import { createReadStream, existsSync, statSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { scryptSync, timingSafeEqual } from 'node:crypto';
import { extname, join, normalize, resolve } from 'node:path';
import { Readable } from 'node:stream';

const root = resolve('dist');
const port = Number(process.env.PORT || 3000);
const dataDir = resolve(process.env.APP_DATA_DIR || 'data');
const appStatePath = join(dataDir, 'app-state.json');
const studentAccountsPath = resolve(process.env.APP_STUDENT_ACCOUNTS_FILE || join(dataDir, 'student-accounts.json'));
const staleStudentMs = Number(process.env.STUDENT_STALE_MS || 90_000);
const appAdminToken = process.env.APP_ADMIN_TOKEN || '';
const appParentToken = process.env.APP_PARENT_TOKEN || '';

const proxyTargets = {
  '/medischedule-api': process.env.MEDISCHEDULE_API_BASE || 'https://www.medischedule.kr/api',
  '/mentoring-api': process.env.MENTORING_API_BASE || 'https://mentoring-api-6l1a.onrender.com',
  '/mediweekly-api': process.env.MEDIWEEKLY_API_BASE || 'https://www.mediweekly.kr/api',
  '/penalty-api': process.env.MEDIPENALTY_API_BASE || 'https://www.medipenalty.kr/api',
};

const proxyTokens = {
  '/medischedule-api': process.env.MEDISCHEDULE_TOKEN || '',
  '/mentoring-api': process.env.MENTORING_TOKEN || '',
  '/mediweekly-api': process.env.MEDIWEEKLY_TOKEN || '',
  '/penalty-api': process.env.MEDIPENALTY_TOKEN || '',
};

const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.webp': 'image/webp',
};

let appState = {
  students: {},
  familyReports: {},
  messages: [],
  rewardOrders: [],
  settings: {},
  pushTokens: {},
  updatedAt: new Date().toISOString(),
};
let writeInFlight = false;
let writeQueued = false;
const realtimeClients = new Set();
const familyClients = new Set();

function corsHeaders(headers = {}) {
  return {
    'access-control-allow-origin': process.env.APP_CORS_ORIGIN || '*',
    'access-control-allow-methods': 'GET,POST,PUT,OPTIONS',
    'access-control-allow-headers': 'content-type,authorization',
    ...headers,
  };
}

function send(res, status, body, headers = {}) {
  res.writeHead(status, headers);
  res.end(body);
}

function sendJson(res, status, payload, headers = {}) {
  send(res, status, JSON.stringify(payload), corsHeaders({ 'content-type': 'application/json; charset=utf-8', ...headers }));
}

function isAdminAuthorized(req, url) {
  if (!appAdminToken) return true;
  const authorization = req.headers.authorization || '';
  const headerToken = Array.isArray(authorization) ? authorization[0] : authorization;
  const queryToken = url.searchParams.get('adminToken') || '';
  return headerToken === `Bearer ${appAdminToken}` || queryToken === appAdminToken;
}

function requireAdmin(req, res, url) {
  if (isAdminAuthorized(req, url)) return true;
  sendJson(res, 401, { error: 'Admin token required' });
  return false;
}

function isParentAuthorized(req, url) {
  if (!appParentToken) return true;
  const authorization = req.headers.authorization || '';
  const headerToken = Array.isArray(authorization) ? authorization[0] : authorization;
  const queryToken = url.searchParams.get('parentToken') || '';
  return headerToken === `Bearer ${appParentToken}` || queryToken === appParentToken;
}

function requireParent(req, res, url) {
  if (isParentAuthorized(req, url)) return true;
  sendJson(res, 401, { error: 'Parent token required' });
  return false;
}

async function loadAppState() {
  try {
    await mkdir(dataDir, { recursive: true });
    const raw = await readFile(appStatePath, 'utf8');
    const parsed = JSON.parse(raw);
    appState = {
      students: parsed.students && typeof parsed.students === 'object' ? parsed.students : {},
      familyReports: parsed.familyReports && typeof parsed.familyReports === 'object' ? parsed.familyReports : {},
      messages: Array.isArray(parsed.messages) ? parsed.messages : [],
      rewardOrders: Array.isArray(parsed.rewardOrders) ? parsed.rewardOrders : [],
      settings: parsed.settings && typeof parsed.settings === 'object' ? parsed.settings : {},
      pushTokens: parsed.pushTokens && typeof parsed.pushTokens === 'object' ? parsed.pushTokens : {},
      updatedAt: parsed.updatedAt || new Date().toISOString(),
    };
  } catch (error) {
    if (error?.code !== 'ENOENT') console.warn('Failed to load app state:', error);
    await persistAppState();
  }
}

