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
  mentorSubjectRecordId?: string;
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
  todaySeconds?: number;
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

export type PenaltySettings = {
  from: string;
  to: string;
};

export type RewardPurchase = {
  id: string;
  itemName: string;
  fruitCost: number;
  purchasedAt: string;
};

export type RewardOrder = {
  id: string;
  studentId: string;
  studentName: string;
  itemId: string;
  itemName: string;
  starCost: number;
  createdAt: string;
  status: 'pending' | 'acknowledged';
  acknowledgedAt?: string;
};

export type MapAvatar = {
  species: 'human' | 'cat' | 'dog' | 'rabbit' | 'bear' | 'fox' | 'panda' | 'hamster' | 'penguin' | 'dinosaur';
  skin: 'peach' | 'warm' | 'tan' | 'deep';
  fur: 'cream' | 'peach' | 'caramel' | 'cocoa' | 'charcoal' | 'snow' | 'mint' | 'lavender';
  hair: 'cap' | 'bob' | 'spike' | 'bun' | 'short' | 'curl' | 'ponytail' | 'part';
  hairColor: 'espresso' | 'chestnut' | 'honey' | 'ash' | 'midnight' | 'rose' | 'silver' | 'lavender';
  eyes: 'dot' | 'round' | 'sparkle' | 'sleepy';
  eyeColor: 'chocolate' | 'ocean' | 'forest' | 'violet' | 'graphite';
  expression: 'smile' | 'happy' | 'curious' | 'playful' | 'calm';
  marking: 'none' | 'cheeks' | 'mask' | 'spot' | 'stripe';
  outfitStyle: 'hoodie' | 'sailor' | 'explorer' | 'school' | 'wizard' | 'sport';
  outfit: 'ocean' | 'mint' | 'sunset' | 'violet' | 'charcoal' | 'rose' | 'sunny' | 'sky';
  accessory: 'none' | 'glasses' | 'headphones' | 'crown' | 'bow' | 'beanie' | 'flower' | 'halo';
  aura: 'none' | 'stars' | 'hearts' | 'bubbles' | 'leaves';
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
  familyReports?: FamilySyncReport[];
  rewardOrders?: RewardOrder[];
  rewardSettings?: RewardSettings;
  rewardMapVisibility?: Record<string, boolean>;
  penaltySettings?: PenaltySettings;
};

export type FamilySyncReport = {
  studentId: string;
  studentName: string;
  profile: {
    studentId: string;
    studentName: string;
    studentPhone?: string;
    parentPhone?: string;
  };
  studySummary: {
    today: number;
    week: number;
    month: number;
    custom: number;
    streak: number;
    goal: number;
  };
  subjectStudy: Array<{
    subject: string;
    minutes: number;
    color: string;
    note?: string;
  }>;
  weeklyLearning: Array<{
    day: string;
    date: string;
    minutes: number;
    completion: number;
  }>;
  schedules: ScheduleItem[];
  tasks: Task[];
  studyBlocks: StudyBlock[];
  attendance: {
    status: string;
    checkIn: string;
    checkOut: string;
    seat?: string;
    timeline: Array<{
      time: string;
      label: string;
      tone: 'good' | 'neutral' | 'warn';
    }>;
  };
  rewards: {
    fruits: number;
    rewardPurchases: RewardPurchase[];
    attendanceDates: string[];
    claimedAttendanceRewards: number[];
    claimedStageRewards: string[];
    rewardSettings: RewardSettings;
    rewardMapVisibility: Record<string, boolean>;
  };
  penalty?: PenaltySummary;
  analysis: {
    completionRate: number;
    completedTasks: number;
    totalTasks: number;
    focusScore: number;
    activeSubjectCount: number;
  };
  updatedAt: string;
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
  penaltySettings: PenaltySettings;
  adminMessages: AdminMessage[];
  dismissedMessageIds: string[];
  hiddenTaskIds: string[];
  timerSkin: TimerSkin;
  appTheme: AppTheme;
  mapAvatar: MapAvatar;
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
