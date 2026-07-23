import { AppPreferences, ClassReview, PracticeLog, PracticeTask, WeeklyReflection } from "./models";

const STORAGE_KEY = "groovinlog.class-reviews.v1";
const STANDALONE_TASKS_KEY = "groovinlog.standalone-tasks.v1";
const PRACTICE_LOGS_KEY = "groovinlog.practice-logs.v1";
const WEEKLY_REFLECTIONS_KEY = "groovinlog.weekly-reflections.v1";
const PREFERENCES_KEY = "groovinlog.preferences.v1";

export const DEFAULT_PREFERENCES: AppPreferences = {
  defaultPracticeDurationMinutes: 20,
  practiceQueueSortOrder: "newest",
  showDifficulty: false,
  showBodyStatus: false,
};

function normalizePreferences(value: Partial<AppPreferences> | null): AppPreferences {
  const minutes = Number(value?.defaultPracticeDurationMinutes);
  const sortOrder = value?.practiceQueueSortOrder;
  return {
    defaultPracticeDurationMinutes:Number.isFinite(minutes) && minutes > 0 ? Math.round(minutes) : DEFAULT_PREFERENCES.defaultPracticeDurationMinutes,
    practiceQueueSortOrder:sortOrder === "oldest" ? "oldest" : DEFAULT_PREFERENCES.practiceQueueSortOrder,
    showDifficulty:value?.showDifficulty === true,
    showBodyStatus:value?.showBodyStatus === true,
  };
}

export function readPreferences(): AppPreferences {
  if (typeof window === "undefined") return DEFAULT_PREFERENCES;
  try {
    const value = window.localStorage.getItem(PREFERENCES_KEY);
    return value ? normalizePreferences(JSON.parse(value) as Partial<AppPreferences>) : DEFAULT_PREFERENCES;
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export function savePreferences(preferences: Partial<AppPreferences>) {
  const next = normalizePreferences({ ...readPreferences(), ...preferences });
  window.localStorage.setItem(PREFERENCES_KEY, JSON.stringify(next));
  window.dispatchEvent(new Event("groovinlog:updated"));
  return next;
}

export function readClassReviews(): ClassReview[] {
  if (typeof window === "undefined") return [];
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    return value ? JSON.parse(value) as ClassReview[] : [];
  } catch {
    return [];
  }
}

export function saveClassReview(review: ClassReview) {
  const existing = readClassReviews().filter(item => item.id !== review.id);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify([review, ...existing]));
  window.dispatchEvent(new Event("groovinlog:updated"));
}

export function appendPracticeTasksToClassReview(reviewId: string, tasks: PracticeTask[]) {
  const reviews = readClassReviews();
  const nextReviews = reviews.map(review => review.id === reviewId ? { ...review, tasks:[...tasks, ...review.tasks] } : review);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextReviews));
  window.dispatchEvent(new Event("groovinlog:updated"));
  return nextReviews.find(review => review.id === reviewId);
}

export function readPracticeTasks(): PracticeTask[] {
  return [...readStandaloneTasks(), ...readClassReviews().flatMap(review => review.tasks)];
}

export function readStandaloneTasks(): PracticeTask[] {
  if (typeof window === "undefined") return [];
  try {
    const value = window.localStorage.getItem(STANDALONE_TASKS_KEY);
    return value ? JSON.parse(value) as PracticeTask[] : [];
  } catch {
    return [];
  }
}

export function saveStandaloneTask(task: PracticeTask) {
  const existing = readStandaloneTasks().filter(item => item.id !== task.id);
  window.localStorage.setItem(STANDALONE_TASKS_KEY, JSON.stringify([task, ...existing]));
  window.dispatchEvent(new Event("groovinlog:updated"));
}

export function findPracticeTask(taskId: string): PracticeTask | undefined {
  return readPracticeTasks().find(task => task.id === taskId);
}

export function updatePracticeTask(taskId: string, patch: Partial<PracticeTask>) {
  const standalone = readStandaloneTasks();
  const standaloneIndex = standalone.findIndex(task => task.id === taskId);
  if (standaloneIndex >= 0) {
    standalone[standaloneIndex] = { ...standalone[standaloneIndex], ...patch };
    window.localStorage.setItem(STANDALONE_TASKS_KEY, JSON.stringify(standalone));
    window.dispatchEvent(new Event("groovinlog:updated"));
    return;
  }

  const reviews = readClassReviews();
  let changed = false;
  const nextReviews = reviews.map(review => ({
    ...review,
    tasks: review.tasks.map(task => {
      if (task.id !== taskId) return task;
      changed = true;
      return { ...task, ...patch };
    }),
  }));
  if (changed) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextReviews));
    window.dispatchEvent(new Event("groovinlog:updated"));
  }
}

export function readPracticeLogs(): PracticeLog[] {
  if (typeof window === "undefined") return [];
  try {
    const value = window.localStorage.getItem(PRACTICE_LOGS_KEY);
    return value ? JSON.parse(value) as PracticeLog[] : [];
  } catch {
    return [];
  }
}

export function savePracticeLog(log: PracticeLog) {
  const existing = readPracticeLogs().filter(item => item.id !== log.id);
  window.localStorage.setItem(PRACTICE_LOGS_KEY, JSON.stringify([log, ...existing]));
  updatePracticeTask(log.taskId, { status: "practicing" });
  window.dispatchEvent(new Event("groovinlog:updated"));
}

export function readWeeklyReflections(): WeeklyReflection[] {
  if (typeof window === "undefined") return [];
  try {
    const value = window.localStorage.getItem(WEEKLY_REFLECTIONS_KEY);
    return value ? JSON.parse(value) as WeeklyReflection[] : [];
  } catch {
    return [];
  }
}

export function saveWeeklyReflection(reflection: WeeklyReflection) {
  const existing = readWeeklyReflections().filter(item => item.weekStart !== reflection.weekStart);
  window.localStorage.setItem(WEEKLY_REFLECTIONS_KEY, JSON.stringify([reflection, ...existing]));
  window.dispatchEvent(new Event("groovinlog:updated"));
}