async function persistAppState() {
  if (writeInFlight) {
    writeQueued = true;
    return;
  }
  writeInFlight = true;
  try {
    await mkdir(dataDir, { recursive: true });
    await writeFile(appStatePath, JSON.stringify(appState, null, 2), 'utf8');
  } finally {
    writeInFlight = false;
    if (writeQueued) {
      writeQueued = false;
      void persistAppState();
    }
  }
}

function touchState() {
  appState.updatedAt = new Date().toISOString();
  void persistAppState();
}

function normalizeStatus(value) {
  return ['studying', 'break', 'offline'].includes(value) ? value : 'offline';
}

function seoulDateKey(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function normalizeStudyDate(value) {
  const text = normalizeText(value);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : seoulDateKey();
}

function publicStudent(row) {
  const today = seoulDateKey();
  const sessions = Object.values(row.sessions && typeof row.sessions === 'object' ? row.sessions : {})
    .filter((session) => session && typeof session === 'object')
    .filter((session) => normalizeStudyDate(session.studyDate) === today)
    .filter((session) => Date.now() - Date.parse(session.lastSeenAt || session.updatedAt || 0) <= staleStudentMs);
  const statusPriority = { studying: 3, break: 2, offline: 1 };
  const selectedSession = [...sessions].sort((a, b) => {
    const priorityDiff = statusPriority[normalizeStatus(b.status)] - statusPriority[normalizeStatus(a.status)];
    if (priorityDiff) return priorityDiff;
    return String(b.lastSeenAt || b.updatedAt || '').localeCompare(String(a.lastSeenAt || a.updatedAt || ''));
  })[0];
  const sessionLastSeenAt = sessions
    .map((session) => session.lastSeenAt || session.updatedAt)
    .filter(Boolean)
    .sort()
    .at(-1);
  const lastSeenAt = sessionLastSeenAt || row.lastSeenAt || row.updatedAt || new Date(0).toISOString();
  const stale = !sessions.length && Date.now() - Date.parse(lastSeenAt) > staleStudentMs;
  const rowIsToday = normalizeStudyDate(row.studyDate) === today;
  const todaySeconds = Math.max(
    rowIsToday ? Number(row.todaySeconds || Number(row.todayMinutes || 0) * 60) : 0,
    ...sessions.map((session) => Number(session.todaySeconds || Number(session.todayMinutes || 0) * 60)),
  );
  return {
    id: row.id,
    name: row.name,
    studentPhone: row.studentPhone,
    parentPhone: row.parentPhone,
    status: stale ? 'offline' : normalizeStatus(selectedSession?.status ?? row.status),
    todayMinutes: Number.isFinite(todaySeconds) ? Math.max(0, Math.floor(todaySeconds / 60)) : 0,
    todaySeconds: Number.isFinite(todaySeconds) ? Math.max(0, Math.floor(todaySeconds)) : 0,
    subject: selectedSession?.subject || row.subject || '',
    lastSeenAt,
    updatedAt: row.updatedAt || lastSeenAt,
    stale,
  };
}

function publicStudents() {
  return Object.values(appState.students)
    .map(publicStudent)
    .sort((a, b) => a.name.localeCompare(b.name, 'ko-KR', { numeric: true }));
}

function publicMessage(message) {
  return {
    id: message.id,
    recipientId: message.recipientId,
    recipientName: message.recipientName,
    body: message.body,
    createdAt: message.createdAt,
    dismissedBy: Array.isArray(message.dismissedBy) ? message.dismissedBy : [],
  };
}

function messagesFor(studentId) {
  const messages = appState.messages.map(publicMessage);
  if (!studentId) return messages;
  return messages.filter((message) => message.recipientId === studentId || message.recipientId === 'all');
}

function snapshotFor(client = {}) {
  const studentId = client.studentId;
  return {
    serverTime: new Date().toISOString(),
    students: publicStudents(),
    messages: messagesFor(client.role === 'admin' ? undefined : studentId),
    ...(client.role === 'admin' ? { familyReports: familyReportsFor() } : {}),
    ...(client.role === 'admin' ? { rewardOrders: appState.rewardOrders.slice(0, 200) } : {}),
    rewardSettings: appState.settings.rewardSettings,
    rewardMapVisibility: appState.settings.rewardMapVisibility,
    penaltySettings: appState.settings.penaltySettings,
  };
}

function jsonSafe(value, fallback) {
  if (value === undefined || value === null) return fallback;
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return fallback;
  }
}

function limitedArray(value, max) {
  return Array.isArray(value) ? value.slice(-max).map((item) => jsonSafe(item, null)).filter(Boolean) : [];
}

function numberValue(value, fallback = 0) {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
}

