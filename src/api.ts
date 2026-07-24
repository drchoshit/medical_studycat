import { DEFAULT_SUBJECTS, demoSchedule, todayKey } from './demoData';
import type { AdminMessage, FamilySyncReport, LiveStudentStatus, PenaltySettings, PenaltySummary, RealtimeSnapshot, RewardOrder, RewardSettings, ScheduleItem, StudentStatus, Subject, Task } from './types';

export const weekDays = ['월', '화', '수', '목', '금', '토', '일'];

const medischeduleBase =
  import.meta.env.VITE_MEDISCHEDULE_API_BASE ||
  import.meta.env.VITE_MEDISCHECHEDULE_API_BASE ||
  '/medischedule-api';

const mentoringBase = import.meta.env.VITE_MENTORING_API_BASE || '/mentoring-api';
const mediweeklyBase = import.meta.env.VITE_MEDIWEEKLY_API_BASE || '/mediweekly-api';
const penaltyBase = import.meta.env.VITE_MEDIPENALTY_API_BASE || '/penalty-api';
const appApiBase = import.meta.env.VITE_APP_API_BASE || '/app-api';

function thisWeekStart(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return todayKey(d);
}

function getStoredToken(keys: string[], envToken?: string) {
  if (envToken) return envToken;
  if (typeof localStorage === 'undefined') return '';
  for (const key of keys) {
    const value = localStorage.getItem(key);
    if (value && value !== 'null' && value !== 'undefined') return value;
  }
  return '';
}

function authHeaders(kind: 'medischedule' | 'mentoring' | 'mediweekly' | 'penalty', contentType = false): HeadersInit {
  const token = (() => {
    if (kind === 'medischedule') {
      return getStoredToken(
        ['medical-study-medischedule-token', 'adminToken', 'studentToken', 'token'],
        import.meta.env.VITE_MEDISCHEDULE_TOKEN || import.meta.env.VITE_MEDISCHECHEDULE_TOKEN,
      );
    }
    if (kind === 'mentoring') {
      return getStoredToken(
        ['medical-study-mentor-token', 'mentorToken', 'token'],
        import.meta.env.VITE_MENTORING_TOKEN,
      );
    }
    if (kind === 'mediweekly') {
      return getStoredToken(
        ['medical-study-mediweekly-token', 'mediweeklyToken', 'token'],
        import.meta.env.VITE_MEDIWEEKLY_TOKEN,
      );
    }
    return getStoredToken(
      ['medical-study-medipenalty-token', 'medipenaltyToken', 'token'],
      import.meta.env.VITE_MEDIPENALTY_TOKEN,
    );
  })();

  return {
    ...(contentType ? { 'Content-Type': 'application/json' } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function fetchJson<T>(url: string, init?: RequestInit, timeoutMs = 4500): Promise<T> {
  const requestUrl = new URL(url, window.location.origin);
  const effectiveTimeoutMs = requestUrl.hostname.endsWith('.onrender.com')
    ? Math.max(timeoutMs, 65_000)
    : timeoutMs;
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), effectiveTimeoutMs);
  try {
    const res = await fetch(url, {
      credentials: 'same-origin',
      ...init,
      signal: init?.signal ?? controller.signal,
    });
    const text = await res.text();
    let json: { error?: string; message?: string } | null = null;
    if (text) {
      try {
        json = JSON.parse(text);
      } catch {
        json = null;
      }
    }
    if (text && json === null) {
      throw new Error(`Expected JSON response from ${requestUrl.pathname}`);
    }
    if (!res.ok) {
      const message = json?.error || json?.message || `HTTP ${res.status}`;
      throw new Error(message);
    }
    return json as T;
  } finally {
    window.clearTimeout(timer);
  }
}

function appApiUrl(path: string, params: Record<string, string | undefined> = {}) {
  const base = appApiBase.replace(/\/$/, '');
  const origin = typeof window === 'undefined' ? 'http://localhost' : window.location.origin;
  const url = new URL(`${base}${path}`, origin);
  Object.entries(params).forEach(([key, value]) => {
    if (value) url.searchParams.set(key, value);
  });
  return base.startsWith('http') ? url.toString() : `${url.pathname}${url.search}`;
}

function getAppAdminToken() {
  return getStoredToken(['medical-study-app-admin-token', 'adminToken', 'token'], import.meta.env.VITE_APP_ADMIN_TOKEN);
}

function appApiHeaders(contentType = false): HeadersInit {
  const token = getAppAdminToken();
  return {
    ...(contentType ? { 'Content-Type': 'application/json' } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export async function verifyAppAdminPassword(password: string): Promise<boolean> {
  const token = password.trim().replace(/^Bearer\s+/i, '');
  if (!token) return false;
  try {
    await fetchJson(
      appApiUrl('/admin/verify'),
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      },
      5000,
    );
    return true;
  } catch {
    return false;
  }
}

function normalizeSnapshot(payload: Partial<RealtimeSnapshot> | null | undefined): RealtimeSnapshot {
  return {
    serverTime: payload?.serverTime || new Date().toISOString(),
    students: Array.isArray(payload?.students) ? payload.students : [],
    messages: Array.isArray(payload?.messages) ? payload.messages : [],
    familyReports: Array.isArray(payload?.familyReports) ? payload.familyReports : [],
    rewardOrders: Array.isArray(payload?.rewardOrders) ? payload.rewardOrders : [],
    rewardSettings: payload?.rewardSettings,
    rewardMapVisibility: payload?.rewardMapVisibility,
    penaltySettings: payload?.penaltySettings,
  };
}

export async function loadRealtimeSnapshot(role: 'admin' | 'user', studentId?: string): Promise<RealtimeSnapshot> {
  try {
    const payload = await fetchJson<Partial<RealtimeSnapshot>>(
      appApiUrl('/snapshot', { role, studentId }),
      { headers: role === 'admin' ? appApiHeaders() : undefined },
      5000,
    );
    return normalizeSnapshot(payload);
  } catch {
    return normalizeSnapshot(null);
  }
}

export async function publishStudentStatus(student: StudentStatus & { running?: boolean }): Promise<LiveStudentStatus | null> {
  try {
    const payload = await fetchJson<{ student?: LiveStudentStatus }>(
      appApiUrl('/students/status'),
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentId: student.id,
          studentName: student.name,
          studentPhone: student.studentPhone,
          parentPhone: student.parentPhone,
          status: student.status,
          todayMinutes: student.todayMinutes,
          subject: student.subject,
          running: student.running,
        }),
      },
      5000,
    );
    return payload.student ?? null;
  } catch {
    return null;
  }
}

