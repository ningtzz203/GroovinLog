import { FOCUS_TAGS } from "./models";

export type AIWeeklyClassInput = {
  id: string;
  date: string;
  danceStyle: string;
  classTheme: string;
  whatILearned: string;
  notDigested: string;
};

export type AIWeeklyTaskInput = {
  id: string;
  classReviewId: string | null;
  title: string;
  keyPoints: string;
  focusTags: string[];
  isHighPriority: boolean;
  durationMinutes: number;
  status: string;
  createdAt: string;
  hasPracticeLog: boolean;
  practiceLogCount: number;
  totalPracticeMinutes: number;
};

export type AIWeeklyLogInput = {
  id: string;
  taskId: string;
  classId: string | null;
  date: string;
  durationMinutes: number;
  practiceContent: string;
  progressScore: number;
  nextFocus: string;
};

export type AIWeeklyFocusInput = {
  name: string;
  minutes: number;
  sessions: number;
  percentage: number;
};

export type AIWeeklyInsightInput = {
  week: {
    start: string;
    end: string;
    label: string;
  };
  stats: {
    classCount: number;
    practiceLogCount: number;
    practiceMinutes: number;
    taskCount: number;
    digestedTaskCount: number;
    unpracticedTaskCount: number;
    sparseData: boolean;
  };
  focusDistribution: AIWeeklyFocusInput[];
  classes: AIWeeklyClassInput[];
  tasks: AIWeeklyTaskInput[];
  practiceLogs: AIWeeklyLogInput[];
};

export type AIWeeklyInsight = {
  summary: string;
  patterns: string[];
  gaps: string[];
  nextWeekSuggestions: string[];
};

const FOCUS_SET = new Set<string>(FOCUS_TAGS);
const STATUS_SET = new Set(["active", "practicing", "done", "digested", "completed", "paused"]);

const MAX_TEXT = {
  weekLabel: 40,
  danceStyle: 80,
  classTheme: 120,
  note: 500,
  taskTitle: 100,
  taskKeyPoints: 300,
  practiceContent: 400,
  nextFocus: 240,
  insightSummary: 220,
  insightItem: 140,
};

function cleanText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, maxLength) : "";
}

