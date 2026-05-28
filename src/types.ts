export type Role = 'user' | 'admin';

export type PageKey = 'home' | 'tasks' | 'analysis' | 'garden' | 'center';

export type Subject = string;

export type TimerSkin = 'pure' | 'glass' | 'studio' | 'halo' | 'line';

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

export type RewardPurchase = {
  id: string;
  itemName: string;
  fruitCost: number;
  purchasedAt: string;
};

export type RewardSettings = {
  pointsPerMinute: number;
  minutesPerFruit: number;
  attendanceTenFruits: number;
  attendanceTwentyFruits: number;
  attendanceFullFruits: number;
};

export type AdminMessage = {
  id: string;
  recipientId: string;
  recipientName: string;
  body: string;
  createdAt: string;
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
  rewardPurchases: RewardPurchase[];
  rewardSettings: RewardSettings;
  adminMessages: AdminMessage[];
  dismissedMessageIds: string[];
  hiddenTaskIds: string[];
  timerSkin: TimerSkin;
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