function normalizeFamilyReport(body, id, previous = {}) {
  const profile = body.profile && typeof body.profile === 'object' ? body.profile : {};
  const studySummary = body.studySummary && typeof body.studySummary === 'object' ? body.studySummary : {};
  const attendance = body.attendance && typeof body.attendance === 'object' ? body.attendance : {};
  const rewards = body.rewards && typeof body.rewards === 'object' ? body.rewards : {};
  const analysis = body.analysis && typeof body.analysis === 'object' ? body.analysis : {};
  const penalty = body.penalty && typeof body.penalty === 'object' ? jsonSafe(body.penalty, undefined) : undefined;
  const now = new Date().toISOString();

  return {
    studentId: id,
    studentName: normalizeText(body.studentName || profile.studentName, previous.studentName || id),
    profile: {
      studentId: id,
      studentName: normalizeText(profile.studentName || body.studentName, previous.studentName || id),
      studentPhone: normalizeText(profile.studentPhone, previous.profile?.studentPhone),
      parentPhone: normalizeText(profile.parentPhone, previous.profile?.parentPhone),
    },
    studySummary: {
      today: Math.max(0, Math.floor(numberValue(studySummary.today, previous.studySummary?.today))),
      week: Math.max(0, Math.floor(numberValue(studySummary.week, previous.studySummary?.week))),
      month: Math.max(0, Math.floor(numberValue(studySummary.month, previous.studySummary?.month))),
      custom: Math.max(0, Math.floor(numberValue(studySummary.custom, previous.studySummary?.custom))),
      streak: Math.max(0, Math.floor(numberValue(studySummary.streak, previous.studySummary?.streak))),
      goal: Math.max(0, Math.floor(numberValue(studySummary.goal, previous.studySummary?.goal ?? 720))),
    },
    subjectStudy: limitedArray(body.subjectStudy, 40),
    weeklyLearning: limitedArray(body.weeklyLearning, 21),
    schedules: limitedArray(body.schedules, 150),
    tasks: limitedArray(body.tasks, 300),
    studyBlocks: limitedArray(body.studyBlocks, 1000),
    attendance: {
      status: normalizeText(attendance.status, previous.attendance?.status || 'offline'),
      checkIn: normalizeText(attendance.checkIn, previous.attendance?.checkIn || '-'),
      checkOut: normalizeText(attendance.checkOut, previous.attendance?.checkOut || '-'),
      seat: normalizeText(attendance.seat, previous.attendance?.seat),
      timeline: limitedArray(attendance.timeline, 100),
    },
    rewards: {
      fruits: Math.max(0, Math.floor(numberValue(rewards.fruits, previous.rewards?.fruits))),
      rewardPurchases: limitedArray(rewards.rewardPurchases, 200),
      attendanceDates: limitedArray(rewards.attendanceDates, 500),
      claimedAttendanceRewards: limitedArray(rewards.claimedAttendanceRewards, 100),
      claimedStageRewards: limitedArray(rewards.claimedStageRewards, 500),
      rewardSettings: jsonSafe(rewards.rewardSettings, previous.rewards?.rewardSettings),
      rewardMapVisibility: jsonSafe(rewards.rewardMapVisibility, previous.rewards?.rewardMapVisibility),
    },
    ...(penalty ? { penalty } : previous.penalty ? { penalty: previous.penalty } : {}),
    analysis: {
      completionRate: Math.max(0, Math.min(100, Math.floor(numberValue(analysis.completionRate, previous.analysis?.completionRate)))),
      completedTasks: Math.max(0, Math.floor(numberValue(analysis.completedTasks, previous.analysis?.completedTasks))),
      totalTasks: Math.max(0, Math.floor(numberValue(analysis.totalTasks, previous.analysis?.totalTasks))),
      focusScore: Math.max(0, Math.min(100, Math.floor(numberValue(analysis.focusScore, previous.analysis?.focusScore)))),
      activeSubjectCount: Math.max(0, Math.floor(numberValue(analysis.activeSubjectCount, previous.analysis?.activeSubjectCount))),
    },
    updatedAt: normalizeText(body.updatedAt, now),
    receivedAt: now,
  };
}

function publicFamilyReport(report) {
  if (!report) return null;
  return jsonSafe(report, null);
}

function familyReportsFor(studentId) {
  const reports = Object.values(appState.familyReports).map(publicFamilyReport).filter(Boolean);
  if (!studentId) return reports.sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')));
  return reports.filter((report) => report.studentId === studentId);
}

function familySnapshotFor(client = {}) {
  const studentId = normalizeText(client.studentId);
  const reports = familyReportsFor(studentId);
  return {
    serverTime: new Date().toISOString(),
    students: studentId ? publicStudents().filter((student) => student.id === studentId) : publicStudents(),
    reports,
    report: reports[0] ?? null,
    rewardSettings: appState.settings.rewardSettings,
    rewardMapVisibility: appState.settings.rewardMapVisibility,
  };
}

function sendSse(client, payload) {
  try {
    client.res.write(`data: ${JSON.stringify(payload)}\n\n`);
  } catch {
    realtimeClients.delete(client);
  }
}

function broadcastRealtime() {
  for (const client of realtimeClients) sendSse(client, snapshotFor(client));
}