export async function publishFamilySync(report: FamilySyncReport): Promise<boolean> {
  try {
    await fetchJson(
      appApiUrl('/family/report'),
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(report),
      },
      7000,
    );
    return true;
  } catch {
    return false;
  }
}

export async function sendRealtimeAdminMessage(student: StudentStatus, body: string): Promise<AdminMessage | null> {
  try {
    const payload = await fetchJson<{ message?: AdminMessage }>(
      appApiUrl('/messages'),
      {
        method: 'POST',
        headers: appApiHeaders(true),
        body: JSON.stringify({
          recipientId: student.id,
          recipientName: student.name,
          body,
        }),
      },
      5000,
    );
    return payload.message ?? null;
  } catch {
    return null;
  }
}

export async function submitRewardOrder(order: {
  studentId: string;
  studentName: string;
  itemId: string;
  itemName: string;
  starCost: number;
}): Promise<RewardOrder | null> {
  try {
    const payload = await fetchJson<{ order?: RewardOrder }>(
      appApiUrl('/reward-orders'),
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(order),
      },
      5000,
    );
    return payload.order ?? null;
  } catch {
    return null;
  }
}

export async function acknowledgeRewardOrder(orderId: string): Promise<boolean> {
  try {
    await fetchJson(
      appApiUrl(`/reward-orders/${encodeURIComponent(orderId)}/acknowledge`),
      {
        method: 'POST',
        headers: appApiHeaders(true),
      },
      5000,
    );
    return true;
  } catch {
    return false;
  }
}

export async function dismissRealtimeAdminMessage(messageId: string, studentId: string): Promise<boolean> {
  try {
    await fetchJson(
      appApiUrl(`/messages/${encodeURIComponent(messageId)}/dismiss`),
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId }),
      },
      5000,
    );
    return true;
  } catch {
    return false;
  }
}

export async function saveRealtimeSettings(settings: { rewardSettings?: RewardSettings; rewardMapVisibility?: Record<string, boolean>; penaltySettings?: PenaltySettings }): Promise<boolean> {
  try {
    await fetchJson(
      appApiUrl('/settings'),
      {
        method: 'PUT',
        headers: appApiHeaders(true),
        body: JSON.stringify(settings),
      },
      5000,
    );
    return true;
  } catch {
    return false;
  }
}

export function subscribeRealtimeSnapshot(
  role: 'admin' | 'user',
  studentId: string | undefined,
  onSnapshot: (snapshot: RealtimeSnapshot) => void,
) {
  if (typeof EventSource === 'undefined') return () => {};
  const source = new EventSource(appApiUrl('/events', { role, studentId, adminToken: role === 'admin' ? getAppAdminToken() : undefined }));
  source.onmessage = (event) => {
    try {
      onSnapshot(normalizeSnapshot(JSON.parse(event.data)));
    } catch {
      // Ignore malformed realtime frames and keep the polling fallback alive.
    }
  };
  return () => source.close();
}

function extractRows(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== 'object') return [];
  const object = payload as Record<string, unknown>;
  const candidates = [object.students, object.schedules, object.tasks, object.users, object.data, object.items, object.rows, object.list];
  return candidates.find(Array.isArray) as unknown[] | undefined ?? [];
}

function normalizeDay(value: unknown) {
  const text = String(value ?? '').trim();
  if (weekDays.includes(text)) return text;
  const map: Record<string, string> = {
    Mon: '월',
    Tue: '화',
    Wed: '수',
    Thu: '목',
    Fri: '금',
    Sat: '토',
    Sun: '일',
    Monday: '월',
    Tuesday: '화',
    Wednesday: '수',
    Thursday: '목',
    Friday: '금',
    Saturday: '토',
    Sunday: '일',
  };
  if (map[text]) return map[text];
  return text.slice(0, 1);
}

function normalizeTime(value: unknown) {
  const text = String(value ?? '').trim();
  return text.includes(':') ? text.slice(0, 5) : text;
}

