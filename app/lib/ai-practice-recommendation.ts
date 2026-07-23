import { FOCUS_TAGS } from "./models";

export type AIRecommendationTaskInput = {
  id: string;
  title: string;
  keyPoints: string;
  focusTags: string[];
  isHighPriority: boolean;
  durationMinutes: number;
  status: string;
  createdAt: string;
  classReviewId: string | null;
  lastPracticedAt: string | null;
  practiceLogCount14d: number;
  totalPracticeMinutes14d: number;
  daysSinceLastPractice: number | null;
};

export type AIRecommendationLogInput = {
  taskId: string;
  date: string;
  durationMinutes: number;
  practiceContent: string;
  progressScore: number;
  nextFocus: string;
};

export type AIRecommendationClassInput = {
  id: string;
  date: string;
  danceStyle: string;
  classTheme: string;
  whatILearned: string;
  notDigested: string;
};

export type AIRecommendationFocusInput = {
  name: string;
  sessions: number;
  minutes: number;
};

export type AIPracticeRecommendationInput = {
  generatedAt: string;
  activeTasks: AIRecommendationTaskInput[];
  recentPracticeLogs: AIRecommendationLogInput[];
  recentClasses: AIRecommendationClassInput[];
  focusStats14d: AIRecommendationFocusInput[];
};

export type AIPracticeRecommendation = {
  recommendations: {
    taskId: string;
    reason: string;
    priority: 1 | 2 | 3;
  }[];
  sessionNote: string;
};

const FOCUS_SET = new Set<string>(FOCUS_TAGS);
const STATUS_SET = new Set(["active", "practicing", "paused"]);

const MAX_TEXT = {
  taskTitle: 100,
  taskKeyPoints: 260,
  practiceContent: 260,
  nextFocus: 180,
  danceStyle: 80,
  classTheme: 120,
  note: 360,
  reason: 140,
  sessionNote: 180,
};

function cleanText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, maxLength) : "";
}

function cleanDate(value: unknown) {
  const text = cleanText(value, 40);
  return /^\d{4}-\d{2}-\d{2}/.test(text) ? text : "";
}

function cleanMinutes(value: unknown, max = 3000) {
  const minutes = Number(value);
  if (!Number.isFinite(minutes)) return 0;
  return Math.min(max, Math.max(0, Math.round(minutes)));
}

function cleanFocusTags(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.filter(tag => typeof tag === "string" && (FOCUS_SET.has(tag) || tag.length <= 24)).slice(0, 6);
}

function cleanPriority(value: unknown): 1 | 2 | 3 {
  const priority = Number(value);
  if (priority === 1 || priority === 2 || priority === 3) return priority;
  return 3;
}