function broadcastFamily() {
  for (const client of familyClients) sendSse(client, familySnapshotFor(client));
}

function broadcastAll() {
  broadcastRealtime();
  broadcastFamily();
}

async function readJsonBody(req, limitBytes = 1_000_000) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limitBytes) throw new Error('Request body too large');
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function normalizeText(value, fallback = '') {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function extractRows(payload) {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== 'object') return [];
  const candidates = [
    payload.users,
    payload.students,
    payload.data,
    payload.items,
    payload.rows,
    payload.list,
  ];
  return candidates.find(Array.isArray) || [];
}

function normalizeLoginKey(value) {
  return String(value ?? '').trim().toLowerCase().replace(/\s+/g, '');
}

function normalizeActive(value) {
  if (value === undefined || value === null || value === '') return true;
  if (typeof value === 'boolean') return value;
  const text = String(value).trim().toLowerCase();
  return !['0', 'false', 'off', 'inactive', 'disabled'].includes(text);
}

function publicMentorStudentUser(row) {
  const username = normalizeText(row.username ?? row.external_id ?? row.externalId ?? row.studentId ?? row.student_id ?? row.id);
  const id = normalizeText(row.external_id ?? row.externalId ?? row.username ?? row.studentId ?? row.student_id ?? row.id);
  const name = normalizeText(row.student_name ?? row.studentName ?? row.name ?? row.display_name, username || id);
  return {
    id,
    username,
    name,
    active: normalizeActive(row.is_active ?? row.isActive ?? row.active),
  };
}

function normalizeMentorStudentUsers(rows) {
  return rows
    .map((raw) => {
      const row = raw && typeof raw === 'object' ? raw : {};
      return {
        ...publicMentorStudentUser(row),
        password: normalizeText(row.password ?? row.plain_password ?? row.parent_password),
      };
    })
    .filter((row) => row.id && row.username);
}

async function readLocalStudentUsers() {
  try {
    const payload = JSON.parse(await readFile(studentAccountsPath, 'utf8'));
    return extractRows(payload)
      .map((raw) => {
        const row = raw && typeof raw === 'object' ? raw : {};
        return {
          ...publicMentorStudentUser(row),
          passwordHash: normalizeText(row.passwordHash ?? row.password_hash),
        };
      })
      .filter((row) => row.id && row.username && row.passwordHash);
  } catch (error) {
    if (error?.code === 'ENOENT') return [];
    console.error(`Failed to read local student accounts from ${studentAccountsPath}:`, error);
    return [];
  }
}

function verifyPasswordHash(password, encodedHash) {
  const [scheme, salt, expectedHex] = normalizeText(encodedHash).split('$');
  if (scheme !== 'scrypt' || !salt || !/^[a-f0-9]+$/i.test(expectedHex || '')) return false;
  try {
    const expected = Buffer.from(expectedHex, 'hex');
    const actual = scryptSync(password, salt, expected.length);
    return expected.length > 0 && timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

async function verifyLocalStudentLogin(loginId, password) {
  const users = await readLocalStudentUsers();
  const student = users.find((row) => normalizeLoginKey(row.username) === normalizeLoginKey(loginId) || normalizeLoginKey(row.id) === normalizeLoginKey(loginId));
  if (!student) return null;
  if (!student.active) {
    const error = new Error('비활성화된 학생 계정입니다.');
    error.statusCode = 401;
    throw error;
  }
  if (!verifyPasswordHash(password, student.passwordHash)) {
    const error = new Error('학생 비밀번호가 맞지 않습니다.');
    error.statusCode = 401;
    throw error;
  }
  return publicMentorStudentUser(student);
}

async function fetchMentorStudentUsers() {
  const token = proxyTokens['/mentoring-api'];
  if (!token) {
    const error = new Error('MENTORING_TOKEN is required for medimentors student login sync');
    error.statusCode = 503;
    throw error;
  }
  const target = new URL(`${proxyTargets['/mentoring-api'].replace(/\/$/, '')}/api/users/parents?_t=${Date.now()}`);
  const upstream = await fetch(target, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  });
  const text = await upstream.text();
  const payload = text ? JSON.parse(text) : null;
  if (!upstream.ok) {
    const error = new Error(payload?.error || payload?.message || `medimentors HTTP ${upstream.status}`);
    error.statusCode = upstream.status === 401 || upstream.status === 403 ? 503 : upstream.status;
    throw error;
  }
  return normalizeMentorStudentUsers(extractRows(payload));
}

async function authenticateMentorStudentLogin(loginId, password) {
  const target = new URL(`${proxyTargets['/mentoring-api'].replace(/\/$/, '')}/api/auth/login`);
  const upstream = await fetch(target, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: loginId, password }),
  });
  const text = await upstream.text();
  let payload = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = null;
  }
  if (!upstream.ok) {
    const error = new Error(payload?.error || payload?.message || (upstream.status === 401 ? '학생 ID 또는 비밀번호가 맞지 않습니다.' : `medimentors HTTP ${upstream.status}`));
    error.statusCode = upstream.status;
    throw error;
  }
  const token = normalizeText(payload?.token);
  if (!token) {
    const error = new Error('Medimentors 로그인 토큰을 받지 못했습니다.');
    error.statusCode = 502;
    throw error;
  }
  const user = payload?.user && typeof payload.user === 'object'
    ? payload.user
    : { username: loginId, external_id: loginId, name: loginId };
  const student = publicMentorStudentUser({
    ...user,
    username: user.username ?? loginId,
    external_id: user.external_id ?? loginId,
  });
  if (!student.active) {
    const error = new Error('비활성화된 학생 계정입니다.');
    error.statusCode = 401;
    throw error;
  }
  return { student, token };
}

