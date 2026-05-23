import { Fragment, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  BarChart3,
  Bell,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  ClipboardList,
  Edit3,
  Expand,
  Gift,
  Home,
  LogOut,
  MessageSquare,
  Pause,
  Pencil,
  Play,
  Plus,
  Save,
  Send,
  ShieldCheck,
  Sparkles,
  Sprout,
  Square,
  Stamp,
  Timer,
  Trophy,
  UserRound,
  Users,
  X,
} from 'lucide-react';
import { loadMedischeduleStudents, loadMentoringTasks, loadSchedule, syncMentoringTaskCompletion, weekDays } from './api';
import { DEFAULT_SUBJECTS, defaultAppData, defaultRewardSettings, demoSchedule, demoStudents, rewardItems, subjectColor, todayKey } from './demoData';
import fruitUrl from './assets/tree-fruit.png';
import treeSceneUrl from './assets/reward-tree.jpg';
import type { AdminMessage, AppData, PageKey, RewardPurchase, RewardSettings, Role, RunningSession, ScheduleItem, StudentStatus, StudyBlock, Subject, Task, TimerSkin } from './types';

const STORAGE_KEY = 'medical-roadmap-study-v3';
const ROLE_KEY = 'medical-roadmap-role-v1';
const ATTENDANCE_HIDE_KEY = 'medical-roadmap-attendance-hide-date-v1';
type TimerTab = 'main' | Subject;
type StudentSortKey = 'name' | 'phone';

const navItems: Array<{ key: PageKey; label: string; Icon: typeof Home }> = [
  { key: 'home', label: '홈', Icon: Home },
  { key: 'tasks', label: '과제', Icon: ClipboardList },
  { key: 'analysis', label: '분석', Icon: BarChart3 },
  { key: 'garden', label: '보상', Icon: Sprout },
  { key: 'center', label: '현황', Icon: Users },
];

const timerSkinOptions: Array<{ key: TimerSkin; label: string }> = [
  { key: 'pure', label: 'Slate' },
  { key: 'glass', label: 'Pearl' },
  { key: 'studio', label: 'Deck' },
  { key: 'halo', label: 'Halo' },
  { key: 'line', label: 'Line' },
];

const fruitPositions = [
  [48, 45],
  [41, 50],
  [56, 51],
  [35, 57],
  [62, 58],
  [49, 61],
  [43, 66],
  [57, 67],
  [50, 72],
  [31, 63],
  [68, 64],
  [39, 72],
] as const;

function pad(value: number) {
  return String(value).padStart(2, '0');
}

function formatClock(totalSeconds: number) {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = safe % 60;
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

function formatMinuteText(minutes: number) {
  const safe = Math.max(0, Math.floor(minutes));
  const h = Math.floor(safe / 60);
  const m = safe % 60;
  if (h > 0 && m > 0) return `${h}시간 ${m}분`;
  if (h > 0) return `${h}시간`;
  return `${m}분`;
}

function getStoredData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultAppData();
    const parsed = JSON.parse(raw) as Partial<AppData>;
    const fallback = defaultAppData(parsed.studentName, parsed.studentId);
    const studyBlocks = Array.isArray(parsed.studyBlocks)
      ? parsed.studyBlocks.filter((block) => !['block-1', 'block-2', 'block-3', 'block-4'].includes(block.id))
      : [];
    return {
      ...fallback,
      ...parsed,
      subjectNames: Array.isArray(parsed.subjectNames) && parsed.subjectNames.length ? parsed.subjectNames : DEFAULT_SUBJECTS,
      tasks: Array.isArray(parsed.tasks) ? parsed.tasks : fallback.tasks,
      studyBlocks,
      attendanceDates: Array.isArray(parsed.attendanceDates) ? parsed.attendanceDates : [],
      claimedAttendanceRewards: Array.isArray(parsed.claimedAttendanceRewards) ? parsed.claimedAttendanceRewards : [],
      rewardPurchases: Array.isArray(parsed.rewardPurchases) ? parsed.rewardPurchases : [],
      rewardSettings: normalizeRewardSettings(parsed.rewardSettings),
      adminMessages: Array.isArray(parsed.adminMessages) ? parsed.adminMessages : [],
      dismissedMessageIds: Array.isArray(parsed.dismissedMessageIds) ? parsed.dismissedMessageIds : [],
      timerSkin: parsed.timerSkin === 'glass' || parsed.timerSkin === 'studio' || parsed.timerSkin === 'pure' ? parsed.timerSkin : 'pure',
    };
  } catch {
    return defaultAppData();
  }
}

function getInitialRole(): Role | null {
  try {
    const stored = localStorage.getItem(ROLE_KEY);
    return stored === 'admin' || stored === 'user' ? stored : null;
  } catch {
    return null;
  }
}

function shouldShowAttendancePopup() {
  try {
    return localStorage.getItem(ATTENDANCE_HIDE_KEY) !== todayKey();
  } catch {
    return true;
  }
}

function monthDateKeys(date = new Date()) {
  const y = date.getFullYear();
  const m = date.getMonth();
  const days = new Date(y, m + 1, 0).getDate();
  return Array.from({ length: days }, (_, index) => todayKey(new Date(y, m, index + 1)));
}

function normalizeRewardSettings(settings?: Partial<RewardSettings>): RewardSettings {
  const numberOr = (value: unknown, fallback: number) => {
    const next = Number(value);
    return Number.isFinite(next) ? next : fallback;
  };
  return {
    pointsPerMinute: Math.max(1, numberOr(settings?.pointsPerMinute, defaultRewardSettings.pointsPerMinute)),
    minutesPerFruit: Math.max(1, numberOr(settings?.minutesPerFruit, defaultRewardSettings.minutesPerFruit)),
    attendanceTenFruits: Math.max(0, numberOr(settings?.attendanceTenFruits, defaultRewardSettings.attendanceTenFruits)),
    attendanceTwentyFruits: Math.max(0, numberOr(settings?.attendanceTwentyFruits, defaultRewardSettings.attendanceTwentyFruits)),
    attendanceFullFruits: Math.max(0, numberOr(settings?.attendanceFullFruits, defaultRewardSettings.attendanceFullFruits)),
  };
}

function fruitPointThreshold(settings: RewardSettings) {
  return Math.max(1, settings.pointsPerMinute * settings.minutesPerFruit);
}

function attendanceRewardSteps(fullMonthDays: number, settings: RewardSettings = defaultRewardSettings) {
  return [
    { threshold: 10, fruits: settings.attendanceTenFruits, label: '10일' },
    { threshold: 20, fruits: settings.attendanceTwentyFruits, label: '20일' },
    { threshold: fullMonthDays, fruits: settings.attendanceFullFruits, label: '한 달 전체' },
  ];
}

function applyAttendanceReward(data: AppData): AppData {
  const currentMonthDates = new Set(monthDateKeys());
  const monthAttendance = data.attendanceDates.filter((key) => currentMonthDates.has(key));
  const claimed = new Set(data.claimedAttendanceRewards);
  const settings = normalizeRewardSettings(data.rewardSettings);
  const newlyAchieved = attendanceRewardSteps(currentMonthDates.size, settings).filter((step) => monthAttendance.length >= step.threshold && !claimed.has(step.threshold));
  if (!newlyAchieved.length) return data;
  return {
    ...data,
    fruits: data.fruits + newlyAchieved.reduce((sum, step) => sum + step.fruits, 0),
    claimedAttendanceRewards: [...data.claimedAttendanceRewards, ...newlyAchieved.map((step) => step.threshold)],
  };
}

function sessionSeconds(session: RunningSession | null, nowMs: number) {
  if (!session) return 0;
  if (session.paused) return session.accumulatedSeconds;
  return session.accumulatedSeconds + Math.floor((nowMs - session.startedAtMs) / 1000);
}

function subjectSessionSeconds(session: RunningSession | null, nowMs: number) {
  if (!session) return 0;
  if (session.paused) return session.subjectAccumulatedSeconds;
  return session.subjectAccumulatedSeconds + Math.floor((nowMs - session.subjectStartedAtMs) / 1000);
}

function startMinuteOfDay(date = new Date()) {
  return date.getHours() * 60 + date.getMinutes();
}

function completionRate(tasks: Task[]) {
  if (!tasks.length) return 0;
  return Math.round((tasks.filter((task) => task.completed).length / tasks.length) * 100);
}

function todayBlocks(blocks: StudyBlock[]) {
  const key = todayKey();
  return blocks.filter((block) => block.date === key);
}

function blockDurationSeconds(block: StudyBlock) {
  return Math.max(0, Math.round(block.durationSeconds ?? block.durationMinutes * 60));
}

function totalSecondsFromBlocks(blocks: StudyBlock[]) {
  return blocks.reduce((sum, block) => sum + blockDurationSeconds(block), 0);
}

function totalMinutesFromBlocks(blocks: StudyBlock[]) {
  return totalSecondsFromBlocks(blocks) / 60;
}

function subjectSeconds(blocks: StudyBlock[], subjects: Subject[]) {
  const result = Object.fromEntries(subjects.map((subject) => [subject, 0])) as Record<Subject, number>;
  blocks.forEach((block) => {
    result[block.subject] = (result[block.subject] ?? 0) + blockDurationSeconds(block);
  });
  return result;
}

function subjectMinutes(blocks: StudyBlock[], subjects: Subject[]) {
  const result = Object.fromEntries(subjects.map((subject) => [subject, 0])) as Record<Subject, number>;
  blocks.forEach((block) => {
    result[block.subject] = (result[block.subject] ?? 0) + blockDurationSeconds(block) / 60;
  });
  return result;
}

function studentPhoneText(student?: StudentStatus) {
  return student?.studentPhone || '-';
}