function normalizeScheduleType(value: unknown): ScheduleItem['type'] {
  const text = String(value ?? '').trim().toLowerCase();
  if (text === '센터' || text === 'center') return 'center';
  if (text === '외부' || text === 'external' || text === '원외') return 'outside';
  return 'self';
}

type RemoteScheduleRow = {
  id?: string | number;
  day?: string;
  start?: string;
  end?: string;
  type?: string;
  description?: string;
  title?: string;
  student_id?: string | number;
  studentId?: string | number;
  week_start?: string;
};

function normalizeSchedule(rows: unknown[], studentId?: string): ScheduleItem[] {
  return rows
    .map((raw, index) => {
      const row = raw && typeof raw === 'object' ? (raw as RemoteScheduleRow) : {};
      const rowStudentId = String(row.student_id ?? row.studentId ?? '').trim();
      if (studentId && rowStudentId && rowStudentId !== studentId) return null;
      const day = normalizeDay(row.day);
      const start = normalizeTime(row.start);
      const end = normalizeTime(row.end);
      if (!day || !start || !end) return null;
      return {
        id: String(row.id ?? `remote-schedule-${studentId ?? 'all'}-${index}`),
        day,
        start,
        end,
        title: String(row.description || row.title || row.type || '일정'),
        type: normalizeScheduleType(row.type),
      };
    })
    .filter(Boolean) as ScheduleItem[];
}

type RemoteStudentRow = {
  id?: string | number;
  external_id?: string | number;
  externalId?: string | number;
  studentId?: string | number;
  customId?: string | number;
  name?: string;
  studentName?: string;
  phone?: string;
  studentPhone?: string;
  student_phone?: string;
  parentPhone?: string;
  parent_phone?: string;
  guardianPhone?: string;
};

export type MedimentorsStudentLogin = {
  id: string;
  username: string;
  name: string;
  active: boolean;
};

type StaticStudentAccount = MedimentorsStudentLogin & {
  aliases?: string[];
  iterations: number;
  salt: string;
  passwordHash: string;
};

const staticStudentAccounts: StaticStudentAccount[] = [
  {
    id: 'qlf258',
    username: 'qlf258',
    aliases: ['qtf258'],
    name: '김도윤',
    active: true,
    iterations: 210_000,
    salt: 'ePfWZK1yzIIG9waZQLt+0g==',
    passwordHash: 'g+L1CDYYwmbPOugRceHQfbSh4PVw5hf0Cscv7wvMJZE=',
  },
];

function normalizeStudentLoginKey(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, '');
}

function decodeBase64(value: string) {
  return Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
}

function equalBytes(left: Uint8Array, right: Uint8Array) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left[index] ^ right[index];
  }
  return difference === 0;
}

async function verifyStaticStudentLogin(loginId: string, password: string): Promise<{
  ok: boolean;
  source: string;
  student?: MedimentorsStudentLogin;
  error?: string;
} | null> {
  const account = staticStudentAccounts.find((candidate) => (
    normalizeStudentLoginKey(candidate.username) === normalizeStudentLoginKey(loginId)
    || normalizeStudentLoginKey(candidate.id) === normalizeStudentLoginKey(loginId)
    || candidate.aliases?.some((alias) => normalizeStudentLoginKey(alias) === normalizeStudentLoginKey(loginId))
  ));
  if (!account) return null;
  if (!account.active) {
    return { ok: false, source: '정적 학생 계정', error: '비활성화된 학생 계정입니다.' };
  }
  if (!globalThis.crypto?.subtle) {
    return { ok: false, source: '정적 학생 계정', error: '이 브라우저에서는 안전한 로그인 검증을 지원하지 않습니다.' };
  }

  const key = await globalThis.crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = await globalThis.crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt: decodeBase64(account.salt),
      iterations: account.iterations,
    },
    key,
    256,
  );
  if (!equalBytes(new Uint8Array(bits), decodeBase64(account.passwordHash))) {
    return { ok: false, source: '정적 학생 계정', error: '학생 비밀번호가 맞지 않습니다.' };
  }

  return {
    ok: true,
    source: '정적 학생 계정',
    student: {
      id: account.id,
      username: account.username,
      name: account.name,
      active: account.active,
    },
  };
}

export async function verifyMedimentorsStudentLogin(loginId: string, password: string): Promise<{
  ok: boolean;
  source: string;
  student?: MedimentorsStudentLogin;
  error?: string;
}> {
  const cleanId = loginId.trim();
  const cleanPassword = password.trim();
  if (!cleanId || !cleanPassword) {
    return { ok: false, source: '입력 필요', error: '학생 ID와 비밀번호를 입력하세요.' };
  }

  const staticResult = await verifyStaticStudentLogin(cleanId, cleanPassword);
  if (staticResult) return staticResult;

  try {
    const payload = await fetchJson<{ student?: MedimentorsStudentLogin; source?: string }>(
      appApiUrl('/student-login/verify'),
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ loginId: cleanId, password: cleanPassword }),
      },
      7000,
    );
    if (!payload?.student) {
      return { ok: false, source: payload?.source || 'medimentors 계정 인증 필요', error: 'medimentors 학생 계정 확인에 실패했습니다.' };
    }
    return { ok: true, source: payload.source || 'medimentors 계정 실시간', student: payload.student };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'medimentors 학생 계정 정보를 불러오지 못했습니다.';
    return {
      ok: false,
      source: 'medimentors 계정 인증 필요',
      error: message === 'HTTP 404'
        ? 'Render에 app-api 서버가 연결되지 않았습니다. Static Site가 아니라 Node Web Service로 배포되어야 합니다.'
        : message,
    };
  }
}