function cleanDate(value: unknown) {
  const text = cleanText(value, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : "";
}

function cleanMinutes(value: unknown, max = 2000) {
  const minutes = Number(value);
  if (!Number.isFinite(minutes)) return 0;
  return Math.min(max, Math.max(0, Math.round(minutes)));
}

function cleanBoolean(value: unknown) {
  return value === true;
}

function cleanFocusTags(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.filter(tag => typeof tag === "string" && (FOCUS_SET.has(tag) || tag.length <= 24)).slice(0, 6);
}

function cleanInsightList(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map(item => cleanText(item, MAX_TEXT.insightItem)).filter(Boolean).slice(0, 3);
}

export function sanitizeWeeklyInsightRequestBody(value: unknown): { data?: AIWeeklyInsightInput; error?: string } {
  const body = value as Partial<AIWeeklyInsightInput> | null;
  if (!body || typeof body !== "object") return { error: "请求内容无效。" };

  const classes = Array.isArray(body.classes) ? body.classes.slice(0, 10).map(item => {
    const source = item as Partial<AIWeeklyClassInput>;
    return {
      id: cleanText(source.id, 80),
      date: cleanDate(source.date),
      danceStyle: cleanText(source.danceStyle, MAX_TEXT.danceStyle),
      classTheme: cleanText(source.classTheme, MAX_TEXT.classTheme),
      whatILearned: cleanText(source.whatILearned, MAX_TEXT.note),
      notDigested: cleanText(source.notDigested, MAX_TEXT.note),
    };
  }).filter(item => item.id && item.date) : [];

  const tasks = Array.isArray(body.tasks) ? body.tasks.slice(0, 20).map(item => {
    const source = item as Partial<AIWeeklyTaskInput>;
    return {
      id: cleanText(source.id, 80),
      classReviewId: source.classReviewId === null ? null : cleanText(source.classReviewId, 80) || null,
      title: cleanText(source.title, MAX_TEXT.taskTitle),
      keyPoints: cleanText(source.keyPoints, MAX_TEXT.taskKeyPoints),
      focusTags: cleanFocusTags(source.focusTags),
      isHighPriority: cleanBoolean(source.isHighPriority),
      durationMinutes: cleanMinutes(source.durationMinutes, 999),
      status: STATUS_SET.has(String(source.status)) ? String(source.status) : "active",
      createdAt: cleanText(source.createdAt, 40),
      hasPracticeLog: cleanBoolean(source.hasPracticeLog),
      practiceLogCount: cleanMinutes(source.practiceLogCount, 999),
      totalPracticeMinutes: cleanMinutes(source.totalPracticeMinutes),
    };
  }).filter(item => item.id && item.title) : [];

  const practiceLogs = Array.isArray(body.practiceLogs) ? body.practiceLogs.slice(0, 30).map(item => {
    const source = item as Partial<AIWeeklyLogInput>;
    const score = Number(source.progressScore);
    return {
      id: cleanText(source.id, 80),
      taskId: cleanText(source.taskId, 80),
      classId: source.classId === null ? null : cleanText(source.classId, 80) || null,
      date: cleanDate(source.date),
      durationMinutes: cleanMinutes(source.durationMinutes, 999),
      practiceContent: cleanText(source.practiceContent, MAX_TEXT.practiceContent),
      progressScore: Number.isFinite(score) ? Math.min(5, Math.max(1, Math.round(score))) : 3,
      nextFocus: cleanText(source.nextFocus, MAX_TEXT.nextFocus),
    };
  }).filter(item => item.id && item.taskId && item.date) : [];

  const focusDistribution = Array.isArray(body.focusDistribution) ? body.focusDistribution.slice(0, 8).map(item => {
    const source = item as Partial<AIWeeklyFocusInput>;
    return {
      name: cleanText(source.name, 32),
      minutes: cleanMinutes(source.minutes),
      sessions: cleanMinutes(source.sessions, 999),
      percentage: Math.min(100, Math.max(0, cleanMinutes(source.percentage, 100))),
    };
  }).filter(item => item.name) : [];

  const statsSource = body.stats as Partial<AIWeeklyInsightInput["stats"]> | undefined;
  const stats = {
    classCount: cleanMinutes(statsSource?.classCount, 100),
    practiceLogCount: cleanMinutes(statsSource?.practiceLogCount, 300),
    practiceMinutes: cleanMinutes(statsSource?.practiceMinutes),
    taskCount: cleanMinutes(statsSource?.taskCount, 300),
    digestedTaskCount: cleanMinutes(statsSource?.digestedTaskCount, 300),
    unpracticedTaskCount: cleanMinutes(statsSource?.unpracticedTaskCount, 300),
    sparseData: cleanBoolean(statsSource?.sparseData),
  };

  const weekSource = body.week as Partial<AIWeeklyInsightInput["week"]> | undefined;
  const data: AIWeeklyInsightInput = {
    week: {
      start: cleanDate(weekSource?.start),
      end: cleanDate(weekSource?.end),
      label: cleanText(weekSource?.label, MAX_TEXT.weekLabel),
    },
    stats,
    focusDistribution,
    classes,
    tasks,
    practiceLogs,
  };

  if (!data.week.start || !data.week.end) return { error: "周复盘时间范围无效。" };
  if (classes.length === 0 && tasks.length === 0 && practiceLogs.length === 0) return { error: "这一周还没有足够记录，先记录一节课或一次练习后再生成 Insight。" };
  return { data };
}

export function normalizeWeeklyInsight(value: unknown): AIWeeklyInsight | null {
  const source = value as Partial<AIWeeklyInsight> | null;
  if (!source || typeof source !== "object") return null;
  const insight: AIWeeklyInsight = {
    summary: cleanText(source.summary, MAX_TEXT.insightSummary),
    patterns: cleanInsightList(source.patterns),
    gaps: cleanInsightList(source.gaps),
    nextWeekSuggestions: cleanInsightList(source.nextWeekSuggestions),
  };
  if (!insight.summary && !insight.patterns.length && !insight.gaps.length && !insight.nextWeekSuggestions.length) return null;
  return insight;
}
