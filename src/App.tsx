import { Fragment, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  BarChart3,
  Bell,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Edit3,
  Expand,
  Flag,
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
  Star,
  Timer,
  Trash2,
  Trophy,
  UserRound,
  Users,
  X,
} from 'lucide-react';
import {
  dismissRealtimeAdminMessage,
  loadMedischeduleStudents,
  loadMentoringTasks,
  loadPenaltySummary,
  loadRealtimeSnapshot,
  loadSchedule,
  publishFamilySync,
  publishStudentStatus,
  saveRealtimeSettings,
  sendRealtimeAdminMessage,
  subscribeRealtimeSnapshot,
  syncMentoringTaskCompletion,
  verifyMedimentorsStudentLogin,
  weekDays,
  type MentoringCurriculumItem,
  type MentoringWeekOption,
} from './api';
import { DEFAULT_SUBJECTS, defaultAppData, defaultRewardSettings, demoSchedule, demoStudents, rewardItems, subjectColor, todayKey } from './demoData';
import fruitUrl from './assets/tree-fruit.png';
import treeSceneUrl from './assets/reward-tree-modern.png';
import type { AdminMessage, AppData, AppTheme, FamilySyncReport, LiveStudentStatus, PageKey, PenaltySettings, PenaltySummary, RealtimeSnapshot, RewardPurchase, RewardSettings, Role, RunningSession, ScheduleItem, StudentStatus, StudyBlock, Subject, Task, TimerSkin } from './types';

const DESKTOP_FRAME_WIDTH = 1440;
const DESKTOP_FRAME_HEIGHT = 900;

function useDesktopFrameScale() {
  const [viewport, setViewport] = useState(() => ({
    width: typeof window === 'undefined' ? DESKTOP_FRAME_WIDTH : window.innerWidth,
    height: typeof window === 'undefined' ? DESKTOP_FRAME_HEIGHT : window.innerHeight,
  }));

  useEffect(() => {
    const updateViewport = () => {
      const visualViewport = window.visualViewport;
      setViewport({
        width: visualViewport?.width ?? window.innerWidth,
        height: visualViewport?.height ?? window.innerHeight,
      });
    };

    updateViewport();
    window.addEventListener('resize', updateViewport);
    window.addEventListener('orientationchange', updateViewport);
    window.visualViewport?.addEventListener('resize', updateViewport);

    return () => {
      window.removeEventListener('resize', updateViewport);
      window.removeEventListener('orientationchange', updateViewport);
      window.visualViewport?.removeEventListener('resize', updateViewport);
    };
  }, []);

  const widthScale = Math.max(320, viewport.width) / DESKTOP_FRAME_WIDTH;
  const heightScale = Math.max(320, viewport.height) / DESKTOP_FRAME_HEIGHT;
  return Math.min(widthScale, heightScale);
}

const STORAGE_KEY = 'medical-roadmap-study-v3';
const ROLE_KEY = 'medical-roadmap-role-v1';
const ATTENDANCE_HIDE_KEY = 'medical-roadmap-attendance-hide-date-v1';
const SUBJECT_NAMES_CUSTOMIZED_KEY = 'medical-roadmap-subject-names-customized-v1';
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

const modernNavItems: Array<{ key: PageKey; label: string; Icon: typeof Home }> = [
  { key: 'home', label: '오늘', Icon: Home },
  { key: 'tasks', label: '과제', Icon: ClipboardList },
  { key: 'analysis', label: '리포트', Icon: BarChart3 },
  { key: 'garden', label: '보상', Icon: Sprout },
  { key: 'center', label: '센터', Icon: Users },
];

const modernTimerSkinOptions: Array<{ key: TimerSkin; label: string }> = [
  { key: 'pure', label: '모던' },
  { key: 'halo', label: '타일' },
  { key: 'pulse', label: '스코어' },
];

const appThemeOptions: Array<{ key: AppTheme; label: string }> = [
  { key: 'modern', label: '클린' },
  { key: 'midnight', label: '미드나잇' },
  { key: 'botanic', label: '보타닉' },
];

const subjectFallbackLabels = ['국어', '수학', '영어', '탐구', '탐구', '탐구'];
const subjectAlias: Record<string, string> = {
  '援?뼱': '국어',
  '?섑븰': '수학',
  '?곸뼱': '영어',
  '怨쇳븰': '탐구',
  '?먭뎄': '탐구',
  '?섑븰?쇱닠': '탐구',
  '과학': '탐구',
  '의학논술': '탐구',
  '수학논술': '탐구',
  '탐구-1': '탐구',
  '탐구-2': '탐구',
  '탐구-3': '탐구',
};

const demoTaskTitles: Record<string, string> = {
  'task-1': '미적분 오답 30문항',
  'task-2': '확률과 통계 개념 복습',
  'task-3': '빈칸 추론 20문항',
  'task-4': '비문학 지문 4세트',
  'task-5': '생명과학 유전 노트',
  'task-6': '기출 선지 정리',
  'task-7': '면접 질문 답변 정리',
};

const demoScheduleTitles: Record<string, string> = {
  'sch-1': '센터 자습',
  'sch-2': '수학 클리닉',
  'sch-3': '센터 자습',
  'sch-4': '국어 멘토링',
  'sch-5': '센터 자습',
  'sch-6': '센터 자습',
  'sch-7': '센터 자습',
  'sch-8': '주간 테스트',
};

const rewardLabels: Record<string, string> = {
  'reward-1': '간식 교환권',
  'reward-2': '음료 쿠폰',
  'reward-3': '프리미엄 노트',
  'reward-4': '자습실 우선권',
  'reward-5': '프린트 20매',
  'reward-6': '오답 클리닉 10분',
  'reward-7': '스티커 팩',
  'reward-8': '모의고사 해설권',
  'reward-9': '멘토 질문권',
  'reward-10': '집중석 예약권',
};

const modernRewardItems = [
  ...rewardItems,
  { id: 'reward-5', name: '프린트 20매', cost: 1, stock: '교환 가능' },
  { id: 'reward-6', name: '오답 클리닉 10분', cost: 2, stock: '교환 가능' },
  { id: 'reward-7', name: '스티커 팩', cost: 2, stock: '교환 가능' },
  { id: 'reward-8', name: '모의고사 해설권', cost: 5, stock: '교환 가능' },
  { id: 'reward-9', name: '멘토 질문권', cost: 3, stock: '교환 가능' },
  { id: 'reward-10', name: '집중석 예약권', cost: 4, stock: '교환 가능' },
];

type RewardMapTheme = 'august' | 'september' | 'october' | 'november' | 'december';
type RewardStageNode = { x: number; y: number; label: string };
const rewardStageStepCount = 20;
const rewardStageTotal = rewardStageStepCount;
const rewardStageStarsPerStage = 5;
const rewardStageStarMinutes = 4 * 60;
const rewardStageDefaultMinutes = rewardStageStarsPerStage * rewardStageStarMinutes;

const rewardStageLabel = (index: number) => {
  return String(index + 1);
};

const rewardMapMonths: Array<{ key: string; label: string; title: string; subtitle: string; theme: RewardMapTheme }> = [
  { key: '2026-07', label: '7월', title: 'Blue Coast Run', subtitle: '여름 시즌 해안 맵', theme: 'august' },
  { key: '2026-08', label: '8월', title: 'Campus Hills', subtitle: '여름 집중 언덕 맵', theme: 'september' },
  { key: '2026-09', label: '9월', title: 'Night Festival', subtitle: '가을 시작 축제 맵', theme: 'october' },
  { key: '2026-10', label: '10월', title: 'Crystal Lab', subtitle: '실전 집중 연구소 맵', theme: 'november' },
  { key: '2026-11', label: '11월', title: 'Snow Finale', subtitle: '시즌 완주 설원 맵', theme: 'december' },
];

const normalizeRewardMapVisibility = (visibility?: Record<string, boolean>): Record<string, boolean> => Object.fromEntries(
  rewardMapMonths.map((month) => [month.key, visibility?.[month.key] !== false]),
);

const rewardMapImages: Record<RewardMapTheme, string> = {
  august: '/reward-maps/blue-coast-run.png',
  september: '/reward-maps/campus-hills.png',
  october: '/reward-maps/night-festival.png',
  november: '/reward-maps/crystal-lab.png',
  december: '/reward-maps/snow-finale.png',
};

const rewardStageLayouts: Record<RewardMapTheme, RewardStageNode[]> = {
  august: [
    { x: 28.71, y: 71.79, label: '1' },
    { x: 23.88, y: 59.53, label: '2' },
    { x: 31.22, y: 51.99, label: '3' },
    { x: 24.84, y: 44.03, label: '4' },
    { x: 29.21, y: 31.61, label: '5' },
    { x: 38.43, y: 23.37, label: '6' },
    { x: 45.68, y: 28.36, label: '7' },
    { x: 49.86, y: 18.46, label: '8' },
    { x: 55.9, y: 26.14, label: '9' },
    { x: 48.49, y: 38.4, label: '10' },
    { x: 55.4, y: 52.14, label: '11' },
    { x: 53.17, y: 67.06, label: '12' },
    { x: 59.71, y: 71.64, label: '13' },
    { x: 63.09, y: 56.87, label: '14' },
    { x: 70.79, y: 40.47, label: '15' },
    { x: 74.53, y: 12.85, label: '16' },
    { x: 82.01, y: 32.2, label: '17' },
    { x: 83.38, y: 57.16, label: '18' },
    { x: 74.6, y: 76.22, label: '19' },
    { x: 70.43, y: 93.94, label: '20' },
  ],
  september: [
    { x: 15.54, y: 45.94, label: '1' },
    { x: 27.33, y: 48.93, label: '2' },
    { x: 36.21, y: 47.54, label: '3' },
    { x: 34.53, y: 33.68, label: '4' },
    { x: 40.14, y: 22.9, label: '5' },
    { x: 44.32, y: 43.13, label: '6' },
    { x: 48.71, y: 25.26, label: '7' },
    { x: 58.31, y: 27.21, label: '8' },
    { x: 59.42, y: 45.2, label: '9' },
    { x: 69.86, y: 37.81, label: '10' },
    { x: 80.94, y: 48.6, label: '11' },
    { x: 84.32, y: 68.54, label: '12' },
    { x: 77.48, y: 86.71, label: '13' },
    { x: 65.04, y: 84.05, label: '14' },
    { x: 65.11, y: 66.47, label: '15' },
    { x: 60.58, y: 55.83, label: '16' },
    { x: 52.52, y: 47.56, label: '17' },
    { x: 43.96, y: 55.83, label: '18' },
    { x: 46.83, y: 67.06, label: '19' },
    { x: 31.01, y: 88.77, label: '20' },
  ],
  october: [
    { x: 10.65, y: 71.2, label: '1' },
    { x: 16.94, y: 58.63, label: '2' },
    { x: 24.08, y: 48.17, label: '3' },
    { x: 33.49, y: 43.39, label: '4' },
    { x: 42.01, y: 36.19, label: '5' },
    { x: 43.17, y: 19.54, label: '6' },
    { x: 49.06, y: 23.49, label: '7' },
    { x: 55.56, y: 30.49, label: '8' },
    { x: 62.94, y: 27.92, label: '9' },
    { x: 68.92, y: 22.9, label: '10' },
    { x: 64.68, y: 41.51, label: '11' },
    { x: 73.53, y: 44.02, label: '12' },
    { x: 84.89, y: 53.32, label: '13' },
    { x: 84.1, y: 69.13, label: '14' },
    { x: 73.81, y: 72.53, label: '15' },
    { x: 67.27, y: 65.14, label: '16' },
    { x: 55.04, y: 63.96, label: '17' },
    { x: 48.71, y: 56.72, label: '18' },
    { x: 40.36, y: 67.65, label: '19' },
    { x: 37.41, y: 89.36, label: '20' },
  ],
  november: [
    { x: 21.94, y: 49.78, label: '1' },
    { x: 27.48, y: 49.35, label: '2' },
    { x: 35.4, y: 50.22, label: '3' },
    { x: 30.94, y: 67.06, label: '4' },
    { x: 39.05, y: 67.6, label: '5' },
    { x: 46.12, y: 58.79, label: '6' },
    { x: 54.1, y: 66.03, label: '7' },
    { x: 54.04, y: 79.57, label: '8' },
    { x: 58.82, y: 64.34, label: '9' },
    { x: 64.17, y: 48.3, label: '10' },
    { x: 54.53, y: 30.28, label: '11' },
    { x: 57.55, y: 21.42, label: '12' },
    { x: 67.55, y: 40.92, label: '13' },
    { x: 77.41, y: 45.53, label: '14' },
    { x: 84.31, y: 50.85, label: '15' },
    { x: 75.76, y: 71.34, label: '16' },
    { x: 66.98, y: 63.81, label: '17' },
    { x: 52.23, y: 58.49, label: '18' },
    { x: 40, y: 36.19, label: '19' },
    { x: 29.5, y: 22.6, label: '20' },
  ],
  december: [
    { x: 25.54, y: 83.46, label: '1' },
    { x: 33.08, y: 76.96, label: '2' },
    { x: 36.75, y: 68.12, label: '3' },
    { x: 30.13, y: 53.07, label: '4' },
    { x: 23.45, y: 40.77, label: '5' },
    { x: 34.82, y: 35.45, label: '6' },
    { x: 35.15, y: 50.72, label: '7' },
    { x: 44.03, y: 66.38, label: '8' },
    { x: 55.61, y: 76.22, label: '9' },
    { x: 64.1, y: 78.43, label: '10' },
    { x: 71.37, y: 74, label: '11' },
    { x: 70.65, y: 49.63, label: '12' },
    { x: 63.67, y: 39.29, label: '13' },
    { x: 73.74, y: 35.45, label: '14' },
    { x: 79.21, y: 49.78, label: '15' },
    { x: 81.29, y: 67.95, label: '16' },
    { x: 61.44, y: 58.94, label: '17' },
    { x: 44.82, y: 50.22, label: '18' },
    { x: 47.89, y: 33.15, label: '19' },
    { x: 43.81, y: 15.36, label: '20' },
  ],
};

const buildRewardMapPath = (nodes: RewardStageNode[]) => {
  if (nodes.length === 0) return '';
  if (nodes.length === 1) return `M ${nodes[0].x} ${nodes[0].y}`;
  const command = [`M ${nodes[0].x} ${nodes[0].y}`];
  for (let index = 0; index < nodes.length - 1; index += 1) {
    const previous = nodes[Math.max(0, index - 1)];
    const current = nodes[index];
    const next = nodes[index + 1];
    const afterNext = nodes[Math.min(nodes.length - 1, index + 2)];
    const controlA = {
      x: current.x + (next.x - previous.x) / 6,
      y: current.y + (next.y - previous.y) / 6,
    };
    const controlB = {
      x: next.x - (afterNext.x - current.x) / 6,
      y: next.y - (afterNext.y - current.y) / 6,
    };
    command.push(`C ${controlA.x.toFixed(2)} ${controlA.y.toFixed(2)}, ${controlB.x.toFixed(2)} ${controlB.y.toFixed(2)}, ${next.x} ${next.y}`);
  }
  return command.join(' ');
};

const clampRewardMapPercent = (value: number) => Math.min(98, Math.max(2, Number(value.toFixed(2))));

const cloneRewardStageNodes = (nodes: RewardStageNode[]) => nodes.map((node) => ({
  x: clampRewardMapPercent(Number(node.x)),
  y: clampRewardMapPercent(Number(node.y)),
  label: String(node.label),
}));

const normalizeRewardStageNodes = (nodes: RewardStageNode[]) => {
  const safeNodes = cloneRewardStageNodes(nodes).filter((node) => Number.isFinite(node.x) && Number.isFinite(node.y));
  if (safeNodes.length === rewardStageTotal) {
    return safeNodes.map((node, index) => ({ ...node, label: rewardStageLabel(index) }));
  }
  if (safeNodes.length < 2) return safeNodes;
  return Array.from({ length: rewardStageTotal }, (_, index) => {
    const sourcePosition = (index / (rewardStageTotal - 1)) * (safeNodes.length - 1);
    const fromIndex = Math.floor(sourcePosition);
    const toIndex = Math.min(safeNodes.length - 1, fromIndex + 1);
    const ratio = sourcePosition - fromIndex;
    const from = safeNodes[fromIndex];
    const to = safeNodes[toIndex];
    return {
      x: clampRewardMapPercent(from.x + (to.x - from.x) * ratio),
      y: clampRewardMapPercent(from.y + (to.y - from.y) * ratio),
      label: rewardStageLabel(index),
    };
  });
};

const defaultRewardStageNodes = (theme: RewardMapTheme) => normalizeRewardStageNodes(rewardStageLayouts[theme]);

const rewardStageStarCount = (monthMinutes: number, stageIndex: number, stageMinutes: number) => {
  const stageStartMinutes = stageIndex * stageMinutes;
  if (monthMinutes >= stageStartMinutes + stageMinutes) return rewardStageStarsPerStage;
  if (monthMinutes < stageStartMinutes) return 0;
  return Math.min(rewardStageStarsPerStage, Math.floor((monthMinutes - stageStartMinutes) / rewardStageStarMinutes));
};

const mapObject = (kind: string, x: number, y: number, scale = 1, rotate = 0) => ({
  kind,
  x,
  y,
  scale,
  rotate,
});

type PremiumMapObject = { id?: string; kind: string; x: number; y: number; scale?: number; rotate?: number };
type PremiumLandmark = Required<Pick<PremiumMapObject, 'id'>> & PremiumMapObject;
type PremiumWorldConfig = {
  skyTop: string;
  skyMid: string;
  skyBottom: string;
  horizon: string;
  terrainA: string;
  terrainB: string;
  terrainC: string;
  sideA: string;
  sideB: string;
  shadow: string;
  accent: string;
  landmarkTop: string;
  landmarkFront: string;
  landmarkSide: string;
  landmarks: PremiumLandmark[];
};

const premiumWorldConfigs: Record<RewardMapTheme, PremiumWorldConfig> = {
  august: {
    skyTop: '#6ee7ff',
    skyMid: '#dffcff',
    skyBottom: '#58d8cf',
    horizon: '#c7fff1',
    terrainA: '#9af064',
    terrainB: '#35c96d',
    terrainC: '#098a55',
    sideA: '#c07831',
    sideB: '#84421f',
    shadow: '#065f46',
    accent: '#f59e0b',
    landmarkTop: '#a5f3fc',
    landmarkFront: '#22c7a9',
    landmarkSide: '#0f766e',
    landmarks: [
      { id: 'august-lighthouse', ...mapObject('coast-lighthouse', 210, 172, 1.28, -6) },
      { id: 'august-sand-castle', ...mapObject('coast-sand-castle', 520, 130, 1.16, 8) },
      { id: 'august-pier', ...mapObject('coast-pier', 1030, 460, 1.08, -12) },
      { id: 'august-sailboat', ...mapObject('coast-sailboat', 858, 504, 0.94, 7) },
    ],
  },
  september: {
    skyTop: '#c8f7ff',
    skyMid: '#f7ffe8',
    skyBottom: '#b9f4c9',
    horizon: '#f1ffe8',
    terrainA: '#c4ef66',
    terrainB: '#65c94e',
    terrainC: '#2b8b48',
    sideA: '#b68745',
    sideB: '#6f4d2a',
    shadow: '#315a2e',
    accent: '#2563eb',
    landmarkTop: '#dbeafe',
    landmarkFront: '#60a5fa',
    landmarkSide: '#2563eb',
    landmarks: [
      { id: 'september-clocktower', ...mapObject('campus-clocktower', 180, 135, 1.18, -5) },
      { id: 'september-greenhouse', ...mapObject('campus-greenhouse', 540, 130, 1.08, 8) },
      { id: 'september-fountain', ...mapObject('campus-fountain', 1040, 480, 1.1, -4) },
      { id: 'september-library-cart', ...mapObject('campus-library-cart', 300, 500, 0.92, 5) },
    ],
  },
  october: {
    skyTop: '#2b174d',
    skyMid: '#5b21b6',
    skyBottom: '#f59e0b',
    horizon: '#fed7aa',
    terrainA: '#f6b75f',
    terrainB: '#c66a2f',
    terrainC: '#7c2d12',
    sideA: '#8f4f2a',
    sideB: '#4b1f16',
    shadow: '#1e1b4b',
    accent: '#f97316',
    landmarkTop: '#fde68a',
    landmarkFront: '#fb7185',
    landmarkSide: '#be123c',
    landmarks: [
      { id: 'october-tent', ...mapObject('festival-tent', 180, 135, 1.18, -5) },
      { id: 'october-stage', ...mapObject('festival-stage', 300, 500, 0.94, 7) },
      { id: 'october-arch', ...mapObject('festival-arch', 1040, 480, 1.08, -4) },
      { id: 'october-moon-boat', ...mapObject('festival-moon-boat', 1120, 430, 0.9, 5) },
    ],
  },
  november: {
    skyTop: '#dbeafe',
    skyMid: '#eef2ff',
    skyBottom: '#c4b5fd',
    horizon: '#e0f2fe',
    terrainA: '#93c5fd',
    terrainB: '#6366f1',
    terrainC: '#312e81',
    sideA: '#5344a7',
    sideB: '#2e2365',
    shadow: '#312e81',
    accent: '#22d3ee',
    landmarkTop: '#ffffff',
    landmarkFront: '#67e8f9',
    landmarkSide: '#4f46e5',
    landmarks: [
      { id: 'november-observatory', ...mapObject('lab-observatory', 180, 135, 1.16, -6) },
      { id: 'november-reactor', ...mapObject('lab-reactor', 540, 130, 1.08, 6) },
      { id: 'november-prism-tower', ...mapObject('lab-prism-tower', 1040, 480, 1.04, -5) },
      { id: 'november-crystal-gate', ...mapObject('lab-crystal-gate', 1120, 430, 0.88, 5) },
    ],
  },
  december: {
    skyTop: '#dbeafe',
    skyMid: '#ffffff',
    skyBottom: '#bfdbfe',
    horizon: '#eff6ff',
    terrainA: '#ffffff',
    terrainB: '#bfdbfe',
    terrainC: '#60a5fa',
    sideA: '#93b7d2',
    sideB: '#547c9c',
    shadow: '#1d4ed8',
    accent: '#2563eb',
    landmarkTop: '#ffffff',
    landmarkFront: '#93c5fd',
    landmarkSide: '#2563eb',
    landmarks: [
      { id: 'december-cabin', ...mapObject('snow-cabin', 180, 135, 1.14, -6) },
      { id: 'december-igloo', ...mapObject('snow-igloo', 345, 110, 1.04, 4) },
      { id: 'december-castle', ...mapObject('snow-castle', 1040, 480, 1.06, -5) },
      { id: 'december-lodge', ...mapObject('snow-lodge', 1120, 430, 0.9, 6) },
    ],
  },
};