function sortStudents(students: StudentStatus[], sortKey: StudentSortKey) {
  return [...students].sort((a, b) => {
    const left = sortKey === 'phone' ? (a.studentPhone || a.id) : a.name;
    const right = sortKey === 'phone' ? (b.studentPhone || b.id) : b.name;
    return left.localeCompare(right, 'ko-KR', { numeric: true });
  });
}

function commitSegmentToData(data: AppData, session: RunningSession, seconds: number, completeTask = false) {
  const durationSeconds = Math.max(0, Math.floor(seconds));
  if (durationSeconds <= 0) return data;
  const minutes = durationSeconds / 60;
  const task = session.taskId ? data.tasks.find((item) => item.id === session.taskId) : undefined;
  return {
    ...data,
    tasks: data.tasks.map((item) =>
      item.id === session.taskId ? { ...item, elapsedSeconds: item.elapsedSeconds + seconds, completed: completeTask || item.completed } : item,
    ),
    studyBlocks: [
      ...data.studyBlocks,
      {
        id: `block-${Date.now()}-${Math.round(Math.random() * 1000)}`,
        date: todayKey(),
        startMinute: startMinuteOfDay(new Date(session.subjectStartedAtMs)),
        durationMinutes: minutes,
        durationSeconds,
        subject: session.subject,
        taskTitle: task?.title,
      },
    ],
  };
}

function PageTitle({ label, title, right }: { label: string; title: string; right?: React.ReactNode }) {
  return (
    <div className="page-title">
      <div>
        <span>{label}</span>
        <h1>{title}</h1>
      </div>
      {right}
    </div>
  );
}

function LoginScreen({ onLogin }: { onLogin: (role: Role, name: string, id: string) => void }) {
  const [mode, setMode] = useState<Role>('user');
  const [name, setName] = useState('김도윤');
  const [id, setId] = useState('qtf258');

  return (
    <div className="login-screen">
      <section className="login-card">
        <div className="login-card-head">
          <div className="app-logo">MR</div>
          <div>
            <span>Medical Roadmap</span>
            <h1>로그인</h1>
          </div>
        </div>
        <div className="login-switch">
          <button className={mode === 'user' ? 'selected' : ''} onClick={() => setMode('user')} type="button">
            <UserRound size={26} />
            학생
          </button>
          <button className={mode === 'admin' ? 'selected' : ''} onClick={() => setMode('admin')} type="button">
            <ShieldCheck size={26} />
            관리자
          </button>
        </div>
        <label>
          이름
          <input value={name} onChange={(event) => setName(event.target.value)} />
        </label>
        <label>
          학생 ID
          <input value={id} onChange={(event) => setId(event.target.value)} />
        </label>
        <button className="login-submit" type="button" onClick={() => onLogin(mode, name.trim() || '학생', id.trim() || 'student-demo')}>
          시작하기
          <ChevronRight size={24} />
        </button>
      </section>
    </div>
  );
}

function SideRail({
  role,
  page,
  setPage,
  studentName,
  onLogout,
}: {
  role: Role;
  page: PageKey;
  setPage: (page: PageKey) => void;
  studentName: string;
  onLogout: () => void;
}) {
  return (
    <aside className="side-rail">
      <div className="rail-logo">MR</div>
      <div className="rail-user">
        <strong>{role === 'admin' ? '관리자' : studentName}</strong>
        <span>{role === 'admin' ? '운영 모드' : '학생 모드'}</span>
      </div>
      <nav className="rail-nav">
        {role === 'user' ? (
          navItems.map(({ key, label, Icon }) => (
            <button key={key} className={page === key ? 'active' : ''} onClick={() => setPage(key)} type="button">
              <Icon size={24} />
              <span>{label}</span>
            </button>
          ))
        ) : (
          <button className="active" type="button">
            <ShieldCheck size={24} />
            <span>관리</span>
          </button>
        )}
      </nav>
      <button className="rail-logout" type="button" onClick={onLogout} aria-label="로그아웃">
        <LogOut size={24} />
      </button>
    </aside>
  );
}

function SubjectDock({
  subjects,
  selectedTab,
  subjectTotalSeconds,
  mainSeconds,
  activeSubject,
  activeSubjectSeconds,
  onSelectMain,
  onSelect,
  onRename,
}: {
  subjects: Subject[];
  selectedTab: TimerTab;
  subjectTotalSeconds: Record<Subject, number>;
  mainSeconds: number;
  activeSubject?: Subject;
  activeSubjectSeconds: number;
  onSelectMain: () => void;
  onSelect: (subject: Subject) => void;
  onRename: (index: number, name: string) => void;
}) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [draft, setDraft] = useState('');

  function openEditor(index: number, current: string) {
    setEditingIndex(index);
    setDraft(current);
  }

  function saveEditor() {
    if (editingIndex === null) return;
    onRename(editingIndex, draft);
    setEditingIndex(null);
  }

  return (
    <div className="subject-dock">
      {subjects.map((subject, index) => {
        const liveSeconds = activeSubject === subject ? activeSubjectSeconds : 0;
        const seconds = (subjectTotalSeconds[subject] ?? 0) + liveSeconds;
        const selected = selectedTab === subject;
        return (
          <div className={`subject-chip ${selected ? 'selected' : ''}`} key={`${subject}-${index}`} style={{ '--subject-color': subjectColor(subject, subjects) } as React.CSSProperties}>
            {editingIndex === index ? (
              <input
                value={draft}
                autoFocus
                onChange={(event) => setDraft(event.target.value)}
                onBlur={saveEditor}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') saveEditor();
                  if (event.key === 'Escape') setEditingIndex(null);
                }}
              />
            ) : (
              <button className="subject-main" type="button" onClick={() => onSelect(subject)}>
                <strong>{subject}</strong>
                <span>{formatClock(seconds)}</span>
              </button>
            )}
            <button className="subject-edit" type="button" onClick={() => openEditor(index, subject)} aria-label={`${subject} 이름 수정`}>
              <Pencil size={15} />
            </button>
          </div>
        );
      })}
      <div className={`subject-chip main-tab ${selectedTab === 'main' ? 'selected' : ''}`}>
        <button className="subject-main" type="button" onClick={onSelectMain}>
          <strong>합계</strong>
          <span>{formatClock(mainSeconds)}</span>
        </button>
      </div>
    </div>
  );
}

