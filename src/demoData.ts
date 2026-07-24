import type { AppData, RewardSettings, ScheduleItem, StudentStatus, Subject, Task } from './types';

export const DEFAULT_SUBJECTS: Subject[] = ['국어', '수학', '영어', '탐구-1', '탐구-2', '탐구-3'];

export const subjectPalette = ['#5C6AD9', '#138060', '#C49A4A', '#8C6DD7', '#D86A57', '#2A8CAD', '#CE6E9E', '#6A8A42'];

export function subjectColor(subject: Subject, subjects: Subject[] = DEFAULT_SUBJECTS) {
  const index = Math.max(0, subjects.indexOf(subject));
  return subjectPalette[index % subjectPalette.length];
}

export const demoTasks: Task[] = [
  { id: 'task-1', subject: '수학', title: '미적분 오답 30문항', completed: false, elapsedSeconds: 0, portalStatus: 'synced' },
  { id: 'task-2', subject: '수학', title: '확률과 통계 개념 복습', completed: true, elapsedSeconds: 3120, portalStatus: 'synced' },
  { id: 'task-3', subject: '영어', title: '빈칸 추론 20문항', completed: false, elapsedSeconds: 0, portalStatus: 'synced' },
  { id: 'task-4', subject: '국어', title: '비문학 지문 4세트', completed: false, elapsedSeconds: 0, portalStatus: 'local' },
  { id: 'task-5', subject: '탐구-1', title: '생명과학 유전 파트', completed: false, elapsedSeconds: 0, portalStatus: 'pending' },
  { id: 'task-6', subject: '탐구-2', title: '기출 선지 정리', completed: true, elapsedSeconds: 2460, portalStatus: 'synced' },
  { id: 'task-7', subject: '탐구-3', title: '면접 질문 답변 정리', completed: false, elapsedSeconds: 0, portalStatus: 'local' },
];

export const demoSchedule: ScheduleItem[] = [
  { id: 'sch-1', day: '월', start: '08:30', end: '12:00', title: '센터 자습', type: 'center' },
  { id: 'sch-2', day: '월', start: '14:00', end: '16:00', title: '수학 클리닉', type: 'outside' },
  { id: 'sch-3', day: '화', start: '09:00', end: '13:00', title: '센터 자습', type: 'center' },
  { id: 'sch-4', day: '수', start: '10:00', end: '12:30', title: '국어 멘토링', type: 'outside' },
  { id: 'sch-5', day: '수', start: '14:00', end: '18:00', title: '센터 자습', type: 'center' },
  { id: 'sch-6', day: '목', start: '09:00', end: '15:00', title: '센터 자습', type: 'center' },
  { id: 'sch-7', day: '금', start: '11:00', end: '17:00', title: '센터 자습', type: 'center' },
  { id: 'sch-8', day: '토', start: '09:30', end: '12:30', title: '주간 테스트', type: 'self' },
];

const demoNames = [
  '김도윤', '강윤호', '오병연', '김서현', '조서연', '권예찬', '홍경환', '박지민', '최정근', '김예훈',
  '강요셉', '권승준', '이서준', '정하린', '문지우', '백민재', '서유찬', '윤채원', '한지호', '송민서',
  '임도현', '전시우', '채서아', '하준영', '노유진', '배시온', '고태민', '심예린', '유건우', '장서윤',
];

export const demoStudents: StudentStatus[] = Array.from({ length: 30 }, (_, index) => {
  const status = index % 7 === 4 || index % 7 === 6 ? 'offline' : index % 5 === 2 ? 'break' : 'studying';
  const subject = DEFAULT_SUBJECTS[index % DEFAULT_SUBJECTS.length];
  const baseMinutes = Math.max(0, 178 - index * 5);
  return {
    id: `s-${index + 1}`,
    studentPhone: `010-${String(2200 + index).padStart(4, '0')}-${String(3812 + index * 37).slice(-4).padStart(4, '0')}`,
    parentPhone: `010-${String(8800 + index).padStart(4, '0')}-${String(1203 + index * 43).slice(-4).padStart(4, '0')}`,
    name: demoNames[index] ?? `학생 ${index + 1}`,
    status,
    todayMinutes: status === 'offline' ? Math.max(0, baseMinutes - 42) : baseMinutes,
    subject,
  };
});

export const defaultRewardSettings: RewardSettings = {
  stageMinutes: 1200,
  stageRewardStars: 1,
  attendanceTenStars: 1,
  attendanceTwentyStars: 2,
  attendanceFullStars: 4,
};

export function todayKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function defaultAppData(name = '학생', id = 'student-demo'): AppData {
  const today = todayKey();
  return {
    studentId: id,
    studentName: name,
    points: 0,
    fruits: 3,
    subjectNames: DEFAULT_SUBJECTS,
    tasks: demoTasks,
    studyBlocks: [],
    attendanceDates: [today],
    claimedAttendanceRewards: [],
    claimedStageRewards: [],
    rewardPurchases: [],
    rewardSettings: defaultRewardSettings,
    rewardMapVisibility: {
      '2026-07': true,
      '2026-08': true,
      '2026-09': true,
      '2026-10': true,
      '2026-11': true,
    },
    penaltySettings: {
      from: '',
      to: '',
    },
    adminMessages: [],
    dismissedMessageIds: [],
    hiddenTaskIds: [],
    timerSkin: 'pure',
    appTheme: 'modern',
    mapAvatar: {
      species: 'human',
      skin: 'peach',
      fur: 'cream',
      hair: 'cap',
      eyes: 'dot',
      expression: 'smile',
      marking: 'none',
      outfitStyle: 'hoodie',
      outfit: 'ocean',
      accessory: 'none',
      aura: 'none',
    },
  };
}

export const rewardItems = [
  { id: 'reward-1', name: '간식 교환권', cost: 1, stock: '상시' },
  { id: 'reward-2', name: '음료 쿠폰', cost: 2, stock: '충분' },
  { id: 'reward-3', name: '프리미엄 노트', cost: 3, stock: '보통' },
  { id: 'reward-4', name: '자습실 우선권', cost: 4, stock: '한정' },
];