function RewardWorldBackdrop({ theme }: { theme: RewardMapTheme }) {
  const config = premiumWorldConfigs[theme];
  const skyId = `${theme}-premium-sky`;
  const terrainId = `${theme}-premium-terrain`;
  const sideId = `${theme}-premium-side`;
  const glowId = `${theme}-premium-light`;
  const waterId = `${theme}-premium-water`;
  const textureId = `${theme}-premium-texture`;
  const gridId = `${theme}-premium-grid`;
  const platformShapes: Record<RewardMapTheme, { top: string; side: string; rim: string }> = {
    august: {
      top: 'M70 354 C132 284 244 260 350 292 C438 210 600 188 748 238 C866 218 1010 236 1130 306 C1162 325 1156 364 1110 392 C1014 452 842 468 686 436 C548 490 352 480 206 414 C120 420 54 394 70 354Z',
      side: 'M70 354 C132 284 244 260 350 292 C438 210 600 188 748 238 C866 218 1010 236 1130 306 C1162 325 1156 364 1110 392 C1014 452 842 468 686 436 C548 490 352 480 206 414 C120 420 54 394 70 354 L70 392 C124 454 270 498 446 500 C528 502 610 494 686 474 C844 507 1030 484 1130 426 C1162 407 1170 370 1130 340 C1010 270 866 252 748 272 C600 222 438 244 350 326 C244 294 132 318 70 392Z',
      rim: 'M88 350 C162 296 254 286 348 316 C444 245 592 225 726 268 C850 246 992 260 1108 326',
    },
    september: {
      top: 'M86 302 L204 244 L340 248 L452 204 L612 196 L728 228 L842 214 L1008 250 L1134 334 L1052 430 L858 466 L690 438 L530 492 L338 448 L182 456 L64 386Z',
      side: 'M86 302 L204 244 L340 248 L452 204 L612 196 L728 228 L842 214 L1008 250 L1134 334 L1052 430 L858 466 L690 438 L530 492 L338 448 L182 456 L64 386Z M64 386 L64 426 L178 496 L336 490 L530 528 L690 476 L858 506 L1052 470 L1134 374 L1134 334 L1052 430 L858 466 L690 438 L530 492 L338 448 L182 456Z',
      rim: 'M110 326 L218 272 L334 276 L454 232 L604 226 L724 258 L848 242 L984 276 L1102 344',
    },
    october: {
      top: 'M78 374 L188 268 L340 242 L486 272 L610 210 L760 238 L910 206 L1118 330 L1068 436 L892 454 L730 420 L574 482 L402 458 L244 492 L78 432Z',
      side: 'M78 374 L188 268 L340 242 L486 272 L610 210 L760 238 L910 206 L1118 330 L1068 436 L892 454 L730 420 L574 482 L402 458 L244 492 L78 432Z M78 432 L78 472 L244 532 L402 496 L574 522 L730 460 L892 494 L1068 476 L1118 370 L1118 330 L1068 436 L892 454 L730 420 L574 482 L402 458 L244 492Z',
      rim: 'M108 384 L206 292 L340 270 L478 300 L610 240 L760 268 L906 238 L1084 344',
    },
    november: {
      top: 'M74 332 L210 270 L354 280 L480 214 L626 240 L732 194 L880 240 L1132 320 L1064 438 L894 462 L728 418 L574 486 L388 446 L218 462 L74 392Z',
      side: 'M74 332 L210 270 L354 280 L480 214 L626 240 L732 194 L880 240 L1132 320 L1064 438 L894 462 L728 418 L574 486 L388 446 L218 462 L74 392Z M74 392 L74 438 L218 502 L388 484 L574 524 L728 456 L894 504 L1064 480 L1132 362 L1132 320 L1064 438 L894 462 L728 418 L574 486 L388 446 L218 462Z',
      rim: 'M106 344 L222 296 L354 306 L482 242 L626 270 L734 224 L878 268 L1094 336',
    },
    december: {
      top: 'M70 374 C180 292 302 266 418 290 L552 222 L698 278 L826 214 L1012 262 L1138 354 C1090 424 998 458 862 456 L724 424 L574 476 L398 444 L236 472 C146 462 88 430 70 374Z',
      side: 'M70 374 C180 292 302 266 418 290 L552 222 L698 278 L826 214 L1012 262 L1138 354 C1090 424 998 458 862 456 L724 424 L574 476 L398 444 L236 472 C146 462 88 430 70 374 L70 414 C116 474 194 510 326 514 L398 482 L574 514 L724 462 L862 496 C998 498 1090 464 1138 394 L1138 354 C1090 424 998 458 862 456 L724 424 L574 476 L398 444 L236 472 C146 462 88 430 70 374Z',
      rim: 'M108 366 C198 312 306 292 414 318 L552 250 L696 306 L826 244 L994 288 L1104 358',
    },
  };
  const shape = platformShapes[theme];
  const props: Record<RewardMapTheme, PremiumMapObject[]> = {
    august: [
      mapObject('coast-palm', 90, 310, 0.66, -8),
      mapObject('coast-starfish', 150, 460, 0.64, 9),
      mapObject('coast-crab', 300, 500, 0.72, -4),
      mapObject('coast-shell', 345, 110, 0.58, 6),
      mapObject('coast-coral', 420, 420, 0.72, -10),
      mapObject('coast-turtle', 1040, 520, 0.68, 4),
      mapObject('coast-fish', 620, 105, 0.58, 6),
      mapObject('coast-jelly', 1000, 130, 0.64, -5),
      mapObject('coast-umbrella', 730, 360, 0.68, 8),
      mapObject('coast-beach-ball', 780, 520, 0.6, -7),
      mapObject('coast-bucket', 930, 520, 0.64, 6),
      mapObject('coast-anchor', 980, 100, 0.62, -6),
      mapObject('coast-bottle', 1120, 430, 0.58, 0),
      mapObject('coast-clam', 1180, 370, 0.58, 7),
      mapObject('coast-seaweed', 120, 220, 0.62, -9),
      mapObject('coast-conch', 390, 170, 0.58, 5),
      mapObject('coast-sandbar', 560, 330, 0.64, -6),
      mapObject('coast-float', 240, 380, 0.58, 8),
    ],
    september: [
      mapObject('campus-open-book', 120, 220, 0.66, -4),
      mapObject('campus-pencil', 150, 460, 0.7, 7),
      mapObject('campus-backpack', 240, 380, 0.66, -8),
      mapObject('campus-bench', 345, 110, 0.6, 5),
      mapObject('campus-round-tree', 390, 170, 0.72, -4),
      mapObject('campus-maple-tree', 420, 420, 0.68, 8),
      mapObject('campus-notebook', 500, 480, 0.66, -6),
      mapObject('campus-ruler', 620, 105, 0.62, 6),
      mapObject('campus-lamp', 660, 500, 0.68, -5),
      mapObject('campus-apple', 760, 120, 0.62, 7),
      mapObject('campus-bike', 830, 320, 0.66, -3),
      mapObject('campus-trophy', 860, 500, 0.62, 8),
      mapObject('campus-paper-plane', 900, 150, 0.62, -6),
      mapObject('campus-magnifier', 1000, 130, 0.64, 5),
      mapObject('campus-flowerbed', 1120, 430, 0.66, -4),
      mapObject('campus-tablet', 1180, 370, 0.6, 6),
      mapObject('campus-chair', 560, 330, 0.58, -7),
      mapObject('campus-coffee', 320, 340, 0.58, 4),
    ],
    october: [
      mapObject('festival-lantern', 90, 310, 0.66, -5),
      mapObject('festival-pumpkin', 120, 220, 0.66, 8),
      mapObject('festival-balloon', 180, 210, 0.62, -7),
      mapObject('festival-candy', 260, 180, 0.62, 5),
      mapObject('festival-mask', 345, 110, 0.62, -4),
      mapObject('festival-drum', 390, 170, 0.64, 7),
      mapObject('festival-firework', 540, 130, 0.66, -6),
      mapObject('festival-sparkler', 620, 105, 0.58, 5),
      mapObject('festival-garland', 620, 280, 0.58, -8),
      mapObject('festival-popcorn', 660, 500, 0.6, 6),
      mapObject('festival-cauldron', 760, 120, 0.66, -5),
      mapObject('festival-star-lamp', 780, 520, 0.62, 8),
      mapObject('festival-ticket', 860, 500, 0.62, -6),
      mapObject('festival-flame', 980, 100, 0.62, 6),
      mapObject('festival-ghost-light', 960, 512, 0.62, -5),
      mapObject('festival-banner', 1150, 494, 0.6, 5),
      mapObject('festival-confetti', 1180, 370, 0.58, -4),
      mapObject('festival-cup', 430, 510, 0.58, 8),
    ],
    november: [
      mapObject('lab-crystal-cluster', 120, 220, 0.66, -6),
      mapObject('lab-beaker', 150, 460, 0.64, 8),
      mapObject('lab-test-tube', 210, 90, 0.62, -8),
      mapObject('lab-microscope', 240, 380, 0.66, 4),
      mapObject('lab-atom', 320, 340, 0.68, -4),
      mapObject('lab-circuit', 345, 110, 0.62, 7),
      mapObject('lab-console', 500, 480, 0.66, -6),
      mapObject('lab-data-cube', 610, 72, 0.62, 5),
      mapObject('lab-satellite', 620, 105, 0.62, -8),
      mapObject('lab-magnet', 660, 500, 0.64, 8),
      mapObject('lab-flask', 690, 250, 0.6, -6),
      mapObject('lab-orb', 780, 520, 0.62, 7),
      mapObject('lab-laser', 830, 320, 0.58, -4),
      mapObject('lab-geode', 860, 500, 0.66, 4),
      mapObject('lab-chip', 970, 520, 0.62, -6),
      mapObject('lab-drone', 1150, 500, 0.58, 6),
      mapObject('lab-vial', 1180, 370, 0.58, -5),
      mapObject('lab-telescope', 260, 180, 0.58, 8),
    ],
    december: [
      mapObject('snow-pine', 90, 310, 0.66, -5),
      mapObject('snow-snowman', 120, 220, 0.66, 8),
      mapObject('snow-gift', 150, 460, 0.62, -7),
      mapObject('snow-sled', 180, 210, 0.62, 5),
      mapObject('snow-candy-cane', 260, 180, 0.62, -5),
      mapObject('snow-crystal', 300, 500, 0.66, 7),
      mapObject('snow-mitten', 390, 170, 0.62, -6),
      mapObject('snow-skates', 420, 420, 0.62, 5),
      mapObject('snow-lantern', 470, 360, 0.58, -8),
      mapObject('snow-fence-piece', 540, 130, 0.62, 7),
      mapObject('snow-berry-tree', 620, 105, 0.64, -5),
      mapObject('snow-stump', 660, 500, 0.58, 8),
      mapObject('snow-globe', 780, 520, 0.66, -6),
      mapObject('snow-star', 860, 500, 0.64, 5),
      mapObject('snow-wreath', 980, 100, 0.62, -4),
      mapObject('snow-hot-cocoa', 960, 520, 0.62, 6),
      mapObject('snow-bell', 1150, 500, 0.58, -5),
      mapObject('snow-snowflake', 1180, 370, 0.58, 8),
    ],
  };
  const themeLabel = theme === 'december' ? 'snow' : theme === 'august' ? 'coast' : theme === 'september' ? 'forest' : theme === 'october' ? 'festival' : 'crystal';
  const renderObjectArt = (kind: string) => {
    if (kind === 'coast-lighthouse') {
      return (
        <>
          <path d="M-22 36 0-48 22 36Z" fill="#f8fafc" stroke="#e2e8f0" strokeWidth="4" />
          <path d="M-14 -10H14V36H-14Z" fill="#f97316" opacity="0.72" />
          <path d="M-28 -48H28L16-65H-16Z" fill="#0ea5e9" stroke="#e0f2fe" strokeWidth="4" />
          <circle cx="0" cy="-42" r="9" fill="#fde68a" />
          <path d="M-52 -42H-18M18 -42H52" stroke="#fde68a" strokeWidth="8" strokeLinecap="round" opacity="0.42" />
        </>
      );
    }
    if (kind === 'coast-sand-castle') {
      return (
        <>
          <path d="M-42 32H42L30-24H-30Z" fill="#f8d889" stroke="#c58f35" strokeWidth="4" />
          <path d="M-28-24V-48H-8V-24M8-24V-56H30V-24" fill="#f8d889" stroke="#c58f35" strokeWidth="4" />
          <path d="M-34 0H34" stroke="#fff3c4" strokeWidth="5" strokeLinecap="round" />
          <circle cx="0" cy="17" r="9" fill="#d69e3d" />
        </>
      );
    }
    if (kind === 'coast-pier') {
      return (
        <>
          <path d="M-50 10 40-34 54-16-36 30Z" fill="#b7791f" stroke="#7c4a20" strokeWidth="5" />
          <path d="M-28 0 22-24M-6 10 44-14M-46 16 4-8" stroke="#f7c873" strokeWidth="5" strokeLinecap="round" />
          <path d="M-34 20V44M28-20V6" stroke="#7c4a20" strokeWidth="8" strokeLinecap="round" />
        </>
      );
    }
    if (kind === 'coast-sailboat') {
      return (
        <>
          <path d="M-45 16 C-18 34 22 34 48 14 L34 36H-30Z" fill="#0f766e" />
          <path d="M0 14V-48" stroke="#475569" strokeWidth="5" strokeLinecap="round" />
          <path d="M4-45V10L46 8Z" fill="#f8fafc" stroke="#bfdbfe" strokeWidth="3" />
          <path d="M-4-35V10L-38 10Z" fill="#f97316" stroke="#fed7aa" strokeWidth="3" />
        </>
      );
    }
    if (kind === 'coast-palm' || kind === 'campus-round-tree' || kind === 'campus-maple-tree' || kind === 'snow-pine' || kind === 'snow-berry-tree') {
      const snowy = kind.startsWith('snow-');
      const maple = kind === 'campus-maple-tree';
      if (snowy) {
        return (
          <>
            <path d="M0 36V-26" stroke="#8b5a2b" strokeWidth="9" strokeLinecap="round" />
            <path d="M0-62-38 8h76Z" fill={kind === 'snow-berry-tree' ? '#166534' : '#1f7a59'} stroke="#e0f2fe" strokeWidth="4" />
            <path d="M0-32-30 24h60Z" fill={kind === 'snow-berry-tree' ? '#15803d' : '#2f9e75'} stroke="#e0f2fe" strokeWidth="4" />
            {kind === 'snow-berry-tree' ? <><circle cx="-12" cy="-12" r="5" fill="#ef4444" /><circle cx="16" cy="8" r="5" fill="#ef4444" /></> : null}
          </>
        );
      }
      if (kind === 'coast-palm') {
        return (
          <>
            <path d="M-4 36 C10 4 8-24-4-44" stroke="#9a5f2f" strokeWidth="9" strokeLinecap="round" />
            <path d="M-2-42 C-42-62-58-34-20-30Z" fill="#16a34a" />
            <path d="M-2-42 C34-70 58-42 20-30Z" fill="#22c55e" />
            <path d="M-2-42 C-22-18-12 0 4-24Z" fill="#15803d" />
            <circle cx="3" cy="-38" r="8" fill="#b45309" />
          </>
        );
      }
      return (
        <>
          <path d="M0 34V-8" stroke="#8b5a2b" strokeWidth="9" strokeLinecap="round" />
          <circle cx="-20" cy="-18" r="24" fill={maple ? '#f59e0b' : '#22c55e'} />
          <circle cx="10" cy="-30" r="28" fill={maple ? '#ef4444' : '#16a34a'} />
          <circle cx="28" cy="-10" r="22" fill={maple ? '#f97316' : '#4ade80'} />
        </>
      );
    }
    if (kind === 'coast-starfish') return <path d="M0-42 12-12 44-14 18 6 28 38 0 20-28 38-18 6-44-14-12-12Z" fill="#fb7185" stroke="#fecdd3" strokeWidth="4" />;
    if (kind === 'coast-crab') return <><ellipse cx="0" cy="8" rx="28" ry="20" fill="#ef4444" /><circle cx="-12" cy="-14" r="5" fill="#0f172a" /><circle cx="12" cy="-14" r="5" fill="#0f172a" /><path d="M-28 4-52-12M28 4 52-12M-20 22-40 38M20 22 40 38" stroke="#ef4444" strokeWidth="8" strokeLinecap="round" /></>;
    if (kind === 'coast-shell' || kind === 'coast-conch' || kind === 'coast-clam') return <><path d="M-38 24 C-30-28 30-28 38 24Z" fill={kind === 'coast-conch' ? '#fb923c' : '#f9a8d4'} stroke="#fff7ed" strokeWidth="4" /><path d="M-22 18 C-16-14-8-26 0-30M0 24V-30M22 18 C16-14 8-26 0-30" stroke="#be185d" strokeWidth="3" opacity="0.38" /></>;
    if (kind === 'coast-coral' || kind === 'coast-seaweed') return <><path d="M0 38V-32M0-10-24-30M0 4 28-18M0 20-22 6" stroke={kind === 'coast-coral' ? '#fb7185' : '#16a34a'} strokeWidth="10" strokeLinecap="round" /><circle cx="0" cy="-32" r="9" fill={kind === 'coast-coral' ? '#fda4af' : '#4ade80'} /></>;
    if (kind === 'coast-turtle') return <><ellipse cx="0" cy="8" rx="34" ry="24" fill="#22c55e" stroke="#bbf7d0" strokeWidth="4" /><circle cx="38" cy="4" r="12" fill="#4ade80" /><path d="M-12-8 12 24M14-8-10 24" stroke="#15803d" strokeWidth="4" /></>;
    if (kind === 'coast-fish' || kind === 'coast-jelly') {
      if (kind === 'coast-jelly') return <><path d="M-30 4 C-26-34 26-34 30 4 C24 22-24 22-30 4Z" fill="#a78bfa" stroke="#ddd6fe" strokeWidth="4" /><path d="M-18 20 C-24 34-10 38-16 50M0 22 C-8 34 8 38 0 50M18 20 C10 34 24 38 16 50" stroke="#c4b5fd" strokeWidth="5" strokeLinecap="round" /></>;
      return <><path d="M-42 0 C-16-28 22-28 46 0 C22 28-16 28-42 0Z" fill="#38bdf8" stroke="#e0f2fe" strokeWidth="4" /><path d="M-42 0-58-20V20Z" fill="#0ea5e9" /><circle cx="20" cy="-6" r="5" fill="#0f172a" /></>;
    }
    if (kind === 'coast-umbrella') return <><path d="M-44 0 C-28-46 28-46 44 0Z" fill="#f97316" stroke="#fed7aa" strokeWidth="4" /><path d="M0 0V42" stroke="#7c4a20" strokeWidth="6" strokeLinecap="round" /><path d="M0-38V0" stroke="#fff7ed" strokeWidth="5" /></>;
    if (kind === 'coast-beach-ball' || kind === 'coast-float') return <><circle cx="0" cy="0" r="30" fill="#f8fafc" stroke="#bae6fd" strokeWidth="4" /><path d="M0-30 A30 30 0 0 1 30 0H0Z" fill="#ef4444" /><path d="M0 30 A30 30 0 0 1-30 0H0Z" fill="#facc15" /></>;
    if (kind === 'coast-bucket') return <><path d="M-28-14H28L20 34H-20Z" fill="#38bdf8" stroke="#e0f2fe" strokeWidth="4" /><path d="M-20-14 C-16-38 16-38 20-14" fill="none" stroke="#64748b" strokeWidth="5" /></>;
    if (kind === 'coast-anchor') return <><path d="M0-44V28M-24-20H24M-34 8 C-24 44 24 44 34 8" fill="none" stroke="#475569" strokeWidth="9" strokeLinecap="round" /><circle cx="0" cy="-50" r="10" fill="none" stroke="#475569" strokeWidth="7" /></>;
    if (kind === 'coast-bottle') return <><path d="M-13-40H13V-8L28 24C16 38-16 38-28 24L-13-8Z" fill="#a7f3d0" stroke="#0f766e" strokeWidth="4" /><path d="M-10-52H10V-38H-10Z" fill="#0f766e" /></>;
    if (kind === 'coast-sandbar') return <path d="M-50 12 C-34-18 28-22 52 6 C30 30-30 34-50 12Z" fill="#fde68a" stroke="#facc15" strokeWidth="4" />;

    if (kind.startsWith('campus-')) {
      if (kind === 'campus-clocktower') return <><path d="M-28 34H28V-30H-28Z" fill="#f8fafc" stroke="#60a5fa" strokeWidth="4" /><path d="M-36-30H36L0-58Z" fill="#2563eb" /><circle cx="0" cy="-8" r="13" fill="#dbeafe" stroke="#1d4ed8" strokeWidth="4" /><path d="M0-8V-17M0-8 8-2" stroke="#1d4ed8" strokeWidth="4" strokeLinecap="round" /></>;
      if (kind === 'campus-greenhouse') return <><path d="M-46 22V-8L0-42 46-8V22Z" fill="#bfdbfe" stroke="#2563eb" strokeWidth="4" opacity="0.86" /><path d="M-36 22H36V-2H-36Z" fill="#22c55e" /><path d="M0-42V22M-24 10 0-20 24 10" stroke="#e0f2fe" strokeWidth="4" /></>;
      if (kind === 'campus-fountain') return <><ellipse cx="0" cy="22" rx="44" ry="16" fill="#93c5fd" stroke="#dbeafe" strokeWidth="4" /><path d="M-18 8 C-6-30 6-30 18 8" fill="none" stroke="#38bdf8" strokeWidth="6" strokeLinecap="round" /><circle cx="0" cy="4" r="12" fill="#60a5fa" /></>;
      if (kind === 'campus-library-cart') return <><path d="M-42-8H38V26H-42Z" fill="#94a3b8" stroke="#f8fafc" strokeWidth="4" /><rect x="-34" y="-36" width="18" height="30" fill="#f87171" /><rect x="-12" y="-42" width="18" height="36" fill="#60a5fa" /><rect x="10" y="-30" width="18" height="24" fill="#facc15" /><circle cx="-24" cy="32" r="7" fill="#0f172a" /><circle cx="22" cy="32" r="7" fill="#0f172a" /></>;
      if (kind.includes('book') || kind.includes('notebook')) return <><path d="M-42-28 C-20-36-6-26 0-16 C6-26 20-36 42-28V30C22 22 8 24 0 36C-8 24-22 22-42 30Z" fill="#ffffff" stroke="#60a5fa" strokeWidth="4" /><path d="M0-16V34" stroke="#2563eb" strokeWidth="4" /></>;
      if (kind === 'campus-pencil' || kind === 'campus-ruler') return <><path d="M-48 12 28-34 44-12-32 34Z" fill={kind === 'campus-pencil' ? '#facc15' : '#fde68a'} stroke="#b45309" strokeWidth="4" /><path d="M28-34 50-46 44-12Z" fill="#fca5a5" /></>;
      if (kind === 'campus-backpack') return <><path d="M-30-16 C-26-42 26-42 30-16V34H-30Z" fill="#3b82f6" stroke="#bfdbfe" strokeWidth="4" /><path d="M-16-18V18H16V-18" stroke="#1d4ed8" strokeWidth="5" /><path d="M-22-14 C-42 2-42 24-24 32M22-14 C42 2 42 24 24 32" stroke="#1e3a8a" strokeWidth="5" fill="none" /></>;
      if (kind === 'campus-bench' || kind === 'campus-chair') return <><path d="M-42-12H42M-34 8H34" stroke="#92400e" strokeWidth="10" strokeLinecap="round" /><path d="M-30 8V34M30 8V34" stroke="#475569" strokeWidth="6" /></>;
      if (kind === 'campus-lamp') return <><path d="M0 34V-30" stroke="#475569" strokeWidth="7" strokeLinecap="round" /><path d="M-24-30H24L14-48H-14Z" fill="#fde68a" stroke="#f59e0b" strokeWidth="4" /><circle cx="0" cy="-26" r="16" fill="#fef3c7" opacity="0.5" /></>;
      if (kind === 'campus-apple') return <><circle cx="-8" cy="4" r="24" fill="#ef4444" /><circle cx="10" cy="4" r="24" fill="#dc2626" /><path d="M0-20 C0-42 16-42 24-54" stroke="#166534" strokeWidth="6" strokeLinecap="round" /><path d="M4-34 C20-44 34-34 24-22Z" fill="#22c55e" /></>;
      if (kind === 'campus-bike') return <><circle cx="-30" cy="18" r="18" fill="none" stroke="#1e3a8a" strokeWidth="5" /><circle cx="30" cy="18" r="18" fill="none" stroke="#1e3a8a" strokeWidth="5" /><path d="M-30 18 0-10 30 18H-8L-30 18M0-10 10-28" stroke="#60a5fa" strokeWidth="5" fill="none" strokeLinecap="round" /></>;
      if (kind === 'campus-trophy') return <><path d="M-24-28H24V-4C24 18 8 26 0 26S-24 18-24-4Z" fill="#facc15" stroke="#b45309" strokeWidth="4" /><path d="M-24-18H-44C-42 6-28 8-20 0M24-18H44C42 6 28 8 20 0" fill="none" stroke="#facc15" strokeWidth="7" /><path d="M0 26V42M-20 42H20" stroke="#b45309" strokeWidth="7" strokeLinecap="round" /></>;
      if (kind === 'campus-paper-plane') return <path d="M-48-8 48-42 18 42 0 8Z" fill="#e0f2fe" stroke="#2563eb" strokeWidth="4" />;
      if (kind === 'campus-magnifier') return <><circle cx="-8" cy="-8" r="26" fill="#dbeafe" stroke="#2563eb" strokeWidth="6" opacity="0.9" /><path d="M12 12 42 42" stroke="#1e3a8a" strokeWidth="9" strokeLinecap="round" /></>;
      if (kind === 'campus-flowerbed') return <><path d="M-46 18H46L34 36H-34Z" fill="#92400e" /><circle cx="-24" cy="0" r="11" fill="#f472b6" /><circle cx="0" cy="-6" r="12" fill="#facc15" /><circle cx="24" cy="0" r="11" fill="#60a5fa" /></>;
      if (kind === 'campus-tablet') return <><rect x="-34" y="-38" width="68" height="76" rx="8" fill="#0f172a" stroke="#e0f2fe" strokeWidth="4" /><rect x="-24" y="-26" width="48" height="50" rx="4" fill="#93c5fd" /></>;
      if (kind === 'campus-coffee') return <><path d="M-26-18H22V30H-18Z" fill="#f8fafc" stroke="#94a3b8" strokeWidth="4" /><path d="M22-8H38C42 10 32 20 22 16" fill="none" stroke="#94a3b8" strokeWidth="5" /><path d="M-10-34 C-18-46-2-48-10-58M8-34 C0-46 18-48 8-58" stroke="#94a3b8" strokeWidth="4" strokeLinecap="round" /></>;
    }

    if (kind.startsWith('festival-')) {
      if (kind === 'festival-tent') return <><path d="M-52 20 0-52 52 20Z" fill="#fb7185" stroke="#fed7aa" strokeWidth="5" /><path d="M0-52V20" stroke="#fff7ed" strokeWidth="5" /><path d="M-36 20H36V44H-36Z" fill="#7c2d12" /></>;
      if (kind === 'festival-stage') return <><path d="M-50 18H50V42H-50Z" fill="#7c2d12" /><path d="M-42 18 C-22-22 22-22 42 18Z" fill="#facc15" stroke="#fed7aa" strokeWidth="4" /><circle cx="-22" cy="0" r="8" fill="#fb7185" /><circle cx="22" cy="0" r="8" fill="#fb7185" /></>;
      if (kind === 'festival-arch') return <><path d="M-44 40V0C-44-52 44-52 44 0V40" fill="none" stroke="#f97316" strokeWidth="12" strokeLinecap="round" /><circle cx="-22" cy="-22" r="10" fill="#facc15" /><circle cx="22" cy="-22" r="10" fill="#fb7185" /></>;
      if (kind === 'festival-moon-boat') return <><path d="M-44 4 C-18 42 26 42 48 0 C20 18-14 18-44 4Z" fill="#fde68a" stroke="#f59e0b" strokeWidth="4" /><path d="M-26 22 C-4 34 24 30 38 10" stroke="#7c2d12" strokeWidth="5" fill="none" /></>;
      if (kind === 'festival-lantern' || kind === 'festival-star-lamp') return <><path d="M0-46V-28" stroke="#fde68a" strokeWidth="5" /><path d="M-24-28H24V22C8 38-8 38-24 22Z" fill={kind === 'festival-star-lamp' ? '#facc15' : '#fb7185'} stroke="#fed7aa" strokeWidth="4" /><path d="M0-16 7 0 24 1 10 11 15 28 0 18-15 28-10 11-24 1-7 0Z" fill="#fff7ed" opacity="0.76" /></>;
      if (kind === 'festival-pumpkin') return <><ellipse cx="-16" cy="8" rx="20" ry="28" fill="#f97316" /><ellipse cx="16" cy="8" rx="20" ry="28" fill="#ea580c" /><ellipse cx="0" cy="8" rx="24" ry="31" fill="#fb923c" /><path d="M0-24 C4-42 22-34 16-50" stroke="#166534" strokeWidth="6" strokeLinecap="round" /></>;
      if (kind === 'festival-balloon') return <><circle cx="-14" cy="-18" r="19" fill="#60a5fa" /><circle cx="18" cy="-26" r="19" fill="#fb7185" /><path d="M-14 2 C-28 20-20 34-28 46M18-6 C28 16 14 30 22 46" stroke="#fde68a" strokeWidth="4" fill="none" /></>;
      if (kind === 'festival-candy') return <><path d="M-28-18H28V18H-28Z" rx="10" fill="#f8fafc" stroke="#fb7185" strokeWidth="4" /><path d="M-28 0-54-18V18ZM28 0 54-18V18Z" fill="#facc15" /><path d="M-12-18 12 18M8-18 28 14" stroke="#fb7185" strokeWidth="5" /></>;
      if (kind === 'festival-mask') return <><path d="M-44-14 C-18-36 18-36 44-14 C32 22 12 34 0 16 C-12 34-32 22-44-14Z" fill="#a78bfa" stroke="#fde68a" strokeWidth="4" /><circle cx="-18" cy="-4" r="7" fill="#1e1b4b" /><circle cx="18" cy="-4" r="7" fill="#1e1b4b" /></>;
      if (kind === 'festival-drum') return <><ellipse cx="0" cy="-22" rx="32" ry="12" fill="#fde68a" /><path d="M-32-22V22C-20 36 20 36 32 22V-22Z" fill="#dc2626" stroke="#fed7aa" strokeWidth="4" /><path d="M-42-42 42 28M42-42-42 28" stroke="#92400e" strokeWidth="5" strokeLinecap="round" /></>;
      if (kind === 'festival-firework' || kind === 'festival-confetti' || kind === 'festival-sparkler') return <><path d="M0 38V-34M-34 4 34-4M-24-24 24 24M24-24-24 24" stroke="#facc15" strokeWidth="6" strokeLinecap="round" /><circle cx="0" cy="0" r="10" fill="#fb7185" /><circle cx="-32" cy="-28" r="5" fill="#60a5fa" /><circle cx="34" cy="-12" r="5" fill="#f97316" /></>;
      if (kind === 'festival-garland' || kind === 'festival-banner') return <><path d="M-50-18 C-22 8 22 8 50-18" fill="none" stroke="#fde68a" strokeWidth="5" /><path d="M-32-10  -20 18 -8-10ZM-4 2 8 30 20 2ZM26-8 38 20 50-8Z" fill="#fb7185" /></>;
      if (kind === 'festival-popcorn' || kind === 'festival-cup') return <><path d="M-28-20H28L18 36H-18Z" fill="#f8fafc" stroke="#fb7185" strokeWidth="4" /><path d="M-20-20V30M0-20V36M20-20V30" stroke="#ef4444" strokeWidth="5" /><circle cx="-18" cy="-34" r="10" fill="#fde68a" /><circle cx="0" cy="-40" r="11" fill="#fde68a" /><circle cx="18" cy="-34" r="10" fill="#fde68a" /></>;
      if (kind === 'festival-cauldron') return <><path d="M-36-10H36C34 30 20 42 0 42S-34 30-36-10Z" fill="#1f2937" stroke="#94a3b8" strokeWidth="4" /><circle cx="-10" cy="-22" r="8" fill="#a3e635" /><circle cx="12" cy="-24" r="9" fill="#22d3ee" /><path d="M-22 42-34 54M22 42 34 54" stroke="#111827" strokeWidth="6" strokeLinecap="round" /></>;
      if (kind === 'festival-flame' || kind === 'festival-ghost-light') return <><path d="M0-48 C32-12 16 38 0 44 C-24 28-26 0 0-48Z" fill={kind === 'festival-flame' ? '#f97316' : '#f8fafc'} stroke="#fde68a" strokeWidth="4" /><path d="M0-16 C10 6 4 26-8 32 C-18 18-14 0 0-16Z" fill="#facc15" /></>;
      if (kind === 'festival-ticket') return <path d="M-48-24H48V24H-48Z" fill="#fde68a" stroke="#f97316" strokeWidth="4" strokeDasharray="8 6" />;
    }

    if (kind.startsWith('lab-')) {
      if (kind === 'lab-observatory') return <><path d="M-44 30H44V-6H-44Z" fill="#312e81" stroke="#a5f3fc" strokeWidth="4" /><path d="M-34-6 C-20-48 20-48 34-6Z" fill="#67e8f9" opacity="0.84" /><circle cx="0" cy="-20" r="15" fill="#e0f2fe" /></>;
      if (kind === 'lab-reactor') return <><circle cx="0" cy="0" r="42" fill="#312e81" stroke="#67e8f9" strokeWidth="7" /><circle cx="0" cy="0" r="18" fill="#22d3ee" /><path d="M0-52V-32M0 32V52M-52 0H-32M32 0H52" stroke="#a5f3fc" strokeWidth="6" strokeLinecap="round" /></>;
      if (kind === 'lab-prism-tower' || kind === 'lab-crystal-gate') return <><path d="M0-58 42 18 0 48-42 18Z" fill="#67e8f9" stroke="#e0f2fe" strokeWidth="5" opacity="0.9" /><path d="M0-58V48M-42 18H42" stroke="#4f46e5" strokeWidth="4" opacity="0.46" /></>;
      if (kind === 'lab-crystal-cluster' || kind === 'lab-geode') return <><path d="M-28 34-18-26 0-48 14-16 34 32Z" fill="#67e8f9" stroke="#e0f2fe" strokeWidth="4" /><path d="M-48 34-34-6-18-24-18 34Z" fill="#38bdf8" opacity="0.82" /><path d="M16 34 26-2 44 22 42 34Z" fill="#a78bfa" /></>;
      if (kind === 'lab-beaker' || kind === 'lab-flask') return <><path d="M-18-46H18V-12L38 28C24 44-24 44-38 28L-18-12Z" fill="#e0f2fe" stroke="#38bdf8" strokeWidth="4" /><path d="M-28 22 C-8 12 8 30 28 18L36 34C20 44-20 44-36 34Z" fill="#22d3ee" opacity="0.68" /></>;
      if (kind === 'lab-test-tube' || kind === 'lab-vial') return <><path d="M-16-46H16V28C16 42-16 42-16 28Z" fill="#e0f2fe" stroke="#818cf8" strokeWidth="4" /><path d="M-14 8H14V28C14 38-14 38-14 28Z" fill="#a78bfa" /><path d="M-24-46H24" stroke="#e0f2fe" strokeWidth="6" strokeLinecap="round" /></>;
      if (kind === 'lab-microscope') return <><path d="M-28 40H34M-14 28 C28 18 36-18 8-32" stroke="#312e81" strokeWidth="9" strokeLinecap="round" fill="none" /><path d="M4-44 34-28" stroke="#67e8f9" strokeWidth="12" strokeLinecap="round" /><circle cx="-16" cy="20" r="14" fill="#818cf8" /></>;
      if (kind === 'lab-atom') return <><ellipse cx="0" cy="0" rx="46" ry="16" fill="none" stroke="#67e8f9" strokeWidth="5" /><ellipse cx="0" cy="0" rx="46" ry="16" fill="none" stroke="#a78bfa" strokeWidth="5" transform="rotate(60)" /><ellipse cx="0" cy="0" rx="46" ry="16" fill="none" stroke="#60a5fa" strokeWidth="5" transform="rotate(-60)" /><circle cx="0" cy="0" r="9" fill="#f8fafc" /></>;
      if (kind === 'lab-circuit' || kind === 'lab-chip') return <><rect x="-34" y="-34" width="68" height="68" rx="10" fill="#312e81" stroke="#67e8f9" strokeWidth="4" /><path d="M-18-8H18M-18 8H18M-8-18V18M8-18V18" stroke="#a5f3fc" strokeWidth="4" /><circle cx="-24" cy="-24" r="5" fill="#22d3ee" /><circle cx="24" cy="24" r="5" fill="#22d3ee" /></>;
      if (kind === 'lab-console') return <><path d="M-44-20H44V28H-44Z" fill="#1e1b4b" stroke="#67e8f9" strokeWidth="4" /><rect x="-30" y="-8" width="22" height="18" fill="#22d3ee" /><circle cx="20" cy="0" r="8" fill="#a78bfa" /><circle cx="34" cy="10" r="6" fill="#facc15" /></>;
      if (kind === 'lab-data-cube' || kind === 'lab-orb') return <><path d="M0-44 40-20 40 24 0 48-40 24-40-20Z" fill="#38bdf8" stroke="#e0f2fe" strokeWidth="4" opacity="0.86" /><path d="M0-44V48M-40-20 0 4 40-20" stroke="#312e81" strokeWidth="4" opacity="0.38" /></>;
      if (kind === 'lab-satellite' || kind === 'lab-telescope') return <><path d="M-30-6 10-30 30 4-10 28Z" fill="#c7d2fe" stroke="#4f46e5" strokeWidth="4" /><path d="M-48-28-22-12M22 18 48 36M0 0 36-36" stroke="#67e8f9" strokeWidth="5" strokeLinecap="round" /></>;
      if (kind === 'lab-magnet') return <><path d="M-36-32V4C-36 46 36 46 36 4V-32H14V4C14 22-14 22-14 4V-32Z" fill="#ef4444" stroke="#e0f2fe" strokeWidth="4" /><path d="M-36-32H-14M14-32H36" stroke="#67e8f9" strokeWidth="7" /></>;
      if (kind === 'lab-laser') return <><rect x="-44" y="-14" width="54" height="28" rx="8" fill="#312e81" stroke="#67e8f9" strokeWidth="4" /><path d="M12 0H54" stroke="#f472b6" strokeWidth="8" strokeLinecap="round" /><circle cx="0" cy="0" r="8" fill="#f472b6" /></>;
      if (kind === 'lab-drone') return <><rect x="-20" y="-14" width="40" height="28" rx="10" fill="#4f46e5" stroke="#a5f3fc" strokeWidth="4" /><circle cx="-44" cy="-20" r="12" fill="none" stroke="#67e8f9" strokeWidth="5" /><circle cx="44" cy="-20" r="12" fill="none" stroke="#67e8f9" strokeWidth="5" /><path d="M-20-10-34-18M20-10 34-18" stroke="#a5f3fc" strokeWidth="4" /></>;
    }

    if (kind.startsWith('snow-')) {
      if (kind === 'snow-cabin' || kind === 'snow-lodge') return <><path d="M-44 34H44V-8H-44Z" fill="#b45309" stroke="#e0f2fe" strokeWidth="4" /><path d="M-54-8 0-50 54-8Z" fill="#f8fafc" stroke="#bfdbfe" strokeWidth="5" /><rect x="-12" y="8" width="24" height="26" fill="#7c2d12" /></>;
      if (kind === 'snow-igloo') return <><path d="M-48 30 C-42-34 42-34 48 30Z" fill="#e0f2fe" stroke="#ffffff" strokeWidth="5" /><path d="M-32 0H32M-20-22H20M0-34V30M-36 16H36" stroke="#93c5fd" strokeWidth="4" /><path d="M-16 30V8C-16-6 16-6 16 8V30Z" fill="#60a5fa" /></>;
      if (kind === 'snow-castle') return <><path d="M-42 34H42V-24H-42Z" fill="#bfdbfe" stroke="#ffffff" strokeWidth="4" /><path d="M-48-24V-48H-24V-24M24-24V-48H48V-24M-10-24V-58H10V-24" fill="#e0f2fe" stroke="#ffffff" strokeWidth="4" /></>;
      if (kind === 'snow-snowman') return <><circle cx="0" cy="18" r="28" fill="#f8fafc" stroke="#bfdbfe" strokeWidth="4" /><circle cx="0" cy="-22" r="20" fill="#ffffff" stroke="#bfdbfe" strokeWidth="4" /><circle cx="-7" cy="-27" r="3" fill="#0f172a" /><circle cx="7" cy="-27" r="3" fill="#0f172a" /><path d="M0-20 16-16" stroke="#f97316" strokeWidth="5" strokeLinecap="round" /><path d="M-24 2H24" stroke="#ef4444" strokeWidth="6" strokeLinecap="round" /></>;
      if (kind === 'snow-gift') return <><rect x="-34" y="-20" width="68" height="54" rx="6" fill="#ef4444" stroke="#fecaca" strokeWidth="4" /><path d="M0-20V34M-34 4H34" stroke="#fde68a" strokeWidth="8" /><path d="M0-22 C-30-50-38-10 0-22 C30-50 38-10 0-22Z" fill="#fde68a" /></>;
      if (kind === 'snow-sled') return <><path d="M-44 10H32V28H-44Z" fill="#b45309" /><path d="M-52 34 C-22 48 30 48 54 32" fill="none" stroke="#7c2d12" strokeWidth="7" strokeLinecap="round" /><path d="M-28-12V28M18-12V28" stroke="#7c2d12" strokeWidth="6" /></>;
      if (kind === 'snow-candy-cane') return <><path d="M-10 42V-28C-10-54 32-54 32-28C32-10 8-10 8-28" fill="none" stroke="#f8fafc" strokeWidth="16" strokeLinecap="round" /><path d="M-10 32 8 14M-10 4 8-14M10-48 28-32" stroke="#ef4444" strokeWidth="8" strokeLinecap="round" /></>;
      if (kind === 'snow-crystal' || kind === 'snow-snowflake' || kind === 'snow-star') return <><path d="M0-46V46M-40-23 40 23M40-23-40 23" stroke="#60a5fa" strokeWidth="6" strokeLinecap="round" /><circle cx="0" cy="0" r="11" fill="#e0f2fe" stroke="#ffffff" strokeWidth="4" /></>;
      if (kind === 'snow-mitten') return <><path d="M-26-12 C-26-42 18-42 20-10V28C10 42-22 40-30 22Z" fill="#f472b6" stroke="#fbcfe8" strokeWidth="4" /><path d="M20-6 C46-8 46 28 22 28" fill="#f472b6" stroke="#fbcfe8" strokeWidth="4" /></>;
      if (kind === 'snow-skates') return <><path d="M-40-22H4V12H-30Z" fill="#f8fafc" stroke="#94a3b8" strokeWidth="4" /><path d="M8-22H44V12H16Z" fill="#bfdbfe" stroke="#94a3b8" strokeWidth="4" /><path d="M-36 24 C-16 34 22 34 46 24" stroke="#64748b" strokeWidth="5" fill="none" strokeLinecap="round" /></>;
      if (kind === 'snow-lantern') return <><path d="M0-46V-24" stroke="#64748b" strokeWidth="5" /><rect x="-24" y="-24" width="48" height="54" rx="10" fill="#0f172a" stroke="#bfdbfe" strokeWidth="4" /><circle cx="0" cy="2" r="16" fill="#fde68a" opacity="0.86" /></>;
      if (kind === 'snow-fence-piece') return <><path d="M-48-8H48M-48 16H48M-34-28V34M0-28V34M34-28V34" stroke="#e0f2fe" strokeWidth="8" strokeLinecap="round" /></>;
      if (kind === 'snow-stump') return <><ellipse cx="0" cy="-8" rx="28" ry="15" fill="#d97706" stroke="#fde68a" strokeWidth="4" /><path d="M-28-8V30C-14 42 14 42 28 30V-8Z" fill="#92400e" /><path d="M-12-6 C-4-14 8-12 14-4" stroke="#7c2d12" strokeWidth="4" fill="none" /></>;
      if (kind === 'snow-globe') return <><circle cx="0" cy="-8" r="32" fill="#dbeafe" stroke="#ffffff" strokeWidth="5" opacity="0.86" /><path d="M-34 28H34L24 44H-24Z" fill="#7c2d12" /><circle cx="0" cy="-8" r="6" fill="#60a5fa" /></>;
      if (kind === 'snow-wreath') return <><circle cx="0" cy="0" r="31" fill="none" stroke="#15803d" strokeWidth="14" /><circle cx="-14" cy="-18" r="5" fill="#ef4444" /><circle cx="18" cy="-10" r="5" fill="#ef4444" /><path d="M-10 24 0 42 10 24" fill="#ef4444" /></>;
      if (kind === 'snow-hot-cocoa') return <><path d="M-28-18H24V30H-20Z" fill="#f8fafc" stroke="#94a3b8" strokeWidth="4" /><path d="M24-8H40C44 10 34 22 24 16" fill="none" stroke="#94a3b8" strokeWidth="5" /><circle cx="-8" cy="-24" r="7" fill="#ffffff" /><circle cx="10" cy="-26" r="7" fill="#ffffff" /></>;
      if (kind === 'snow-bell') return <><path d="M-30 22 C-24-18-14-42 0-42S24-18 30 22Z" fill="#facc15" stroke="#fef3c7" strokeWidth="4" /><path d="M-38 24H38" stroke="#b45309" strokeWidth="6" strokeLinecap="round" /><circle cx="0" cy="32" r="7" fill="#b45309" /></>;
    }

    return <circle cx="0" cy="0" r="28" fill="#e0f2fe" stroke="#ffffff" strokeWidth="4" />;
  };
  const renderThemeObject = (object: PremiumMapObject, index: number, feature = false) => {
    const transform = `translate(${object.x} ${object.y}) rotate(${object.rotate ?? 0}) scale(${object.scale ?? 1})`;

    return (
      <g className={`theme-object ${feature ? 'feature-object' : 'prop-object'} object-${object.kind}`} key={object.id ?? `${object.kind}-${index}`} transform={transform}>
        <ellipse className="theme-object-shadow" cx="0" cy="42" rx={feature ? 62 : 42} ry={feature ? 15 : 11} />
        {renderObjectArt(object.kind)}
      </g>
    );
  };

  return (
    <svg className={`reward-world reward-world-premium reward-world-${theme}`} viewBox="0 0 1200 560" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id={skyId} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor={config.skyTop} />
          <stop offset="0.5" stopColor={config.skyMid} />
          <stop offset="1" stopColor={config.skyBottom} />
        </linearGradient>
        <linearGradient id={terrainId} x1="0" x2="1" y1="0" y2="1">
          <stop offset="0" stopColor={config.terrainA} />
          <stop offset="0.5" stopColor={config.terrainB} />
          <stop offset="1" stopColor={config.terrainC} />
        </linearGradient>
        <linearGradient id={sideId} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor={config.sideA} />
          <stop offset="1" stopColor={config.sideB} />
        </linearGradient>
        <linearGradient id={waterId} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor={theme === 'october' ? '#5b21b6' : theme === 'november' ? '#dbeafe' : theme === 'december' ? '#eef6ff' : '#6ee7ff'} />
          <stop offset="1" stopColor={theme === 'october' ? '#1e1b4b' : theme === 'november' ? '#c4b5fd' : theme === 'december' ? '#c7ddf6' : '#22c7bd'} />
        </linearGradient>
        <radialGradient id={glowId} cx="50%" cy="35%" r="65%">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.64" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
        <pattern id={textureId} width="44" height="44" patternUnits="userSpaceOnUse">
          <path d="M0 44 44 0" stroke="#ffffff" strokeOpacity="0.15" strokeWidth="3" />
          <path d="M-16 26 18-8" stroke="#0f172a" strokeOpacity="0.07" strokeWidth="2" />
          <circle cx="10" cy="12" r="2.2" fill="#ffffff" fillOpacity="0.18" />
          <circle cx="32" cy="30" r="1.8" fill="#0f172a" fillOpacity="0.08" />
        </pattern>
        <pattern id={gridId} width="88" height="52" patternUnits="userSpaceOnUse" patternTransform="skewX(-18)">
          <path d="M0 0H88V52H0Z" fill="none" stroke="#ffffff" strokeOpacity="0.12" strokeWidth="2" />
          <path d="M44 0V52 M0 26H88" stroke="#0f172a" strokeOpacity="0.06" strokeWidth="2" />
        </pattern>
      </defs>
      <rect width="1200" height="560" fill={`url(#${skyId})`} />
      <rect className="premium-horizon" y="304" width="1200" height="256" fill={`url(#${waterId})`} />
      <rect width="1200" height="560" fill={`url(#${glowId})`} />

      <g className={`premium-map-scene premium-map-${themeLabel}`}>
        <path className="map-distant ridge-a" d="M0 316 C140 270 260 274 386 318 C520 254 674 252 814 318 C942 272 1058 276 1200 324 V560 H0Z" />
        <path className="map-distant ridge-b" d="M0 386 C178 348 322 356 470 392 C618 336 782 336 936 388 C1038 354 1126 356 1200 382 V560 H0Z" />
        <g className="map-clouds">
          <path d="M142 142c0-25 21-45 47-45 8-28 35-47 66-43 26 3 46 22 53 47 27 0 50 20 50 46 0 29-24 49-55 49H188c-28 0-46-22-46-54Z" />
          <path d="M702 96c0-21 17-37 39-37 7-23 29-39 55-36 22 3 38 19 44 39 23 1 42 18 42 40 0 24-21 41-46 41h-93c-24 0-41-18-41-47Z" />
          <path d="M946 170c0-19 16-34 36-34 6-22 27-36 51-34 20 3 36 18 41 37 22 0 40 17 40 38 0 23-19 38-43 38h-87c-23 0-38-17-38-45Z" />
        </g>

        {theme === 'august' && (
          <g className="map-theme-layer august-layer">
            <path className="side-island" d="M74 236c35-42 110-54 154-19 34 27 19 74-34 91-66 21-154-6-158-47-1-9 9-18 38-25Z" />
            <path className="side-island island-small" d="M1038 410c34-30 96-34 130-7 29 23 12 63-36 73-57 12-115-10-118-43-1-9 6-16 24-23Z" />
            <path className="map-wave" d="M16 418 C120 438 220 438 326 418" />
            <path className="map-wave" d="M846 420 C968 396 1074 398 1184 424" />
            <path className="map-wave" d="M110 505 C300 482 504 488 700 510" />
          </g>
        )}

        {theme === 'september' && (
          <g className="map-theme-layer september-layer">
            <path className="forest-canopy" d="M90 238c86-78 210-104 358-78 106 19 200 17 312-6 152-31 276 2 374 93-50-4-96 7-138 33-84-62-184-78-300-49-96 24-188 26-276 2-134-37-242-20-330 50-52-29-102-44-150-45Z" />
            <path className="forest-shadow" d="M120 452c152 45 302 42 452-9 128 43 272 43 430 0" />
          </g>
        )}

        {theme === 'october' && (
          <g className="map-theme-layer october-layer">
            <path className="festival-glow" d="M0 262 C172 205 314 222 458 280 C622 188 790 184 966 262 C1040 220 1118 220 1200 260 V560 H0Z" />
            <path className="festival-lamp-line" d="M190 122 C394 170 646 150 962 116" />
            <path className="festival-lamp-line lower" d="M260 468 C456 422 686 422 932 466" />
            <circle className="festival-light" cx="258" cy="138" r="8" />
            <circle className="festival-light" cx="464" cy="156" r="8" />
            <circle className="festival-light" cx="674" cy="146" r="8" />
            <circle className="festival-light" cx="896" cy="124" r="8" />
          </g>
        )}

        {theme === 'november' && (
          <g className="map-theme-layer november-layer">
            <path className="lab-grid" d="M90 154 H1120 M108 214 H1162 M64 444 H1140 M210 106 V512 M438 82 V526 M674 92 V512 M916 110 V520" />
            <path className="crystal-panel panel-a" d="M118 352 256 280 378 344 234 420Z" />
            <path className="crystal-panel panel-b" d="M828 252 984 198 1104 286 950 358Z" />
            <path className="crystal-panel panel-c" d="M496 422 646 356 772 422 620 494Z" />
          </g>
        )}

        {theme === 'december' && (
          <g className="map-theme-layer december-layer">
            <path className="snow-hills" d="M0 322 C150 286 294 298 430 340 C598 268 782 274 956 344 C1052 300 1132 292 1200 316 V560 H0Z" />
            <path className="snow-fence" d="M120 242 H232 M900 226 H1018 M222 430 H382 M930 448 H1090" />
            <path className="ice-ridge" d="M178 386 C330 318 468 314 590 376 C740 316 904 314 1048 382" />
            <path className="ice-ridge thin" d="M358 454 C526 430 696 430 878 454" />
          </g>
        )}

        <ellipse className="premium-board-shadow" cx="604" cy="500" rx="520" ry="52" fill={config.shadow} />
        <path className="premium-board-side" d={shape.side} fill={`url(#${sideId})`} />
        <path className="premium-board-main" d={shape.top} fill={`url(#${terrainId})`} />
        <path className="premium-board-texture" d={shape.top} fill={`url(#${textureId})`} />
        <path className="premium-board-grid" d={shape.top} fill={`url(#${gridId})`} />
        <path className="premium-board-rim" d={shape.rim} />

        <g className="premium-terrain-layers">
          <path className="terrain-layer layer-a" d="M146 360 C250 316 352 316 452 360 C542 302 662 286 782 320 C896 300 1006 320 1106 380 C986 426 842 430 716 390 C592 452 420 454 282 398 C224 378 178 366 146 360Z" />
          <path className="terrain-layer layer-b" d="M234 430 C358 390 464 390 552 430 C658 386 798 390 944 440 C760 488 452 488 234 430Z" />
          <path className="terrain-layer layer-c" d="M430 282 C522 238 632 236 752 276 C656 290 570 318 492 362 C476 326 454 300 430 282Z" />
          <path className="terrain-layer layer-d" d="M114 386 C240 334 354 336 456 392 C570 330 696 318 822 358 C922 332 1038 352 1130 416 C984 392 856 394 744 424 C622 384 494 384 360 424 C264 388 182 376 114 386Z" />
          <path className="terrain-crease" d="M158 404 C288 330 430 326 584 394 C732 326 904 330 1078 408" />
          <path className="terrain-crease thin" d="M278 468 C440 428 622 432 824 470" />
        </g>

        <g className="map-props">
          {props[theme].map((prop, index) => renderThemeObject(prop, index))}
        </g>

        <g className="premium-landmarks">
          {config.landmarks.map((landmark, index) => renderThemeObject(landmark, index, true))}
      </g>
      </g>
    </svg>
  );
}