async function verifyMentorStudentLogin(loginId, password) {
  const cleanId = normalizeText(loginId);
  const cleanPassword = normalizeText(password);
  if (!cleanId || !cleanPassword) {
    const error = new Error('학생 ID와 비밀번호를 입력하세요.');
    error.statusCode = 400;
    throw error;
  }
  const localStudent = await verifyLocalStudentLogin(cleanId, cleanPassword);
  if (localStudent) return { student: localStudent, token: '' };
  return authenticateMentorStudentLogin(cleanId, cleanPassword);
}

function handleRealtimeEvents(req, res, url) {
  const client = {
    res,
    role: url.searchParams.get('role') === 'admin' ? 'admin' : 'user',
    studentId: normalizeText(url.searchParams.get('studentId')),
  };
  res.writeHead(200, corsHeaders({
    'content-type': 'text/event-stream; charset=utf-8',
    'cache-control': 'no-cache, no-transform',
    connection: 'keep-alive',
  }));
  res.write(': connected\n\n');
  realtimeClients.add(client);
  sendSse(client, snapshotFor(client));

  const heartbeat = setInterval(() => {
    try {
      res.write(': heartbeat\n\n');
    } catch {
      clearInterval(heartbeat);
      realtimeClients.delete(client);
    }
  }, 25_000);

  req.on('close', () => {
    clearInterval(heartbeat);
    realtimeClients.delete(client);
  });
}

function handleFamilyEvents(req, res, url) {
  const client = {
    res,
    studentId: normalizeText(url.searchParams.get('studentId')),
  };
  res.writeHead(200, corsHeaders({
    'content-type': 'text/event-stream; charset=utf-8',
    'cache-control': 'no-cache, no-transform',
    connection: 'keep-alive',
  }));
  res.write(': connected\n\n');
  familyClients.add(client);
  sendSse(client, familySnapshotFor(client));

  const heartbeat = setInterval(() => {
    try {
      res.write(': heartbeat\n\n');
    } catch {
      clearInterval(heartbeat);
      familyClients.delete(client);
    }
  }, 25_000);

  req.on('close', () => {
    clearInterval(heartbeat);
    familyClients.delete(client);
  });
}