function normalizeStudents(rows: unknown[]): StudentStatus[] {
  return rows
    .map((raw, index) => {
      const row = raw && typeof raw === 'object' ? (raw as RemoteStudentRow) : {};
      const id = String(row.external_id ?? row.externalId ?? row.studentId ?? row.customId ?? row.id ?? `med-${index + 1}`).trim();
      const name = String(row.studentName ?? row.name ?? id).trim();
      const studentPhone = String(row.studentPhone ?? row.student_phone ?? row.phone ?? '').trim();
      const parentPhone = String(row.parentPhone ?? row.parent_phone ?? row.guardianPhone ?? '').trim();
      return {
        id,
        name,
        studentPhone: studentPhone || undefined,
        parentPhone: parentPhone || undefined,
        status: 'offline' as const,
        todayMinutes: 0,
        subject: DEFAULT_SUBJECTS[0],
      };
    })
    .filter((student) => student.id && student.name);
}

function mergeStudentRosters(primary: StudentStatus[], secondary: StudentStatus[]) {
  const result = [...primary];
  const byId = new Map(result.map((student, index) => [normalizeLookupKey(student.id), index]));
  const byName = new Map(result.map((student, index) => [normalizeLookupKey(student.name), index]));
  const byPhone = new Map(
    result
      .map((student, index) => [normalizePhone(student.studentPhone), index] as const)
      .filter(([phone]) => phone),
  );

  secondary.forEach((student) => {
    const index = byId.get(normalizeLookupKey(student.id))
      ?? byName.get(normalizeLookupKey(student.name))
      ?? byPhone.get(normalizePhone(student.studentPhone));
    if (index === undefined) {
      result.push(student);
      byId.set(normalizeLookupKey(student.id), result.length - 1);
      byName.set(normalizeLookupKey(student.name), result.length - 1);
      if (student.studentPhone) byPhone.set(normalizePhone(student.studentPhone), result.length - 1);
      return;
    }
    result[index] = {
      ...result[index],
      studentPhone: student.studentPhone || result[index].studentPhone,
      parentPhone: student.parentPhone || result[index].parentPhone,
    };
  });
  return result;
}

function normalizeLookupKey(value: unknown) {
  return String(value ?? '').trim().toLowerCase().replace(/\s+/g, '');
}

function normalizePhone(value: unknown) {
  return String(value ?? '').replace(/[^\d]/g, '');
}

function collectObjects(value: unknown, rows: Record<string, unknown>[] = [], depth = 0): Record<string, unknown>[] {
  if (depth > 5 || !value) return rows;
  if (Array.isArray(value)) {
    value.forEach((item) => collectObjects(item, rows, depth + 1));
    return rows;
  }
  if (typeof value !== 'object') return rows;
  const object = value as Record<string, unknown>;
  rows.push(object);
  Object.entries(object).forEach(([key, child]) => {
    if (['html', 'content', 'memo', 'note'].includes(key.toLowerCase())) return;
    collectObjects(child, rows, depth + 1);
  });
  return rows;
}

function readStudentNumber(row: Record<string, unknown>) {
  const value =
    row.studentPhone
    ?? row.student_phone
    ?? row.phone
    ?? row.phoneNumber
    ?? row.phone_number
    ?? row.attendanceNumber
    ?? row.attendance_number
    ?? row.number
    ?? row.studentNumber
    ?? row.student_number;
  const normalized = normalizePhone(value);
  return normalized.length >= 4 ? String(value ?? '').trim() : '';
}

function extractStudentNumberRows(payload: unknown) {
  const result: Array<{ id: string; name: string; studentPhone: string }> = [];
  const seen = new Set<string>();
  collectObjects(payload).forEach((row) => {
    const studentPhone = readStudentNumber(row);
    if (!studentPhone) return;
    const id = String(row.studentId ?? row.student_id ?? row.external_id ?? row.externalId ?? row.id ?? '').trim();
    const name = String(row.studentName ?? row.student_name ?? row.name ?? row.student ?? '').trim();
    if (!id && !name) return;
    const key = `${normalizeLookupKey(id)}-${normalizeLookupKey(name)}-${normalizePhone(studentPhone)}`;
    if (seen.has(key)) return;
    seen.add(key);
    result.push({ id, name, studentPhone });
  });
  return result;
}

function mergeMediweeklyStudentNumbers(roster: StudentStatus[], weeklyRows: Array<{ id: string; name: string; studentPhone: string }>) {
  if (!roster.length || !weeklyRows.length) return roster;
  const byId = new Map<string, string>();
  const byName = new Map<string, string>();
  weeklyRows.forEach((row) => {
    if (row.id) byId.set(normalizeLookupKey(row.id), row.studentPhone);
    if (row.name) byName.set(normalizeLookupKey(row.name), row.studentPhone);
  });
  return roster.map((student) => {
    const weeklyPhone = byId.get(normalizeLookupKey(student.id)) ?? byName.get(normalizeLookupKey(student.name));
    return weeklyPhone ? { ...student, studentPhone: weeklyPhone } : student;
  });
}

