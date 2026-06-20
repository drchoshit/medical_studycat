import { createReadStream, existsSync, statSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';
import { Readable } from 'node:stream';

const root = resolve('dist');
const port = Number(process.env.PORT || 3000);
const dataDir = resolve(process.env.APP_DATA_DIR || 'data');
const appStatePath = join(dataDir, 'app-state.json');
const staleStudentMs = Number(process.env.STUDENT_STALE_MS || 90_000);
const appAdminToken = process.env.APP_ADMIN_TOKEN || '';

const proxyTargets = {
  '/medischedule-api': process.env.MEDISCHEDULE_API_BASE || 'https://medischedule.kr/api',
  '/mentoring-api': process.env.MENTORING_API_BASE || 'https://mentoring-api-6l1a.onrender.com',
  '/penalty-api': process.env.MEDIPENALTY_API_BASE || 'https://medipenalty.kr/api',
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
  '.webp': 'image/webp',
};

let appState = {
  students: {},
  messages: [],
  settings: {},
  pushTokens: {},
  updatedAt: new Date().toISOString(),
};
let writeInFlight = false;
let writeQueued = false;
const realtimeClients = new Set();

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

async function loadAppState() {
  try {
    await mkdir(dataDir, { recursive: true });
    const raw = await readFile(appStatePath, 'utf8');
    const parsed = JSON.parse(raw);
    appState = {
      students: parsed.students && typeof parsed.students === 'object' ? parsed.students : {},
      messages: Array.isArray(parsed.messages) ? parsed.messages : [],
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

function publicStudent(row) {
  const lastSeenAt = row.lastSeenAt || row.updatedAt || new Date(0).toISOString();
  const stale = Date.now() - Date.parse(lastSeenAt) > staleStudentMs;
  return {
    id: row.id,
    name: row.name,
    studentPhone: row.studentPhone,
    parentPhone: row.parentPhone,
    status: stale ? 'offline' : normalizeStatus(row.status),
    todayMinutes: Number.isFinite(Number(row.todayMinutes)) ? Math.max(0, Math.floor(Number(row.todayMinutes))) : 0,
    subject: row.subject || '',
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

  if (url.pathname === '/app-api/snapshot' && req.method === 'GET') {
    if (url.searchParams.get('role') === 'admin' && !requireAdmin(req, res, url)) return;
    sendJson(res, 200, snapshotFor({
      role: url.searchParams.get('role') === 'admin' ? 'admin' : 'user',
      studentId: normalizeText(url.searchParams.get('studentId')),
    }));
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
    const next = {
      ...previous,
      id,
      name: normalizeText(body.studentName || body.name, previous.name || id),
      studentPhone: normalizeText(body.studentPhone, previous.studentPhone),
      parentPhone: normalizeText(body.parentPhone, previous.parentPhone),
      status: normalizeStatus(body.status),
      todayMinutes: Number.isFinite(Number(body.todayMinutes)) ? Math.max(0, Math.floor(Number(body.todayMinutes))) : Number(previous.todayMinutes || 0),
      subject: normalizeText(body.subject, previous.subject),
      running: Boolean(body.running),
      lastSeenAt: now,
      updatedAt: now,
    };
    appState.students[id] = next;
    touchState();
    broadcastRealtime();
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
    broadcastRealtime();
    sendJson(res, 201, { message: publicMessage(message) });
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
    broadcastRealtime();
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
      updatedAt: new Date().toISOString(),
    };
    touchState();
    broadcastRealtime();
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
  const path = req.url.slice(prefix.length) || '/';
  const target = new URL(`${targetBase.replace(/\/$/, '')}${path}`);
  const headers = { ...req.headers, host: target.host };
  delete headers.connection;

  try {
    const upstream = await fetch(target, {
      method: req.method,
      headers,
      body: ['GET', 'HEAD'].includes(req.method) ? undefined : Readable.toWeb(req),
      duplex: 'half',
      redirect: 'manual',
    });

    res.writeHead(upstream.status, Object.fromEntries(upstream.headers.entries()));
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