export function sanitizePracticeRecommendationRequestBody(value: unknown): { data?: AIPracticeRecommendationInput; allowedTaskIds?: string[]; error?: string } {
  const body = value as Partial<AIPracticeRecommendationInput> | null;
  if (!body || typeof body !== "object") return { error: "请求内容无效。" };

  const activeTasks = Array.isArray(body.activeTasks) ? body.activeTasks.slice(0, 20).map(item => {
    const source = item as Partial<AIRecommendationTaskInput>;
    const status = String(source.status);
    const days = Number(source.daysSinceLastPractice);
    return {
      id: cleanText(source.id, 80),
      title: cleanText(source.title, MAX_TEXT.taskTitle),
      keyPoints: cleanText(source.keyPoints, MAX_TEXT.taskKeyPoints),
      focusTags: cleanFocusTags(source.focusTags),
      isHighPriority: source.isHighPriority === true,
      durationMinutes: cleanMinutes(source.durationMinutes, 999),
      status: STATUS_SET.has(status) ? status : "active",
      createdAt: cleanDate(source.createdAt),
      classReviewId: source.classReviewId === null ? null : cleanText(source.classReviewId, 80) || null,
      lastPracticedAt: source.lastPracticedAt === null ? null : cleanDate(source.lastPracticedAt) || null,
      practiceLogCount14d: cleanMinutes(source.practiceLogCount14d, 999),
      totalPracticeMinutes14d: cleanMinutes(source.totalPracticeMinutes14d),
      daysSinceLastPractice: source.daysSinceLastPractice === null || !Number.isFinite(days) ? null : Math.max(0, Math.round(days)),
    };
  }).filter(item => item.id && item.title) : [];

  const allowedTaskIds = activeTasks.map(task => task.id);
  if (activeTasks.length < 2) return { error: "待练任务太少，不需要调用 AI 推荐。" };

  const recentPracticeLogs = Array.isArray(body.recentPracticeLogs) ? body.recentPracticeLogs.slice(0, 30).map(item => {
    const source = item as Partial<AIRecommendationLogInput>;
    const score = Number(source.progressScore);
    return {
      taskId: cleanText(source.taskId, 80),
      date: cleanDate(source.date),
      durationMinutes: cleanMinutes(source.durationMinutes, 999),
      practiceContent: cleanText(source.practiceContent, MAX_TEXT.practiceContent),
      progressScore: Number.isFinite(score) ? Math.min(5, Math.max(1, Math.round(score))) : 3,
      nextFocus: cleanText(source.nextFocus, MAX_TEXT.nextFocus),
    };
  }).filter(item => item.taskId && item.date && allowedTaskIds.includes(item.taskId)) : [];

  const recentClasses = Array.isArray(body.recentClasses) ? body.recentClasses.slice(0, 8).map(item => {
    const source = item as Partial<AIRecommendationClassInput>;
    return {
      id: cleanText(source.id, 80),
      date: cleanDate(source.date),
      danceStyle: cleanText(source.danceStyle, MAX_TEXT.danceStyle),
      classTheme: cleanText(source.classTheme, MAX_TEXT.classTheme),
      whatILearned: cleanText(source.whatILearned, MAX_TEXT.note),
      notDigested: cleanText(source.notDigested, MAX_TEXT.note),
    };
  }).filter(item => item.id && item.date) : [];

  const focusStats14d = Array.isArray(body.focusStats14d) ? body.focusStats14d.slice(0, 10).map(item => {
    const source = item as Partial<AIRecommendationFocusInput>;
    return {
      name: cleanText(source.name, 32),
      sessions: cleanMinutes(source.sessions, 999),
      minutes: cleanMinutes(source.minutes),
    };
  }).filter(item => item.name) : [];

  return {
    data: {
      generatedAt: cleanDate(body.generatedAt) || new Date().toISOString(),
      activeTasks,
      recentPracticeLogs,
      recentClasses,
      focusStats14d,
    },
    allowedTaskIds,
  };
}

export function normalizePracticeRecommendation(value: unknown, allowedTaskIds: string[]): AIPracticeRecommendation | null {
  const source = value as Partial<AIPracticeRecommendation> | null;
  if (!source || typeof source !== "object") return null;
  const allowed = new Set(allowedTaskIds);
  const seen = new Set<string>();
  const recommendations = Array.isArray(source.recommendations) ? source.recommendations.map(item => {
    const recommendation = item as Partial<AIPracticeRecommendation["recommendations"][number]>;
    return {
      taskId: cleanText(recommendation.taskId, 80),
      reason: cleanText(recommendation.reason, MAX_TEXT.reason),
      priority: cleanPriority(recommendation.priority),
    };
  }).filter(item => {
    if (!allowed.has(item.taskId) || !item.reason || seen.has(item.taskId)) return false;
    seen.add(item.taskId);
    return true;
  }).sort((a, b) => a.priority - b.priority).slice(0, 3) : [];

  if (!recommendations.length) return null;
  return {
    recommendations,
    sessionNote: cleanText(source.sessionNote, MAX_TEXT.sessionNote),
  };
}