export async function loadMediweeklyStudentNumbers(): Promise<Array<{ id: string; name: string; studentPhone: string }>> {
  const endpoints = [`${mediweeklyBase}/state`, `${mediweeklyBase}/state/weekly-calendars`];
  for (const endpoint of endpoints) {
    try {
      const payload = await fetchJson<unknown>(
        `${endpoint}${endpoint.includes('?') ? '&' : '?'}_t=${Date.now()}`,
        { headers: authHeaders('mediweekly') },
        6000,
      );
      const rows = extractStudentNumberRows(payload);
      if (rows.length) return rows;
    } catch {
      // mediweekly requires an authenticated admin token for the attendance table.
    }
  }
  return [];
}

export async function loadMedischeduleStudents(): Promise<StudentStatus[]> {
  let medischeduleStudents: StudentStatus[] = [];
  const endpoints = [`${medischeduleBase}/admin/students`, `${medischeduleBase}/students`];
  for (const endpoint of endpoints) {
    try {
      const payload = await fetchJson<unknown>(
        `${endpoint}${endpoint.includes('?') ? '&' : '?'}_t=${Date.now()}`,
        { headers: authHeaders('medischedule') },
        5000,
      );
      const students = normalizeStudents(extractRows(payload));
      if (students.length) {
        medischeduleStudents = students;
        break;
      }
    } catch {
      // A real medischedule admin token is required for the live roster.
    }
  }

  let mentoringStudents: StudentStatus[] = [];
  try {
    const payload = await fetchJson<unknown>(
      `${mentoringBase}/api/students?_t=${Date.now()}`,
      { headers: authHeaders('mentoring') },
      6000,
    );
    mentoringStudents = normalizeStudents(extractRows(payload));
  } catch {
    // Preserve the schedule roster when the mentoring roster is temporarily unavailable.
  }

  const roster = mentoringStudents.length
    ? mergeStudentRosters(mentoringStudents, medischeduleStudents)
    : medischeduleStudents;
  if (!roster.length) return [];
  const weeklyRows = await loadMediweeklyStudentNumbers();
  return mergeMediweeklyStudentNumbers(roster, weeklyRows);
}

type RemotePenaltySummaryRow = {
  id?: string | number;
  student_id?: string | number;
  studentId?: string | number;
  name?: string;
  studentName?: string;
  points?: string | number;
  total_points?: string | number;
  totalPoints?: string | number;
};

function normalizePenaltySummary(rows: unknown[]): PenaltySummary[] {
  return rows
    .map((raw, index) => {
      const row = raw && typeof raw === 'object' ? (raw as RemotePenaltySummaryRow) : {};
      const id = String(row.id ?? row.student_id ?? row.studentId ?? `penalty-${index + 1}`).trim();
      const name = String(row.name ?? row.studentName ?? id).trim();
      const points = Number(row.points ?? row.total_points ?? row.totalPoints ?? 0);
      return {
        id,
        name,
        points: Number.isFinite(points) ? points : 0,
      };
    })
    .filter((row) => row.id);
}

function penaltyQuery(settings?: PenaltySettings) {
  const params = new URLSearchParams({ _t: String(Date.now()) });
  if (settings?.from) params.set('from', settings.from);
  if (settings?.to) params.set('to', settings.to);
  return params.toString();
}

export async function loadPenaltySummary(settings?: PenaltySettings): Promise<{ items: PenaltySummary[]; source: string }> {
  const query = penaltyQuery(settings);
  const endpoints = [`${penaltyBase}/summary/cumulative`, `${penaltyBase}/penalties/summary`];
  for (const endpoint of endpoints) {
    try {
      const payload = await fetchJson<unknown>(
        `${endpoint}?${query}`,
        { headers: authHeaders('penalty') },
        5000,
      );
      return { items: normalizePenaltySummary(extractRows(payload)), source: '' };
    } catch {
      // Try the legacy endpoint before falling back.
    }
  }
  return { items: [], source: '' };
}

export async function loadSchedule(studentId: string): Promise<{ items: ScheduleItem[]; source: string }> {
  const weekStart = thisWeekStart();
  const headers = authHeaders('medischedule');

  try {
    const payload = await fetchJson<unknown>(
      `${medischeduleBase}/student/schedules/${encodeURIComponent(studentId)}?weekStart=${weekStart}&_t=${Date.now()}`,
      { headers },
      5000,
    );
    return { items: normalizeSchedule(extractRows(payload), studentId), source: 'student-schedule-app-full 실시간' };
  } catch {
    // Try the admin schedule feed next. This works when an admin token is available.
  }

  try {
    const payload = await fetchJson<unknown>(
      `${medischeduleBase}/admin/schedules?weekStart=${weekStart}&_t=${Date.now()}`,
      { headers },
      5000,
    );
    return { items: normalizeSchedule(extractRows(payload), studentId), source: 'student-schedule-app-full 관리자 일정' };
  } catch {
    return { items: demoSchedule, source: '데모 일정 - student-schedule-app-full 인증 필요' };
  }
}