function HomePage({
  data,
  subjects,
  schedule,
  selectedSubject,
  selectedTab,
  timerSkin,
  runningSession,
  totalElapsedSeconds,
  subjectElapsedSeconds,
  latestMessages,
  onStart,
  onPause,
  onStop,
  onMainSelect,
  onSubjectSelect,
  onRenameSubject,
  onTimerSkinChange,
  onTimerFullscreen,
  onWeekOpen,
}: {
  data: AppData;
  subjects: Subject[];
  schedule: ScheduleItem[];
  selectedSubject: Subject;
  selectedTab: TimerTab;
  timerSkin: TimerSkin;
  runningSession: RunningSession | null;
  totalElapsedSeconds: number;
  subjectElapsedSeconds: number;
  latestMessages: AdminMessage[];
  onStart: () => void;
  onPause: () => void;
  onStop: () => void;
  onMainSelect: () => void;
  onSubjectSelect: (subject: Subject) => void;
  onRenameSubject: (index: number, name: string) => void;
  onTimerSkinChange: (skin: TimerSkin) => void;
  onTimerFullscreen: () => void;
  onWeekOpen: () => void;
}) {
  const today = ['일', '월', '화', '수', '목', '금', '토'][new Date().getDay()];
  const todaySchedule = schedule.filter((item) => item.day === today).slice(0, 3);
  const completed = data.tasks.filter((task) => task.completed).length;
  const todays = todayBlocks(data.studyBlocks);
  const subjectTotals = subjectSeconds(todays, subjects);
  const activeSubject = runningSession?.subject;
  const totalTodaySeconds = totalSecondsFromBlocks(todays) + (runningSession ? subjectElapsedSeconds : 0);
  const todayStudy = totalTodaySeconds / 60;
  const visibleSubjectSeconds =
    selectedTab !== 'main'
      ? (subjectTotals[selectedTab] ?? 0) + (activeSubject === selectedTab ? subjectElapsedSeconds : 0)
      : totalTodaySeconds;
  const visibleTimerTitle = selectedTab === 'main' ? '합계 타이머' : `${selectedTab} 타이머`;
  const visibleTimerCaption =
    selectedTab === 'main'
      ? runningSession
        ? '오늘 과목별 누적 합계가 실시간 반영 중'
        : '오늘 저장된 과목별 공부 시간 합계'
      : activeSubject === selectedTab
        ? `${selectedTab} 현재 기록 중`
        : `${selectedTab} 오늘 누적 시간`;
  const timerClock = formatClock(visibleSubjectSeconds);
  const [displayHours, displayMinutes, displaySeconds] = timerClock.split(':');
  const timerProgress = `${((visibleSubjectSeconds % 3600) / 3600) * 360}deg`;

  return (
    <div className="page home-page">
      <PageTitle
        label="Focus Session"
        title="오늘의 공부"
        right={<div className={`session-state ${runningSession && !runningSession.paused ? 'live' : ''}`}>{runningSession?.paused ? '일시정지' : runningSession ? '진행 중' : '대기'}</div>}
      />
      <section className="home-grid">
        <div className="focus-panel">
          <SubjectDock
            subjects={subjects}
            selectedTab={selectedTab}
            subjectTotalSeconds={subjectTotals}
            mainSeconds={totalTodaySeconds}
            activeSubject={activeSubject}
            activeSubjectSeconds={subjectElapsedSeconds}
            onSelectMain={onMainSelect}
            onSelect={onSubjectSelect}
            onRename={onRenameSubject}
          />
          <div
            className={`main-timer-card timer-${timerSkin} ${selectedTab === 'main' ? 'main-mode' : 'subject-mode'}`}
            style={{ '--timer-progress': timerProgress } as React.CSSProperties}
          >
            <button className="icon-float" type="button" onClick={onTimerFullscreen} aria-label="타이머 전체보기" disabled={!runningSession}>
              <Expand size={25} />
            </button>
            <div className="timer-style-switch" aria-label="타이머 디자인 선택">
              {timerSkinOptions.map((option) => (
                <button
                  className={timerSkin === option.key ? 'active' : ''}
                  key={option.key}
                  type="button"
                  onClick={() => onTimerSkinChange(option.key)}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <div className="timer-kicker">
              <Sparkles size={18} />
              {visibleTimerTitle}
            </div>
            <div className="timer-display" aria-label={timerClock}>
              <div className="timer-unit">
                <strong>{displayHours}</strong>
              </div>
              <i>:</i>
              <div className="timer-unit">
                <strong>{displayMinutes}</strong>
              </div>
              <i>:</i>
              <div className="timer-unit">
                <strong>{displaySeconds}</strong>
              </div>
            </div>
            <p>{visibleTimerCaption}</p>
          </div>
          <div className="focus-actions">
            <button className="primary" type="button" onClick={onStart} disabled={Boolean(runningSession && !runningSession.paused)}>
              <Play size={28} />
              {runningSession && !runningSession.paused ? '진행 중' : runningSession?.paused ? '재개' : '공부 시작'}
            </button>
            <button type="button" onClick={onPause} disabled={!runningSession}>
              <Pause size={28} />
              {runningSession?.paused ? '재개' : '일시정지'}
            </button>
            <button className="danger" type="button" onClick={onStop} disabled={!runningSession}>
              <Square size={26} />
              중지
            </button>
          </div>
        </div>
        <aside className="home-side">
          <button className="schedule-brief" type="button" onClick={onWeekOpen}>
            <div className="card-head">
              <CalendarDays size={26} />
              <div>
                <h2>오늘의 일정</h2>
                <span>눌러서 주간 일정 보기</span>
              </div>
            </div>
            <div className="schedule-text-list">
              {todaySchedule.length ? (
                todaySchedule.map((item) => (
                  <p key={item.id}>
                    <span>{item.start}-{item.end}</span>
                    <strong>{item.title}</strong>
                  </p>
                ))
              ) : (
                <p><span>오늘</span><strong>등록된 일정 없음</strong></p>
              )}
            </div>
          </button>
          <div className="stat-stack">
            <div className="front-alert-card">
              <span>프론트 알림</span>
              {latestMessages.length ? (
                latestMessages.slice(0, 2).map((message) => <p key={message.id}>{message.body}</p>)
              ) : (
                <p>새 관리자 알림 없음</p>
              )}
            </div>
            <div className="stat-card"><span>오늘 공부</span><strong>{formatMinuteText(todayStudy)}</strong></div>
            <div className="stat-card"><span>과제 완료</span><strong>{completed}/{data.tasks.length}</strong></div>
          </div>
        </aside>
      </section>
    </div>
  );
}

function TaskCard({
  task,
  onComplete,
  onStop,
  onEdit,
}: {
  task: Task;
  onComplete: () => void;
  onStop: () => void;
  onEdit: () => void;
}) {
  return (
    <article className={`task-card ${task.completed ? 'done' : ''}`}>
      <div className="task-top">
        <span>{task.portalStatus === 'synced' ? '포털 연동' : task.portalStatus === 'pending' ? '동기화 대기' : '로컬'}</span>
        <button type="button" onClick={onEdit} aria-label="과제 편집"><Edit3 size={18} /></button>
      </div>
      <h3>{task.title}</h3>
      <div className="task-buttons">
        <button className="complete-task" type="button" onClick={onComplete} disabled={task.completed}><CheckCircle2 size={19} />완료</button>
        <button className="stop-task" type="button" onClick={onStop}><Square size={18} />중지</button>
      </div>
    </article>
  );
}

function TasksPage({
  subjects,
  tasks,
  taskSource,
  onCompleteTask,
  onStopTask,
  onEditTask,
  onNewTask,
}: {
  subjects: Subject[];
  tasks: Task[];
  taskSource: string;
  onCompleteTask: (task: Task) => void;
  onStopTask: (task: Task) => void;
  onEditTask: (task: Task) => void;
  onNewTask: (subject: Subject) => void;
}) {
  const rate = completionRate(tasks);
  return (
    <div className="page tasks-page">
      <PageTitle
        label="Assignments"
        title="과목별 할 일"
        right={<div className="completion-pill"><strong>{rate}%</strong><span>완료율</span></div>}
      />
      <section className="task-board">
        {subjects.slice(0, 5).map((subject) => {
          const subjectTasks = tasks.filter((task) => task.subject === subject).slice(0, 3);
          return (
            <div className="task-lane" key={subject}>
              <div className="lane-head">
                <i style={{ backgroundColor: subjectColor(subject, subjects) }} />
                <strong>{subject}</strong>
                <button type="button" onClick={() => onNewTask(subject)} aria-label={`${subject} 과제 추가`}><Plus size={18} /></button>
              </div>
              {subjectTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onComplete={() => onCompleteTask(task)}
                  onStop={() => onStopTask(task)}
                  onEdit={() => onEditTask(task)}
                />
              ))}
              {!subjectTasks.length ? <div className="empty-state">할 일 없음</div> : null}
            </div>
          );
        })}
      </section>
      <div className="source-caption">{taskSource}</div>
    </div>
  );
}

function AnalysisPage({ subjects, blocks, tasks, onEditBlock }: { subjects: Subject[]; blocks: StudyBlock[]; tasks: Task[]; onEditBlock: (block: StudyBlock) => void }) {
  const todays = todayBlocks(blocks);
  const minutesBySubject = subjectMinutes(todays, subjects);
  const total = totalMinutesFromBlocks(todays);
  const topSubject = subjects.reduce((best, subject) => (minutesBySubject[subject] > minutesBySubject[best] ? subject : best), subjects[0]);
  const longest = todays.reduce((best, block) => (blockDurationSeconds(block) > blockDurationSeconds(best) ? block : best), todays[0] ?? null);
  const avg = todays.length ? Math.round(total / todays.length) : 0;
  const durationHours = Array.from({ length: 19 }, (_, index) => 6 * 60 + index * 60);
  const durationMarkers = [10, 20, 30, 40, 50, 60];

  function blockForSlot(minute: number) {
    const normalizedMinute = minute % (24 * 60);
    return todays.find((block) => normalizedMinute >= block.startMinute && normalizedMinute < block.startMinute + blockDurationSeconds(block) / 60);
  }

  function durationHourLabel(minute: number) {
    const hour = Math.floor((minute / 60) % 24);
    if (hour === 0) return '12';
    return String(hour > 12 ? hour - 12 : hour);
  }

  return (
    <div className="page analysis-page">
      <PageTitle label="Insights" title="공부 시간 분석" />
      <section className="analysis-grid">
        <div className="insight-metrics">
          <div><span>총 공부</span><strong>{formatMinuteText(total)}</strong></div>
          <div><span>최다 과목</span><strong>{topSubject}</strong></div>
          <div><span>평균 세션</span><strong>{formatMinuteText(avg)}</strong></div>
          <div><span>최장 세션</span><strong>{longest ? formatMinuteText(blockDurationSeconds(longest) / 60) : '0분'}</strong></div>
        </div>
        <div className="timeline-panel">
          <div className="card-head">
            <Activity size={25} />
            <div><h2>10분 단위 기록표</h2><span>{todayKey()} · 클릭하면 기록 편집</span></div>
          </div>
          <div className="duration-sheet">
            <div className="duration-title">DURATION</div>
            <div className="duration-grid">
              <div className="duration-cell duration-head">T</div>
              {durationMarkers.map((marker) => (
                <div className="duration-cell duration-head" key={marker}>{marker}</div>
              ))}
              {durationHours.map((hourMinute) => (
                <Fragment key={hourMinute}>
                  <div className="duration-cell duration-hour">{durationHourLabel(hourMinute)}</div>
                  {durationMarkers.map((marker, markerIndex) => {
                    const slotMinute = hourMinute + markerIndex * 10;
                    const block = blockForSlot(slotMinute);
                    return (
                      <button
                        key={`${hourMinute}-${marker}`}
                        className={`duration-cell duration-slot ${block ? 'filled' : ''}`}
                        style={{ '--block-color': block ? subjectColor(block.subject, subjects) : undefined } as React.CSSProperties}
                        type="button"
                        onClick={() => block && onEditBlock(block)}
                        title={block ? `${block.subject} · ${block.taskTitle ?? '공부 기록'}` : '빈 10분 기록'}
                      >
                        <span>{block ? block.subject.slice(0, 2) : ''}</span>
                      </button>
                    );
                  })}
                </Fragment>
              ))}
              <div className="duration-cell duration-total-label">TOTAL</div>
              <div className="duration-cell duration-total">{formatMinuteText(total)}</div>
            </div>
          </div>
        </div>
        <div className="subject-panel">
          <h2>과목별 비율</h2>
          {subjects.slice(0, 6).map((subject) => {
            const value = minutesBySubject[subject] ?? 0;
            const percent = total ? Math.round((value / total) * 100) : 0;
            return (
              <div className="subject-bar" key={subject}>
                <span>{subject}</span>
                <div><i style={{ width: `${percent}%`, backgroundColor: subjectColor(subject, subjects) }} /></div>
                <strong>{percent}%</strong>
              </div>
            );
          })}
          <div className="small-metrics">
            <div><span>완료율</span><strong>{completionRate(tasks)}%</strong></div>
            <div><span>활동 과목</span><strong>{subjects.filter((subject) => (minutesBySubject[subject] ?? 0) > 0).length}</strong></div>
          </div>
        </div>
      </section>
    </div>
  );
}

function GardenPage({ data, onBuyReward, onOpenAttendance }: { data: AppData; onBuyReward: (item: { id: string; name: string; cost: number }) => void; onOpenAttendance: () => void }) {
  const [tab, setTab] = useState<'garden' | 'rewards' | 'attendance'>('garden');
  const monthCount = data.attendanceDates.filter((key) => monthDateKeys().includes(key)).length;
  const rewardSettings = normalizeRewardSettings(data.rewardSettings);
  const threshold = fruitPointThreshold(rewardSettings);
  const pointProgress = data.points % threshold;

  return (
    <div className="page garden-page">
      <PageTitle label="Rewards" title="포인트 가든" right={<div className="fruit-wallet"><img src={fruitUrl} alt="" />{data.fruits}개</div>} />
      <div className="section-tabs">
        <button className={tab === 'garden' ? 'active' : ''} onClick={() => setTab('garden')} type="button">정원</button>
        <button className={tab === 'rewards' ? 'active' : ''} onClick={() => setTab('rewards')} type="button">보상 상점</button>
        <button className={tab === 'attendance' ? 'active' : ''} onClick={() => setTab('attendance')} type="button">출석</button>
      </div>
      {tab === 'garden' ? (
        <section className="garden-layout">
          <div className="garden-tree-card">
            <img className="tree-scene" src={treeSceneUrl} alt="" />
            {Array.from({ length: Math.min(data.fruits, fruitPositions.length) }, (_, index) => {
              const [left, top] = fruitPositions[index];
              return <img key={index} src={fruitUrl} alt="" className="fruit-image" style={{ left: `${left}%`, top: `${top}%` }} />;
            })}
          </div>
          <div className="wallet-panel">
            <div><span>보유 포인트</span><strong>{data.points.toLocaleString('ko-KR')}P</strong></div>
            <div><span>보유 열매</span><strong>{data.fruits}개</strong></div>
            <div className="point-rule">
              <span>공부 1분 = {rewardSettings.pointsPerMinute}포인트</span>
              <div className="progress-track"><i style={{ width: `${(pointProgress / threshold) * 100}%` }} /></div>
              <em>{threshold - pointProgress}P 후 열매 1개</em>
            </div>
          </div>
        </section>
      ) : null}
      {tab === 'rewards' ? (
        <section className="reward-grid">
          {rewardItems.map((item) => (
            <article className="reward-card" key={item.id}>
              <img src={fruitUrl} alt="" />
              <span>{item.stock}</span>
              <h3>{item.name}</h3>
              <strong>열매 {item.cost}개</strong>
              <button type="button" onClick={() => onBuyReward({ id: item.id, name: item.name, cost: item.cost })} disabled={data.fruits < item.cost}>교환</button>
            </article>
          ))}
        </section>
      ) : null}
      {tab === 'attendance' ? (
        <section className="attendance-panel">
          <button className="attendance-open" type="button" onClick={onOpenAttendance}>
            <Stamp size={34} />
            <strong>이번 달 출석 {monthCount}일</strong>
            <span>10일 {rewardSettings.attendanceTenFruits}개 · 20일 {rewardSettings.attendanceTwentyFruits}개 · 전체 {rewardSettings.attendanceFullFruits}개</span>
          </button>
          <div className="purchase-list">
            {data.rewardPurchases.slice(0, 4).map((purchase) => (
              <div key={purchase.id}><span>{purchase.itemName}</span><strong>-{purchase.fruitCost}개</strong></div>
            ))}
            {!data.rewardPurchases.length ? <div className="empty-state">교환 내역 없음</div> : null}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function CenterPage({ students, subjects }: { students: StudentStatus[]; subjects: Subject[] }) {
  const sorted = [...students].sort((a, b) => b.todayMinutes - a.todayMinutes);
  const studying = students.filter((student) => student.status === 'studying').length;
  const resting = students.filter((student) => student.status === 'break').length;
  const offline = students.filter((student) => student.status === 'offline').length;
  const avg = Math.round(students.reduce((sum, student) => sum + student.todayMinutes, 0) / students.length);
  const statusLabel: Record<StudentStatus['status'], string> = {
    studying: '공부중',
    break: '휴식중',
    offline: '오프라인',
  };

  return (
    <div className="page center-page">
      <PageTitle
        label="Live Center"
        title="센터 공부 현황"
        right={<div className="session-state">{students.length}명</div>}
      />
      <section className="center-grid">
        <div className="center-hero">
          <div className="status-total studying"><span>공부중</span><strong>{studying}명</strong></div>
          <div className="status-total break"><span>휴식중</span><strong>{resting}명</strong></div>
          <div className="status-total offline"><span>오프라인</span><strong>{offline}명</strong></div>
          <div><span>센터 평균</span><strong>{formatMinuteText(avg)}</strong></div>
        </div>
        <div className="student-grid">
          {students.map((student) => (
            <article className={`student-card ${student.status}`} key={student.id} style={{ '--student-color': subjectColor(student.subject, subjects) } as React.CSSProperties}>
              <div className="student-status-badge">{statusLabel[student.status]}</div>
              <h3>{student.id}</h3>
              <strong>{formatMinuteText(student.todayMinutes)}</strong>
              <span>{student.status === 'studying' ? `${student.subject} 공부 중` : student.status === 'break' ? '잠시 휴식 중' : '오늘 접속 대기'}</span>
            </article>
          ))}
        </div>
        <div className="leader-card">
          <div className="card-head"><Trophy size={25} /><div><h2>오늘 TOP 5</h2><span>메디컬로드맵 센터</span></div></div>
          {sorted.slice(0, 5).map((student, index) => (
            <div className="leader-row" key={student.id}>
              <strong>{index + 1}</strong>
              <span>{student.id}</span>
              <em>{formatMinuteText(student.todayMinutes)}</em>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function AdminPage({
  data,
  students,
  subjects,
  schedule,
  onSendMessage,
  onTaskChange,
  onRewardSettingsChange,
  onFruitChange,
}: {
  data: AppData;
  students: StudentStatus[];
  subjects: Subject[];
  schedule: ScheduleItem[];
  onSendMessage: (student: StudentStatus, body: string) => void;
  onTaskChange: (task: Task) => void;
  onRewardSettingsChange: (settings: RewardSettings) => void;
  onFruitChange: (delta: number) => void;
}) {
  const [tab, setTab] = useState<'overview' | 'students' | 'learning' | 'rewards' | 'settings' | 'messages'>('overview');
  const [selectedStudentId, setSelectedStudentId] = useState(students[0]?.id ?? data.studentId);
  const [studentSort, setStudentSort] = useState<StudentSortKey>('name');
  const [messageBody, setMessageBody] = useState('');
  const [selectedStudentTasks, setSelectedStudentTasks] = useState<Task[]>(data.tasks);
  const [selectedTaskSource, setSelectedTaskSource] = useState('medimentors.kr');
  const rewardSettings = normalizeRewardSettings(data.rewardSettings);
  const sorted = [...students].sort((a, b) => b.todayMinutes - a.todayMinutes);
  const adminStudents = useMemo(() => sortStudents(students, studentSort), [students, studentSort]);
  const selectedStudent = students.find((student) => student.id === selectedStudentId) ?? students[0];
  const visibleTasks = selectedStudentTasks.length ? selectedStudentTasks : data.tasks;
  const total = students.reduce((sum, student) => sum + student.todayMinutes, 0);
  const studying = students.filter((student) => student.status === 'studying').length;
  const resting = students.filter((student) => student.status === 'break').length;
  const offline = students.filter((student) => student.status === 'offline').length;
  const completed = visibleTasks.filter((task) => task.completed).length;
  const todaySchedule = schedule.filter((item) => item.day === ['일', '월', '화', '수', '목', '금', '토'][new Date().getDay()]).slice(0, 4);
  const monthDates = monthDateKeys();
  const attendedDates = new Set(data.attendanceDates);
  const monthAttendance = data.attendanceDates.filter((key) => monthDates.includes(key)).length;
  const fullMonth = monthDates.length;
  const selectedMessages = data.adminMessages.filter((message) => message.recipientId === selectedStudent?.id);
  const rewardSteps = attendanceRewardSteps(fullMonth, rewardSettings);
  const subjectRows = subjects.map((subject) => {
    const subjectTasks = visibleTasks.filter((task) => task.subject === subject);
    const subjectMinutes = data.studyBlocks.filter((block) => block.subject === subject && block.date === todayKey()).reduce((sum, block) => sum + blockDurationSeconds(block) / 60, 0);
    return {
      subject,
      minutes: subjectMinutes,
      completed: subjectTasks.filter((task) => task.completed).length,
      total: subjectTasks.length,
    };
  });
  const recentMessages = [...data.adminMessages].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 30);

  useEffect(() => {
    if (!selectedStudent?.id) return;
    let cancelled = false;
    async function refreshSelectedTasks() {
      if (!selectedStudent?.id) return;
      const result = await loadMentoringTasks(selectedStudent.id);
      if (cancelled) return;
      setSelectedStudentTasks(result.tasks);
      setSelectedTaskSource(result.source);
    }
    void refreshSelectedTasks();
    const id = window.setInterval(refreshSelectedTasks, 60000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [selectedStudent?.id]);

  function updateRewardSetting(key: keyof RewardSettings, value: number) {
    onRewardSettingsChange(normalizeRewardSettings({ ...rewardSettings, [key]: value }));
  }

  function renderStudentPicker(label: string) {
    return (
      <div className="admin-mini-student-picker" aria-label={label}>
        {students.map((student) => (
          <button className={`${student.status} ${selectedStudent?.id === student.id ? 'selected' : ''}`} key={student.id} onClick={() => setSelectedStudentId(student.id)} type="button">
            <i />
            <span>{student.name}</span>
          </button>
        ))}
      </div>
    );
  }

  function sendMessage() {
    const body = messageBody.trim();
    if (!body || !selectedStudent) return;
    onSendMessage(selectedStudent, body);
    setMessageBody('');
  }

  return (
    <div className="page admin-page">
      <PageTitle label="Admin Console" title="학생 앱 운영 대시보드" right={<div className="session-state live">관리자</div>} />
      <nav className="admin-tabs">
        {[
          ['overview', '현황'],
          ['students', '학생'],
          ['learning', '학습'],
          ['rewards', '보상·출석'],
          ['settings', '규칙'],
          ['messages', '메시지'],
        ].map(([key, label]) => (
          <button className={tab === key ? 'active' : ''} key={key} onClick={() => setTab(key as typeof tab)} type="button">{label}</button>
        ))}
      </nav>
      <section className="admin-content">
        {tab === 'overview' ? (
          <>
            <div className="admin-grid">
              <div className="admin-metric status-total studying"><Users size={28} /><span>공부중</span><strong>{studying}명</strong></div>
              <div className="admin-metric status-total break"><Pause size={28} /><span>휴식중</span><strong>{resting}명</strong></div>
              <div className="admin-metric status-total offline"><LogOut size={28} /><span>오프라인</span><strong>{offline}명</strong></div>
              <div className="admin-metric"><Timer size={28} /><span>센터 총 공부</span><strong>{formatMinuteText(total)}</strong></div>
            </div>
            <div className="admin-bottom">
              <div className="admin-panel admin-live">
                <div className="admin-panel-head"><h2>실시간 학생 현황</h2><span>공부/휴식/오프라인</span></div>
                <div className="admin-student-list">
                  {sorted.map((student) => (
                    <div className={`admin-student-row ${student.status}`} key={student.id}>
                      <i />
                      <span>{student.name}</span>
                      <em>{student.status === 'studying' ? student.subject : student.status === 'break' ? '휴식중' : '오프라인'}</em>
                      <strong>{formatMinuteText(student.todayMinutes)}</strong>
                    </div>
                  ))}
                </div>
              </div>
              <div className="admin-panel admin-ops">
                <div className="admin-panel-head"><h2>학생 페이지 관리</h2><span>일정 · 과제 · 보상 · 출석</span></div>
                <div className="admin-control-grid">
                  <div><CalendarDays size={22} /><span>오늘 일정</span><strong>{todaySchedule.length}건</strong></div>
                  <div><ClipboardList size={22} /><span>과제 완료</span><strong>{completed}/{visibleTasks.length}</strong></div>
                  <div><CircleDollarSign size={22} /><span>포인트</span><strong>{data.points.toLocaleString('ko-KR')}P</strong></div>
                  <div><Gift size={22} /><span>열매</span><strong>{data.fruits}개</strong></div>
                  <div><Stamp size={22} /><span>월 출석</span><strong>{monthAttendance}일</strong></div>
                  <div><MessageSquare size={22} /><span>메시지</span><strong>{data.adminMessages.length}건</strong></div>
                </div>
                <div className="admin-sync-list">
                  <div><span>일정 연동</span><strong>medischedule</strong></div>
                  <div><span>멘토링 연동</span><strong>medimentors</strong></div>
                  <div><span>냥톡 커뮤니티</span><strong>제거됨</strong></div>
                </div>
              </div>
            </div>
          </>
        ) : null}
        {tab === 'students' ? (
          <div className="admin-two-col">
            <div className="admin-panel admin-student-panel">
              <div className="admin-panel-head"><h2>학생 선택</h2><span>{students.length}명</span></div>
              <div className="admin-sort-controls" aria-label="학생 정렬">
                <button className={studentSort === 'name' ? 'active' : ''} type="button" onClick={() => setStudentSort('name')}>이름순</button>
                <button className={studentSort === 'phone' ? 'active' : ''} type="button" onClick={() => setStudentSort('phone')}>번호순</button>
              </div>
              <div className="admin-select-list">
                {adminStudents.map((student) => (
                  <button className={`${student.status} ${selectedStudent?.id === student.id ? 'selected' : ''}`} key={student.id} onClick={() => setSelectedStudentId(student.id)} type="button">
                    <i />
                    <div className="admin-student-card-main">
                      <strong>{student.name}</strong>
                      <span>{student.id}</span>
                    </div>
                    <em>{studentPhoneText(student)}</em>
                  </button>
                ))}
              </div>
            </div>
            <div className="admin-panel admin-detail-panel">
              <div className="admin-panel-head"><h2>{selectedStudent?.name ?? '학생'} 상세</h2><span>{selectedStudent?.status === 'studying' ? '공부중' : selectedStudent?.status === 'break' ? '휴식중' : '오프라인'}</span></div>
              <div className="admin-detail-grid">
                <div><span>학생 ID</span><strong>{selectedStudent?.id ?? '-'}</strong></div>
                <div><span>학생 번호</span><strong>{studentPhoneText(selectedStudent)}</strong></div>
                <div><span>오늘 공부</span><strong>{formatMinuteText(selectedStudent?.todayMinutes ?? 0)}</strong></div>
                <div><span>현재 과목</span><strong>{selectedStudent?.subject ?? '-'}</strong></div>
                <div><span>과제 완료</span><strong>{completed}/{visibleTasks.length}</strong></div>
                <div><span>최근 메시지</span><strong>{selectedMessages.length}건</strong></div>
              </div>
              <div className="admin-student-task-preview">
                {visibleTasks.slice(0, 4).map((task) => (
                  <div key={task.id}>
                    <span>{task.subject}</span>
                    <strong>{task.title}</strong>
                    <em>{task.completed ? '완료' : '진행'}</em>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : null}
        {tab === 'learning' ? (
          <div className="admin-two-col">
            <div className="admin-panel admin-learning-panel">
              <div className="admin-panel-head"><h2>{selectedStudent?.name ?? '학생'} 공부 분석</h2><span>오늘 기준</span></div>
              {renderStudentPicker('학습 학생 선택')}
              <div className="admin-subject-list">
                {subjectRows.map((row) => (
                  <div key={row.subject}>
                    <span>{row.subject}</span>
                    <strong>{formatMinuteText(row.minutes)}</strong>
                    <em>{row.completed}/{row.total || 0}</em>
                  </div>
                ))}
              </div>
            </div>
            <div className="admin-panel">
              <div className="admin-panel-head"><h2>학생별 과제 수정</h2><span>{selectedTaskSource}</span></div>
              <div className="admin-task-edit-list">
                {visibleTasks.map((task) => (
                  <div key={task.id}>
                    <span>{task.subject}</span>
                    <input
                      value={task.title}
                      onChange={(event) => onTaskChange({ ...task, title: event.target.value, portalStatus: 'pending' })}
                      aria-label={`${task.subject} 과제명`}
                    />
                    <button
                      type="button"
                      onClick={() => onTaskChange({ ...task, completed: !task.completed, portalStatus: 'pending' })}
                    >
                      {task.completed ? '완료' : '진행'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : null}
        {tab === 'rewards' ? (
          <div className="admin-two-col">
            <div className="admin-panel admin-reward-overview-panel">
              <div className="admin-panel-head"><h2>{selectedStudent?.name ?? '학생'} 보상</h2><span>학생 페이지 연동</span></div>
              {renderStudentPicker('보상 학생 선택')}
              <div className="admin-detail-grid">
                <div><span>포인트</span><strong>{data.points.toLocaleString('ko-KR')}P</strong></div>
                <div><span>열매</span><strong>{data.fruits}개</strong></div>
                <div><span>월 출석</span><strong>{monthAttendance}/{fullMonth}일</strong></div>
                <div><span>구매 이력</span><strong>{data.rewardPurchases.length}건</strong></div>
              </div>
              <div className="admin-fruit-actions">
                <button type="button" onClick={() => onFruitChange(-1)} disabled={data.fruits <= 0}>열매 -1</button>
                <img src={fruitUrl} alt="" />
                <button type="button" onClick={() => onFruitChange(1)}>열매 +1</button>
              </div>
              <div className="admin-reward-rules">
                <div><span>포인트 규칙</span><strong>1분 = {rewardSettings.pointsPerMinute}P</strong></div>
                <div><span>열매 규칙</span><strong>{rewardSettings.minutesPerFruit}분마다 1개</strong></div>
                <div><span>출석 보상</span><strong>{rewardSettings.attendanceTenFruits}/{rewardSettings.attendanceTwentyFruits}/{rewardSettings.attendanceFullFruits}개</strong></div>
              </div>
            </div>
            <div className="admin-panel admin-reward-status-panel">
              <div className="admin-panel-head"><h2>지급 상태</h2><span>10일 · 20일 · 전체</span></div>
              <div className="admin-reward-progress-list">
                {rewardSteps.map((step) => {
                  const percent = Math.min(100, Math.round((monthAttendance / step.threshold) * 100));
                  return (
                    <div key={step.threshold}>
                      <span>{step.label}</span>
                      <strong>{data.claimedAttendanceRewards.includes(step.threshold) ? `열매 ${step.fruits}개 지급 완료` : `${Math.max(0, step.threshold - monthAttendance)}일 남음`}</strong>
                      <i><b style={{ width: `${percent}%` }} /></i>
                    </div>
                  );
                })}
              </div>
              <div className="admin-mini-calendar">
                {monthDates.map((date) => (
                  <div className={attendedDates.has(date) ? 'stamped' : ''} key={date}>
                    <span>{Number(date.slice(-2))}</span>
                  </div>
                ))}
              </div>
              <div className="admin-compact-list admin-reward-history">
                {data.rewardPurchases.slice(0, 3).map((purchase) => <div key={purchase.id}><span>구매</span><strong>{purchase.itemName}</strong></div>)}
                {!data.rewardPurchases.length ? <div><span>구매</span><strong>교환 내역 없음</strong></div> : null}
              </div>
            </div>
          </div>
        ) : null}
        {tab === 'settings' ? (
          <div className="admin-two-col">
            <div className="admin-panel admin-reward-settings">
              <div className="admin-panel-head"><h2>포인트·열매 규칙</h2><span>전체 학생 적용</span></div>
              <div className="admin-setting-grid">
                <label>공부 1분당 포인트<input type="number" min={1} value={rewardSettings.pointsPerMinute} onChange={(event) => updateRewardSetting('pointsPerMinute', Number(event.target.value))} /></label>
                <label>열매 1개 지급 기준(분)<input type="number" min={1} value={rewardSettings.minutesPerFruit} onChange={(event) => updateRewardSetting('minutesPerFruit', Number(event.target.value))} /></label>
                <label>10일 출석 열매<input type="number" min={0} value={rewardSettings.attendanceTenFruits} onChange={(event) => updateRewardSetting('attendanceTenFruits', Number(event.target.value))} /></label>
                <label>20일 출석 열매<input type="number" min={0} value={rewardSettings.attendanceTwentyFruits} onChange={(event) => updateRewardSetting('attendanceTwentyFruits', Number(event.target.value))} /></label>
                <label>전체 출석 열매<input type="number" min={0} value={rewardSettings.attendanceFullFruits} onChange={(event) => updateRewardSetting('attendanceFullFruits', Number(event.target.value))} /></label>
              </div>
            </div>
            <div className="admin-panel">
              <div className="admin-panel-head"><h2>현재 적용값</h2><span>학생 앱 보상 계산</span></div>
              <div className="admin-compact-list">
                <div><span>포인트</span><strong>1분 = {rewardSettings.pointsPerMinute}P</strong></div>
                <div><span>열매</span><strong>{rewardSettings.minutesPerFruit}분마다 1개</strong></div>
                <div><span>출석 10일</span><strong>열매 {rewardSettings.attendanceTenFruits}개</strong></div>
                <div><span>출석 20일</span><strong>열매 {rewardSettings.attendanceTwentyFruits}개</strong></div>
                <div><span>전체 출석</span><strong>열매 {rewardSettings.attendanceFullFruits}개</strong></div>
              </div>
            </div>
          </div>
        ) : null}
        {tab === 'messages' ? (
          <div className="admin-two-col">
            <div className="admin-panel admin-message-compose">
              <div className="admin-panel-head"><h2>학생 메시지 발송</h2><span>{selectedStudent?.name ?? '학생'}에게 팝업</span></div>
              <div className="admin-message-students">
                {students.map((student) => (
                  <button className={`${student.status} ${selectedStudent?.id === student.id ? 'selected' : ''}`} key={student.id} onClick={() => setSelectedStudentId(student.id)} type="button">{student.name}</button>
                ))}
              </div>
              <textarea value={messageBody} onChange={(event) => setMessageBody(event.target.value)} placeholder="학생에게 보낼 메시지를 입력하세요." maxLength={120} />
              <button className="admin-send-button" type="button" onClick={sendMessage} disabled={!messageBody.trim()}><Send size={20} /> 메시지 보내기</button>
            </div>
            <div className="admin-panel">
              <div className="admin-panel-head"><h2>최근 발송</h2><span>최신 30개</span></div>
              <div className="admin-message-log">
                {recentMessages.length ? recentMessages.map((message) => (
                  <div key={message.id}>
                    <span>{message.recipientName}</span>
                    <strong>{message.body}</strong>
                  </div>
                )) : <p>아직 발송한 메시지가 없습니다.</p>}
              </div>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}

function WeekScheduleModal({ schedule, source, onClose }: { schedule: ScheduleItem[]; source: string; onClose: () => void }) {
  return (
    <div className="modal-layer">
      <section className="modal-panel week-modal">
        <div className="modal-head">
          <div><h2>주간 일정표</h2><span>{source}</span></div>
          <button onClick={onClose} type="button" aria-label="닫기"><X size={28} /></button>
        </div>
        <div className="week-grid">
          {weekDays.map((day) => (
            <div className="week-column" key={day}>
              <strong>{day}</strong>
              {schedule.filter((item) => item.day === day).slice(0, 5).map((item) => (
                <div className={`week-item ${item.type}`} key={item.id}>
                  <span>{item.start}-{item.end}</span>
                  <em>{item.title}</em>
                </div>
              ))}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function TimerFullscreenModal({
  elapsedSeconds,
  subject,
  onClose,
  onPause,
  onStop,
  paused,
}: {
  elapsedSeconds: number;
  subject: Subject;
  onClose: () => void;
  onPause: () => void;
  onStop: () => void;
  paused: boolean;
}) {
  const [displayHours, displayMinutes, displaySeconds] = formatClock(elapsedSeconds).split(':');
  return (
    <div className="modal-layer">
      <section className="timer-fullscreen">
        <button className="modal-close-floating" onClick={onClose} type="button" aria-label="닫기"><X size={30} /></button>
        <span>{paused ? '일시정지' : '공부 중'} · {subject}</span>
        <div className="timer-display fullscreen-display" aria-label={formatClock(elapsedSeconds)}>
          <div className="timer-unit">
            <strong>{displayHours}</strong>
          </div>
          <i>:</i>
          <div className="timer-unit">
            <strong>{displayMinutes}</strong>
          </div>
          <i>:</i>
          <div className="timer-unit">
            <strong>{displaySeconds}</strong>
          </div>
        </div>
        <div className="timer-fullscreen-actions">
          <button onClick={onPause} type="button"><Pause size={32} />{paused ? '재개' : '일시정지'}</button>
          <button onClick={onStop} type="button"><Square size={32} />중지</button>
        </div>
      </section>
    </div>
  );
}

function AttendanceModal({
  data,
  animatedDate,
  onClose,
  onHideToday,
}: {
  data: AppData;
  animatedDate: string | null;
  onClose: () => void;
  onHideToday: () => void;
}) {
  const dates = monthDateKeys();
  const attended = new Set(data.attendanceDates);
  const count = dates.filter((date) => attended.has(date)).length;
  const full = dates.length;
  const today = todayKey();
  const rewardSteps = attendanceRewardSteps(full, normalizeRewardSettings(data.rewardSettings));
  const claimedRewards = new Set(data.claimedAttendanceRewards);
  const nextReward = rewardSteps.find((step) => count < step.threshold);
  const progress = Math.min(100, Math.round((count / full) * 100));
  return (
    <div className="modal-layer">
      <section className="modal-panel attendance-modal">
        <div className="modal-head">
          <div><h2>출석 체크</h2><span>이번 달 {count}/{full}일 · 공부 시작 시 오늘 도장 기록</span></div>
          <button onClick={onClose} type="button" aria-label="닫기"><X size={28} /></button>
        </div>
        <div className="calendar-grid">
          {dates.map((date) => {
            const stamped = attended.has(date);
            const animate = stamped && date === animatedDate;
            return (
              <div className={`${stamped ? 'stamped' : ''} ${date === today ? 'today' : ''} ${animate ? 'stamp-animate' : ''}`} key={date}>
                <span>{Number(date.slice(-2))}</span>
                {stamped ? (
                  <strong className="stamp-mark">
                    <Stamp size={24} />
                    출석
                  </strong>
                ) : date === today ? (
                  <em>오늘</em>
                ) : null}
              </div>
            );
          })}
        </div>
        <div className="attendance-reward-panel">
          <div className="attendance-progress-head">
            <div>
              <span>출석 보상</span>
              <strong>{nextReward ? `${nextReward.threshold - count}일 더 출석하면 열매 ${nextReward.fruits}개` : '이번 달 출석 보상 완료'}</strong>
            </div>
            <em>{count}/{full}일</em>
          </div>
          <div className="attendance-progress-track" aria-label="출석 진행률">
            <i style={{ width: `${progress}%` }} />
          </div>
          <div className="attendance-reward-steps">
            {rewardSteps.map((step) => {
              const achieved = count >= step.threshold;
              const claimed = claimedRewards.has(step.threshold);
              return (
                <div className={`${achieved ? 'achieved' : ''} ${claimed ? 'claimed' : ''}`} key={step.threshold}>
                  <span><img src={fruitUrl} alt="" />{step.label}</span>
                  <strong>열매 {step.fruits}개</strong>
                  <em>{claimed ? '지급 완료' : achieved ? '달성' : `${step.threshold - count}일 남음`}</em>
                </div>
              );
            })}
          </div>
        </div>
        <div className="attendance-actions">
          <button type="button" onClick={onHideToday}>오늘 하루 다시 보지 않기</button>
          <button type="button" onClick={onClose}>확인</button>
        </div>
      </section>
    </div>
  );
}

function AdminMessageModal({ message, onClose }: { message: AdminMessage; onClose: () => void }) {
  return (
    <div className="modal-layer message-layer">
      <section className="modal-panel admin-message-modal">
        <div className="message-modal-icon"><Bell size={30} /></div>
        <div>
          <span>관리자 메시지</span>
          <h2>{message.recipientName} 학생에게</h2>
          <p>{message.body}</p>
        </div>
        <button type="button" onClick={onClose}>확인</button>
      </section>
    </div>
  );
}

function TaskEditor({ task, subjects, initialSubject, onSave, onClose }: { task: Task | null; subjects: Subject[]; initialSubject: Subject; onSave: (task: Task) => void; onClose: () => void }) {
  const [title, setTitle] = useState(task?.title ?? '');
  const [subject, setSubject] = useState<Subject>(task?.subject ?? initialSubject);

  return (
    <div className="modal-layer">
      <section className="modal-panel editor-modal">
        <div className="modal-head">
          <h2>{task ? '과제 편집' : '과제 추가'}</h2>
          <button onClick={onClose} type="button" aria-label="닫기"><X size={28} /></button>
        </div>
        <label>과목<select value={subject} onChange={(event) => setSubject(event.target.value)}>{subjects.map((item) => <option key={item}>{item}</option>)}</select></label>
        <label>할 일<input value={title} onChange={(event) => setTitle(event.target.value)} /></label>
        <button
          className="save-button"
          type="button"
          onClick={() =>
            onSave({
              id: task?.id ?? `task-${Date.now()}`,
              subject,
              title: title.trim() || '새 과제',
              completed: task?.completed ?? false,
              elapsedSeconds: task?.elapsedSeconds ?? 0,
              portalStatus: task?.portalStatus ?? 'local',
            })
          }
        >
          <Save size={24} />
          저장
        </button>
      </section>
    </div>
  );
}

function BlockEditor({ block, subjects, onSave, onClose }: { block: StudyBlock; subjects: Subject[]; onSave: (block: StudyBlock) => void; onClose: () => void }) {
  const [subject, setSubject] = useState<Subject>(block.subject);
  const [duration, setDuration] = useState(Math.max(10, Math.round(blockDurationSeconds(block) / 60)));
  const normalizedDuration = Math.max(10, duration);
  return (
    <div className="modal-layer">
      <section className="modal-panel editor-modal">
        <div className="modal-head">
          <h2>공부 기록 편집</h2>
          <button onClick={onClose} type="button" aria-label="닫기"><X size={28} /></button>
        </div>
        <label>과목<select value={subject} onChange={(event) => setSubject(event.target.value)}>{subjects.map((item) => <option key={item}>{item}</option>)}</select></label>
        <label>시간<input type="number" min={10} max={240} step={10} value={duration} onChange={(event) => setDuration(Number(event.target.value))} /></label>
        <button className="save-button" type="button" onClick={() => onSave({ ...block, subject, durationMinutes: normalizedDuration, durationSeconds: normalizedDuration * 60 })}>
          <Save size={24} />
          저장
        </button>
      </section>
    </div>
  );
}

export default function App() {
  const [role, setRole] = useState<Role | null>(getInitialRole);
  const [page, setPage] = useState<PageKey>('home');
  const [data, setData] = useState<AppData>(getStoredData);
  const [schedule, setSchedule] = useState<ScheduleItem[]>(demoSchedule);
  const [scheduleSource, setScheduleSource] = useState('데모 일정');
  const [taskSource, setTaskSource] = useState('데모 멘토링');
  const subjects = data.subjectNames.length ? data.subjectNames : DEFAULT_SUBJECTS;
  const [selectedSubject, setSelectedSubject] = useState<Subject>(subjects[1] ?? '수학');
  const [timerTab, setTimerTab] = useState<TimerTab>('main');
  const [runningSession, setRunningSession] = useState<RunningSession | null>(null);
  const [nowMs, setNowMs] = useState(Date.now());
  const [weekOpen, setWeekOpen] = useState(false);
  const [timerOpen, setTimerOpen] = useState(false);
  const [attendanceOpen, setAttendanceOpen] = useState(false);
  const [animatedAttendanceDate, setAnimatedAttendanceDate] = useState<string | null>(null);
  const [taskEditor, setTaskEditor] = useState<{ task: Task | null; subject: Subject } | null>(null);
  const [blockEditor, setBlockEditor] = useState<StudyBlock | null>(null);
  const [medischeduleStudents, setMedischeduleStudents] = useState<StudentStatus[]>([]);
  const totalElapsedSeconds = sessionSeconds(runningSession, nowMs);
  const subjectElapsedSeconds = subjectSessionSeconds(runningSession, nowMs);
  const actualTodayMinutes = Math.floor((totalSecondsFromBlocks(todayBlocks(data.studyBlocks)) + (runningSession ? subjectElapsedSeconds : 0)) / 60);
  const studentMessages = useMemo(
    () => data.adminMessages.filter((message) => message.recipientId === data.studentId).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [data.adminMessages, data.studentId],
  );
  const unreadMessage = role === 'user' ? studentMessages.find((message) => !data.dismissedMessageIds.includes(message.id)) : undefined;

  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, [data]);

  useEffect(() => {
    if (role) localStorage.setItem(ROLE_KEY, role);
  }, [role]);

  useEffect(() => {
    if (role !== 'admin') return;
    let cancelled = false;
    async function refreshStudents() {
      const students = await loadMedischeduleStudents();
      if (!cancelled && students.length) setMedischeduleStudents(students);
    }
    void refreshStudents();
    const id = window.setInterval(refreshStudents, 60000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [role]);

  useEffect(() => {
    if (role === 'user' && shouldShowAttendancePopup()) {
      setAnimatedAttendanceDate(todayKey());
      setAttendanceOpen(true);
    }
  }, [role]);

  useEffect(() => {
    if (!subjects.includes(selectedSubject)) setSelectedSubject(subjects[0] ?? '수학');
    if (timerTab !== 'main' && !subjects.includes(timerTab)) setTimerTab('main');
  }, [selectedSubject, subjects, timerTab]);

  useEffect(() => {
    if (!role) return;
    let cancelled = false;
    async function refreshLinkedData() {
      const [scheduleResult, taskResult] = await Promise.all([
        loadSchedule(data.studentId),
        loadMentoringTasks(data.studentId),
      ]);
      if (cancelled) return;
      setSchedule(scheduleResult.items);
      setScheduleSource(scheduleResult.source);
      setTaskSource(taskResult.source);
      setData((prev) => {
        if (!taskResult.tasks.length) return prev;
        const nextSubjects = [...prev.subjectNames];
        taskResult.tasks.forEach((task) => {
          if (!nextSubjects.includes(task.subject)) nextSubjects.push(task.subject);
        });
        return { ...prev, subjectNames: nextSubjects, tasks: taskResult.tasks };
      });
    }
    void refreshLinkedData();
    const id = window.setInterval(refreshLinkedData, 60000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [role, data.studentId]);

  function markAttendance() {
    const today = todayKey();
    const alreadyStamped = data.attendanceDates.includes(today);
    setData((prev) => {
      if (prev.attendanceDates.includes(today)) return applyAttendanceReward(prev);
      return applyAttendanceReward({ ...prev, attendanceDates: [...prev.attendanceDates, today] });
    });
    if (!alreadyStamped) {
      setAnimatedAttendanceDate(today);
      if (shouldShowAttendancePopup()) setAttendanceOpen(true);
    }
  }

  function handleLogin(nextRole: Role, name: string, id: string) {
    setRole(nextRole);
    setData((prev) => ({ ...prev, studentName: name, studentId: id }));
    if (nextRole === 'user' && shouldShowAttendancePopup()) {
      setAnimatedAttendanceDate(todayKey());
      setAttendanceOpen(true);
    }
  }

  function openAttendanceModal() {
    setAnimatedAttendanceDate(todayKey());
    setAttendanceOpen(true);
  }

  function closeAttendanceModal() {
    setAttendanceOpen(false);
    setAnimatedAttendanceDate(null);
  }

  function hideAttendanceToday() {
    localStorage.setItem(ATTENDANCE_HIDE_KEY, todayKey());
    closeAttendanceModal();
  }

  function logout() {
    localStorage.removeItem(ROLE_KEY);
    setRole(null);
    setRunningSession(null);
    setPage('home');
  }

  function startSession(subject = selectedSubject, taskId?: string) {
    const now = Date.now();
    markAttendance();
    setNowMs(now);
    setSelectedSubject(subject);
    const prev = runningSession;
    if (!prev) {
      setRunningSession({ subject, taskId, startedAtMs: now, accumulatedSeconds: 0, subjectStartedAtMs: now, subjectAccumulatedSeconds: 0, paused: false });
      return;
    }

    const sameTarget = prev.subject === subject && prev.taskId === taskId;
    if (sameTarget && !prev.paused) return;
    if (sameTarget && prev.paused) {
      setRunningSession({ ...prev, startedAtMs: now, subjectStartedAtMs: now, paused: false });
      return;
    }

    const currentSubjectSeconds = subjectSessionSeconds(prev, now);
    if (currentSubjectSeconds > 0) {
      setData((current) => commitSegmentToData(current, prev, currentSubjectSeconds));
    }
    setRunningSession({
      ...prev,
      subject,
      taskId,
      startedAtMs: prev.paused ? now : prev.startedAtMs,
      subjectStartedAtMs: now,
      subjectAccumulatedSeconds: 0,
      paused: false,
    });
  }

  function selectSubject(subject: Subject) {
    setTimerTab(subject);
    if (!runningSession) {
      setSelectedSubject(subject);
      return;
    }
    startSession(subject);
  }

  function pauseSession() {
    const now = Date.now();
    setNowMs(now);
    const prev = runningSession;
    if (!prev) return;
    if (prev.paused) {
      setRunningSession({ ...prev, startedAtMs: now, subjectStartedAtMs: now, paused: false });
      return;
    }
    setRunningSession({
      ...prev,
      accumulatedSeconds: sessionSeconds(prev, now),
      subjectAccumulatedSeconds: subjectSessionSeconds(prev, now),
      paused: true,
    });
  }

  function stopSession(completeTask = false) {
    const now = Date.now();
    setNowMs(now);
    const prev = runningSession;
    if (!prev) return;
    const totalSeconds = sessionSeconds(prev, now);
    const currentSubjectSeconds = subjectSessionSeconds(prev, now);
    const totalMinutes = Math.floor(totalSeconds / 60);
    setData((current) => {
      const rewardSettings = normalizeRewardSettings(current.rewardSettings);
      const segmented = commitSegmentToData(current, prev, currentSubjectSeconds, completeTask);
      const earnedPoints = totalMinutes * rewardSettings.pointsPerMinute;
      const nextPoints = segmented.points + earnedPoints;
      const threshold = fruitPointThreshold(rewardSettings);
      const newFruits = Math.floor(nextPoints / threshold) - Math.floor(segmented.points / threshold);
      return { ...segmented, points: nextPoints, fruits: segmented.fruits + Math.max(0, newFruits) };
    });
    setTimerOpen(false);
    setRunningSession(null);
  }

  function completeTask(task: Task) {
    if (runningSession?.taskId === task.id) {
      stopSession(true);
    }
    setData((prev) => ({
      ...prev,
      tasks: prev.tasks.map((item) => (item.id === task.id ? { ...item, completed: true, portalStatus: 'synced' } : item)),
    }));
    void syncMentoringTaskCompletion(task, true).then((synced) => {
      if (!synced) {
        setData((prev) => ({
          ...prev,
          tasks: prev.tasks.map((item) => (item.id === task.id ? { ...item, portalStatus: 'pending' } : item)),
        }));
      }
    });
  }

  function stopTask(task: Task) {
    if (runningSession?.taskId === task.id) {
      stopSession(false);
    }
    setData((prev) => ({
      ...prev,
      tasks: prev.tasks.map((item) => (item.id === task.id ? { ...item, completed: false, elapsedSeconds: 0, portalStatus: 'pending' } : item)),
    }));
    void syncMentoringTaskCompletion(task, false).then((synced) => {
      if (synced) {
        setData((prev) => ({
          ...prev,
          tasks: prev.tasks.map((item) => (item.id === task.id ? { ...item, portalStatus: 'synced' } : item)),
        }));
      }
    });
  }

  function setTimerSkin(timerSkin: TimerSkin) {
    setData((prev) => ({ ...prev, timerSkin }));
  }

  function saveTask(task: Task) {
    setData((prev) => {
      const exists = prev.tasks.some((item) => item.id === task.id);
      const nextSubjects = prev.subjectNames.includes(task.subject) ? prev.subjectNames : [...prev.subjectNames, task.subject];
      return { ...prev, subjectNames: nextSubjects, tasks: exists ? prev.tasks.map((item) => (item.id === task.id ? task : item)) : [task, ...prev.tasks] };
    });
    setTaskEditor(null);
  }

  function saveBlock(block: StudyBlock) {
    setData((prev) => ({ ...prev, studyBlocks: prev.studyBlocks.map((item) => (item.id === block.id ? block : item)) }));
    setBlockEditor(null);
  }

  function renameSubject(index: number, name: string) {
    const nextName = name.trim();
    if (!nextName) return;
    setData((prev) => {
      const oldName = prev.subjectNames[index];
      if (!oldName || oldName === nextName) return prev;
      const subjectNames = prev.subjectNames.map((subject, subjectIndex) => (subjectIndex === index ? nextName : subject));
      return {
        ...prev,
        subjectNames,
        tasks: prev.tasks.map((task) => (task.subject === oldName ? { ...task, subject: nextName } : task)),
        studyBlocks: prev.studyBlocks.map((block) => (block.subject === oldName ? { ...block, subject: nextName } : block)),
      };
    });
    setSelectedSubject((prev) => (prev === subjects[index] ? nextName : prev));
    setTimerTab((prev) => (prev === subjects[index] ? nextName : prev));
    setRunningSession((prev) => (prev?.subject === subjects[index] ? { ...prev, subject: nextName } : prev));
  }

  function buyReward(item: { id: string; name: string; cost: number }) {
    setData((prev) => {
      if (prev.fruits < item.cost) return prev;
      const purchase: RewardPurchase = {
        id: `purchase-${Date.now()}`,
        itemName: item.name,
        fruitCost: item.cost,
        purchasedAt: new Date().toISOString(),
      };
      return { ...prev, fruits: prev.fruits - item.cost, rewardPurchases: [purchase, ...prev.rewardPurchases] };
    });
  }

  function sendAdminMessage(student: StudentStatus, body: string) {
    const message: AdminMessage = {
      id: `message-${Date.now()}`,
      recipientId: student.id,
      recipientName: student.name,
      body,
      createdAt: new Date().toISOString(),
    };
    setData((prev) => ({ ...prev, adminMessages: [message, ...prev.adminMessages].slice(0, 30) }));
  }

  function saveAdminTask(task: Task) {
    setData((prev) => ({
      ...prev,
      tasks: prev.tasks.map((item) => (item.id === task.id ? task : item)),
    }));
  }

  function saveRewardSettings(rewardSettings: RewardSettings) {
    setData((prev) => ({ ...prev, rewardSettings: normalizeRewardSettings(rewardSettings) }));
  }

  function changeFruits(delta: number) {
    setData((prev) => ({ ...prev, fruits: Math.max(0, prev.fruits + delta) }));
  }

  function dismissAdminMessage(messageId: string) {
    setData((prev) => (
      prev.dismissedMessageIds.includes(messageId)
        ? prev
        : { ...prev, dismissedMessageIds: [...prev.dismissedMessageIds, messageId] }
    ));
  }

  const students = useMemo(
    () => {
      const roster = medischeduleStudents.length ? medischeduleStudents : demoStudents;
      return roster.map((student, index) => {
        const fallback = demoStudents[index % demoStudents.length] ?? demoStudents[0];
        const merged = {
          ...fallback,
          ...student,
          studentPhone: student.studentPhone || fallback.studentPhone,
          parentPhone: student.parentPhone || fallback.parentPhone,
          status: fallback.status,
          todayMinutes: fallback.todayMinutes,
          subject: fallback.subject,
        };
        const isLiveUser = student.id === data.studentId || (!medischeduleStudents.length && index === 0);
        return isLiveUser
          ? {
              ...merged,
              id: data.studentId,
              name: data.studentName,
              status: runningSession ? (runningSession.paused ? 'break' : 'studying') : merged.status,
              todayMinutes: actualTodayMinutes,
              subject: runningSession?.subject ?? merged.subject,
            }
          : merged;
      });
    },
    [actualTodayMinutes, data.studentId, data.studentName, medischeduleStudents, runningSession],
  );

  let content: React.ReactNode = null;
  if (!role) {
    content = <LoginScreen onLogin={handleLogin} />;
  } else if (role === 'admin') {
    content = (
      <AdminPage
        data={data}
        students={students}
        subjects={subjects}
        schedule={schedule}
        onSendMessage={sendAdminMessage}
        onTaskChange={saveAdminTask}
        onRewardSettingsChange={saveRewardSettings}
        onFruitChange={changeFruits}
      />
    );
  } else if (page === 'home') {
    content = (
      <HomePage
        data={data}
        subjects={subjects}
        schedule={schedule}
        selectedSubject={selectedSubject}
        selectedTab={timerTab}
        timerSkin={data.timerSkin}
        runningSession={runningSession}
        totalElapsedSeconds={totalElapsedSeconds}
        subjectElapsedSeconds={subjectElapsedSeconds}
        latestMessages={studentMessages}
        onStart={() => startSession(timerTab === 'main' ? selectedSubject : timerTab)}
        onPause={pauseSession}
        onStop={() => stopSession(false)}
        onMainSelect={() => setTimerTab('main')}
        onSubjectSelect={selectSubject}
        onRenameSubject={renameSubject}
        onTimerSkinChange={setTimerSkin}
        onTimerFullscreen={() => setTimerOpen(true)}
        onWeekOpen={() => setWeekOpen(true)}
      />
    );
  } else if (page === 'tasks') {
    content = (
      <TasksPage
        subjects={subjects}
        tasks={data.tasks}
        taskSource={taskSource}
        onCompleteTask={completeTask}
        onStopTask={stopTask}
        onEditTask={(task) => setTaskEditor({ task, subject: task.subject })}
        onNewTask={(subject) => setTaskEditor({ task: null, subject })}
      />
    );
  } else if (page === 'analysis') {
    content = <AnalysisPage subjects={subjects} blocks={data.studyBlocks} tasks={data.tasks} onEditBlock={setBlockEditor} />;
  } else if (page === 'garden') {
    content = <GardenPage data={data} onBuyReward={buyReward} onOpenAttendance={openAttendanceModal} />;
  } else {
    content = <CenterPage students={students} subjects={subjects} />;
  }

  return (
    <div className="app-viewport">
      <div className={`tablet-frame ${role ? 'with-rail' : 'login-only'}`}>
        {role ? <SideRail role={role} page={page} setPage={setPage} studentName={data.studentName} onLogout={logout} /> : null}
        <main className={role ? 'app-main' : 'login-main'}>{content}</main>
        {weekOpen ? <WeekScheduleModal schedule={schedule} source={scheduleSource} onClose={() => setWeekOpen(false)} /> : null}
        {timerOpen && runningSession ? (
          <TimerFullscreenModal
            elapsedSeconds={totalElapsedSeconds}
            subject={runningSession.subject}
            paused={runningSession.paused}
            onPause={pauseSession}
            onStop={() => stopSession(false)}
            onClose={() => setTimerOpen(false)}
          />
        ) : null}
        {attendanceOpen ? <AttendanceModal data={data} animatedDate={animatedAttendanceDate} onClose={closeAttendanceModal} onHideToday={hideAttendanceToday} /> : null}
        {unreadMessage ? <AdminMessageModal message={unreadMessage} onClose={() => dismissAdminMessage(unreadMessage.id)} /> : null}
        {taskEditor ? <TaskEditor task={taskEditor.task} subjects={subjects} initialSubject={taskEditor.subject} onSave={saveTask} onClose={() => setTaskEditor(null)} /> : null}
        {blockEditor ? <BlockEditor block={blockEditor} subjects={subjects} onSave={saveBlock} onClose={() => setBlockEditor(null)} /> : null}
      </div>
    </div>
  );
}
