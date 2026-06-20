export type Role = 'user' | 'admin';

export type PageKey = 'home' | 'tasks' | 'analysis' | 'garden' | 'center';

export type Subject = string;

export type TimerSkin = 'pure' | 'glass' | 'studio' | 'halo' | 'line' | 'pulse';

export type AppTheme = 'modern' | 'midnight' | 'botanic';

export type Task = {
  id: string;
  subject: Subject;
  title: string;
  goalMinutes?: number;
  completed: boolean;
  elapsedSeconds: number;
  portalStatus: 'synced' | 'local' | 'pending';
  mentorStudentId?: string;
  mentorWeekId?: string;
  mentorWeekRecordId?: string;
  mentorField?: string;
  mentorPath?: string;
};

export type StudyBlock = {
  id: string;
  date: string;
  startMinute: number;
  durationMinutes: number;
  durationSeconds?: number;
  subject: Subject;
  taskTitle?: string;
};

export type ScheduleItem = {
  id: string;
  day: string;
  start: string;
  end: string;
  title: string;
  type: 'center' | 'outside' | 'self';
};

export type StudentStatus = {
  id: string;
  name: string;
  studentPhone?: string;
  parentPhone?: string;
  status: 'studying' | 'break' | 'offline';
  todayMinutes: number;
  subject: Subject;
};

export type LiveStudentStatus = StudentStatus & {
  lastSeenAt?: string;
  updatedAt?: string;
  stale?: boolean;
};

export type PenaltySummary = {
  id: string;
  name: string;
  points: number;
};

export type RewardPurchase = {
  id: string;
  itemName: string;
  fruitCost: number;
  purchasedAt: string;
};

export type RewardSettings = {
  stageMinutes: number;
  stageRewardStars: number;
  attendanceTenStars: number;
  attendanceTwentyStars: number;
  attendanceFullStars: number;
};

export type AdminMessage = {
  id: string;
  recipientId: string;
  recipientName: string;
  body: string;
  createdAt: string;
  dismissedBy?: string[];
};

export type RealtimeSnapshot = {
  serverTime: string;
  students: LiveStudentStatus[];
  messages: AdminMessage[];
  rewardSettings?: RewardSettings;
  rewardMapVisibility?: Record<string, boolean>;
};

export type AppData = {
  studentId: string;
  studentName: string;
  points: number;
  fruits: number;
  subjectNames: Subject[];
  tasks: Task[];
  studyBlocks: StudyBlock[];
  attendanceDates: string[];
  claimedAttendanceRewards: number[];
  claimedStageRewards: string[];
  rewardPurchases: RewardPurchase[];
  rewardSettings: RewardSettings;
  rewardMapVisibility: Record<string, boolean>;
  adminMessages: AdminMessage[];
  dismissedMessageIds: string[];
  hiddenTaskIds: string[];
  timerSkin: TimerSkin;
  appTheme: AppTheme;
};

export type RunningSession = {
  subject: Subject;
  taskId?: string;
  startedAtMs: number;
  accumulatedSeconds: number;
  subjectStartedAtMs: number;
  subjectAccumulatedSeconds: number;
  paused: boolean;
};