type RemoteMentoringRecord = {
  id?: string | number;
  record?: RemoteMentoringRecord;
  week_record?: Record<string, unknown>;
  weekRecord?: Record<string, unknown>;
  subjects?: Array<{ name?: string; subject?: string; subjectName?: string; subject_name?: string; title?: string; tasks?: unknown[]; todos?: unknown[] }>;
  subject_records?: Array<Record<string, unknown>>;
  subjectRecords?: Array<Record<string, unknown>>;
  todos?: unknown[];
  tasks?: unknown[];
};

export type MentoringWeekOption = {
  id: string;
  label: string;
  startDate: string;
  endDate: string;
};

export type MentoringCurriculumItem = {
  subject: Subject;
  content: string;
};

export type MentoringTasksResult = {
  tasks: Task[];
  subjects: Subject[];
  source: string;
  weeks: MentoringWeekOption[];
  selectedWeekId: string;
  curriculum: MentoringCurriculumItem[];
  error?: string;
};

function parseMaybeJson(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const text = value.trim();
  if (!text) return value;
  if ((text.startsWith('{') && text.endsWith('}')) || (text.startsWith('[') && text.endsWith(']'))) {
    try {
      return JSON.parse(text);
    } catch {
      return value;
    }
  }
  return value;
}

function cleanSubjectName(value: unknown): Subject | undefined {
  const text = String(value || '').trim();
  if (!text || text === '[object Object]' || /^\d+$/.test(text)) return undefined;
  if (DEFAULT_SUBJECTS.includes(text)) return text;
  const lower = text.toLowerCase();
  const englishMap: Record<string, Subject> = {
    korean: '국어',
    math: '수학',
    mathematics: '수학',
    english: '영어',
    science: '과학',
  };
  return englishMap[lower] ?? text;
}

function toSubject(value: unknown, fallback: Subject = DEFAULT_SUBJECTS[1]): Subject {
  return cleanSubjectName(value) ?? fallback;
}

function addSubject(subjects: Subject[], value: unknown) {
  const subject = cleanSubjectName(value);
  if (subject && !subjects.includes(subject)) subjects.push(subject);
  return subject;
}

function subjectFromRecord(row: Record<string, unknown>, fallback?: unknown) {
  return cleanSubjectName(row.subject || row.subjectName || row.subject_name || row.name || row.title || fallback);
}

function isGenericMentoringKey(key: string) {
  const normalized = key.toLowerCase();
  return [
    'tasks',
    'todos',
    'assignments',
    'daily_tasks',
    'b_daily_tasks',
    'b_daily_tasks_this_week',
    'completed',
    'done',
    'checked',
    'status',
    'title',
    'text',
    'name',
    'memo',
    'content',
    'id',
  ].includes(normalized);
}

function isSubjectKey(key: string, knownSubjects: Subject[] = []) {
  const subject = cleanSubjectName(key);
  return Boolean(subject && !isGenericMentoringKey(key) && (knownSubjects.includes(subject) || !key.includes('_')));
}

function readTaskTitle(raw: unknown, fallback: string) {
  if (typeof raw === 'string') {
    const text = raw.trim();
    return text.includes('[object Object]') ? fallback : text;
  }
  const item = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const candidates = [item.title, item.text, item.name, item.assignment, item.memo, item.content];
  for (const candidate of candidates) {
    if (typeof candidate !== 'string' && typeof candidate !== 'number') continue;
    const text = String(candidate).trim();
    if (text && !text.includes('[object Object]')) return text;
  }
  return fallback;
}

function readTaskDone(raw: unknown) {
  const item = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  return Boolean(item.completed || item.done || item.checked || item.status === 'done' || item.status === 'completed');
}

function normalizeTask(raw: unknown, index: number, subject: Subject, meta: Partial<Task> = {}): Task {
  const title = readTaskTitle(raw, `멘토링 과제 ${index + 1}`);
  return {
    id: String((raw as Record<string, unknown> | undefined)?.id || `mentor-task-${subject}-${index}`),
    subject,
    title,
    completed: readTaskDone(raw),
    elapsedSeconds: Number((raw as Record<string, unknown> | undefined)?.elapsedSeconds || (raw as Record<string, unknown> | undefined)?.elapsed_seconds || 0),
    portalStatus: 'synced',
    ...meta,
  };
}

function isTaskLike(value: unknown) {
  if (!value || typeof value !== 'object') return false;
  const item = value as Record<string, unknown>;
  const hasScalarTitle = [item.title, item.text, item.name, item.assignment, item.memo, item.content]
    .some((candidate) => (
      (typeof candidate === 'string' || typeof candidate === 'number')
      && String(candidate).trim()
      && !String(candidate).includes('[object Object]')
    ));
  return hasScalarTitle;
}

function shouldSkipMentoringKey(key: string) {
  const normalized = key.toLowerCase();
  return (
    normalized === 'problems' ||
    normalized.includes('wrong_answer') ||
    normalized.includes('wronganswer') ||
    normalized.includes('clinic_records') ||
    normalized.includes('image') ||
    normalized.includes('score')
  );
}

