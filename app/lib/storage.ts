import { ClassReview, PracticeLog, PracticeTask, WeeklyReflection } from "./models";

const STORAGE_KEY = "groovinlog.class-reviews.v1";
const STANDALONE_TASKS_KEY = "groovinlog.standalone-tasks.v1";
const PRACTICE_LOGS_KEY = "groovinlog.practice-logs.v1";
const WEEKLY_REFLECTIONS_KEY = "groovinlog.weekly-reflections.v1";

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