const weekDayLabels = ['월', '화', '수', '목', '금', '토', '일'];

function isLikelyBrokenText(value: string) {
  return value.includes('?') || value.includes('\uFFFD') || value.includes('占쏙옙');
}

function displayStudentName(name: string) {
  return name && !isLikelyBrokenText(name) ? name : '학생';
}

function displaySubject(subject: TimerTab | Subject, subjects: Subject[] = DEFAULT_SUBJECTS) {
  if (subject === 'main') return '전체';
  if (subjectAlias[subject]) return subjectAlias[subject];
  const defaultIndex = DEFAULT_SUBJECTS.indexOf(subject);
  if (defaultIndex >= 0) return subjectFallbackLabels[defaultIndex] ?? subject;
  const localIndex = subjects.indexOf(subject);
  if (isLikelyBrokenText(subject) && localIndex >= 0) return subjectFallbackLabels[localIndex] ?? '과목';
  return subject || '과목';
}

function normalizeStoredSubjects(subjects?: Subject[]) {
  if (!Array.isArray(subjects) || !subjects.length) return DEFAULT_SUBJECTS;
  const normalized = subjects
    .map((subject) => String(subject ?? '').trim())
    .filter((subject, index, rows) => subject && rows.indexOf(subject) === index);
  if (!normalized.length) return DEFAULT_SUBJECTS;
  const previousNames = ['국어', '수학', '영어', '과학', '탐구', '수학논술', '의학논술'];
  const looksLikePreset = normalized.length === DEFAULT_SUBJECTS.length && normalized.every((subject, index) => (
    isLikelyBrokenText(subject) || previousNames.includes(subject) || subject === DEFAULT_SUBJECTS[index]
  ));
  return looksLikePreset ? DEFAULT_SUBJECTS : normalized;
}