function walkMentoringTasks(
  value: unknown,
  context: { studentId: string; weekId: string; weekRecordId?: string; subjectRecordId?: string; field: string; subject?: Subject; subjects?: Subject[]; path: Array<string | number> },
  tasks: Task[],
) {
  const parsed = parseMaybeJson(value);
  if (Array.isArray(parsed)) {
    parsed.forEach((item, index) => {
      walkMentoringTasks(item, { ...context, path: [...context.path, index] }, tasks);
    });
    return;
  }

  if (typeof parsed === 'string') {
    parsed
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => Boolean(line) && !line.includes('[object Object]'))
      .forEach((line, index) => {
        const subject = context.subject ?? toSubject(context.path.at(-1));
        tasks.push(normalizeTask(line, tasks.length + index, subject, {
          id: `mentor-task-${context.weekId}-${context.field}-${context.path.join('-')}-${index}`,
          mentorStudentId: context.studentId,
          mentorWeekId: context.weekId,
          mentorWeekRecordId: context.weekRecordId,
          mentorSubjectRecordId: context.subjectRecordId,
          mentorField: context.field,
          mentorPath: JSON.stringify([...context.path, index]),
        }));
      });
    return;
  }

  if (!parsed || typeof parsed !== 'object') return;
  if (isTaskLike(parsed)) {
    const subject = context.subject ?? toSubject(context.path.at(-1));
    tasks.push(normalizeTask(parsed, tasks.length, subject, {
      id: `mentor-task-${context.weekId}-${context.field}-${context.path.join('-') || tasks.length}`,
      mentorStudentId: context.studentId,
      mentorWeekId: context.weekId,
      mentorWeekRecordId: context.weekRecordId,
      mentorSubjectRecordId: context.subjectRecordId,
      mentorField: context.field,
      mentorPath: JSON.stringify(context.path),
    }));
    return;
  }

  Object.entries(parsed as Record<string, unknown>).forEach(([key, child]) => {
    if (shouldSkipMentoringKey(key)) return;
    const nextSubject = isSubjectKey(key, context.subjects) ? toSubject(key, context.subject) : context.subject;
    walkMentoringTasks(child, { ...context, subject: nextSubject, path: [...context.path, key] }, tasks);
  });
}

