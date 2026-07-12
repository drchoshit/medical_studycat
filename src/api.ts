import { DEFAULT_SUBJECTS, demoSchedule, todayKey } from './demoData';
import type { AdminMessage, FamilySyncReport, LiveStudentStatus, PenaltySettings, PenaltySummary, RealtimeSnapshot, RewardSettings, ScheduleItem, StudentStatus, Subject, Task } from './types';

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
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      credentials: 'include',
      ...init,
      signal: init?.signal ?? controller.signal,
    });
    const text = await res.text();
    const json = text ? JSON.parse(text) : null;
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
    rewardSettings: payload?.rewardSettings,
    rewardMapVisibility: payload?.rewardMapVisibility,
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
    if (!payload.student) {
      return { ok: false, source: payload.source || 'medimentors 계정 인증 필요', error: 'medimentors 학생 계정 확인에 실패했습니다.' };
    }
    return { ok: true, source: payload.source || 'medimentors 계정 실시간', student: payload.student };
  } catch (error) {
    return {
      ok: false,
      source: 'medimentors 계정 인증 필요',
      error: error instanceof Error ? error.message : 'medimentors 학생 계정 정보를 불러오지 못했습니다.',
    };
  }
}

function normalizeStudents(rows: unknown[]): StudentStatus[] {
  return rows
    .map((raw, index) => {
      const row = raw && typeof raw === 'object' ? (raw as RemoteStudentRow) : {};
      const id = String(row.studentId ?? row.customId ?? row.id ?? `med-${index + 1}`).trim();
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
        const weeklyRows = await loadMediweeklyStudentNumbers();
        return mergeMediweeklyStudentNumbers(students, weeklyRows);
      }
    } catch {
      // A real medischedule admin token is required for the live roster.
    }
  }
  return [];
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
  const endpoints = [`${penaltyBase}/penalties/summary`, `${penaltyBase}/summary/cumulative`];
  for (const endpoint of endpoints) {
    try {
      const payload = await fetchJson<unknown>(
        `${endpoint}?${query}`,
        { headers: authHeaders('penalty') },
        5000,
      );
      return {
        items: normalizePenaltySummary(extractRows(payload)),
        source: settings?.from || settings?.to ? 'medipenalty 기간 실시간' : 'medipenalty 실시간',
      };
    } catch {
      // Try the legacy endpoint before falling back.
    }
  }
  return { items: [], source: 'medipenalty 연결 필요' };
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