async function handleAppApi(req, res, url) {
  if (req.method === 'OPTIONS') {
    send(res, 204, '', corsHeaders());
    return;
  }

  if (url.pathname === '/app-api/events' && req.method === 'GET') {
    if (url.searchParams.get('role') === 'admin' && !requireAdmin(req, res, url)) return;
    handleRealtimeEvents(req, res, url);
    return;
  }

  if (url.pathname === '/app-api/health' && req.method === 'GET') {
    sendJson(res, 200, { ok: true, serverTime: new Date().toISOString() });
    return;
  }

  if (url.pathname === '/app-api/admin/verify' && req.method === 'POST') {
    if (!appAdminToken) {
      sendJson(res, 503, { error: 'APP_ADMIN_TOKEN is required for tablet unlock' });
      return;
    }
    if (!requireAdmin(req, res, url)) return;
    sendJson(res, 200, { ok: true, serverTime: new Date().toISOString() });
    return;
  }

  if (url.pathname === '/app-api/student-login/verify' && req.method === 'POST') {
    const body = await readJsonBody(req, 20_000);
    try {
      const result = await verifyMentorStudentLogin(body.loginId || body.id || body.username, body.password);
      sendJson(res, 200, {
        student: result.student,
        mentoringToken: result.token || undefined,
        source: result.token ? 'medimentors 계정 직접 인증' : '로컬 학생 계정',
      });
    } catch (error) {
      sendJson(res, error.statusCode || 500, { error: error instanceof Error ? error.message : String(error), source: 'medimentors 계정 인증 필요' });
    }
    return;
  }

  if (url.pathname === '/app-api/snapshot' && req.method === 'GET') {
    if (url.searchParams.get('role') === 'admin' && !requireAdmin(req, res, url)) return;
    sendJson(res, 200, snapshotFor({
      role: url.searchParams.get('role') === 'admin' ? 'admin' : 'user',
      studentId: normalizeText(url.searchParams.get('studentId')),
    }));
    return;
  }

  if (url.pathname === '/app-api/family/events' && req.method === 'GET') {
    if (!requireParent(req, res, url)) return;
    handleFamilyEvents(req, res, url);
    return;
  }

  if (url.pathname === '/app-api/family/snapshot' && req.method === 'GET') {
    if (!requireParent(req, res, url)) return;
    sendJson(res, 200, familySnapshotFor({
      studentId: normalizeText(url.searchParams.get('studentId')),
    }));
    return;
  }

  if (url.pathname === '/app-api/family/report' && req.method === 'POST') {
    const body = await readJsonBody(req);
    const id = normalizeText(body.studentId || body.profile?.studentId || body.id);
    if (!id) {
      sendJson(res, 400, { error: 'studentId is required' });
      return;
    }
    const previous = appState.familyReports[id] || {};
    const report = normalizeFamilyReport(body, id, previous);
    appState.familyReports[id] = report;

    const existingStudent = appState.students[id] || {};
    appState.students[id] = {
      ...existingStudent,
      id,
      name: report.studentName,
      studentPhone: report.profile.studentPhone || existingStudent.studentPhone,
      parentPhone: report.profile.parentPhone || existingStudent.parentPhone,
      todayMinutes: report.studySummary.today,
      subject: report.subjectStudy[0]?.subject || existingStudent.subject || '',
      status: existingStudent.status || 'offline',
      updatedAt: report.updatedAt,
      lastSeenAt: existingStudent.lastSeenAt || report.updatedAt,
    };

    touchState();
    broadcastAll();
    sendJson(res, 200, { report: publicFamilyReport(report), serverTime: new Date().toISOString() });
    return;
  }

  if (url.pathname === '/app-api/students' && req.method === 'GET') {
    sendJson(res, 200, { students: publicStudents(), serverTime: new Date().toISOString() });
    return;
  }

  if (url.pathname === '/app-api/students/status' && req.method === 'POST') {
    const body = await readJsonBody(req);
    const id = normalizeText(body.studentId || body.id);
    if (!id) {
      sendJson(res, 400, { error: 'studentId is required' });
      return;
    }
    const now = new Date().toISOString();
    const previous = appState.students[id] || {};
    const sessionId = normalizeText(body.sessionId, 'legacy').slice(0, 120);
    const studyDate = normalizeStudyDate(body.studyDate);
    const previousSessions = previous.sessions && typeof previous.sessions === 'object' ? previous.sessions : {};
    const sessions = Object.fromEntries(
      Object.entries(previousSessions)
        .filter(([, session]) => session && typeof session === 'object')
        .filter(([, session]) => Date.now() - Date.parse(session.lastSeenAt || session.updatedAt || 0) <= Math.max(staleStudentMs * 4, 10 * 60_000))
        .slice(-24),
    );
    const previousSession = sessions[sessionId] || {};
    const incomingStatus = normalizeStatus(body.status);
    const keepLegacyStudyState = sessionId === 'legacy'
      && normalizeStatus(previousSession.status) === 'studying'
      && incomingStatus === 'offline'
      && Date.now() - Date.parse(previousSession.lastSeenAt || 0) <= staleStudentMs;
    const incomingTodaySeconds = Number.isFinite(Number(body.todaySeconds))
      ? Math.max(0, Math.floor(Number(body.todaySeconds)))
      : Math.max(0, Math.floor(Number(body.todayMinutes || 0) * 60));
    const session = {
      ...previousSession,
      sessionId,
      status: keepLegacyStudyState ? 'studying' : incomingStatus,
      todayMinutes: Number.isFinite(Number(body.todayMinutes)) ? Math.max(0, Math.floor(Number(body.todayMinutes))) : 0,
      todaySeconds: normalizeStudyDate(previousSession.studyDate) === studyDate
        ? Math.max(Number(previousSession.todaySeconds || 0), incomingTodaySeconds)
        : incomingTodaySeconds,
      subject: keepLegacyStudyState ? previousSession.subject : normalizeText(body.subject, previous.subject),
      running: keepLegacyStudyState ? true : Boolean(body.running),
      studyDate,
      lastSeenAt: now,
      updatedAt: now,
    };
    sessions[sessionId] = session;
    const next = {
      ...previous,
      id,
      name: normalizeText(body.studentName || body.name, previous.name || id),
      studentPhone: normalizeText(body.studentPhone, previous.studentPhone),
      parentPhone: normalizeText(body.parentPhone, previous.parentPhone),
      status: normalizeStatus(body.status),
      todayMinutes: Number.isFinite(Number(body.todayMinutes)) ? Math.max(0, Math.floor(Number(body.todayMinutes))) : Number(previous.todayMinutes || 0),
      todaySeconds: session.todaySeconds,
      subject: normalizeText(body.subject, previous.subject),
      running: Boolean(body.running),
      studyDate,
      sessions,
      lastSeenAt: now,
      updatedAt: now,
    };
    appState.students[id] = next;
    touchState();
    broadcastAll();
    sendJson(res, 200, { student: publicStudent(next) });
    return;
  }

  if (url.pathname === '/app-api/messages' && req.method === 'GET') {
    const studentId = normalizeText(url.searchParams.get('studentId'));
    if (!studentId && !requireAdmin(req, res, url)) return;
    sendJson(res, 200, { messages: messagesFor(studentId) });
    return;
  }

  if (url.pathname === '/app-api/messages' && req.method === 'POST') {
    if (!requireAdmin(req, res, url)) return;
    const body = await readJsonBody(req);
    const recipientId = normalizeText(body.recipientId);
    const bodyText = normalizeText(body.body);
    if (!recipientId || !bodyText) {
      sendJson(res, 400, { error: 'recipientId and body are required' });
      return;
    }
    const message = {
      id: `message-${Date.now()}-${Math.round(Math.random() * 1_000_000)}`,
      recipientId,
      recipientName: normalizeText(body.recipientName, recipientId),
      body: bodyText.slice(0, 1000),
      createdAt: new Date().toISOString(),
      dismissedBy: [],
    };
    appState.messages = [message, ...appState.messages].slice(0, 500);
    touchState();
    broadcastAll();
    sendJson(res, 201, { message: publicMessage(message) });
    return;
  }

  if (url.pathname === '/app-api/reward-orders' && req.method === 'POST') {
    const body = await readJsonBody(req);
    const studentId = normalizeText(body.studentId);
    const studentName = normalizeText(body.studentName, studentId);
    const itemId = normalizeText(body.itemId);
    const itemName = normalizeText(body.itemName);
    const starCost = Math.max(0, Math.floor(numberValue(body.starCost)));
    if (!studentId || !itemId || !itemName) {
      sendJson(res, 400, { error: 'studentId, itemId and itemName are required' });
      return;
    }
    const order = {
      id: `reward-order-${Date.now()}-${Math.round(Math.random() * 1_000_000)}`,
      studentId,
      studentName,
      itemId,
      itemName: itemName.slice(0, 200),
      starCost,
      createdAt: new Date().toISOString(),
      status: 'pending',
    };
    appState.rewardOrders = [order, ...appState.rewardOrders].slice(0, 500);
    touchState();
    broadcastAll();
    sendJson(res, 201, { order });
    return;
  }

  const rewardOrderAckMatch = url.pathname.match(/^\/app-api\/reward-orders\/([^/]+)\/acknowledge$/);
  if (rewardOrderAckMatch && req.method === 'POST') {
    if (!requireAdmin(req, res, url)) return;
    const orderId = decodeURIComponent(rewardOrderAckMatch[1]);
    const order = appState.rewardOrders.find((item) => item.id === orderId);
    if (!order) {
      sendJson(res, 404, { error: 'Reward order not found' });
      return;
    }
    order.status = 'acknowledged';
    order.acknowledgedAt = new Date().toISOString();
    touchState();
    broadcastAll();
    sendJson(res, 200, { order });
    return;
  }

  const dismissMatch = url.pathname.match(/^\/app-api\/messages\/([^/]+)\/dismiss$/);
  if (dismissMatch && req.method === 'POST') {
    const body = await readJsonBody(req);
    const messageId = decodeURIComponent(dismissMatch[1]);
    const studentId = normalizeText(body.studentId || url.searchParams.get('studentId'));
    const message = appState.messages.find((item) => item.id === messageId);
    if (!message) {
      sendJson(res, 404, { error: 'Message not found' });
      return;
    }
    if (studentId) {
      const dismissedBy = new Set(Array.isArray(message.dismissedBy) ? message.dismissedBy : []);
      dismissedBy.add(studentId);
      message.dismissedBy = [...dismissedBy];
    }
    touchState();
    broadcastAll();
    sendJson(res, 200, { message: publicMessage(message) });
    return;
  }

  if (url.pathname === '/app-api/settings' && req.method === 'GET') {
    sendJson(res, 200, appState.settings);
    return;
  }

  if (url.pathname === '/app-api/settings' && req.method === 'PUT') {
    if (!requireAdmin(req, res, url)) return;
    const body = await readJsonBody(req);
    appState.settings = {
      ...appState.settings,
      ...(body.rewardSettings ? { rewardSettings: body.rewardSettings } : {}),
      ...(body.rewardMapVisibility ? { rewardMapVisibility: body.rewardMapVisibility } : {}),
      ...(body.penaltySettings ? { penaltySettings: body.penaltySettings } : {}),
      updatedAt: new Date().toISOString(),
    };
    touchState();
    broadcastAll();
    sendJson(res, 200, appState.settings);
    return;
  }

  if (url.pathname === '/app-api/push-token' && req.method === 'POST') {
    const body = await readJsonBody(req);
    const studentId = normalizeText(body.studentId);
    const token = normalizeText(body.token);
    if (!studentId || !token) {
      sendJson(res, 400, { error: 'studentId and token are required' });
      return;
    }
    appState.pushTokens[studentId] = {
      token,
      platform: normalizeText(body.platform, 'unknown'),
      updatedAt: new Date().toISOString(),
    };
    touchState();
    sendJson(res, 200, { ok: true });
    return;
  }

  sendJson(res, 404, { error: 'Not found' });
}