function uniqueTasks(tasks: Task[]) {
  const seen = new Set<string>();
  return tasks.filter((task) => {
    const key = `${task.subject}-${task.title}-${task.mentorField}-${task.mentorPath}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return Boolean(task.title);
  });
}

function normalizeMentoringWeek(raw: Record<string, unknown>): MentoringWeekOption {
  const id = String(raw.id ?? '').trim();
  return {
    id,
    label: String(raw.label ?? raw.name ?? `${id}회차`).trim().replace(/주차/g, '회차'),
    startDate: String(raw.start_date ?? raw.startDate ?? '').slice(0, 10),
    endDate: String(raw.end_date ?? raw.endDate ?? '').slice(0, 10),
  };
}

function normalizedAccountKey(value: unknown) {
  return String(value ?? '').trim().toLowerCase().replace(/\s+/g, '');
}

function findMentoringStudentId(payload: unknown, requestedId: string) {
  const requestedKey = normalizedAccountKey(requestedId);
  const match = extractRows(payload).find((raw) => {
    if (!raw || typeof raw !== 'object') return false;
    const row = raw as Record<string, unknown>;
    return [
      row.external_id,
      row.externalId,
      row.username,
      row.student_id,
      row.studentId,
      row.id,
    ].some((value) => normalizedAccountKey(value) === requestedKey);
  }) as Record<string, unknown> | undefined;
  return String(match?.id ?? match?.student_id ?? match?.studentId ?? requestedId).trim();
}

export async function loadMentoringTasks(studentId: string, requestedWeekId?: string): Promise<MentoringTasksResult> {
  const headers = authHeaders('mentoring');
  const emptyResult: MentoringTasksResult = {
    tasks: [],
    subjects: [],
    source: '',
    weeks: [],
    selectedWeekId: '',
    curriculum: [],
  };

  try {
    const [weeksPayload, studentsPayload] = await Promise.all([
      fetchJson<{ weeks?: Array<Record<string, unknown>> }>(`${mentoringBase}/api/weeks`, { headers }, 5000),
      fetchJson<unknown>(`${mentoringBase}/api/students`, { headers }, 5000),
    ]);
    const weeks = [...(weeksPayload.weeks ?? [])]
      .map(normalizeMentoringWeek)
      .filter((week) => week.id)
      .sort((a, b) => (
        (b.startDate || b.endDate).localeCompare(a.startDate || a.endDate)
        || Number(b.id) - Number(a.id)
      ))
      .slice(0, 3);
    const selectedWeekId = weeks.some((week) => week.id === requestedWeekId)
      ? String(requestedWeekId)
      : weeks[0]?.id;
    if (!selectedWeekId) throw new Error('선택 가능한 멘토링 회차가 없습니다.');

    const mentoringStudentId = findMentoringStudentId(studentsPayload, studentId);
    const record = await fetchJson<RemoteMentoringRecord>(
      `${mentoringBase}/api/mentoring/record?studentId=${encodeURIComponent(mentoringStudentId)}&weekId=${encodeURIComponent(selectedWeekId)}`,
      { headers },
      6000,
    );
    const payload = record.record ?? record;
    const weekRecord = (payload.week_record ?? payload.weekRecord ?? {}) as Record<string, unknown>;
    const weekRecordId = String(weekRecord.id ?? payload.id ?? '').trim() || undefined;
    const nextTasks: Task[] = [];
    const portalSubjects: Subject[] = [];
    const curriculum: MentoringCurriculumItem[] = [];

    const subjectRecords = payload.subject_records ?? payload.subjectRecords ?? [];
    subjectRecords.forEach((row, index) => {
      const subject = addSubject(portalSubjects, subjectFromRecord(row, index)) ?? toSubject(index);
      const curriculumText = String(row.a_curriculum ?? '').trim();
      if (curriculumText) curriculum.push({ subject, content: curriculumText });
      if (row.a_this_hw === undefined || row.a_this_hw === null || row.a_this_hw === '') return;
      walkMentoringTasks(row.a_this_hw, {
        studentId: mentoringStudentId,
        weekId: selectedWeekId,
        weekRecordId,
        subjectRecordId: String(row.id ?? '').trim() || undefined,
        field: 'a_this_hw',
        subject,
        subjects: portalSubjects,
        path: [index],
      }, nextTasks);
    });

    const tasks = uniqueTasks(nextTasks);
    tasks.forEach((task) => addSubject(portalSubjects, task.subject));
    return {
      tasks,
      subjects: portalSubjects,
      source: 'medimentors.kr',
      weeks,
      selectedWeekId,
      curriculum,
    };
  } catch (error) {
    return {
      ...emptyResult,
      error: error instanceof Error ? error.message : '멘토링 포털 연결에 실패했습니다.',
    };
  }
}

function updateTaskCompletionInValue(value: unknown, title: string, completed: boolean): { value: unknown; changed: boolean } {
  if (typeof value === 'string') {
    const parsedString = parseMaybeJson(value);
    if (parsedString !== value) {
      const updated = updateTaskCompletionInValue(parsedString, title, completed);
      return {
        value: updated.changed ? JSON.stringify(updated.value) : value,
        changed: updated.changed,
      };
    }
    return { value, changed: false };
  }

  const parsed = value;
  if (Array.isArray(parsed)) {
    let changed = false;
    const next = parsed.map((item) => {
      const result = updateTaskCompletionInValue(item, title, completed);
      changed ||= result.changed;
      return result.value;
    });
    return { value: next, changed };
  }

  if (!parsed || typeof parsed !== 'object') return { value: parsed, changed: false };

  const object = parsed as Record<string, unknown>;
  if (isTaskLike(object) && readTaskTitle(object, '') === title) {
    const next = { ...object };
    if ('completed' in object) next.completed = completed;
    if ('checked' in object) next.checked = completed;
    if ('status' in object) next.status = completed ? 'completed' : 'pending';
    if ('done' in object || !('completed' in object) && !('checked' in object) && !('status' in object)) {
      next.done = completed;
    }
    return {
      value: next,
      changed: true,
    };
  }

  let changed = false;
  const next: Record<string, unknown> = {};
  Object.entries(object).forEach(([key, child]) => {
    const result = updateTaskCompletionInValue(child, title, completed);
    changed ||= result.changed;
    next[key] = result.value;
  });
  return { value: next, changed };
}

function isUnsafeMentoringTaskValue(value: unknown) {
  if (typeof value === 'string') return value.includes('[object Object]');
  try {
    return JSON.stringify(value).includes('[object Object]');
  } catch {
    return true;
  }
}

export async function syncMentoringTaskCompletion(task: Task, completed: boolean): Promise<boolean> {
  if (!task.mentorStudentId || !task.mentorWeekId || !task.mentorField) return false;
  if (!task.title || task.title.includes('[object Object]')) return false;
  const headers = authHeaders('mentoring', true);

  try {
    const record = await fetchJson<RemoteMentoringRecord>(
      `${mentoringBase}/api/mentoring/record?studentId=${encodeURIComponent(task.mentorStudentId)}&weekId=${encodeURIComponent(task.mentorWeekId)}`,
      { headers },
      5000,
    );
    const payload = record.record ?? record;
    if (task.mentorSubjectRecordId) {
      const subjectRecords = payload.subject_records ?? payload.subjectRecords ?? [];
      const subjectRecord = subjectRecords.find((row) => String(row.id ?? '') === task.mentorSubjectRecordId);
      if (!subjectRecord) return false;
      const current = subjectRecord[task.mentorField];
      if (isUnsafeMentoringTaskValue(current)) return false;
      const updated = updateTaskCompletionInValue(current, task.title, completed);
      if (!updated.changed || isUnsafeMentoringTaskValue(updated.value)) return false;
      await fetchJson(
        `${mentoringBase}/api/mentoring/subject-record/${encodeURIComponent(task.mentorSubjectRecordId)}`,
        {
          method: 'PUT',
          headers,
          body: JSON.stringify({ [task.mentorField]: updated.value }),
        },
        5000,
      );
      return true;
    }
    if (!task.mentorWeekRecordId) return false;
    const weekRecord = (payload.week_record ?? payload.weekRecord ?? {}) as Record<string, unknown>;
    const current = weekRecord[task.mentorField];
    if (isUnsafeMentoringTaskValue(current)) return false;
    const updated = updateTaskCompletionInValue(current, task.title, completed);
    if (!updated.changed || isUnsafeMentoringTaskValue(updated.value)) return false;

    await fetchJson(
      `${mentoringBase}/api/mentoring/week-record/${encodeURIComponent(task.mentorWeekRecordId)}`,
      {
        method: 'PUT',
        headers,
        body: JSON.stringify({ [task.mentorField]: updated.value }),
      },
      5000,
    );
    return true;
  } catch {
    return false;
  }
}