type MentoringTasksResult = {
  tasks: Task[];
  subjects: Subject[];
  source: string;
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
  if (typeof raw === 'string') return raw.trim();
  const item = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  return String(item.title || item.text || item.name || item.assignment || item.content || item.memo || fallback).trim();
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
  return ['title', 'text', 'name', 'assignment', 'content', 'memo', 'done', 'completed', 'checked'].some((key) => key in item);
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
  context: { studentId: string; weekId: string; weekRecordId?: string; field: string; subject?: Subject; subjects?: Subject[]; path: Array<string | number> },
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
      .filter(Boolean)
      .forEach((line, index) => {
        const subject = context.subject ?? toSubject(context.path.at(-1));
        tasks.push(normalizeTask(line, tasks.length + index, subject, {
          id: `mentor-task-${context.field}-${context.path.join('-')}-${index}`,
          mentorStudentId: context.studentId,
          mentorWeekId: context.weekId,
          mentorWeekRecordId: context.weekRecordId,
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
      id: `mentor-task-${context.field}-${context.path.join('-') || tasks.length}`,
      mentorStudentId: context.studentId,
      mentorWeekId: context.weekId,
      mentorWeekRecordId: context.weekRecordId,
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

export async function loadMentoringTasks(studentId: string): Promise<MentoringTasksResult> {
  const headers = authHeaders('mentoring');

  try {
    const weeks = await fetchJson<{ weeks?: Array<{ id: string | number }> }>(`${mentoringBase}/api/weeks`, { headers }, 5000);
    const sortedWeeks = [...(weeks.weeks ?? [])].sort((a, b) => Number(a.id) - Number(b.id));
    const latestWeek = sortedWeeks.at(-1)?.id;
    if (!latestWeek) throw new Error('No week id');

    const record = await fetchJson<RemoteMentoringRecord>(
      `${mentoringBase}/api/mentoring/record?studentId=${encodeURIComponent(studentId)}&weekId=${encodeURIComponent(String(latestWeek))}`,
      { headers },
      6000,
    );
    const payload = record.record ?? record;
    const weekRecord = (payload.week_record ?? payload.weekRecord ?? {}) as Record<string, unknown>;
    const weekRecordId = String(weekRecord.id ?? payload.id ?? '').trim() || undefined;
    const nextTasks: Task[] = [];
    const portalSubjects: Subject[] = [];

    if (Array.isArray(payload.subjects)) {
      payload.subjects.forEach((subjectRow, subjectIndex) => {
        const subject = addSubject(portalSubjects, subjectRow.subject || subjectRow.subjectName || subjectRow.subject_name || subjectRow.name || subjectRow.title) ?? toSubject(subjectIndex);
        const rows = Array.isArray(subjectRow.tasks) ? subjectRow.tasks : Array.isArray(subjectRow.todos) ? subjectRow.todos : [];
        rows.forEach((row) => nextTasks.push(normalizeTask(row, nextTasks.length, subject, {
          mentorStudentId: studentId,
          mentorWeekId: String(latestWeek),
          mentorWeekRecordId: weekRecordId,
        })));
      });
    }

    const subjectRecords = payload.subject_records ?? payload.subjectRecords ?? [];
    subjectRecords.forEach((row, index) => {
      const subject = addSubject(portalSubjects, subjectFromRecord(row, index)) ?? toSubject(index);
      const taskSource = row.tasks || row.todos || row.assignments || row.daily_tasks || row.b_daily_tasks || row.b_daily_tasks_this_week;
      if (!taskSource) return;
      walkMentoringTasks(taskSource, {
        studentId,
        weekId: String(latestWeek),
        weekRecordId,
        field: 'subject_records',
        subject,
        subjects: portalSubjects,
        path: [index],
      }, nextTasks);
    });

    ['b_daily_tasks_this_week', 'b_daily_tasks'].forEach((field) => {
      if (weekRecord[field] === undefined) return;
      const parsed = parseMaybeJson(weekRecord[field]);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        Object.keys(parsed as Record<string, unknown>).forEach((key) => {
          if (!shouldSkipMentoringKey(key) && !isGenericMentoringKey(key)) addSubject(portalSubjects, key);
        });
      }
      walkMentoringTasks(weekRecord[field], {
        studentId,
        weekId: String(latestWeek),
        weekRecordId,
        field,
        subjects: portalSubjects,
        path: [],
      }, nextTasks);
    });

    const flatRows = Array.isArray(payload.tasks) ? payload.tasks : Array.isArray(payload.todos) ? payload.todos : [];
    flatRows.forEach((row, index) => {
      const raw = row as Record<string, unknown>;
      const subject = addSubject(portalSubjects, raw?.subject || raw?.subjectName || raw?.subject_name) ?? toSubject(raw?.subject);
      nextTasks.push(normalizeTask(row, index, subject, {
        mentorStudentId: studentId,
        mentorWeekId: String(latestWeek),
        mentorWeekRecordId: weekRecordId,
      }));
    });

    const tasks = uniqueTasks(nextTasks);
    tasks.forEach((task) => addSubject(portalSubjects, task.subject));
    if (tasks.length) return { tasks, subjects: portalSubjects, source: 'medimentors.kr 실시간' };
    return { tasks: [], subjects: portalSubjects, source: 'medimentors.kr 실시간 - 과제 없음' };
  } catch {
    return { tasks: [], subjects: [], source: 'medimentors.kr 인증 필요' };
  }
}

function updateTaskCompletionInValue(value: unknown, title: string, completed: boolean): { value: unknown; changed: boolean } {
  const parsed = parseMaybeJson(value);
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
    return {
      value: {
        ...object,
        done: completed,
        completed,
        status: completed ? 'completed' : 'pending',
      },
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

export async function syncMentoringTaskCompletion(task: Task, completed: boolean): Promise<boolean> {
  if (!task.mentorStudentId || !task.mentorWeekId || !task.mentorWeekRecordId || !task.mentorField) return false;
  const headers = authHeaders('mentoring', true);

  try {
    const record = await fetchJson<RemoteMentoringRecord>(
      `${mentoringBase}/api/mentoring/record?studentId=${encodeURIComponent(task.mentorStudentId)}&weekId=${encodeURIComponent(task.mentorWeekId)}`,
      { headers },
      5000,
    );
    const payload = record.record ?? record;
    const weekRecord = (payload.week_record ?? payload.weekRecord ?? {}) as Record<string, unknown>;
    const current = weekRecord[task.mentorField];
    const updated = updateTaskCompletionInValue(current, task.title, completed);
    if (!updated.changed) return false;

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