async function proxyRequest(req, res, prefix, targetBase) {
  if (req.method === 'OPTIONS') {
    send(res, 204, '', corsHeaders());
    return;
  }

  const path = req.url.slice(prefix.length) || '/';
  const target = new URL(`${targetBase.replace(/\/$/, '')}${path}`);
  const headers = { ...req.headers, host: target.host };
  delete headers.connection;
  const isMentoringLogin = prefix === '/mentoring-api' && target.pathname.endsWith('/api/auth/login');
  if (isMentoringLogin && req.method === 'POST') {
    try {
      const body = await readJsonBody(req, 20_000);
      const upstream = await fetch(target, {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          username: normalizeText(body.username),
          password: String(body.password ?? ''),
        }),
      });
      const text = await upstream.text();
      send(
        res,
        upstream.status,
        text,
        corsHeaders({ 'content-type': upstream.headers.get('content-type') || 'application/json; charset=utf-8' }),
      );
    } catch (error) {
      sendJson(res, 502, { error: 'Medimentors login proxy failed', detail: error instanceof Error ? error.message : String(error) });
    }
    return;
  }
  if (prefix === '/mentoring-api' && path.startsWith('/api/users/parents') && !headers.authorization) {
    send(
      res,
      403,
      JSON.stringify({ error: 'Use /app-api/student-login/verify for student credential checks' }),
      corsHeaders({ 'content-type': 'application/json; charset=utf-8' }),
    );
    return;
  }
  // A current client credential must be allowed to override a stale deployment
  // credential. Fall back to the server token only when the client sent none.
  if (!isMentoringLogin && !headers.authorization && proxyTokens[prefix]) {
    headers.authorization = `Bearer ${proxyTokens[prefix]}`;
  }

  try {
    const upstream = await fetch(target, {
      method: req.method,
      headers,
      body: ['GET', 'HEAD'].includes(req.method) ? undefined : Readable.toWeb(req),
      duplex: 'half',
      redirect: 'manual',
    });

    const responseHeaders = {
      ...Object.fromEntries(upstream.headers.entries()),
      ...corsHeaders(),
    };
    // Node fetch transparently decompresses upstream bodies. Forwarding the
    // original encoded length makes clients truncate JSON before it completes.
    delete responseHeaders['content-length'];
    delete responseHeaders['content-encoding'];
    delete responseHeaders['transfer-encoding'];
    res.writeHead(upstream.status, responseHeaders);
    if (upstream.body) {
      Readable.fromWeb(upstream.body).pipe(res);
    } else {
      res.end();
    }
  } catch (error) {
    send(
      res,
      502,
      JSON.stringify({ error: 'Proxy request failed', detail: error instanceof Error ? error.message : String(error) }),
      { 'content-type': 'application/json; charset=utf-8' },
    );
  }
}