function migrateSubjectValue(subject: Subject, sourceSubjects: Subject[] = DEFAULT_SUBJECTS) {
  const index = sourceSubjects.indexOf(subject);
  if (index >= 0 && index < DEFAULT_SUBJECTS.length) return DEFAULT_SUBJECTS[index];
  if (subject === '과학') return '탐구-1';
  if (subject === '탐구') return '탐구-2';
  if (subject === '수학논술' || subject === '의학논술') return '탐구-3';
  if (subjectAlias[subject] === '탐구') return '탐구-1';
  return subject;
}

function mapSubjectToPortal(subject: Subject, storedSubjects: Subject[], portalSubjects: Subject[]) {
  if (portalSubjects.includes(subject)) return subject;
  const storedIndex = storedSubjects.indexOf(subject);
  if (storedIndex >= 0 && portalSubjects[storedIndex]) return portalSubjects[storedIndex];
  const defaultIndex = DEFAULT_SUBJECTS.indexOf(subject);
  if (defaultIndex >= 0 && portalSubjects[defaultIndex]) return portalSubjects[defaultIndex];
  return subject;
}

function displayTaskTitle(task: Task) {
  if (demoTaskTitles[task.id]) return demoTaskTitles[task.id];
  return task.title && !isLikelyBrokenText(task.title) ? task.title : '학습 과제';
}

function displayScheduleTitle(item: ScheduleItem) {
  if (demoScheduleTitles[item.id]) return demoScheduleTitles[item.id];
  if (item.title && !isLikelyBrokenText(item.title)) return item.title;
  if (item.type === 'center') return '센터 자습';
  if (item.type === 'outside') return '외부 수업';
  return '개인 학습';
}

function displayRewardName(item: { id: string; name: string }) {
  return rewardLabels[item.id] ?? (item.name && !isLikelyBrokenText(item.name) ? item.name : '보상 아이템');
}

function displaySyncStatus(status: Task['portalStatus']) {
  if (status === 'synced') return '연동됨';
  if (status === 'pending') return '동기화 대기';
  return '직접 추가';
}

function formatStudyMinutes(minutes: number) {
  const safe = Math.max(0, Math.floor(minutes));
  const h = Math.floor(safe / 60);
  const m = safe % 60;
  if (h > 0 && m > 0) return `${h}시간 ${m}분`;
  if (h > 0) return `${h}시간`;
  return `${m}분`;
}

function currentWeekDayIndex(date = new Date()) {
  return (date.getDay() + 6) % 7;
}

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

function timeToSeconds(time: string) {
  const [hours, minutes] = time.split(':').map(Number);
  return (Number.isFinite(hours) ? hours : 0) * 3600 + (Number.isFinite(minutes) ? minutes : 0) * 60;
}

function requestPageFullscreen() {
  const target = document.documentElement;
  if (!document.fullscreenElement && target.requestFullscreen) {
    void target.requestFullscreen().catch(() => undefined);
  }
}

function exitPageFullscreen() {
  if (document.fullscreenElement && document.exitFullscreen) {
    void document.exitFullscreen().catch(() => undefined);
  }
}

function TimerFace({
  seconds,
  skin,
  label,
  subLabel,
  fullscreen = false,
  minuteMode,
}: {
  seconds: number;
  skin: TimerSkin;
  label?: string;
  subLabel?: string;
  fullscreen?: boolean;
  minuteMode?: 'elapsed' | 'remaining';
}) {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const clock = formatClock(seconds);
  const [displayHours, displayMinutes, displaySeconds] = clock.split(':');
  const displayMinuteCount = Math.floor(safeSeconds / 60);
  const displayMinuteSeconds = pad(safeSeconds % 60);
  const minuteClock = `${displayMinuteCount}:${displayMinuteSeconds}`;
  const ariaLabel = minuteMode ? `${displayMinuteCount}분 ${displayMinuteSeconds}초` : clock;

  if (skin === 'pulse') {
    return (
      <div className={`timer-face timer-face-pulse ${minuteMode ? 'timer-face-minute' : ''} ${fullscreen ? 'timer-face-fullscreen' : ''}`} aria-label={ariaLabel}>
        <div className="pulse-clock-shell">
          {label ? <span>{label}</span> : null}
          <div className="pulse-clock-digits">
            {minuteMode ? (
              <>
                <strong>{displayMinuteCount}</strong>
                <i>:</i>
                <strong>{displayMinuteSeconds}</strong>
              </>
            ) : (
              <>
                <strong>{displayHours}</strong>
                <i />
                <strong>{displayMinutes}</strong>
                <i />
                <strong>{displaySeconds}</strong>
              </>
            )}
          </div>
          {subLabel ? <em>{subLabel}</em> : null}
        </div>
      </div>
    );
  }

  if (skin === 'halo') {
    const progress = `${((seconds % 3600) / 3600) * 360}deg`;
    return (
      <div className={`timer-face timer-face-aurora ${minuteMode ? 'timer-face-minute' : ''} ${fullscreen ? 'timer-face-fullscreen' : ''}`} style={{ '--face-progress': progress } as React.CSSProperties} aria-label={ariaLabel}>
        <div className="aurora-orbit">
          <div>
            {label ? <span>{label}</span> : null}
            <strong>{minuteMode ? minuteClock : clock}</strong>
            {minuteMode ? <i>분:초</i> : null}
            {subLabel ? <em>{subLabel}</em> : null}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`timer-face timer-face-wood ${minuteMode ? 'timer-face-minute' : ''} ${fullscreen ? 'timer-face-fullscreen' : ''}`} aria-label={ariaLabel}>
      <div className="wood-clock-shell">
        {label ? <span>{label}</span> : null}
        <div className="wood-clock-digits">
          {minuteMode ? (
            <>
              <strong>{displayMinuteCount}</strong>
              <i>:</i>
              <strong>{displayMinuteSeconds}</strong>
            </>
          ) : (
            <>
              <strong>{displayHours}</strong>
              <i>:</i>
              <strong>{displayMinutes}</strong>
              <i>:</i>
              <strong>{displaySeconds}</strong>
            </>
          )}
        </div>
        {subLabel ? <em>{subLabel}</em> : null}
      </div>
    </div>
  );
}

