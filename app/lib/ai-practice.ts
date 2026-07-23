import { FOCUS_TAGS, PracticeTask } from "./models";

export type AIExistingTaskInput = {
  title: string;
  keyPoints: string;
  focusTags: string[];
};

export type AIGeneratePracticeTasksInput = {
  danceStyle: string;
  classTheme: string;
  whatILearned: string;
  notDigested: string;
  existingTasks: AIExistingTaskInput[];
  defaultPracticeDuration: number;
};

export type AIPracticeTaskDraft = {
  title: string;
  keyPoints: string;
  focusTags: string[];
  suggestedDurationMinutes: number;
  isHighPriority: boolean;
};

const FOCUS_SET = new Set<string>(FOCUS_TAGS);
const MAX_TEXT = {
  danceStyle: 80,
  classTheme: 120,
  note: 900,
  taskTitle: 80,
  taskKeyPoints: 220,
};

function cleanText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, maxLength) : "";
}

export function normalizePracticeDuration(value: unknown, fallback = 20) {
  const minutes = Number(value);
  if (!Number.isFinite(minutes)) return fallback;
  return Math.min(60, Math.max(5, Math.round(minutes)));
}

export function sanitizeExistingTasks(value: unknown): AIExistingTaskInput[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 8).map(task => {
    const item = task as Partial<PracticeTask>;
    return {
      title: cleanText(item.title, MAX_TEXT.taskTitle),
      keyPoints: cleanText(item.keyPoints, MAX_TEXT.taskKeyPoints),
      focusTags: Array.isArray(item.focusTags) ? item.focusTags.filter(tag => FOCUS_SET.has(tag)).slice(0, 4) : [],
    };
  }).filter(task => task.title);
}

export function sanitizeAiRequestBody(value: unknown): { data?: AIGeneratePracticeTasksInput; error?: string } {
  const body = value as Partial<AIGeneratePracticeTasksInput> | null;
  if (!body || typeof body !== "object") return { error: "请求内容无效。" };
  const data: AIGeneratePracticeTasksInput = {
    danceStyle: cleanText(body.danceStyle, MAX_TEXT.danceStyle),
    classTheme: cleanText(body.classTheme, MAX_TEXT.classTheme),
    whatILearned: cleanText(body.whatILearned, MAX_TEXT.note),
    notDigested: cleanText(body.notDigested, MAX_TEXT.note),
    existingTasks: sanitizeExistingTasks(body.existingTasks),
    defaultPracticeDuration: normalizePracticeDuration(body.defaultPracticeDuration),
  };
  const contentLength = data.classTheme.length + data.whatILearned.length + data.notDigested.length;
  if (!data.danceStyle || !data.classTheme) return { error: "请先填写舞种和课程主题。" };
  if (contentLength < 12 && data.existingTasks.length === 0) return { error: "课堂复盘内容太少，建议补充一点课堂笔记后再生成。" };
  return { data };
}

export function normalizeAiTaskDrafts(value: unknown, fallbackDuration = 20): AIPracticeTaskDraft[] {
  const source = value as { tasks?: unknown } | null;
  const tasks = Array.isArray(source?.tasks) ? source.tasks : Array.isArray(value) ? value : [];
  return tasks.slice(0, 3).map(item => {
    const task = item as Partial<AIPracticeTaskDraft>;
    const focusTags = Array.isArray(task.focusTags) ? task.focusTags.filter(tag => FOCUS_SET.has(tag)).slice(0, 1) : [];
    return {
      title: cleanText(task.title, MAX_TEXT.taskTitle),
      keyPoints: cleanText(task.keyPoints, MAX_TEXT.taskKeyPoints),
      focusTags: focusTags.length ? focusTags : ["全身"],
      suggestedDurationMinutes: normalizePracticeDuration(task.suggestedDurationMinutes, fallbackDuration),
      isHighPriority: task.isHighPriority === true,
    };
  }).filter(task => task.title);
}

export function isValidAiTaskDrafts(value: unknown) {
  return normalizeAiTaskDrafts(value).length > 0;
}