function serveStatic(req, res) {
  const urlPath = decodeURIComponent(new URL(req.url, `http://${req.headers.host}`).pathname);
  const requested = normalize(urlPath).replace(/^(\.\.[/\\])+/, '');
  let filePath = resolve(join(root, requested));

  if (!filePath.startsWith(root)) {
    send(res, 403, 'Forbidden', { 'content-type': 'text/plain; charset=utf-8' });
    return;
  }

  if (!existsSync(filePath) || statSync(filePath).isDirectory()) {
    filePath = join(root, 'index.html');
  }

  const type = mimeTypes[extname(filePath)] || 'application/octet-stream';
  res.writeHead(200, { 'content-type': type });
  createReadStream(filePath).pipe(res);
}

await loadAppState();

createServer((req, res) => {
  const requestUrl = new URL(req.url, `http://${req.headers.host}`);

  if (requestUrl.pathname === '/app-api' || requestUrl.pathname.startsWith('/app-api/')) {
    void handleAppApi(req, res, requestUrl).catch((error) => {
      sendJson(res, 500, { error: error instanceof Error ? error.message : String(error) });
    });
    return;
  }

  const match = Object.entries(proxyTargets).find(([prefix]) => req.url === prefix || req.url.startsWith(`${prefix}/`));
  if (match) {
    void proxyRequest(req, res, match[0], match[1]);
    return;
  }

  serveStatic(req, res);
}).listen(port, '0.0.0.0', () => {
  console.log(`medical-studycat listening on ${port}`);
});