const examDayPlan = [
  { id: 'ready', label: '입실 및 준비', start: '08:10', end: '08:40', kind: 'break' },
  { id: 'korean', label: '국어', start: '08:40', end: '10:00', kind: 'exam' },
  { id: 'break-1', label: '쉬는시간', start: '10:00', end: '10:30', kind: 'break' },
  { id: 'math', label: '수학', start: '10:30', end: '12:10', kind: 'exam' },
  { id: 'lunch', label: '점심시간', start: '12:10', end: '13:00', kind: 'break' },
  { id: 'english-ready', label: '영어 준비', start: '13:00', end: '13:10', kind: 'break' },
  { id: 'english', label: '영어', start: '13:10', end: '14:20', kind: 'exam' },
  { id: 'break-2', label: '쉬는시간', start: '14:20', end: '14:50', kind: 'break' },
  { id: 'history', label: '한국사', start: '14:50', end: '15:20', kind: 'exam' },
  { id: 'collect-1', label: '한국사 문답지 회수', start: '15:20', end: '15:35', kind: 'break' },
  { id: 'inquiry-1', label: '탐구 1', start: '15:35', end: '16:05', kind: 'exam' },
  { id: 'collect-2', label: '탐구 문답지 회수', start: '16:05', end: '16:07', kind: 'break' },
  { id: 'inquiry-2', label: '탐구 2', start: '16:07', end: '16:37', kind: 'exam' },
] as const;

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
    const storedSubjects = Array.isArray(parsed.subjectNames) && parsed.subjectNames.length ? parsed.subjectNames : DEFAULT_SUBJECTS;
    const subjectNames = normalizeStoredSubjects(storedSubjects);
    const shouldMigrateSubjects = subjectNames === DEFAULT_SUBJECTS;
    const timerSkin: TimerSkin = parsed.timerSkin === 'halo' || parsed.timerSkin === 'pulse' ? parsed.timerSkin : 'pure';
    const appTheme: AppTheme = parsed.appTheme === 'midnight' || parsed.appTheme === 'botanic' ? parsed.appTheme : 'modern';
    const studyBlocks = Array.isArray(parsed.studyBlocks)
      ? parsed.studyBlocks
        .filter((block) => !['block-1', 'block-2', 'block-3', 'block-4'].includes(block.id))
        .map((block) => ({
          ...block,
          subject: shouldMigrateSubjects ? migrateSubjectValue(block.subject, storedSubjects) : block.subject,
        }))
      : [];
    const tasks = Array.isArray(parsed.tasks)
      ? parsed.tasks.map((task) => ({
        ...task,
        subject: shouldMigrateSubjects ? migrateSubjectValue(task.subject, storedSubjects) : task.subject,
      }))
      : fallback.tasks;
    return {
      ...fallback,
      ...parsed,
      points: 0,
      subjectNames,
      tasks,
      studyBlocks,
      attendanceDates: Array.isArray(parsed.attendanceDates) ? parsed.attendanceDates : [],
      claimedAttendanceRewards: Array.isArray(parsed.claimedAttendanceRewards) ? parsed.claimedAttendanceRewards : [],
      claimedStageRewards: Array.isArray(parsed.claimedStageRewards) ? parsed.claimedStageRewards : [],
      rewardPurchases: Array.isArray(parsed.rewardPurchases) ? parsed.rewardPurchases : [],
      rewardSettings: normalizeRewardSettings(parsed.rewardSettings),
      rewardMapVisibility: normalizeRewardMapVisibility(parsed.rewardMapVisibility),
      penaltySettings: normalizePenaltySettings(parsed.penaltySettings),
      adminMessages: Array.isArray(parsed.adminMessages) ? parsed.adminMessages : [],
      dismissedMessageIds: Array.isArray(parsed.dismissedMessageIds) ? parsed.dismissedMessageIds : [],
      hiddenTaskIds: Array.isArray(parsed.hiddenTaskIds) ? parsed.hiddenTaskIds : [],
      timerSkin,
      appTheme,
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

type LegacyRewardSettings = Partial<RewardSettings> & {
  pointsPerMinute?: number;
  minutesPerFruit?: number;
  attendanceTenFruits?: number;
  attendanceTwentyFruits?: number;
  attendanceFullFruits?: number;
};

function normalizeRewardSettings(settings?: LegacyRewardSettings): RewardSettings {
  const numberOr = (value: unknown, fallback: number) => {
    const next = Number(value);
    return Number.isFinite(next) ? next : fallback;
  };
  const attendanceTenStars = Math.max(0, numberOr(settings?.attendanceTenStars ?? settings?.attendanceTenFruits, defaultRewardSettings.attendanceTenStars));
  const attendanceTwentyStars = Math.max(0, numberOr(settings?.attendanceTwentyStars ?? settings?.attendanceTwentyFruits, defaultRewardSettings.attendanceTwentyStars));
  const attendanceFullStars = Math.max(0, numberOr(settings?.attendanceFullStars ?? settings?.attendanceFullFruits, defaultRewardSettings.attendanceFullStars));
  return {
    stageMinutes: rewardStageDefaultMinutes,
    stageRewardStars: Math.max(1, numberOr(settings?.stageRewardStars, defaultRewardSettings.stageRewardStars)),
    attendanceTenStars,
    attendanceTwentyStars,
    attendanceFullStars,
  };
}

function normalizePenaltySettings(settings?: Partial<PenaltySettings>): PenaltySettings {
  const validDate = (value: unknown) => {
    const text = String(value ?? '').trim();
    return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : '';
  };
  const from = validDate(settings?.from);
  const to = validDate(settings?.to);
  if (from && to && from > to) return { from: to, to: from };
  return { from, to };
}

function fruitPointThreshold(settings: RewardSettings) {
  return Math.max(1, normalizeRewardSettings(settings).stageMinutes);
}

function attendanceRewardSteps(fullMonthDays: number, settings: RewardSettings = defaultRewardSettings) {
  return [
    { threshold: 10, fruits: settings.attendanceTenStars, label: '10일' },
    { threshold: 20, fruits: settings.attendanceTwentyStars, label: '20일' },
    { threshold: fullMonthDays, fruits: settings.attendanceFullStars, label: '한 달 전체' },
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

function monthKeyFromDateKey(dateKey: string) {
  return dateKey.slice(0, 7);
}

function monthlyStudyMinutes(blocks: StudyBlock[], monthKey: string) {
  return blocks
    .filter((block) => monthKeyFromDateKey(block.date) === monthKey)
    .reduce((sum, block) => sum + blockDurationSeconds(block) / 60, 0);
}

function rewardStageCount(monthMinutes: number, settings: RewardSettings) {
  return Math.min(rewardStageStepCount, Math.floor(monthMinutes / Math.max(1, settings.stageMinutes)));
}

function applyStageRewards(data: AppData): AppData {
  const settings = normalizeRewardSettings(data.rewardSettings);
  const claimed = new Set(data.claimedStageRewards ?? []);
  const nextClaimed = [...claimed];
  let earnedStars = 0;

  rewardMapMonths.forEach((month) => {
    const completedStages = rewardStageCount(monthlyStudyMinutes(data.studyBlocks, month.key), settings);
    for (let stage = 1; stage <= completedStages; stage += 1) {
      const rewardId = `${month.key}-${stage}`;
      if (!claimed.has(rewardId)) {
        claimed.add(rewardId);
        nextClaimed.push(rewardId);
        earnedStars += settings.stageRewardStars;
      }
    }
  });

  if (!earnedStars) return data;
  return {
    ...data,
    fruits: data.fruits + earnedStars,
    claimedStageRewards: nextClaimed,
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

function weekDateKeys(dateKey = todayKey()) {
  const [year, month, day] = dateKey.split('-').map(Number);
  const date = new Date(year, (month || 1) - 1, day || 1);
  const dayIndex = date.getDay();
  const diff = dayIndex === 0 ? -6 : 1 - dayIndex;
  date.setDate(date.getDate() + diff);
  return Array.from({ length: 7 }, (_, index) => {
    const next = new Date(date);
    next.setDate(date.getDate() + index);
    return todayKey(next);
  });
}

function studyStreak(attendanceDates: string[], baseDate = todayKey()) {
  const dates = new Set(attendanceDates);
  let current = new Date(`${baseDate}T00:00:00`);
  let count = 0;
  while (dates.has(todayKey(current))) {
    count += 1;
    current.setDate(current.getDate() - 1);
  }
  return count;
}

function timeFromMinute(minute?: number) {
  if (!Number.isFinite(Number(minute))) return '-';
  const safeMinute = Math.max(0, Math.floor(Number(minute)));
  const hour = Math.floor(safeMinute / 60) % 24;
  const minutes = safeMinute % 60;
  return `${String(hour).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function blocksWithRunningSession(blocks: StudyBlock[], runningSession: RunningSession | null, subjectElapsedSeconds: number) {
  if (!runningSession || subjectElapsedSeconds <= 0) return blocks;
  return [
    ...blocks,
    {
      id: 'running-session',
      date: todayKey(),
      startMinute: startMinuteOfDay(new Date(runningSession.subjectStartedAtMs)),
      durationMinutes: subjectElapsedSeconds / 60,
      durationSeconds: subjectElapsedSeconds,
      subject: runningSession.subject,
    },
  ];
}

function buildFamilySyncReport(params: {
  data: AppData;
  subjects: Subject[];
  schedule: ScheduleItem[];
  runningSession: RunningSession | null;
  subjectElapsedSeconds: number;
  actualTodayMinutes: number;
  selectedSubject: Subject;
  penalty?: PenaltySummary;
}): FamilySyncReport {
  const { data, subjects, schedule, runningSession, subjectElapsedSeconds, actualTodayMinutes, selectedSubject, penalty } = params;
  const now = new Date();
  const today = todayKey(now);
  const allBlocks = blocksWithRunningSession(data.studyBlocks, runningSession, subjectElapsedSeconds);
  const todays = allBlocks.filter((block) => block.date === today);
  const weekKeys = weekDateKeys(today);
  const weekMinutes = weekKeys.reduce((sum, date) => sum + totalSecondsFromBlocks(allBlocks.filter((block) => block.date === date)) / 60, 0);
  const monthMinutes = monthlyStudyMinutes(allBlocks, today.slice(0, 7));
  const minutesBySubject = subjectMinutes(todays, subjects);
  const activeSubjectCount = Object.values(minutesBySubject).filter((minutes) => minutes > 0).length;
  const completeRate = completionRate(data.tasks);
  const focusProgress = Math.min(100, Math.round((actualTodayMinutes / 720) * 100));
  const focusScore = Math.min(100, Math.round((completeRate * 0.45) + (focusProgress * 0.4) + (activeSubjectCount ? 15 : 0)));
  const completedTasks = data.tasks.filter((task) => task.completed).length;
  const firstBlock = [...todays].sort((a, b) => a.startMinute - b.startMinute)[0];
  const lastBlock = [...todays].sort((a, b) => (a.startMinute + blockDurationSeconds(a) / 60) - (b.startMinute + blockDurationSeconds(b) / 60)).at(-1);
  const checkOutMinute = lastBlock ? lastBlock.startMinute + Math.round(blockDurationSeconds(lastBlock) / 60) : undefined;
  const tasks = data.tasks.map((task) => (
    runningSession?.taskId === task.id
      ? { ...task, elapsedSeconds: task.elapsedSeconds + subjectElapsedSeconds }
      : task
  ));

  return {
    studentId: data.studentId,
    studentName: data.studentName,
    profile: {
      studentId: data.studentId,
      studentName: data.studentName,
    },
    studySummary: {
      today: actualTodayMinutes,
      week: Math.floor(weekMinutes),
      month: Math.floor(monthMinutes),
      custom: Math.floor(weekMinutes),
      streak: studyStreak(data.attendanceDates, today),
      goal: 720,
    },
    subjectStudy: subjects.map((subject) => ({
      subject,
      minutes: Math.floor(minutesBySubject[subject] ?? 0),
      color: subjectColor(subject, subjects),
      note: subject === (runningSession?.subject ?? selectedSubject) ? '현재 선택 과목' : undefined,
    })),
    weeklyLearning: weekKeys.map((date, index) => {
      const minutes = Math.floor(totalSecondsFromBlocks(allBlocks.filter((block) => block.date === date)) / 60);
      return {
        day: weekDayLabels[index] ?? date.slice(5),
        date,
        minutes,
        completion: minutes > 0 ? completeRate : 0,
      };
    }),
    schedules: schedule,
    tasks,
    studyBlocks: allBlocks,
    attendance: {
      status: runningSession ? (runningSession.paused ? '휴식 중' : '공부 중') : actualTodayMinutes > 0 ? '학습 기록 있음' : '대기',
      checkIn: timeFromMinute(firstBlock?.startMinute),
      checkOut: runningSession ? '-' : timeFromMinute(checkOutMinute),
      timeline: todays.slice(-20).map((block) => ({
        time: timeFromMinute(block.startMinute),
        label: `${block.subject} ${Math.max(1, Math.round(blockDurationSeconds(block) / 60))}분`,
        tone: 'good',
      })),
    },
    rewards: {
      fruits: data.fruits,
      rewardPurchases: data.rewardPurchases,
      attendanceDates: data.attendanceDates,
      claimedAttendanceRewards: data.claimedAttendanceRewards,
      claimedStageRewards: data.claimedStageRewards,
      rewardSettings: data.rewardSettings,
      rewardMapVisibility: data.rewardMapVisibility,
    },
    ...(penalty ? { penalty } : {}),
    analysis: {
      completionRate: completeRate,
      completedTasks,
      totalTasks: data.tasks.length,
      focusScore,
      activeSubjectCount,
    },
    updatedAt: now.toISOString(),
  };
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

function mergeAdminMessages(current: AdminMessage[], incoming: AdminMessage[]) {
  const merged = new Map<string, AdminMessage>();
  [...current, ...incoming].forEach((message) => {
    if (!message?.id) return;
    const existing = merged.get(message.id);
    merged.set(message.id, {
      ...existing,
      ...message,
      dismissedBy: Array.from(new Set([...(existing?.dismissedBy ?? []), ...(message.dismissedBy ?? [])])),
    });
  });
  return [...merged.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 200);
}

function applyRealtimeData(data: AppData, snapshot: RealtimeSnapshot): AppData {
  return {
    ...data,
    adminMessages: mergeAdminMessages(data.adminMessages, snapshot.messages),
    rewardSettings: snapshot.rewardSettings ? normalizeRewardSettings(snapshot.rewardSettings) : data.rewardSettings,
    rewardMapVisibility: snapshot.rewardMapVisibility ? normalizeRewardMapVisibility(snapshot.rewardMapVisibility) : data.rewardMapVisibility,
    penaltySettings: snapshot.penaltySettings ? normalizePenaltySettings(snapshot.penaltySettings) : data.penaltySettings,
  };
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

type LoginResult = {
  ok: boolean;
  error?: string;
};

function LoginScreen({ onLogin }: { onLogin: (role: Role, name: string, id: string, password: string) => Promise<LoginResult> | LoginResult }) {
  const [mode, setMode] = useState<Role>('user');
  const [name, setName] = useState('김도윤');
  const [id, setId] = useState('qtf258');
  const [studentPassword, setStudentPassword] = useState('');
  const [medischeduleToken, setMedischeduleToken] = useState(() => localStorage.getItem('medical-study-medischedule-token') || '');
  const [mentorToken, setMentorToken] = useState(() => localStorage.getItem('medical-study-mentor-token') || '');
  const [mediweeklyToken, setMediweeklyToken] = useState(() => localStorage.getItem('medical-study-mediweekly-token') || '');
  const [medipenaltyToken, setMedipenaltyToken] = useState(() => localStorage.getItem('medical-study-medipenalty-token') || '');
  const [appAdminToken, setAppAdminToken] = useState(() => localStorage.getItem('medical-study-app-admin-token') || '');
  const [loginError, setLoginError] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);

  function saveIntegrationTokens() {
    const cleanMedischeduleToken = medischeduleToken.trim().replace(/^Bearer\s+/i, '');
    const cleanMentorToken = mentorToken.trim().replace(/^Bearer\s+/i, '');
    const cleanMediweeklyToken = mediweeklyToken.trim().replace(/^Bearer\s+/i, '');
    const cleanMedipenaltyToken = medipenaltyToken.trim().replace(/^Bearer\s+/i, '');
    const cleanAppAdminToken = appAdminToken.trim().replace(/^Bearer\s+/i, '');
    if (cleanMedischeduleToken) localStorage.setItem('medical-study-medischedule-token', cleanMedischeduleToken);
    if (cleanMentorToken) localStorage.setItem('medical-study-mentor-token', cleanMentorToken);
    if (cleanMediweeklyToken) localStorage.setItem('medical-study-mediweekly-token', cleanMediweeklyToken);
    if (cleanMedipenaltyToken) localStorage.setItem('medical-study-medipenalty-token', cleanMedipenaltyToken);
    if (cleanAppAdminToken) localStorage.setItem('medical-study-app-admin-token', cleanAppAdminToken);
  }

  async function submitLogin() {
    if (loggingIn) return;
    setLoginError('');
    saveIntegrationTokens();
    setLoggingIn(true);
    const result = await onLogin(mode, name.trim() || '학생', id.trim() || 'student-demo', studentPassword);
    setLoggingIn(false);
    if (!result.ok) setLoginError(result.error || '로그인에 실패했습니다.');
  }

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
        {mode === 'user' ? (
          <label>
            비밀번호
            <input value={studentPassword} onChange={(event) => setStudentPassword(event.target.value)} type="password" autoComplete="current-password" />
          </label>
        ) : null}
        {mode === 'admin' ? (
          <div className="login-token-grid">
            <label>
              medischedule token
              <input value={medischeduleToken} onChange={(event) => setMedischeduleToken(event.target.value)} placeholder="adminToken" />
            </label>
            <label>
              medimentors token
              <input value={mentorToken} onChange={(event) => setMentorToken(event.target.value)} placeholder="token" />
            </label>
            <label>
              mediweekly token
              <input value={mediweeklyToken} onChange={(event) => setMediweeklyToken(event.target.value)} placeholder="attendance token" />
            </label>
            <label>
              medipenalty token
              <input value={medipenaltyToken} onChange={(event) => setMedipenaltyToken(event.target.value)} placeholder="penalty token" />
            </label>
            <label>
              app realtime token
              <input value={appAdminToken} onChange={(event) => setAppAdminToken(event.target.value)} placeholder="APP_ADMIN_TOKEN" />
            </label>
          </div>
        ) : null}
        {loginError ? <div className="login-error">{loginError}</div> : null}
        <button className="login-submit" type="button" onPointerDown={saveIntegrationTokens} onMouseDown={saveIntegrationTokens} onClick={submitLogin} disabled={loggingIn}>
          {loggingIn ? '확인 중' : '시작하기'}
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
  appTheme,
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
  onAppThemeChange,
  onTimerFullscreen,
  onWeekOpen,
}: {
  data: AppData;
  subjects: Subject[];
  schedule: ScheduleItem[];
  selectedSubject: Subject;
  selectedTab: TimerTab;
  timerSkin: TimerSkin;
  appTheme: AppTheme;
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
  onAppThemeChange: (theme: AppTheme) => void;
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
  const timerProgressFill = `${((visibleSubjectSeconds % 3600) / 3600) * 100}%`;

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
            style={{ '--timer-progress': timerProgress, '--timer-progress-fill': timerProgressFill } as React.CSSProperties}
          >
            <button className="icon-float" type="button" onClick={onTimerFullscreen} aria-label="타이머 전체보기">
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
  onDelete,
}: {
  task: Task;
  onComplete: () => void;
  onStop: () => void;
  onEdit: () => void;
  onDelete: () => void;
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
        <button className="stop-task" type="button" onClick={onStop}><Square size={18} />미완료</button>
        <button className="delete-task" type="button" onClick={onDelete} aria-label="과제 삭제"><Trash2 size={18} /></button>
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
  onDeleteTask,
  onEditTask,
  onNewTask,
}: {
  subjects: Subject[];
  tasks: Task[];
  taskSource: string;
  onCompleteTask: (task: Task) => void;
  onStopTask: (task: Task) => void;
  onDeleteTask: (task: Task) => void;
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
          const subjectTasks = tasks.filter((task) => task.subject === subject);
          return (
            <div className="task-lane" key={subject}>
              <div className="lane-head">
                <i style={{ backgroundColor: subjectColor(subject, subjects) }} />
                <strong>{subject}</strong>
                <button type="button" onClick={() => onNewTask(subject)} aria-label={`${subject} 과제 추가`}><Plus size={18} /></button>
              </div>
              <div className="task-list">
                {subjectTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    onComplete={() => onCompleteTask(task)}
                    onStop={() => onStopTask(task)}
                    onEdit={() => onEditTask(task)}
                    onDelete={() => onDeleteTask(task)}
                  />
                ))}
                {!subjectTasks.length ? <div className="empty-state">할 일 없음</div> : null}
              </div>
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
  const durationStartMinute = 8 * 60;
  const durationHours = Array.from({ length: 19 }, (_, index) => durationStartMinute + index * 60);
  const durationMarkers = [10, 20, 30, 40, 50, 60];

  function blockForSlot(minute: number) {
    return todays.find((block) => {
      const blockStart = minute >= 24 * 60 && block.startMinute < durationStartMinute ? block.startMinute + 24 * 60 : block.startMinute;
      return minute >= blockStart && minute < blockStart + blockDurationSeconds(block) / 60;
    });
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
          <div><span>평균 공부</span><strong>{formatMinuteText(avg)}</strong></div>
          <div><span>가장 긴 공부</span><strong>{longest ? formatMinuteText(blockDurationSeconds(longest) / 60) : '0분'}</strong></div>
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
      <PageTitle label="Rewards" title="별 보상" right={<div className="fruit-wallet"><img src={fruitUrl} alt="" />{data.fruits}개</div>} />
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
            <div><span>보유 별</span><strong>{data.fruits}개</strong></div>
            <div><span>다음 별</span><strong>{threshold - pointProgress}분</strong></div>
            <div className="point-rule">
              <span>스테이지 도착 시 별 지급</span>
              <div className="progress-track"><i style={{ width: `${(pointProgress / threshold) * 100}%` }} /></div>
              <em>{threshold - pointProgress}분 후 별 1개</em>
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
              <strong>별 {item.cost}개</strong>
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
            <span>10일 {rewardSettings.attendanceTenStars}개 · 20일 {rewardSettings.attendanceTwentyStars}개 · 전체 {rewardSettings.attendanceFullStars}개</span>
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

function ModernSideRail({
  page,
  setPage,
  studentName,
  onLogout,
}: {
  page: PageKey;
  setPage: (page: PageKey) => void;
  studentName: string;
  onLogout: () => void;
}) {
  return (
    <aside className="modern-rail">
      <div className="modern-brand">
        <div className="modern-brand-mark">SC</div>
        <span>StudyCat</span>
      </div>
      <div className="modern-user-pill">
        <UserRound size={18} />
        <div>
          <strong>{displayStudentName(studentName)}</strong>
          <span>학생 대시보드</span>
        </div>
      </div>
      <nav className="modern-nav" aria-label="학생 메뉴">
        {modernNavItems.map(({ key, label, Icon }) => (
          <button key={key} className={page === key ? 'active' : ''} onClick={() => setPage(key)} type="button">
            <Icon size={21} />
            <span>{label}</span>
          </button>
        ))}
      </nav>
      <button className="modern-logout" type="button" onClick={onLogout} aria-label="로그아웃">
        <LogOut size={21} />
        <span>나가기</span>
      </button>
    </aside>
  );
}

function ModernPageHeader({
  eyebrow,
  title,
  description,
  right,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  right?: React.ReactNode;
}) {
  return (
    <header className="modern-page-header">
      <div>
        <span>{eyebrow}</span>
        <h1>{title}</h1>
        {description ? <p>{description}</p> : null}
      </div>
      {right}
    </header>
  );
}

function ModernHomePage({
  data,
  subjects,
  schedule,
  selectedSubject,
  selectedTab,
  timerSkin,
  appTheme,
  runningSession,
  totalElapsedSeconds,
  subjectElapsedSeconds,
  onStart,
  onPause,
  onStop,
  onMainSelect,
  onSubjectSelect,
  onRenameSubject,
  onTimerSkinChange,
  onAppThemeChange,
  onTimerFullscreen,
  onMockTimerOpen,
  onWeekOpen,
}: {
  data: AppData;
  subjects: Subject[];
  schedule: ScheduleItem[];
  selectedSubject: Subject;
  selectedTab: TimerTab;
  timerSkin: TimerSkin;
  appTheme: AppTheme;
  runningSession: RunningSession | null;
  totalElapsedSeconds: number;
  subjectElapsedSeconds: number;
  onStart: () => void;
  onPause: () => void;
  onStop: () => void;
  onMainSelect: () => void;
  onSubjectSelect: (subject: Subject) => void;
  onRenameSubject: (index: number, name: string) => void;
  onTimerSkinChange: (skin: TimerSkin) => void;
  onAppThemeChange: (theme: AppTheme) => void;
  onTimerFullscreen: () => void;
  onMockTimerOpen: () => void;
  onWeekOpen: () => void;
}) {
  const todayIndex = currentWeekDayIndex();
  const today = weekDays[todayIndex] ?? weekDays[0];
  const todaySchedule = schedule.filter((item) => item.day === today).slice(0, 4);
  const todays = todayBlocks(data.studyBlocks);
  const subjectTotals = subjectSeconds(todays, subjects);
  const activeSubject = runningSession?.subject;
  const totalTodaySeconds = totalSecondsFromBlocks(todays) + (runningSession ? subjectElapsedSeconds : 0);
  const selectedTimerSubject = selectedTab === 'main' ? selectedSubject : selectedTab;
  const visibleSubjectSeconds =
    (subjectTotals[selectedTimerSubject] ?? 0) + (activeSubject === selectedTimerSubject ? subjectElapsedSeconds : 0);
  const timerClock = formatClock(visibleSubjectSeconds);
  const completion = completionRate(data.tasks);
  const completed = data.tasks.filter((task) => task.completed).length;
  const timerProgress = `${((visibleSubjectSeconds % 3600) / 3600) * 360}deg`;
  const timerProgressFill = `${((visibleSubjectSeconds % 3600) / 3600) * 100}%`;
  const selectedLabel = displaySubject(selectedTimerSubject, subjects);
  const sessionLabel = runningSession?.paused ? '일시정지' : runningSession ? '집중 중' : '대기 중';
  const [editingSubjectIndex, setEditingSubjectIndex] = useState<number | null>(null);
  const [subjectDraft, setSubjectDraft] = useState('');

  function openSubjectEditor(index: number, subject: Subject) {
    setEditingSubjectIndex(index);
    setSubjectDraft(displaySubject(subject, subjects));
  }

  function saveSubjectEditor() {
    if (editingSubjectIndex === null) return;
    onRenameSubject(editingSubjectIndex, subjectDraft);
    setEditingSubjectIndex(null);
  }

  return (
    <div className="page modern-page modern-home-page">
      <ModernPageHeader
        eyebrow="Student Workspace"
        title={`${displayStudentName(data.studentName)}님의 오늘`}
        description=""
        right={
          <div className="modern-header-actions">
            <button className="modern-header-button" type="button" onClick={onWeekOpen}>
              <CalendarDays size={18} />
              <span>이번주 일정</span>
            </button>
            <button className="modern-header-button" type="button" onClick={onMockTimerOpen}>
              <Timer size={18} />
              <span>수능 카운트다운</span>
            </button>
            <div className="modern-theme-switch" aria-label="앱 테마 선택">
              {appThemeOptions.map((option) => (
                <button className={appTheme === option.key ? 'active' : ''} key={option.key} type="button" onClick={() => onAppThemeChange(option.key)}>
                  {option.label}
                </button>
              ))}
            </div>
            <div className={`modern-live-chip ${runningSession && !runningSession.paused ? 'live' : ''}`}>
              <span>{sessionLabel}</span>
              <strong>{runningSession ? displaySubject(runningSession.subject, subjects) : `${weekDayLabels[todayIndex]}요일`}</strong>
            </div>
          </div>
        }
      />
      <section className="modern-home-grid">
        <section className="modern-timer-panel">
          <div className={`modern-timer-stage timer-${timerSkin}`} style={{ '--timer-progress': timerProgress, '--timer-progress-fill': timerProgressFill } as React.CSSProperties}>
            <div className="modern-timer-toolbar">
              <div>
                <span>현재 과목</span>
                <strong>{selectedLabel}</strong>
              </div>
              <div className="modern-skin-switch" aria-label="타이머 스타일">
                {modernTimerSkinOptions.map((option) => (
                  <button className={timerSkin === option.key ? 'active' : ''} key={option.key} type="button" onClick={() => onTimerSkinChange(option.key)}>
                    {option.label}
                  </button>
                ))}
              </div>
              <button className="modern-icon-button" type="button" onClick={onTimerFullscreen} aria-label="전체 화면">
                <Expand size={20} />
              </button>
            </div>
            <TimerFace
              seconds={visibleSubjectSeconds}
              skin={timerSkin}
              label={selectedLabel}
              subLabel={runningSession?.subject === selectedTimerSubject && !runningSession.paused ? '진행 중' : '대기 중'}
            />
            <div className="modern-timer-corner-total">
              <span>공부 합계</span>
              <strong>{formatStudyMinutes(totalTodaySeconds / 60)}</strong>
            </div>
          </div>

          <div className="modern-subject-strip">
            <div className="modern-subject-strip-head">
              <span>과목별</span>
              <strong>오늘의 총 공부 시간</strong>
            </div>
            {subjects.map((subject, index) => {
              const seconds = (subjectTotals[subject] ?? 0) + (activeSubject === subject ? subjectElapsedSeconds : 0);
              return (
                <div className={`modern-subject-chip ${selectedTimerSubject === subject ? 'active' : ''}`} key={`${subject}-${index}`} style={{ '--subject-color': subjectColor(subject, subjects) } as React.CSSProperties}>
                  {editingSubjectIndex === index ? (
                    <input
                      value={subjectDraft}
                      autoFocus
                      onChange={(event) => setSubjectDraft(event.target.value)}
                      onBlur={saveSubjectEditor}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') saveSubjectEditor();
                        if (event.key === 'Escape') setEditingSubjectIndex(null);
                      }}
                    />
                  ) : (
                    <button type="button" onClick={() => onSubjectSelect(subject)}>
                      <span>{displaySubject(subject, subjects)}</span>
                      <strong>{formatStudyMinutes(seconds / 60)}</strong>
                    </button>
                  )}
                  <button className="modern-subject-edit" type="button" onClick={() => openSubjectEditor(index, subject)} aria-label="과목 이름 변경">
                    <Pencil size={14} />
                  </button>
                </div>
              );
            })}
          </div>

          <div className="modern-focus-actions">
            <button className="primary" type="button" onClick={onStart} disabled={Boolean(runningSession && !runningSession.paused)}>
              <Play size={23} />
              {runningSession && !runningSession.paused ? '진행 중' : runningSession?.paused ? '다시 시작' : '공부 시작'}
            </button>
            <button type="button" onClick={onPause} disabled={!runningSession}>
              <Pause size={23} />
              {runningSession?.paused ? '다시 시작' : '일시정지'}
            </button>
            <button className="danger" type="button" onClick={onStop} disabled={!runningSession}>
              <Square size={21} />
              종료
            </button>
          </div>
        </section>

      </section>
    </div>
  );
}

function ModernTaskCard({
  task,
  subjects,
  onComplete,
  onStop,
  onEdit,
  onDelete,
}: {
  task: Task;
  subjects: Subject[];
  onComplete: () => void;
  onStop: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <article className={`modern-task-card ${task.completed ? 'done' : ''}`} style={{ '--subject-color': subjectColor(task.subject, subjects) } as React.CSSProperties}>
      <div className="modern-task-status">
        <span>{displaySyncStatus(task.portalStatus)}</span>
        <button type="button" onClick={onEdit} aria-label="과제 편집">
          <Edit3 size={17} />
        </button>
      </div>
      <h3>{displayTaskTitle(task)}</h3>
      <p>{displaySubject(task.subject, subjects)} · 누적 {formatStudyMinutes(task.elapsedSeconds / 60)}</p>
      <div className="modern-task-actions">
        <button type="button" onClick={onComplete} disabled={task.completed} aria-label="완료">
          <CheckCircle2 size={18} />
        </button>
        <button type="button" onClick={onStop} aria-label="미완료로 변경">
          <Square size={17} />
        </button>
        <button type="button" onClick={onDelete} aria-label="삭제">
          <Trash2 size={17} />
        </button>
      </div>
    </article>
  );
}

function ModernTasksPage({
  subjects,
  tasks,
  mentoringWeeks,
  selectedMentoringWeekId,
  mentoringCurriculum,
  mentoringError,
  onMentoringWeekChange,
  onRenameSubject,
  onCompleteTask,
  onStopTask,
  onDeleteTask,
  onEditTask,
  onNewTask,
}: {
  subjects: Subject[];
  tasks: Task[];
  mentoringWeeks: MentoringWeekOption[];
  selectedMentoringWeekId: string;
  mentoringCurriculum: MentoringCurriculumItem[];
  mentoringError: string;
  onMentoringWeekChange: (weekId: string) => void;
  onRenameSubject: (index: number, name: string) => void;
  onCompleteTask: (task: Task) => void;
  onStopTask: (task: Task) => void;
  onDeleteTask: (task: Task) => void;
  onEditTask: (task: Task) => void;
  onNewTask: (subject: Subject) => void;
}) {
  const [curriculumOpen, setCurriculumOpen] = useState(false);
  const [editingSubjectIndex, setEditingSubjectIndex] = useState<number | null>(null);
  const [subjectDraft, setSubjectDraft] = useState('');

  function beginSubjectRename(index: number, subject: Subject) {
    setEditingSubjectIndex(index);
    setSubjectDraft(displaySubject(subject, subjects));
  }

  function finishSubjectRename() {
    if (editingSubjectIndex === null) return;
    onRenameSubject(editingSubjectIndex, subjectDraft);
    setEditingSubjectIndex(null);
  }

  return (
    <div className={`page modern-page modern-tasks-page ${mentoringError ? 'mentoring-error' : ''}`}>
      <ModernPageHeader
        eyebrow="Assignments"
        title="과목별 과제 보드"
        description="멘토링 포털의 회차별 이번주 과제를 확인합니다."
        right={(
          <div className="mentoring-board-tools">
            <label>
              <span>멘토링 회차</span>
              <select
                value={selectedMentoringWeekId}
                onChange={(event) => onMentoringWeekChange(event.target.value)}
                disabled={!mentoringWeeks.length}
              >
                {!mentoringWeeks.length ? <option value="">회차 불러오는 중</option> : null}
                {mentoringWeeks.map((week) => (
                  <option value={week.id} key={week.id}>
                    {week.label} · {week.startDate} ~ {week.endDate}
                  </option>
                ))}
              </select>
            </label>
            <button type="button" onClick={() => setCurriculumOpen(true)}>
              <BookOpen size={19} />
              학습 커리큘럼
            </button>
          </div>
        )}
      />
      {mentoringError ? <div className="mentoring-board-notice">멘토링 포털 데이터를 불러오지 못했습니다. 관리자 연동 설정을 확인해 주세요.</div> : null}
      <section className="modern-task-layout">
        <div className="modern-task-columns">
          {subjects.map((subject, subjectIndex) => {
            const subjectTasks = tasks.filter((task) => task.subject === subject);
            return (
              <section className="modern-task-column" key={subject}>
                <div className="modern-column-head">
                  <i style={{ backgroundColor: subjectColor(subject, subjects) }} />
                  {editingSubjectIndex === subjectIndex ? (
                    <input
                      className="modern-column-subject-input"
                      value={subjectDraft}
                      autoFocus
                      onChange={(event) => setSubjectDraft(event.target.value)}
                      onBlur={finishSubjectRename}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') finishSubjectRename();
                        if (event.key === 'Escape') setEditingSubjectIndex(null);
                      }}
                    />
                  ) : <strong>{displaySubject(subject, subjects)}</strong>}
                  <span>{subjectTasks.length}</span>
                  <button type="button" onClick={() => beginSubjectRename(subjectIndex, subject)} aria-label="과목명 변경">
                    <Pencil size={15} />
                  </button>
                  <button type="button" onClick={() => onNewTask(subject)} aria-label="과제 추가">
                    <Plus size={17} />
                  </button>
                </div>
                <div className="modern-task-list">
                  {subjectTasks.map((task) => (
                    <ModernTaskCard
                      key={task.id}
                      task={task}
                      subjects={subjects}
                      onComplete={() => onCompleteTask(task)}
                      onStop={() => onStopTask(task)}
                      onEdit={() => onEditTask(task)}
                      onDelete={() => onDeleteTask(task)}
                    />
                  ))}
                  {!subjectTasks.length ? <div className="modern-empty-state">과제가 없습니다</div> : null}
                </div>
              </section>
            );
          })}
        </div>
      </section>
      {curriculumOpen ? (
        <div className="modern-modal-layer mentoring-curriculum-layer" role="dialog" aria-modal="true" aria-label="학습 커리큘럼">
          <section className="modern-modal-panel mentoring-curriculum-modal">
            <div className="mentoring-curriculum-head">
              <div>
                <span>Mentoring Curriculum</span>
                <h2>학습 커리큘럼</h2>
                <p>{mentoringWeeks.find((week) => week.id === selectedMentoringWeekId)?.label ?? '선택 회차'} 기준</p>
              </div>
              <button type="button" onClick={() => setCurriculumOpen(false)} aria-label="닫기"><X size={25} /></button>
            </div>
            <div className="mentoring-curriculum-grid">
              {subjects.map((subject) => {
                const item = mentoringCurriculum.find((row) => row.subject === subject);
                return (
                  <article key={subject} style={{ '--subject-color': subjectColor(subject, subjects) } as React.CSSProperties}>
                    <h3>{displaySubject(subject, subjects)}</h3>
                    <div>{item?.content || '등록된 커리큘럼이 없습니다.'}</div>
                  </article>
                );
              })}
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}

function ModernAnalysisPage({
  subjects,
  blocks,
  tasks,
  penaltyPoints,
  onEditBlock,
}: {
  subjects: Subject[];
  blocks: StudyBlock[];
  tasks: Task[];
  penaltyPoints: number;
  onEditBlock: (block: StudyBlock) => void;
}) {
  const [reportDate, setReportDate] = useState(todayKey());
  const [stayScope, setStayScope] = useState<'day' | 'week'>('day');
  const todays = blocks.filter((block) => block.date === reportDate);
  const minutesBySubject = subjectMinutes(todays, subjects);
  const total = totalMinutesFromBlocks(todays);
  const topSubject = subjects.length ? subjects.reduce((best, subject) => (minutesBySubject[subject] > minutesBySubject[best] ? subject : best), subjects[0]) : '';
  const longest = todays.reduce((best, block) => (blockDurationSeconds(block) > blockDurationSeconds(best) ? block : best), todays[0] ?? null);
  const avg = todays.length ? Math.round(total / todays.length) : 0;
  const durationStartMinute = 8 * 60;
  const durationHours = Array.from({ length: 19 }, (_, index) => durationStartMinute + index * 60);
  const durationMarkers = [10, 20, 30, 40, 50, 60];
  const completedTasks = tasks.filter((task) => task.completed).length;
  const remainingTasks = Math.max(0, tasks.length - completedTasks);
  const activeSubjectCount = subjects.filter((subject) => (minutesBySubject[subject] ?? 0) > 0).length;
  const focusGoal = 240;
  const focusProgress = Math.min(100, Math.round((total / focusGoal) * 100));
  const focusScore = Math.min(100, Math.round((completionRate(tasks) * 0.45) + (focusProgress * 0.4) + (activeSubjectCount ? 15 : 0)));
  const subjectRows = subjects
    .map((subject) => {
      const value = minutesBySubject[subject] ?? 0;
      return {
        subject,
        value,
        percent: total ? Math.round((value / total) * 100) : 0,
      };
    });
  const sortedBlocks = [...todays].sort((a, b) => a.startMinute - b.startMinute);
  const selectedWeekKeys = weekKeysForDate(reportDate);
  const selectedStayRows = stayScope === 'week'
    ? selectedWeekKeys.map((date) => buildDailyStayRow(date, blocks.filter((block) => block.date === date)))
    : [buildDailyStayRow(reportDate, todays)];
  const selectedStayRow = selectedStayRows.find((row) => row.date === reportDate) ?? selectedStayRows[0];
  const selectedStayStudyMinutes = selectedStayRows.reduce((sum, row) => sum + row.studyMinutes, 0);
  const selectedStayTitle = stayScope === 'week' ? `${selectedWeekKeys[0]} ~ ${selectedWeekKeys[6]}` : reportDate;

  function dateFromKey(dateKey: string) {
    const [year, month, day] = dateKey.split('-').map(Number);
    return new Date(year, (month || 1) - 1, day || 1);
  }

  function weekKeysForDate(dateKey: string) {
    const date = dateFromKey(dateKey);
    const monday = new Date(date);
    monday.setDate(date.getDate() - currentWeekDayIndex(date));
    return Array.from({ length: 7 }, (_, index) => {
      const next = new Date(monday);
      next.setDate(monday.getDate() + index);
      return todayKey(next);
    });
  }

  function buildDailyStayRow(date: string, dayBlocks: StudyBlock[]) {
    const sortedDayBlocks = [...dayBlocks].sort((a, b) => a.startMinute - b.startMinute);
    const studyMinutes = totalMinutesFromBlocks(sortedDayBlocks);
    if (!sortedDayBlocks.length) {
      return {
        date,
        blocks: sortedDayBlocks,
        gradient: dailyPlanGradient(sortedDayBlocks),
        firstBlock: undefined,
        start: '--:--',
        end: '--:--',
        stayMinutes: 0,
        studyMinutes,
        percent: 0,
      };
    }
    const firstStart = Math.min(...sortedDayBlocks.map((block) => block.startMinute));
    const lastEnd = Math.max(...sortedDayBlocks.map((block) => block.startMinute + Math.round(blockDurationSeconds(block) / 60)));
    const stayMinutes = Math.max(studyMinutes, lastEnd - firstStart);
    return {
      date,
      blocks: sortedDayBlocks,
      gradient: dailyPlanGradient(sortedDayBlocks),
      firstBlock: sortedDayBlocks[0],
      start: minuteLabel(firstStart),
      end: minuteLabel(lastEnd),
      stayMinutes,
      studyMinutes,
      percent: stayMinutes ? Math.min(100, Math.round((studyMinutes / stayMinutes) * 100)) : 0,
    };
  }

  function minuteLabel(minute: number) {
    const normalized = ((minute % (24 * 60)) + (24 * 60)) % (24 * 60);
    return `${pad(Math.floor(normalized / 60))}:${pad(normalized % 60)}`;
  }

  function blockRange(block: StudyBlock) {
    const start = block.startMinute;
    const end = start + Math.round(blockDurationSeconds(block) / 60);
    return `${minuteLabel(start)}-${minuteLabel(end)}`;
  }

  function dailyPlanGradient(dayBlocks: StudyBlock[]) {
    const intervals = dayBlocks
      .flatMap((block) => {
        const start = ((block.startMinute % (24 * 60)) + (24 * 60)) % (24 * 60);
        const duration = Math.max(1, Math.round(blockDurationSeconds(block) / 60));
        const end = start + duration;
        const color = subjectColor(block.subject, subjects);
        if (end <= 24 * 60) return [{ start, end, color }];
        return [
          { start, end: 24 * 60, color },
          { start: 0, end: end - (24 * 60), color },
        ];
      })
      .sort((a, b) => a.start - b.start);
    if (!intervals.length) return 'conic-gradient(from -90deg, #edf2f7 0deg 360deg)';
    const stops: string[] = [];
    let cursor = 0;
    intervals.forEach((interval) => {
      const startDeg = (Math.max(cursor, interval.start) / (24 * 60)) * 360;
      const endDeg = (Math.max(interval.start, interval.end) / (24 * 60)) * 360;
      if (startDeg > (cursor / (24 * 60)) * 360) {
        stops.push(`#edf2f7 ${(cursor / (24 * 60)) * 360}deg ${startDeg}deg`);
      }
      stops.push(`${interval.color} ${startDeg}deg ${endDeg}deg`);
      cursor = Math.max(cursor, interval.end);
    });
    if (cursor < 24 * 60) stops.push(`#edf2f7 ${(cursor / (24 * 60)) * 360}deg 360deg`);
    return `conic-gradient(from -90deg, ${stops.join(', ')})`;
  }

  function blockForSlot(minute: number) {
    return todays.find((block) => {
      const blockStart = minute >= 24 * 60 && block.startMinute < durationStartMinute ? block.startMinute + 24 * 60 : block.startMinute;
      return minute >= blockStart && minute < blockStart + blockDurationSeconds(block) / 60;
    });
  }

  function durationHourLabel(minute: number) {
    const hour = Math.floor((minute / 60) % 24);
    if (hour === 0) return '12';
    return String(hour > 12 ? hour - 12 : hour);
  }

  return (
    <div className="page modern-page modern-analysis-page">
      <ModernPageHeader
        eyebrow="Insights"
        title="학습 리포트"
        description="선택한 날짜의 공부량, 균형, 과제 진행도를 한 번에 봅니다."
        right={(
          <div className="modern-report-header-tools">
            <label>
              <span>기준일</span>
              <input type="date" value={reportDate} onChange={(event) => setReportDate(event.target.value || todayKey())} />
            </label>
            <div className="modern-progress-chip"><strong>{focusScore}</strong><span>리포트 점수</span></div>
          </div>
        )}
      />
      <section className="modern-report-grid">
        <section className="modern-report-hero">
          <div className="modern-report-score" style={{ '--score-progress': `${focusScore * 3.6}deg` } as React.CSSProperties}>
            <div className="modern-report-score-value">
              <strong>{focusScore}</strong>
              <span>점</span>
            </div>
          </div>
          <div className="modern-report-copy">
            <span>선택일 페이스</span>
            <h2>{total > 0 ? `${formatStudyMinutes(total)} 집중했습니다` : '아직 기록된 공부가 없습니다'}</h2>
            <p>{total > 0 && topSubject ? `${displaySubject(topSubject, subjects)} 비중이 가장 높습니다.` : '타이머를 시작하면 리포트가 자동으로 채워집니다.'}</p>
          </div>
          <div className="modern-report-goal">
            <div>
              <span>목표 4시간</span>
              <strong>{focusProgress}%</strong>
            </div>
            <i><b style={{ width: `${focusProgress}%` }} /></i>
          </div>
        </section>

        <section className="modern-report-metrics">
          <div><span>총 공부</span><strong>{formatStudyMinutes(total)}</strong></div>
          <div><span>평균 공부</span><strong>{formatStudyMinutes(avg)}</strong></div>
          <div><span>가장 긴 공부</span><strong>{longest ? formatStudyMinutes(blockDurationSeconds(longest) / 60) : '0분'}</strong></div>
          <div><span>활동 과목</span><strong>{activeSubjectCount}개</strong></div>
        </section>

        <section className="modern-report-card modern-report-duration">
          <div className="modern-panel-title">
            <Activity size={22} />
            <div>
              <span>10분 단위</span>
              <strong>공부 기록표</strong>
            </div>
          </div>
          <div className="modern-duration-grid">
            <div className="modern-duration-cell head">T</div>
            {durationMarkers.map((marker) => (
              <div className="modern-duration-cell head" key={marker}>{marker}</div>
            ))}
            {durationHours.map((hourMinute) => (
              <Fragment key={hourMinute}>
                <div className="modern-duration-cell hour">{durationHourLabel(hourMinute)}</div>
                {durationMarkers.map((marker, markerIndex) => {
                  const slotMinute = hourMinute + markerIndex * 10;
                  const block = blockForSlot(slotMinute);
                  return (
                    <button
                      key={`${hourMinute}-${marker}`}
                      className={`modern-duration-cell slot ${block ? 'filled' : ''}`}
                      style={{ '--block-color': block ? subjectColor(block.subject, subjects) : undefined } as React.CSSProperties}
                      type="button"
                      onClick={() => block && onEditBlock(block)}
                      title={block ? `${displaySubject(block.subject, subjects)} · ${block.taskTitle ?? '공부 기록'}` : '빈 10분 기록'}
                    >
                      <span>{block ? displaySubject(block.subject, subjects).slice(0, 2) : ''}</span>
                    </button>
                  );
                })}
              </Fragment>
            ))}
            <div className="modern-duration-cell total-label">TOTAL</div>
            <div className="modern-duration-cell total">{formatStudyMinutes(total)}</div>
          </div>
        </section>

        <section className="modern-report-card modern-report-subjects">
          <div className="modern-panel-title">
            <BarChart3 size={22} />
            <div>
              <span>과목 밸런스</span>
              <strong>시간 분포</strong>
            </div>
          </div>
          <div className="modern-report-subject-list">
            {subjectRows.map(({ subject, value, percent }) => (
              <div className="modern-report-subject-row" key={subject}>
                <span>{displaySubject(subject, subjects)}</span>
                <i><b style={{ width: `${percent}%`, backgroundColor: subjectColor(subject, subjects) }} /></i>
                <strong>{formatStudyMinutes(value)}</strong>
                <em>{percent}%</em>
              </div>
            ))}
          </div>
        </section>

        <section className="modern-report-card modern-report-sessions modern-report-stay">
          <div className="modern-panel-title">
            <Activity size={22} />
            <div>
              <span>일별 체류 시간</span>
              <strong>{selectedStayTitle}</strong>
            </div>
          </div>
          <div className="modern-stay-controls">
            <div>
              <button className={stayScope === 'day' ? 'active' : ''} type="button" onClick={() => setStayScope('day')}>일별</button>
              <button className={stayScope === 'week' ? 'active' : ''} type="button" onClick={() => setStayScope('week')}>주별</button>
            </div>
            <input type="date" value={reportDate} onChange={(event) => setReportDate(event.target.value || todayKey())} />
          </div>
          <div className="modern-stay-plan">
            {stayScope === 'week' ? (
              <div className="modern-stay-week-list">
                <div className="modern-stay-week-summary">
                  <span>선택 주간 공부</span>
                  <strong>{formatStudyMinutes(selectedStayStudyMinutes)}</strong>
                </div>
                {selectedStayRows.map((row) => (
                  <button
                    className={row.date === reportDate ? 'active' : ''}
                    key={row.date}
                    type="button"
                    onClick={() => {
                      setReportDate(row.date);
                      setStayScope('day');
                    }}
                  >
                    <span>{row.date}</span>
                    <strong>체류 {formatStudyMinutes(row.stayMinutes)}</strong>
                    <em>공부 {formatStudyMinutes(row.studyMinutes)}</em>
                  </button>
                ))}
              </div>
            ) : selectedStayRow?.blocks.length ? (
              <>
                <button
                  className="modern-stay-clock"
                  type="button"
                  onClick={() => selectedStayRow.firstBlock && onEditBlock(selectedStayRow.firstBlock)}
                  style={{ '--stay-plan-gradient': selectedStayRow.gradient } as React.CSSProperties}
                >
                  <span className="stay-hour h0">0</span>
                  <span className="stay-hour h6">6</span>
                  <span className="stay-hour h12">12</span>
                  <span className="stay-hour h18">18</span>
                  <div>
                    <strong>{formatStudyMinutes(selectedStayRow.stayMinutes)}</strong>
                    <span>{selectedStayRow.start}-{selectedStayRow.end}</span>
                    <em>공부 {formatStudyMinutes(selectedStayRow.studyMinutes)}</em>
                  </div>
                </button>
                <div className="modern-stay-legend">
                  {selectedStayRow.blocks.slice(0, 5).map((block) => (
                    <button key={block.id} type="button" onClick={() => onEditBlock(block)}>
                      <i style={{ backgroundColor: subjectColor(block.subject, subjects) }} />
                      <span>{blockRange(block)}</span>
                      <strong>{displaySubject(block.subject, subjects)}</strong>
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <div className="modern-report-empty">공부를 시작하면 날짜별 체류 시간이 여기에 표시됩니다.</div>
            )}
          </div>
        </section>

        <section className="modern-report-card modern-report-tasks">
          <div className="modern-panel-title">
            <CheckCircle2 size={22} />
            <div>
              <span>과제 상태</span>
              <strong>{completedTasks}/{tasks.length} 완료</strong>
            </div>
          </div>
          <div className="modern-task-donut" style={{ '--task-progress': `${completionRate(tasks) * 3.6}deg` } as React.CSSProperties}>
            <div className="modern-task-donut-value">
              <strong>{completionRate(tasks)}%</strong>
              <span>완료율</span>
            </div>
          </div>
          <div className="modern-report-task-stats">
            <div><span>완료</span><strong>{completedTasks}개</strong></div>
            <div><span>남음</span><strong>{remainingTasks}개</strong></div>
          </div>
        </section>

        <section className="modern-report-card modern-report-penalty">
          <div className="modern-panel-title">
            <ShieldCheck size={22} />
            <div>
              <span>medipenalty</span>
              <strong>학생별 벌점</strong>
            </div>
          </div>
          <div className="modern-penalty-score">
            <span>누적 벌점</span>
            <strong>{penaltyPoints.toLocaleString('ko-KR')}점</strong>
          </div>
        </section>
      </section>
    </div>
  );
}

function ModernGardenPage({ data, onBuyReward, onOpenAttendance }: { data: AppData; onBuyReward: (item: { id: string; name: string; cost: number }) => void; onOpenAttendance: () => void }) {
  const [selectedMonthKey, setSelectedMonthKey] = useState(rewardMapMonths[0].key);
  const [stageTab, setStageTab] = useState<'map' | 'rewards'>('map');
  const selectedMonth = rewardMapMonths.find((month) => month.key === selectedMonthKey) ?? rewardMapMonths[0];
  const rewardMapVisibility = normalizeRewardMapVisibility(data.rewardMapVisibility);
  const selectedMapOpen = rewardMapVisibility[selectedMonth.key] !== false;
  const stageNodes = defaultRewardStageNodes(selectedMonth.theme);
  const rewardSettings = normalizeRewardSettings(data.rewardSettings);
  const stageStepMinutes = Math.max(1, rewardSettings.stageMinutes);
  const monthMinutes = monthlyStudyMinutes(data.studyBlocks, selectedMonth.key);
  const completedStages = rewardStageCount(monthMinutes, rewardSettings);
  const currentNodeIndex = Math.min(completedStages, stageNodes.length - 1);
  const currentNode = stageNodes[currentNodeIndex];
  const nextTargetMinutes = Math.min(rewardStageStepCount, completedStages + 1) * stageStepMinutes;
  const nextMinutes = completedStages >= rewardStageStepCount ? 0 : Math.max(0, nextTargetMinutes - monthMinutes);
  const monthProgress = Math.min(100, Math.round((monthMinutes / (stageStepMinutes * rewardStageStepCount)) * 100));
  const monthCount = data.attendanceDates.filter((key) => key.startsWith(selectedMonth.key)).length;
  const completedPathNodes = stageNodes.slice(0, Math.min(completedStages + 1, stageNodes.length));

  return (
    <div className="page modern-page modern-garden-page">
      <ModernPageHeader
        eyebrow="Quest Map"
        title="스테이지 보상"
        description="공부 시간이 쌓이면 캐릭터가 다음 스테이지로 이동하고 별 보상을 받습니다."
        right={<div className="modern-wallet-chip"><Star size={18} /><strong>{data.fruits}개</strong><span>별</span></div>}
      />
      <div className="modern-month-tabs" aria-label="월별 맵 선택">
        {rewardMapMonths.map((month) => (
          <button className={selectedMonth.key === month.key ? 'active' : ''} key={month.key} type="button" onClick={() => setSelectedMonthKey(month.key)}>
            <span>{month.label}</span>
            <strong>{month.title}</strong>
          </button>
        ))}
      </div>
      <div className="modern-stage-mode-tabs" aria-label="스테이지 보상 화면">
        <button className={stageTab === 'map' ? 'active' : ''} type="button" onClick={() => setStageTab('map')}>월드맵</button>
        <button className={stageTab === 'rewards' ? 'active' : ''} type="button" onClick={() => setStageTab('rewards')}>별 교환</button>
      </div>
      {stageTab === 'map' ? (
        <section className="modern-stage-layout map-only">
          <div className={`modern-stage-map reward-map-zero theme-${selectedMonth.theme} ${selectedMapOpen ? '' : 'map-closed'}`}>
            <img
              className="reward-map-art"
              src={rewardMapImages[selectedMonth.theme]}
              alt=""
              draggable={false}
            />
            <div className="modern-map-title">
              <span>{selectedMonth.subtitle}</span>
              <strong>{selectedMonth.title}</strong>
            </div>
            <div className="stage-map-hud">
              <div><span>{selectedMonth.label} 진행률</span><strong>{monthProgress}%</strong></div>
              <div><span>현재</span><strong>{currentNodeIndex + 1}/{rewardStageStepCount}</strong></div>
              <div><span>다음 이동</span><strong>{nextMinutes ? formatStudyMinutes(nextMinutes) : '완주'}</strong></div>
            </div>
            <svg className="modern-map-path" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
              <path
                className="path-shadow"
                d={buildRewardMapPath(stageNodes)}
              />
              <path
                className="path-base"
                d={buildRewardMapPath(stageNodes)}
              />
              <path
                className="path-done"
                d={buildRewardMapPath(completedPathNodes)}
              />
            </svg>
            {stageNodes.map((node, index) => {
              const stageStars = rewardStageStarCount(monthMinutes, index, stageStepMinutes);
              const reached = stageStars === rewardStageStarsPerStage;
              const current = index === currentNodeIndex && completedStages < rewardStageStepCount;
              return (
                <div
                  className={`stage-node ${reached ? 'reached' : ''} ${current ? 'current' : ''}`}
                  key={`${node.label}-${index}`}
                  style={{ left: `${node.x}%`, top: `${node.y}%` }}
                >
                <button type="button" aria-label={`${node.label} 스테이지`}>
                  {node.label}
                </button>
                  <div className="stage-star-row" aria-hidden="true">
                    {Array.from({ length: rewardStageStarsPerStage }, (_, starIndex) => (
                      <Star className={starIndex < stageStars ? 'filled' : ''} key={starIndex} size={11} />
                    ))}
                  </div>
              </div>
              );
            })}
            <div className="stage-runner" style={{ left: `${currentNode.x}%`, top: `${currentNode.y}%` }}>
              <div><span /></div>
            </div>
            {!selectedMapOpen ? (
              <div className="reward-map-closed-layer">
                <ShieldCheck size={24} />
                <strong>닫힌 맵</strong>
                <span>관리자 설정에서 열 수 있습니다.</span>
              </div>
            ) : null}
          </div>
        </section>
      ) : (
        <section className="modern-stage-layout rewards-only">
          <section className="stage-rewards-board">
            <div className="stage-rewards-top">
              <div className="stage-summary-card">
                <span>{selectedMonth.label} 진행률</span>
                <strong>{monthProgress}%</strong>
                <i><b style={{ width: `${monthProgress}%` }} /></i>
                <em>{formatStudyMinutes(monthMinutes)} 누적</em>
              </div>
              <div className="stage-summary-grid">
                <div><span>현재 스테이지</span><strong>{currentNodeIndex + 1}/{rewardStageStepCount}</strong></div>
                <div><span>다음 이동</span><strong>{nextMinutes ? formatStudyMinutes(nextMinutes) : '완주'}</strong></div>
                <div><span>스테이지 기준</span><strong>{formatStudyMinutes(stageStepMinutes)}</strong></div>
                <div><span>도착 보상</span><strong>별 {rewardSettings.stageRewardStars}개</strong></div>
              </div>
              <button className="stage-attendance-button" type="button" onClick={onOpenAttendance}>
                <Stamp size={20} />
                <span>이번 달 출석 {monthCount}일</span>
              </button>
            </div>
            <div className="stage-exchange-area">
            <div className="stage-shop-panel">
              <div className="modern-panel-title">
                <Gift size={20} />
                <div>
                  <span>별 교환</span>
                  <strong>상품 보상</strong>
                </div>
              </div>
              <div className="stage-shop-list">
                {modernRewardItems.map((item) => (
                  <article key={item.id}>
                    <div><Star size={14} /><strong>{item.cost}</strong></div>
                    <span>{displayRewardName(item)}</span>
                    <button type="button" onClick={() => onBuyReward({ id: item.id, name: displayRewardName(item), cost: item.cost })} disabled={data.fruits < item.cost}>교환</button>
                  </article>
                ))}
              </div>
            </div>
            <div className="stage-history-panel">
              <div className="modern-panel-title compact">
                <Star size={18} />
                <div>
                  <span>최근 교환</span>
                  <strong>교환한 상품</strong>
                </div>
              </div>
              <div className="modern-purchase-list compact">
                {data.rewardPurchases.slice(0, 4).map((purchase) => (
                  <div key={purchase.id}><span>{purchase.itemName}</span><strong>-{purchase.fruitCost}개</strong></div>
                ))}
                {!data.rewardPurchases.length ? <div className="modern-empty-state">교환 내역이 없습니다</div> : null}
              </div>
            </div>
            </div>
          </section>
        </section>
      )}
    </div>
  );
}

function ModernCenterPage({ students, subjects }: { students: StudentStatus[]; subjects: Subject[] }) {
  const sorted = [...students].sort((a, b) => b.todayMinutes - a.todayMinutes);
  const fruitCount = (student: StudentStatus) => Math.max(0, Math.floor(student.todayMinutes / 60));
  const fruitLeaders = [...students].sort((a, b) => fruitCount(b) - fruitCount(a) || b.todayMinutes - a.todayMinutes);
  const studying = students.filter((student) => student.status === 'studying').length;
  const resting = students.filter((student) => student.status === 'break').length;
  const offline = students.filter((student) => student.status === 'offline').length;
  const statusLabel: Record<StudentStatus['status'], string> = {
    studying: '공부 중',
    break: '휴식 중',
    offline: '오프라인',
  };

  return (
    <div className="page modern-page modern-center-page">
      <ModernPageHeader
        eyebrow="Live Center"
        title="센터 학습 현황"
        description="같은 센터 학생들의 오늘 집중 상태를 한눈에 봅니다."
      />
      <section className="modern-center-grid">
        <div className="modern-center-stats">
          <div className="studying"><span>공부 중</span><strong>{studying}명</strong></div>
          <div className="resting"><span>휴식 중</span><strong>{resting}명</strong></div>
          <div className="offline"><span>오프라인</span><strong>{offline}명</strong></div>
        </div>
        <div className="modern-student-grid">
          {students.map((student) => (
            <article className={`modern-student-card ${student.status}`} key={student.id} style={{ '--student-color': subjectColor(student.subject, subjects) } as React.CSSProperties}>
              <div className="modern-student-state">{statusLabel[student.status]}</div>
              <h3>{student.name} <small>{student.id}</small></h3>
              <strong>{formatStudyMinutes(student.todayMinutes)}</strong>
              <span>{student.status === 'studying' ? `${displaySubject(student.subject, subjects)} 공부 중` : student.status === 'break' ? '잠시 휴식 중' : '접속 대기'}</span>
            </article>
          ))}
        </div>
        <aside className="modern-leader-panel">
          <div className="modern-leader-section">
            <div className="modern-panel-title">
              <Trophy size={22} />
              <div>
                <span>오늘 TOP 5</span>
                <strong>누적 시간 순위</strong>
              </div>
            </div>
            {sorted.slice(0, 5).map((student, index) => (
              <div className="modern-leader-row" key={student.id}>
                <strong>{index + 1}</strong>
                <span>{student.name}</span>
                <em>{formatStudyMinutes(student.todayMinutes)}</em>
              </div>
            ))}
          </div>
          <div className="modern-leader-section fruits">
            <div className="modern-panel-title">
              <Star size={22} />
              <div>
                <span>TOP 3</span>
                <strong>누적 열매 개수</strong>
              </div>
            </div>
            {fruitLeaders.slice(0, 3).map((student, index) => (
              <div className="modern-fruit-row" key={`${student.id}-fruit`}>
                <strong>{index + 1}</strong>
                <span>{student.name}</span>
                <em>{fruitCount(student)}개</em>
              </div>
            ))}
          </div>
        </aside>
      </section>
    </div>
  );
}

function ModernWeekScheduleModal({ schedule, source, onClose }: { schedule: ScheduleItem[]; source: string; onClose: () => void }) {
  const now = new Date();
  const monday = new Date(now);
  monday.setDate(now.getDate() - currentWeekDayIndex(now));
  monday.setHours(0, 0, 0, 0);
  const dates = weekDays.map((_, index) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + index);
    return date;
  });
  const scheduleCount = schedule.length;
  const centerCount = schedule.filter((item) => item.type === 'center').length;
  const typeLabels: Record<ScheduleItem['type'], string> = {
    center: '센터',
    outside: '외부',
    self: '자습',
  };

  return (
    <div className="modern-modal-layer">
      <section className="modern-modal-panel modern-week-modal">
        <div className="modern-week-head">
          <div className="modern-week-title">
            <span><CalendarDays size={16} /> WEEKLY PLAN</span>
            <h2>이번주 일정</h2>
            <p>{source && !isLikelyBrokenText(source) ? source : '학생별 실시간 일정과 연동됩니다.'}</p>
          </div>
          <div className="modern-week-head-actions">
            <div><span>전체 일정</span><strong>{scheduleCount}개</strong></div>
            <div><span>센터 일정</span><strong>{centerCount}개</strong></div>
            <button onClick={onClose} type="button" aria-label="닫기"><X size={25} /></button>
          </div>
        </div>
        <div className="modern-week-legend">
          <span className="center">센터</span>
          <span className="outside">학교·학원·외부</span>
          <span className="self">개인 자습</span>
        </div>
        <div className="modern-week-grid">
          {weekDays.map((day, index) => {
            const dayItems = schedule.filter((item) => item.day === day).slice(0, 5);
            const date = dates[index];
            const isToday = todayKey(date) === todayKey(now);
            return (
            <div className={`modern-week-column ${isToday ? 'today' : ''} ${index >= 5 ? 'weekend' : ''}`} key={`${day}-${index}`}>
              <div className="modern-week-day-head">
                <span>{weekDayLabels[index] ?? day}</span>
                <strong>{date.getMonth() + 1}.{date.getDate()}</strong>
                {isToday ? <em>오늘</em> : null}
              </div>
              <div className="modern-week-items">
                {dayItems.map((item) => {
                  const durationMinutes = Math.max(0, (timeToSeconds(item.end) - timeToSeconds(item.start)) / 60);
                  return (
                    <div className={`modern-week-item ${item.type}`} key={item.id}>
                      <div><span>{item.start}–{item.end}</span><b>{typeLabels[item.type]}</b></div>
                      <em>{displayScheduleTitle(item)}</em>
                      <small>{formatStudyMinutes(durationMinutes)}</small>
                    </div>
                  );
                })}
                {dayItems.length ? null : <div className="modern-week-empty"><CalendarDays size={20} /><span>일정 없음</span></div>}
              </div>
            </div>
          )})}
        </div>
      </section>
    </div>
  );
}

function ModernTimerFullscreenModal({
  elapsedSeconds,
  subject,
  timerSkin,
  onClose,
  onPause,
  onStop,
  paused,
  canControl,
}: {
  elapsedSeconds: number;
  subject: Subject;
  timerSkin: TimerSkin;
  onClose: () => void;
  onPause: () => void;
  onStop: () => void;
  paused: boolean;
  canControl: boolean;
}) {
  const stateText = canControl ? (paused ? '일시정지' : '진행 중') : '대기 중';
  return (
    <div className="modern-modal-layer">
      <section className={`modern-fullscreen-timer timer-${timerSkin}`}>
        <button className="modern-modal-close" onClick={onClose} type="button" aria-label="닫기"><X size={28} /></button>
        <span>{stateText} · {displaySubject(subject)}</span>
        <TimerFace seconds={elapsedSeconds} skin={timerSkin} label={displaySubject(subject)} subLabel={stateText} fullscreen />
        <div className="modern-fullscreen-actions">
          <button onClick={onPause} type="button" disabled={!canControl}><Pause size={30} />{paused ? '다시 시작' : '일시정지'}</button>
          <button onClick={onStop} type="button" disabled={!canControl}><Square size={29} />종료</button>
        </div>
      </section>
    </div>
  );
}

function ModernMockExamTimerModal({
  timerSkin,
  onClose,
  onFullscreenChange,
}: {
  timerSkin: TimerSkin;
  onClose: () => void;
  onFullscreenChange: (fullscreen: boolean) => void;
}) {
  const [mockFullscreen, setMockFullscreen] = useState(false);
  const [countdownRunning, setCountdownRunning] = useState(false);
  const [countdownPaused, setCountdownPaused] = useState(false);
  const examOptions = useMemo(() => (
    examDayPlan
      .filter((phase) => phase.kind === 'exam')
      .map((phase, index) => ({
        ...phase,
        index,
        durationSeconds: Math.max(0, timeToSeconds(phase.end) - timeToSeconds(phase.start)),
      }))
  ), []);
  const [selectedExamId, setSelectedExamId] = useState(() => examOptions[0]?.id ?? '');
  const selectedExam = examOptions.find((phase) => phase.id === selectedExamId) ?? examOptions[0];
  const selectedExamSeconds = selectedExam?.durationSeconds ?? 0;
  const [remainingSeconds, setRemainingSeconds] = useState(selectedExamSeconds);
  const selectedExamColor = subjectColor(DEFAULT_SUBJECTS[(selectedExam?.index ?? 0) % DEFAULT_SUBJECTS.length]);

  useEffect(() => {
    setRemainingSeconds(selectedExamSeconds);
    setCountdownRunning(false);
    setCountdownPaused(false);
  }, [selectedExamId, selectedExamSeconds]);

  useEffect(() => {
    if (!countdownRunning || countdownPaused) return;
    const id = window.setInterval(() => {
      setRemainingSeconds((prev) => {
        const next = Math.max(0, prev - 1);
        if (next <= 0) {
          setCountdownRunning(false);
          setCountdownPaused(false);
        }
        return next;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [countdownPaused, countdownRunning]);

  function startCountdown() {
    if (remainingSeconds <= 0) setRemainingSeconds(selectedExamSeconds);
    setCountdownRunning(true);
    setCountdownPaused(false);
  }

  function stopCountdown() {
    setCountdownRunning(false);
    setCountdownPaused(false);
    setRemainingSeconds(selectedExamSeconds);
  }

  function enterMockFullscreen() {
    setMockFullscreen(true);
    onFullscreenChange(true);
  }

  function leaveMockFullscreen() {
    setMockFullscreen(false);
    onFullscreenChange(false);
  }

  return (
    <div className="modern-modal-layer">
      <section className={`modern-modal-panel modern-mock-modal ${mockFullscreen ? 'mock-fullscreen' : ''}`}>
        {!mockFullscreen ? (
          <div className="modern-modal-head">
            <div><h2>수능 카운트다운</h2><span>과목을 선택하면 해당 시험 시간만 카운트다운합니다.</span></div>
            <div className="modern-modal-head-actions">
              <button onClick={enterMockFullscreen} type="button" aria-label="전체화면"><Expand size={24} /></button>
              <button onClick={onClose} type="button" aria-label="닫기"><X size={26} /></button>
            </div>
          </div>
        ) : (
          <button className="modern-modal-close" onClick={leaveMockFullscreen} type="button" aria-label="전체화면 닫기"><X size={30} /></button>
        )}
        {!mockFullscreen ? (
          <div className="modern-countdown-subjects">
            {examOptions.map((phase) => (
              <button
                key={phase.id}
                className={phase.id === selectedExam?.id ? 'active' : ''}
                type="button"
                onClick={() => setSelectedExamId(phase.id)}
                style={{ '--subject-color': subjectColor(DEFAULT_SUBJECTS[phase.index % DEFAULT_SUBJECTS.length]) } as React.CSSProperties}
              >
                <span>{phase.label}</span>
                <strong>{phase.start}-{phase.end}</strong>
              </button>
            ))}
          </div>
        ) : null}
        <div className={`modern-mock-stage timer-${timerSkin} ${mockFullscreen ? 'timer-only' : ''}`} style={{ '--subject-color': selectedExamColor } as React.CSSProperties}>
          <div className="modern-mock-state exam">
            <span>{countdownRunning && !countdownPaused ? '카운트다운 진행' : countdownPaused ? '일시정지' : '선택 과목'}</span>
            <strong>{selectedExam?.label ?? '과목 선택'}</strong>
            <em>{selectedExam ? `${selectedExam.start}-${selectedExam.end}` : ''}</em>
          </div>
          <TimerFace
            seconds={remainingSeconds}
            skin={timerSkin}
            label={selectedExam?.label}
            minuteMode="remaining"
          />
          <div className="modern-mock-actions">
            <button className="primary" onClick={startCountdown} type="button" disabled={!selectedExam || (countdownRunning && !countdownPaused)}>
              <Play size={22} />{countdownPaused ? '다시 시작' : remainingSeconds < selectedExamSeconds && remainingSeconds > 0 ? '이어가기' : '시작'}
            </button>
            <button onClick={() => setCountdownPaused((prev) => !prev)} type="button" disabled={!countdownRunning}>
              <Pause size={22} />{countdownPaused ? '해제' : '일시정지'}
            </button>
            <button className="danger" onClick={stopCountdown} type="button"><Square size={21} />종료</button>
          </div>
        </div>
      </section>
    </div>
  );
}

function ModernAttendanceModal({
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
    <div className="modern-modal-layer">
      <section className="modern-modal-panel modern-attendance-modal">
        <div className="modern-modal-head">
          <div><h2>출석 체크</h2><span>이번 달 {count}/{full}일 · 공부 시작 시 자동 기록합니다.</span></div>
          <button onClick={onClose} type="button" aria-label="닫기"><X size={26} /></button>
        </div>
        <div className="modern-calendar-grid">
          {dates.map((date) => {
            const stamped = attended.has(date);
            const animate = stamped && date === animatedDate;
            return (
              <div className={`${stamped ? 'stamped' : ''} ${date === today ? 'today' : ''} ${animate ? 'stamp-animate' : ''}`} key={date}>
                <span>{Number(date.slice(-2))}</span>
                {stamped ? <strong><Stamp size={21} />출석</strong> : date === today ? <em>오늘</em> : null}
              </div>
            );
          })}
        </div>
        <div className="modern-attendance-rewards">
          <div className="modern-attendance-progress">
            <div>
              <span>출석 보상</span>
              <strong>{nextReward ? `${nextReward.threshold - count}일 더 출석하면 별 ${nextReward.fruits}개` : '이번 달 출석 보상 완료'}</strong>
            </div>
            <em>{count}/{full}일</em>
          </div>
          <div className="modern-progress-track"><i style={{ width: `${progress}%` }} /></div>
          <div className="modern-attendance-steps">
            {rewardSteps.map((step) => {
              const achieved = count >= step.threshold;
              const claimed = claimedRewards.has(step.threshold);
              return (
                <div className={`${achieved ? 'achieved' : ''} ${claimed ? 'claimed' : ''}`} key={step.threshold}>
                  <span>{step.threshold}일</span>
                  <strong>별 {step.fruits}개</strong>
                  <em>{claimed ? '지급 완료' : achieved ? '달성' : `${step.threshold - count}일 남음`}</em>
                </div>
              );
            })}
          </div>
        </div>
        <div className="modern-modal-actions">
          <button type="button" onClick={onHideToday}>오늘은 숨기기</button>
          <button className="primary" type="button" onClick={onClose}>확인</button>
        </div>
      </section>
    </div>
  );
}

function ModernAdminMessageModal({ message, onClose }: { message: AdminMessage; onClose: () => void }) {
  return (
    <div className="modern-modal-layer">
      <section className="modern-modal-panel modern-message-modal">
        <div className="modern-message-icon"><Bell size={29} /></div>
        <div>
          <span>관리자 메시지</span>
          <h2>{message.recipientName && !isLikelyBrokenText(message.recipientName) ? message.recipientName : '학생'}님에게</h2>
          <p>{message.body}</p>
        </div>
        <button type="button" onClick={onClose}>확인</button>
      </section>
    </div>
  );
}

function ModernTaskEditor({ task, subjects, initialSubject, onSave, onClose }: { task: Task | null; subjects: Subject[]; initialSubject: Subject; onSave: (task: Task) => void; onClose: () => void }) {
  const [title, setTitle] = useState(task ? displayTaskTitle(task) : '');
  const [subject, setSubject] = useState<Subject>(task?.subject ?? initialSubject);

  return (
    <div className="modern-modal-layer">
      <section className="modern-modal-panel modern-editor-modal">
        <div className="modern-modal-head">
          <h2>{task ? '과제 편집' : '과제 추가'}</h2>
          <button onClick={onClose} type="button" aria-label="닫기"><X size={26} /></button>
        </div>
        <label>과목<select value={subject} onChange={(event) => setSubject(event.target.value)}>{subjects.map((item) => <option key={item} value={item}>{displaySubject(item, subjects)}</option>)}</select></label>
        <label>내용<input value={title} onChange={(event) => setTitle(event.target.value)} /></label>
        <button
          className="modern-save-button"
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
          <Save size={22} />
          저장
        </button>
      </section>
    </div>
  );
}

function ModernBlockEditor({ block, subjects, onSave, onClose }: { block: StudyBlock; subjects: Subject[]; onSave: (block: StudyBlock) => void; onClose: () => void }) {
  const [subject, setSubject] = useState<Subject>(block.subject);
  const [duration, setDuration] = useState(Math.max(10, Math.round(blockDurationSeconds(block) / 60)));
  const normalizedDuration = Math.max(10, duration);
  return (
    <div className="modern-modal-layer">
      <section className="modern-modal-panel modern-editor-modal">
        <div className="modern-modal-head">
          <h2>공부 기록 편집</h2>
          <button onClick={onClose} type="button" aria-label="닫기"><X size={26} /></button>
        </div>
        <label>과목<select value={subject} onChange={(event) => setSubject(event.target.value)}>{subjects.map((item) => <option key={item} value={item}>{displaySubject(item, subjects)}</option>)}</select></label>
        <label>시간<input type="number" min={10} max={240} step={10} value={duration} onChange={(event) => setDuration(Number(event.target.value))} /></label>
        <button className="modern-save-button" type="button" onClick={() => onSave({ ...block, subject, durationMinutes: normalizedDuration, durationSeconds: normalizedDuration * 60 })}>
          <Save size={22} />
          저장
        </button>
      </section>
    </div>
  );
}

function AdminPage({
  data,
  students,
  subjects,
  schedule,
  familyReports,
  penaltySummaries,
  realtimeServerTime,
  onSendMessage,
  onRewardSettingsChange,
  onRewardMapVisibilityChange,
  onPenaltySettingsChange,
}: {
  data: AppData;
  students: StudentStatus[];
  subjects: Subject[];
  schedule: ScheduleItem[];
  familyReports: FamilySyncReport[];
  penaltySummaries: PenaltySummary[];
  realtimeServerTime: string;
  onSendMessage: (student: StudentStatus, body: string) => void;
  onRewardSettingsChange: (settings: RewardSettings) => void;
  onRewardMapVisibilityChange: (visibility: Record<string, boolean>) => void;
  onPenaltySettingsChange: (settings: PenaltySettings) => void;
}) {
  const [tab, setTab] = useState<'overview' | 'files' | 'students' | 'learning' | 'rewards' | 'settings' | 'messages'>('overview');
  const [selectedStudentId, setSelectedStudentId] = useState(students[0]?.id ?? data.studentId);
  const [studentSort, setStudentSort] = useState<StudentSortKey>('name');
  const [messageBody, setMessageBody] = useState('');
  const [selectedStudentTasks, setSelectedStudentTasks] = useState<Task[]>(data.tasks);
  const [selectedStudentSubjects, setSelectedStudentSubjects] = useState<Subject[]>(subjects);
  const [selectedTaskSource, setSelectedTaskSource] = useState('medimentors.kr');
  const [selectedSchedule, setSelectedSchedule] = useState<ScheduleItem[]>(schedule);
  const [selectedScheduleSource, setSelectedScheduleSource] = useState('medischedule.kr');
  const [linkedFileNames, setLinkedFileNames] = useState<string[]>([]);
  const rewardSettings = normalizeRewardSettings(data.rewardSettings);
  const rewardMapVisibility = normalizeRewardMapVisibility(data.rewardMapVisibility);
  const penaltySettings = normalizePenaltySettings(data.penaltySettings);
  const openRewardMapCount = rewardMapMonths.filter((month) => rewardMapVisibility[month.key] !== false).length;
  const sorted = [...students].sort((a, b) => b.todayMinutes - a.todayMinutes);
  const adminStudents = useMemo(() => sortStudents(students, studentSort), [students, studentSort]);
  const selectedStudent = students.find((student) => student.id === selectedStudentId) ?? students[0];
  const selectedReport = familyReports.find((report) => report.studentId === selectedStudent?.id)
    ?? familyReports.find((report) => report.studentName === selectedStudent?.name);
  const selectedPenalty = penaltySummaries.find((penalty) => penalty.id === selectedStudent?.id)
    ?? penaltySummaries.find((penalty) => penalty.name === selectedStudent?.name)
    ?? selectedReport?.penalty;
  const visibleTasks = selectedStudentTasks;
  const total = students.reduce((sum, student) => sum + student.todayMinutes, 0);
  const studying = students.filter((student) => student.status === 'studying').length;
  const resting = students.filter((student) => student.status === 'break').length;
  const offline = students.filter((student) => student.status === 'offline').length;
  const completed = visibleTasks.filter((task) => task.completed).length;
  const selectedTodayIndex = new Date().getDay();
  const selectedTodayDay = selectedTodayIndex === 0 ? weekDays[6] : weekDays[selectedTodayIndex - 1];
  const selectedTodaySchedule = selectedSchedule.filter((item) => item.day === selectedTodayDay).slice(0, 4);
  const monthDates = monthDateKeys();
  const selectedRewards = selectedReport?.rewards;
  const selectedAttendanceDates = selectedRewards?.attendanceDates ?? [];
  const selectedClaimedAttendanceRewards = selectedRewards?.claimedAttendanceRewards ?? [];
  const selectedRewardPurchases = selectedRewards?.rewardPurchases ?? [];
  const selectedFruits = selectedRewards?.fruits ?? 0;
  const attendedDates = new Set(selectedAttendanceDates);
  const monthAttendance = selectedAttendanceDates.filter((key) => monthDates.includes(key)).length;
  const fullMonth = monthDates.length;
  const selectedMessages = data.adminMessages.filter((message) => message.recipientId === selectedStudent?.id);
  const rewardSteps = attendanceRewardSteps(fullMonth, rewardSettings);
  const visibleSubjects = selectedStudentSubjects.length ? selectedStudentSubjects : subjects;
  const subjectRows = visibleSubjects.map((subject) => {
    const subjectTasks = visibleTasks.filter((task) => task.subject === subject);
    const subjectMinutes = selectedReport?.subjectStudy.find((row) => row.subject === subject)?.minutes
      ?? selectedReport?.studyBlocks
        .filter((block) => block.subject === subject && block.date === todayKey())
        .reduce((sum, block) => sum + blockDurationSeconds(block) / 60, 0)
      ?? 0;
    return {
      subject,
      minutes: subjectMinutes,
      completed: subjectTasks.filter((task) => task.completed).length,
      total: subjectTasks.length,
    };
  });
  const recentMessages = [...data.adminMessages].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 30);
  const syncedReportCount = new Set(familyReports.map((report) => report.studentId)).size;
  const realtimeLabel = realtimeServerTime
    ? new Date(realtimeServerTime).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : '연결 대기';

  useEffect(() => {
    if (students.length && !students.some((student) => student.id === selectedStudentId)) {
      setSelectedStudentId(students[0].id);
    }
  }, [selectedStudentId, students]);

  useEffect(() => {
    if (!selectedStudent?.id) return;
    let cancelled = false;
    async function refreshSelectedStudentData() {
      if (!selectedStudent?.id) return;
      const [taskResult, scheduleResult] = await Promise.all([
        loadMentoringTasks(selectedStudent.id),
        loadSchedule(selectedStudent.id),
      ]);
      if (cancelled) return;
      const reportTasks = selectedReport?.tasks ?? [];
      const nextTasks = taskResult.tasks.length ? taskResult.tasks : reportTasks;
      const taskSubjects = nextTasks.reduce<Subject[]>((result, task) => (result.includes(task.subject) ? result : [...result, task.subject]), []);
      const reportSubjects = selectedReport?.subjectStudy.map((row) => row.subject).filter(Boolean) ?? [];
      const nextSchedule = selectedReport?.schedules.length ? selectedReport.schedules : scheduleResult.items;
      setSelectedStudentTasks(nextTasks);
      setSelectedStudentSubjects(
        taskResult.subjects.length
          ? taskResult.subjects
          : reportSubjects.length
            ? reportSubjects
            : taskSubjects.length
              ? taskSubjects
              : subjects,
      );
      setSelectedTaskSource(taskResult.source || (reportTasks.length ? 'student app 실시간 리포트' : '연결 대기'));
      setSelectedSchedule(nextSchedule);
      setSelectedScheduleSource(selectedReport?.schedules.length ? 'student app 실시간 리포트' : scheduleResult.source);
    }
    void refreshSelectedStudentData();
    const id = window.setInterval(refreshSelectedStudentData, 10000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [selectedReport?.updatedAt, selectedStudent?.id]);

  function updateRewardSetting(key: keyof RewardSettings, value: number) {
    onRewardSettingsChange(normalizeRewardSettings({ ...rewardSettings, [key]: value }));
  }

  function updateRewardMapVisibility(key: string, open: boolean) {
    onRewardMapVisibilityChange(normalizeRewardMapVisibility({ ...rewardMapVisibility, [key]: open }));
  }

  function updatePenaltySetting(key: keyof PenaltySettings, value: string) {
    onPenaltySettingsChange(normalizePenaltySettings({ ...penaltySettings, [key]: value }));
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

  async function toggleSelectedTask(task: Task) {
    const completed = !task.completed;
    setSelectedStudentTasks((current) => current.map((item) => (
      item.id === task.id ? { ...item, completed, portalStatus: 'pending' } : item
    )));
    const synced = await syncMentoringTaskCompletion(task, completed);
    setSelectedStudentTasks((current) => current.map((item) => (
      item.id === task.id ? { ...item, completed, portalStatus: synced ? 'synced' : 'pending' } : item
    )));
  }

  function rememberLinkedFiles(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    setLinkedFileNames(files.map((file) => `${file.name} (${Math.max(1, Math.round(file.size / 1024)).toLocaleString('ko-KR')}KB)`));
  }

  return (
    <div className="page admin-page">
      <PageTitle
        label="Admin Console"
        title="학생 앱 운영 대시보드"
        right={<div className="session-state live">실시간 · {realtimeLabel}</div>}
      />
      <nav className="admin-tabs">
        {[
          ['overview', '현황'],
          ['files', '파일 연동'],
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
                  <div><CalendarDays size={22} /><span>오늘 일정</span><strong>{selectedTodaySchedule.length}건</strong></div>
                  <div><ClipboardList size={22} /><span>과제 완료</span><strong>{completed}/{visibleTasks.length}</strong></div>
                  <div><Star size={22} /><span>보유 별</span><strong>{selectedFruits}개</strong></div>
                  <div><Trophy size={22} /><span>맵 보상</span><strong>{rewardSettings.stageRewardStars}개</strong></div>
                  <div><Flag size={22} /><span>오픈 맵</span><strong>{openRewardMapCount}/{rewardMapMonths.length}</strong></div>
                  <div><Stamp size={22} /><span>월 출석</span><strong>{monthAttendance}일</strong></div>
                  <div><MessageSquare size={22} /><span>메시지</span><strong>{selectedMessages.length}건</strong></div>
                </div>
                <div className="admin-sync-list">
                  <div><span>학생 명단</span><strong>멘토링 {students.length}명</strong></div>
                  <div><span>앱 리포트</span><strong>{syncedReportCount}명 실시간</strong></div>
                  <div><span>마지막 동기화</span><strong>{realtimeLabel}</strong></div>
                </div>
              </div>
            </div>
          </>
        ) : null}
        {tab === 'files' ? (
          <div className="admin-two-col admin-file-grid">
            <div className="admin-panel admin-file-panel">
              <div className="admin-panel-head"><h2>파일 연동</h2><span>CSV · Excel · JSON 준비</span></div>
              <label className="admin-file-drop">
                <input type="file" accept=".csv,.xlsx,.xls,.json" multiple onChange={rememberLinkedFiles} />
                <ClipboardList size={30} />
                <strong>파일 선택</strong>
                <span>학생 명단, 일정, 과제 파일을 연결할 자리입니다.</span>
              </label>
              <div className="admin-compact-list">
                {linkedFileNames.length ? linkedFileNames.map((fileName) => (
                  <div key={fileName}><span>선택됨</span><strong>{fileName}</strong></div>
                )) : <div><span>선택됨</span><strong>아직 선택된 파일 없음</strong></div>}
              </div>
            </div>
            <div className="admin-panel admin-file-status">
              <div className="admin-panel-head"><h2>현재 연동 상태</h2><span>실시간 서비스 상태</span></div>
              <div className="admin-sync-list">
                <div><span>학생 명단</span><strong>{students.length ? `medimentors ${students.length}명` : '연결 대기'}</strong></div>
                <div><span>일정</span><strong>{selectedScheduleSource}</strong></div>
                <div><span>과제</span><strong>{selectedTaskSource}</strong></div>
                <div><span>학생 앱 리포트</span><strong>{syncedReportCount}명 수신</strong></div>
              </div>
              <div className="admin-compact-list">
                <div><span>app-api</span><strong>연결 · {realtimeLabel}</strong></div>
                <div><span>medimentors</span><strong>{students.length === 67 ? '정상 · 67명' : `수신 · ${students.length}명`}</strong></div>
                <div><span>medipenalty</span><strong>{penaltySummaries.length ? `정상 · ${penaltySummaries.length}명` : '연결 대기'}</strong></div>
              </div>
            </div>
          </div>
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
                <div><span>학생 번호</span><strong>{selectedReport?.profile.studentPhone || studentPhoneText(selectedStudent)}</strong></div>
                <div><span>오늘 공부</span><strong>{formatMinuteText(selectedReport?.studySummary.today ?? selectedStudent?.todayMinutes ?? 0)}</strong></div>
                <div><span>현재 과목</span><strong>{selectedStudent?.subject ?? '-'}</strong></div>
                <div><span>과제 완료</span><strong>{completed}/{visibleTasks.length}</strong></div>
                <div><span>최근 메시지</span><strong>{selectedMessages.length}건</strong></div>
                <div><span>이번 주 공부</span><strong>{formatMinuteText(selectedReport?.studySummary.week ?? 0)}</strong></div>
                <div><span>이번 달 공부</span><strong>{formatMinuteText(selectedReport?.studySummary.month ?? 0)}</strong></div>
                <div><span>누적 벌점</span><strong>{selectedPenalty?.points ?? 0}점</strong></div>
              </div>
              <div className="admin-student-task-preview">
                {selectedTodaySchedule.length ? selectedTodaySchedule.map((item) => (
                  <div key={item.id}>
                    <span>{item.start}-{item.end}</span>
                    <strong>{item.title}</strong>
                    <em>{selectedScheduleSource}</em>
                  </div>
                )) : <div><span>오늘 일정</span><strong>연동된 일정 없음</strong><em>{selectedScheduleSource}</em></div>}
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
              <div className="admin-panel-head"><h2>{selectedStudent?.name ?? '학생'} 공부 분석</h2><span>{selectedReport ? `실시간 · ${new Date(selectedReport.updatedAt).toLocaleTimeString('ko-KR')}` : '앱 리포트 대기'}</span></div>
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
              <div className="admin-panel-head"><h2>학생별 과제 실시간</h2><span>{selectedTaskSource}</span></div>
              <div className="admin-task-edit-list">
                {visibleTasks.map((task) => (
                  <div key={task.id}>
                    <span>{task.subject}</span>
                    <input
                      value={task.title}
                      readOnly
                      aria-label={`${task.subject} 과제명`}
                    />
                    <button
                      type="button"
                      onClick={() => void toggleSelectedTask(task)}
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
                <div><span>보유 별</span><strong>{selectedFruits}개</strong></div>
                <div><span>스테이지 기준</span><strong>{formatStudyMinutes(rewardSettings.stageMinutes)}</strong></div>
                <div><span>월 출석</span><strong>{monthAttendance}/{fullMonth}일</strong></div>
                <div><span>구매 이력</span><strong>{selectedRewardPurchases.length}건</strong></div>
              </div>
              <div className="admin-fruit-actions">
                <span>학생 앱 실시간 보유 별</span>
                <Star size={34} />
                <strong>{selectedFruits}개</strong>
              </div>
              <div className="admin-reward-rules">
                <div><span>스테이지 규칙</span><strong>{formatStudyMinutes(rewardSettings.stageMinutes)}마다 이동</strong></div>
                <div><span>도착 보상</span><strong>별 {rewardSettings.stageRewardStars}개</strong></div>
                <div><span>출석 보상</span><strong>{rewardSettings.attendanceTenStars}/{rewardSettings.attendanceTwentyStars}/{rewardSettings.attendanceFullStars}개</strong></div>
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
                      <strong>{selectedClaimedAttendanceRewards.includes(step.threshold) ? `별 ${step.fruits}개 지급 완료` : `${Math.max(0, step.threshold - monthAttendance)}일 남음`}</strong>
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
                {selectedRewardPurchases.slice(0, 3).map((purchase) => <div key={purchase.id}><span>구매</span><strong>{purchase.itemName}</strong></div>)}
                {!selectedRewardPurchases.length ? <div><span>구매</span><strong>교환 내역 없음</strong></div> : null}
              </div>
            </div>
          </div>
        ) : null}
        {tab === 'settings' ? (
          <div className="admin-two-col admin-settings-grid">
            <div className="admin-panel admin-reward-settings">
              <div className="admin-panel-head"><h2>스테이지·별 규칙</h2><span>전체 학생 적용</span></div>
              <div className="admin-setting-grid">
                <label>스테이지 이동 기준(분)<input type="number" min={rewardStageDefaultMinutes} step={rewardStageDefaultMinutes} value={rewardSettings.stageMinutes} readOnly disabled /></label>
                <label>스테이지 도착 별<input type="number" min={1} value={rewardSettings.stageRewardStars} onChange={(event) => updateRewardSetting('stageRewardStars', Number(event.target.value))} /></label>
                <label>10일 출석 별<input type="number" min={0} value={rewardSettings.attendanceTenStars} onChange={(event) => updateRewardSetting('attendanceTenStars', Number(event.target.value))} /></label>
                <label>20일 출석 별<input type="number" min={0} value={rewardSettings.attendanceTwentyStars} onChange={(event) => updateRewardSetting('attendanceTwentyStars', Number(event.target.value))} /></label>
                <label>전체 출석 별<input type="number" min={0} value={rewardSettings.attendanceFullStars} onChange={(event) => updateRewardSetting('attendanceFullStars', Number(event.target.value))} /></label>
              </div>
            </div>
            <div className="admin-panel">
              <div className="admin-panel-head"><h2>벌점 누적 기간</h2><span>학습 리포트 반영</span></div>
              <div className="admin-setting-grid admin-penalty-period-grid">
                <label>시작일<input type="date" value={penaltySettings.from} onChange={(event) => updatePenaltySetting('from', event.target.value)} /></label>
                <label>종료일<input type="date" value={penaltySettings.to} onChange={(event) => updatePenaltySetting('to', event.target.value)} /></label>
              </div>
              <div className="admin-compact-list">
                <div><span>조회 기준</span><strong>{penaltySettings.from || penaltySettings.to ? `${penaltySettings.from || '처음'} ~ ${penaltySettings.to || '오늘'}` : '전체 누적'}</strong></div>
                <div><span>표시 위치</span><strong>학습 리포트 학생별 벌점란</strong></div>
              </div>
            </div>
            <div className="admin-panel">
              <div className="admin-panel-head"><h2>현재 적용값</h2><span>학생 앱 보상 계산</span></div>
              <div className="admin-compact-list">
                <div><span>스테이지 이동</span><strong>{formatStudyMinutes(rewardSettings.stageMinutes)}마다</strong></div>
                <div><span>스테이지 보상</span><strong>별 {rewardSettings.stageRewardStars}개</strong></div>
                <div><span>출석 10일</span><strong>별 {rewardSettings.attendanceTenStars}개</strong></div>
                <div><span>출석 20일</span><strong>별 {rewardSettings.attendanceTwentyStars}개</strong></div>
                <div><span>전체 출석</span><strong>별 {rewardSettings.attendanceFullStars}개</strong></div>
                <div><span>열린 월드맵</span><strong>{openRewardMapCount}/{rewardMapMonths.length}</strong></div>
              </div>
            </div>
            <div className="admin-panel admin-map-settings">
              <div className="admin-panel-head"><h2>월드맵 공개 설정</h2><span>닫힌 맵은 흐림 처리</span></div>
              <div className="admin-map-toggle-list">
                {rewardMapMonths.map((month) => {
                  const open = rewardMapVisibility[month.key] !== false;
                  return (
                    <button className={open ? 'open' : 'closed'} key={month.key} type="button" onClick={() => updateRewardMapVisibility(month.key, !open)}>
                      <div>
                        <span>{month.label}</span>
                        <strong>{month.title}</strong>
                      </div>
                      <em>{open ? '열림' : '닫힘'}</em>
                    </button>
                  );
                })}
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
  timerSkin,
  onClose,
  onPause,
  onStop,
  paused,
}: {
  elapsedSeconds: number;
  subject: Subject;
  timerSkin: TimerSkin;
  onClose: () => void;
  onPause: () => void;
  onStop: () => void;
  paused: boolean;
}) {
  const [displayHours, displayMinutes, displaySeconds] = formatClock(elapsedSeconds).split(':');
  const timerProgress = `${((elapsedSeconds % 3600) / 3600) * 360}deg`;
  const timerProgressFill = `${((elapsedSeconds % 3600) / 3600) * 100}%`;
  return (
    <div className="modal-layer timer-modal-layer">
      <section className={`timer-fullscreen timer-fullscreen-${timerSkin}`} style={{ '--timer-progress': timerProgress, '--timer-progress-fill': timerProgressFill } as React.CSSProperties}>
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
              <strong>{nextReward ? `${nextReward.threshold - count}일 더 출석하면 별 ${nextReward.fruits}개` : '이번 달 출석 보상 완료'}</strong>
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
                  <strong>별 {step.fruits}개</strong>
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

const KIM_DOYUN_DEMO_DATE = '2026-07-20';
const KIM_DOYUN_DEMO_SUBJECTS: Subject[] = ['국어', '수학', '영어', '사문', '생윤', '동아시아사'];
const LEE_HYUNMIN_TEST_DATE = '2026-07-23';
const LEE_HYUNMIN_PORTAL_SUBJECTS: Subject[] = ['국어', '수학', '영어', '사회문화', '생활과 윤리'];

function seedKimDoyunStudyTime(current: AppData) {
  if (!['qtf258', 'qlf258'].includes(current.studentId.trim().toLowerCase())) return current;
  const demoSubjects = current.subjectNames.length === 6 ? current.subjectNames : KIM_DOYUN_DEMO_SUBJECTS;
  const existingIds = new Set(current.studyBlocks.map((block) => block.id));
  const demoBlocks: StudyBlock[] = demoSubjects.map((subject, index) => ({
    id: `kim-doyun-demo-${KIM_DOYUN_DEMO_DATE}-${index + 1}`,
    date: KIM_DOYUN_DEMO_DATE,
    startMinute: 8 * 60 + index * 60,
    durationMinutes: 60,
    durationSeconds: 60 * 60,
    subject,
    taskTitle: '연동 확인용 임시 공부 기록',
  }));
  const missingBlocks = demoBlocks.filter((block) => !existingIds.has(block.id));
  if (!missingBlocks.length && current.studentName === '김도윤') return current;
  return {
    ...current,
    studentName: '김도윤',
    studyBlocks: [...current.studyBlocks, ...missingBlocks],
  };
}

function seedLeeHyunminStudyTime(current: AppData) {
  if (current.studentId.trim().toLowerCase() !== 'yhp553') return current;
  const existingIds = new Set(current.studyBlocks.map((block) => block.id));
  const testBlocks: StudyBlock[] = LEE_HYUNMIN_PORTAL_SUBJECTS.map((subject, index) => ({
    id: `lee-hyunmin-test-${LEE_HYUNMIN_TEST_DATE}-${index + 1}`,
    date: LEE_HYUNMIN_TEST_DATE,
    startMinute: 8 * 60 + index * 90,
    durationMinutes: 80,
    durationSeconds: 80 * 60,
    subject,
    taskTitle: '과목별 연동 확인용 공부 기록',
  }));
  const missingBlocks = testBlocks.filter((block) => !existingIds.has(block.id));
  return {
    ...current,
    studentName: '이현민',
    subjectNames: LEE_HYUNMIN_PORTAL_SUBJECTS,
    studyBlocks: [...current.studyBlocks, ...missingBlocks],
  };
}

export default function App() {
  const desktopScale = useDesktopFrameScale();
  const [role, setRole] = useState<Role | null>(getInitialRole);
  const [page, setPage] = useState<PageKey>('home');
  const [data, setData] = useState<AppData>(getStoredData);
  const [schedule, setSchedule] = useState<ScheduleItem[]>(demoSchedule);
  const [scheduleSource, setScheduleSource] = useState('데모 일정');
  const [taskSource, setTaskSource] = useState('데모 멘토링');
  const subjects = normalizeStoredSubjects(data.subjectNames);
  const [selectedSubject, setSelectedSubject] = useState<Subject>(subjects[1] ?? '수학');
  const [timerTab, setTimerTab] = useState<TimerTab>('main');
  const [runningSession, setRunningSession] = useState<RunningSession | null>(null);
  const [nowMs, setNowMs] = useState(Date.now());
  const [weekOpen, setWeekOpen] = useState(false);
  const [timerOpen, setTimerOpen] = useState(false);
  const [mockTimerOpen, setMockTimerOpen] = useState(false);
  const [mockPageFullscreen, setMockPageFullscreen] = useState(false);
  const [attendanceOpen, setAttendanceOpen] = useState(false);
  const [animatedAttendanceDate, setAnimatedAttendanceDate] = useState<string | null>(null);
  const [taskEditor, setTaskEditor] = useState<{ task: Task | null; subject: Subject } | null>(null);
  const [blockEditor, setBlockEditor] = useState<StudyBlock | null>(null);
  const [medischeduleStudents, setMedischeduleStudents] = useState<StudentStatus[]>([]);
  const [liveStudents, setLiveStudents] = useState<LiveStudentStatus[]>([]);
  const [familyReports, setFamilyReports] = useState<FamilySyncReport[]>([]);
  const [realtimeServerTime, setRealtimeServerTime] = useState('');
  const [penaltySummaries, setPenaltySummaries] = useState<PenaltySummary[]>([]);
  const [mentoringWeeks, setMentoringWeeks] = useState<MentoringWeekOption[]>([]);
  const [selectedMentoringWeekId, setSelectedMentoringWeekId] = useState('');
  const [mentoringCurriculum, setMentoringCurriculum] = useState<MentoringCurriculumItem[]>([]);
  const [mentoringError, setMentoringError] = useState('');
  const totalElapsedSeconds = sessionSeconds(runningSession, nowMs);
  const subjectElapsedSeconds = subjectSessionSeconds(runningSession, nowMs);
  const fullscreenSubject = timerTab === 'main' ? selectedSubject : timerTab;
  const fullscreenSubjectTotals = subjectSeconds(todayBlocks(data.studyBlocks), subjects);
  const fullscreenElapsedSeconds =
    (fullscreenSubjectTotals[fullscreenSubject] ?? 0)
    + (runningSession?.subject === fullscreenSubject ? subjectElapsedSeconds : 0);
  const actualTodayMinutes = Math.floor((totalSecondsFromBlocks(todayBlocks(data.studyBlocks)) + (runningSession ? subjectElapsedSeconds : 0)) / 60);
  const studentMessages = useMemo(
    () => data.adminMessages.filter((message) => message.recipientId === data.studentId || message.recipientId === 'all').sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [data.adminMessages, data.studentId],
  );
  const unreadMessage = role === 'user'
    ? studentMessages.find((message) => !data.dismissedMessageIds.includes(message.id) && !(message.dismissedBy ?? []).includes(data.studentId))
    : undefined;
  const currentPenalty = useMemo(() => {
    const studentId = data.studentId.trim();
    const studentName = data.studentName.trim();
    return penaltySummaries.find((row) => row.id === studentId)
      ?? penaltySummaries.find((row) => row.name.trim() === studentName);
  }, [data.studentId, data.studentName, penaltySummaries]);
  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        setMockPageFullscreen(false);
      }
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, [data]);

  useEffect(() => {
    if (role !== 'user') return;
    setData((prev) => seedLeeHyunminStudyTime(seedKimDoyunStudyTime(prev)));
  }, [role, data.studentId]);

  useEffect(() => {
    setData((prev) => applyStageRewards({ ...prev, points: 0 }));
  }, []);

  useEffect(() => {
    if (role) localStorage.setItem(ROLE_KEY, role);
  }, [role]);

  useEffect(() => {
    if (!role) return;
    let cancelled = false;
    const applySnapshot = (snapshot: RealtimeSnapshot) => {
      if (cancelled) return;
      setLiveStudents(snapshot.students);
      setFamilyReports(snapshot.familyReports ?? []);
      setRealtimeServerTime(snapshot.serverTime);
      setData((prev) => applyRealtimeData(prev, snapshot));
    };

    void loadRealtimeSnapshot(role, data.studentId).then(applySnapshot);
    const unsubscribe = subscribeRealtimeSnapshot(role, data.studentId, applySnapshot);
    const id = window.setInterval(() => {
      void loadRealtimeSnapshot(role, data.studentId).then(applySnapshot);
    }, 10000);

    return () => {
      cancelled = true;
      unsubscribe();
      window.clearInterval(id);
    };
  }, [role, data.studentId]);

  useEffect(() => {
    if (!role) return;
    let cancelled = false;
    async function refreshStudents() {
      const students = await loadMedischeduleStudents();
      if (!cancelled && students.length) setMedischeduleStudents(students);
    }
    void refreshStudents();
    const id = window.setInterval(refreshStudents, 15000);
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
        loadMentoringTasks(data.studentId, selectedMentoringWeekId),
      ]);
      if (cancelled) return;
      setSchedule(scheduleResult.items);
      setScheduleSource(scheduleResult.source);
      setTaskSource(taskResult.source);
      const portalSubjects = taskResult.subjects;
      const mappedTasks = taskResult.tasks;
      const mappedCurriculum = taskResult.curriculum;
      setMentoringWeeks(taskResult.weeks);
      setSelectedMentoringWeekId(taskResult.selectedWeekId);
      setMentoringCurriculum(mappedCurriculum);
      setMentoringError(taskResult.error ?? '');
      setData((prev) => {
        const hiddenTaskIds = new Set(prev.hiddenTaskIds);
        const visibleTasks = mappedTasks.filter((task) => !hiddenTaskIds.has(task.id));
        const nextSubjects = portalSubjects.length
          ? portalSubjects
          : visibleTasks.reduce<Subject[]>((result, task) => (result.includes(task.subject) ? result : [...result, task.subject]), []);
        const shouldApplyMentoringResult = taskResult.source.startsWith('medimentors.kr');
        if (!shouldApplyMentoringResult && !visibleTasks.length && !nextSubjects.length) return prev;
        const storedSubjects = normalizeStoredSubjects(prev.subjectNames);
        return {
          ...prev,
          subjectNames: nextSubjects.length ? nextSubjects : prev.subjectNames,
          tasks: shouldApplyMentoringResult ? visibleTasks : visibleTasks.length ? visibleTasks : prev.tasks,
          studyBlocks: shouldApplyMentoringResult && nextSubjects.length
            ? prev.studyBlocks.map((block) => ({
              ...block,
              subject: mapSubjectToPortal(block.subject, storedSubjects, nextSubjects),
            }))
            : prev.studyBlocks,
        };
      });
    }
    void refreshLinkedData();
    const id = window.setInterval(refreshLinkedData, 30000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [role, data.studentId, selectedMentoringWeekId]);

  useEffect(() => {
    if (!role) return;
    let cancelled = false;
    async function refreshPenaltySummary() {
      const result = await loadPenaltySummary(data.penaltySettings);
      if (cancelled) return;
      setPenaltySummaries(result.items);
    }
    void refreshPenaltySummary();
    const id = window.setInterval(refreshPenaltySummary, 15000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [role, data.penaltySettings]);

  useEffect(() => {
    if (role !== 'user') return;
    const publish = () => {
      void publishStudentStatus({
        id: data.studentId,
        name: data.studentName,
        status: runningSession ? (runningSession.paused ? 'break' : 'studying') : 'offline',
        todayMinutes: actualTodayMinutes,
        subject: runningSession?.subject ?? selectedSubject,
        running: Boolean(runningSession),
      });
      void publishFamilySync(buildFamilySyncReport({
        data,
        subjects,
        schedule,
        runningSession,
        subjectElapsedSeconds,
        actualTodayMinutes,
        selectedSubject,
        penalty: currentPenalty,
      }));
    };
    publish();
    const id = window.setInterval(publish, 10000);
    return () => window.clearInterval(id);
  }, [actualTodayMinutes, currentPenalty, data, role, runningSession, schedule, selectedSubject, subjectElapsedSeconds, subjects]);

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

  async function handleLogin(nextRole: Role, name: string, id: string, password: string): Promise<LoginResult> {
    let loginName = name;
    let loginId = id;
    if (nextRole === 'user') {
      const result = await verifyMedimentorsStudentLogin(id, password);
      if (!result.ok || !result.student) {
        return { ok: false, error: result.error || 'medimentors 학생 계정 확인에 실패했습니다.' };
      }
      loginName = result.student.name || name;
      loginId = result.student.username || result.student.id || id;
    }

    setRole(nextRole);
    setData((prev) => ({ ...prev, studentName: loginName, studentId: loginId }));
    if (nextRole === 'user' && shouldShowAttendancePopup()) {
      setAnimatedAttendanceDate(todayKey());
      setAttendanceOpen(true);
    }
    return { ok: true };
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
    exitPageFullscreen();
  }

  function requestLogout() {
    logout();
  }

  function openTimerFullscreen() {
    requestPageFullscreen();
    setTimerOpen(true);
  }

  function closeTimerFullscreen() {
    setTimerOpen(false);
    exitPageFullscreen();
  }

  function openMockTimer() {
    setMockTimerOpen(true);
    setMockPageFullscreen(false);
  }

  function closeMockTimer() {
    setMockTimerOpen(false);
    setMockPageFullscreen(false);
    exitPageFullscreen();
  }

  function handleMockFullscreenChange(fullscreen: boolean) {
    setMockPageFullscreen(fullscreen);
    if (fullscreen) requestPageFullscreen();
    else exitPageFullscreen();
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
    setData((current) => {
      const segmented = commitSegmentToData(current, prev, currentSubjectSeconds, completeTask);
      return applyStageRewards({ ...segmented, points: 0 });
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

  function deleteTask(task: Task) {
    if (runningSession?.taskId === task.id) {
      stopSession(false);
    }
    setData((prev) => ({
      ...prev,
      hiddenTaskIds: prev.hiddenTaskIds.includes(task.id) ? prev.hiddenTaskIds : [...prev.hiddenTaskIds, task.id],
      tasks: prev.tasks.filter((item) => item.id !== task.id),
    }));
  }

  function setTimerSkin(timerSkin: TimerSkin) {
    setData((prev) => ({ ...prev, timerSkin }));
  }

  function setAppTheme(appTheme: AppTheme) {
    setData((prev) => ({ ...prev, appTheme }));
  }

  function saveTask(task: Task) {
    setData((prev) => {
      const exists = prev.tasks.some((item) => item.id === task.id);
      const nextSubjects = prev.subjectNames.includes(task.subject) ? prev.subjectNames : [...prev.subjectNames, task.subject];
      return {
        ...prev,
        subjectNames: nextSubjects,
        hiddenTaskIds: prev.hiddenTaskIds.filter((id) => id !== task.id),
        tasks: exists ? prev.tasks.map((item) => (item.id === task.id ? task : item)) : [task, ...prev.tasks],
      };
    });
    setTaskEditor(null);
  }

  function saveBlock(block: StudyBlock) {
    setData((prev) => applyStageRewards({ ...prev, studyBlocks: prev.studyBlocks.map((item) => (item.id === block.id ? block : item)), points: 0 }));
    setBlockEditor(null);
  }

  function renameSubject(index: number, name: string) {
    const nextName = name.trim();
    if (!nextName) return;
    localStorage.setItem(SUBJECT_NAMES_CUSTOMIZED_KEY, 'true');
    const oldName = subjects[index];
    setData((prev) => {
      const storedOldName = prev.subjectNames[index];
      if (!storedOldName || storedOldName === nextName) return prev;
      const subjectNames = prev.subjectNames.map((subject, subjectIndex) => (subjectIndex === index ? nextName : subject));
      return {
        ...prev,
        subjectNames,
        tasks: prev.tasks.map((task) => (task.subject === storedOldName ? { ...task, subject: nextName } : task)),
        studyBlocks: prev.studyBlocks.map((block) => (block.subject === storedOldName ? { ...block, subject: nextName } : block)),
      };
    });
    setMentoringCurriculum((prev) => prev.map((item) => (item.subject === oldName ? { ...item, subject: nextName } : item)));
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
    setData((prev) => ({ ...prev, adminMessages: mergeAdminMessages(prev.adminMessages, [message]) }));
    void sendRealtimeAdminMessage(student, body).then((savedMessage) => {
      if (!savedMessage) return;
      setData((prev) => ({
        ...prev,
        adminMessages: mergeAdminMessages(prev.adminMessages.filter((item) => item.id !== message.id), [savedMessage]),
      }));
    });
  }

  function saveRewardSettings(rewardSettings: RewardSettings) {
    const normalized = normalizeRewardSettings(rewardSettings);
    setData((prev) => ({ ...prev, rewardSettings: normalized }));
    void saveRealtimeSettings({ rewardSettings: normalized });
  }

  function saveRewardMapVisibility(rewardMapVisibility: Record<string, boolean>) {
    const normalized = normalizeRewardMapVisibility(rewardMapVisibility);
    setData((prev) => ({ ...prev, rewardMapVisibility: normalized }));
    void saveRealtimeSettings({ rewardMapVisibility: normalized });
  }

  function savePenaltySettings(penaltySettings: PenaltySettings) {
    const normalized = normalizePenaltySettings(penaltySettings);
    setData((prev) => ({ ...prev, penaltySettings: normalized }));
    void saveRealtimeSettings({ penaltySettings: normalized });
  }

  function dismissAdminMessage(messageId: string) {
    setData((prev) => (
      prev.dismissedMessageIds.includes(messageId)
        ? prev
        : { ...prev, dismissedMessageIds: [...prev.dismissedMessageIds, messageId] }
    ));
    void dismissRealtimeAdminMessage(messageId, data.studentId);
  }

  const students = useMemo(
    () => {
      const liveById = new Map(liveStudents.map((student) => [student.id, student]));
      const roster = medischeduleStudents.length ? medischeduleStudents : liveStudents.length ? liveStudents : demoStudents;
      const rows: StudentStatus[] = roster.map((student, index): StudentStatus => {
        const fallback = demoStudents[index % demoStudents.length] ?? demoStudents[0];
        const live = liveById.get(student.id);
        const merged: StudentStatus = {
          id: live?.id || student.id || fallback.id,
          name: live?.name || student.name || fallback.name,
          studentPhone: live?.studentPhone || student.studentPhone || fallback.studentPhone,
          parentPhone: live?.parentPhone || student.parentPhone || fallback.parentPhone,
          status: live?.status ?? student.status ?? fallback.status,
          todayMinutes: live?.todayMinutes ?? student.todayMinutes ?? fallback.todayMinutes,
          subject: live?.subject || student.subject || fallback.subject,
        };
        const isLiveUser = role === 'user' && (student.id === data.studentId || (!medischeduleStudents.length && !liveStudents.length && index === 0));
        return isLiveUser
          ? {
              ...merged,
              id: data.studentId,
              name: data.studentName,
              status: runningSession ? (runningSession.paused ? 'break' : 'studying') : 'offline',
              todayMinutes: actualTodayMinutes,
              subject: runningSession?.subject ?? selectedSubject,
            }
          : merged;
      });
      const rowIds = new Set(rows.map((student) => student.id));
      liveStudents.forEach((student) => {
        if (!rowIds.has(student.id)) rows.push(student);
      });
      return rows;
    },
    [actualTodayMinutes, data.studentId, data.studentName, liveStudents, medischeduleStudents, role, runningSession, selectedSubject],
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
        familyReports={familyReports}
        penaltySummaries={penaltySummaries}
        realtimeServerTime={realtimeServerTime}
        onSendMessage={sendAdminMessage}
        onRewardSettingsChange={saveRewardSettings}
        onRewardMapVisibilityChange={saveRewardMapVisibility}
        onPenaltySettingsChange={savePenaltySettings}
      />
    );
  } else if (page === 'home') {
    content = (
      <ModernHomePage
        data={data}
        subjects={subjects}
        schedule={schedule}
        selectedSubject={selectedSubject}
        selectedTab={timerTab}
        timerSkin={data.timerSkin}
        appTheme={data.appTheme}
        runningSession={runningSession}
        totalElapsedSeconds={totalElapsedSeconds}
        subjectElapsedSeconds={subjectElapsedSeconds}
        onStart={() => startSession(timerTab === 'main' ? selectedSubject : timerTab)}
        onPause={pauseSession}
        onStop={() => stopSession(false)}
        onMainSelect={() => setTimerTab('main')}
        onSubjectSelect={selectSubject}
        onRenameSubject={renameSubject}
        onTimerSkinChange={setTimerSkin}
        onAppThemeChange={setAppTheme}
        onTimerFullscreen={openTimerFullscreen}
        onMockTimerOpen={openMockTimer}
        onWeekOpen={() => setWeekOpen(true)}
      />
    );
  } else if (page === 'tasks') {
    content = (
      <ModernTasksPage
        subjects={subjects}
        tasks={data.tasks}
        mentoringWeeks={mentoringWeeks}
        selectedMentoringWeekId={selectedMentoringWeekId}
        mentoringCurriculum={mentoringCurriculum}
        mentoringError={mentoringError}
        onMentoringWeekChange={setSelectedMentoringWeekId}
        onRenameSubject={renameSubject}
        onCompleteTask={completeTask}
        onStopTask={stopTask}
        onDeleteTask={deleteTask}
        onEditTask={(task) => setTaskEditor({ task, subject: task.subject })}
        onNewTask={(subject) => setTaskEditor({ task: null, subject })}
      />
    );
  } else if (page === 'analysis') {
    content = (
      <ModernAnalysisPage
        subjects={subjects}
        blocks={data.studyBlocks}
        tasks={data.tasks}
        penaltyPoints={currentPenalty?.points ?? 0}
        onEditBlock={setBlockEditor}
      />
    );
  } else if (page === 'garden') {
    content = <ModernGardenPage data={data} onBuyReward={buyReward} onOpenAttendance={openAttendanceModal} />;
  } else {
    content = <ModernCenterPage students={students} subjects={subjects} />;
  }

  return (
    <div className={`app-viewport app-theme-${data.appTheme} ${role === 'user' ? 'student-viewport' : ''}`}>
      <div
        className="desktop-scale-stage"
        style={{
          width: DESKTOP_FRAME_WIDTH * desktopScale,
          height: DESKTOP_FRAME_HEIGHT * desktopScale,
        }}
      >
      <div
        className={`tablet-frame ${role ? 'with-rail' : 'login-only'} ${role === 'user' ? 'student-mode' : ''} ${timerOpen || mockPageFullscreen ? 'fullscreen-active' : ''}`}
        style={{ transform: `scale(${desktopScale})` }}
      >
        {role ? (
          role === 'user'
            ? <ModernSideRail page={page} setPage={setPage} studentName={data.studentName} onLogout={requestLogout} />
            : <SideRail role={role} page={page} setPage={setPage} studentName={data.studentName} onLogout={requestLogout} />
        ) : null}
        <main className={role ? 'app-main' : 'login-main'}>{content}</main>
        {weekOpen ? <ModernWeekScheduleModal schedule={schedule} source={scheduleSource} onClose={() => setWeekOpen(false)} /> : null}
        {mockTimerOpen ? <ModernMockExamTimerModal timerSkin={data.timerSkin} onClose={closeMockTimer} onFullscreenChange={handleMockFullscreenChange} /> : null}
        {timerOpen ? (
          <ModernTimerFullscreenModal
            elapsedSeconds={fullscreenElapsedSeconds}
            subject={fullscreenSubject}
            timerSkin={data.timerSkin}
            paused={runningSession?.paused ?? false}
            canControl={Boolean(runningSession)}
            onPause={pauseSession}
            onStop={() => {
              stopSession(false);
              exitPageFullscreen();
            }}
            onClose={closeTimerFullscreen}
          />
        ) : null}
        {attendanceOpen ? <ModernAttendanceModal data={data} animatedDate={animatedAttendanceDate} onClose={closeAttendanceModal} onHideToday={hideAttendanceToday} /> : null}
        {unreadMessage ? <ModernAdminMessageModal message={unreadMessage} onClose={() => dismissAdminMessage(unreadMessage.id)} /> : null}
        {taskEditor ? <ModernTaskEditor task={taskEditor.task} subjects={subjects} initialSubject={taskEditor.subject} onSave={saveTask} onClose={() => setTaskEditor(null)} /> : null}
        {blockEditor ? <ModernBlockEditor block={blockEditor} subjects={subjects} onSave={saveBlock} onClose={() => setBlockEditor(null)} /> : null}
      </div>
      </div>
    </div>
  );
}
