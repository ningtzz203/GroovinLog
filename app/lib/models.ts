export const FOCUS_TAGS = [
  "手臂", "胸", "肩", "胯", "腿和脚", "核心", "全身",
  "Groove", "协调", "Isolation", "控制", "Musicality", "Texture", "Freestyle", "体能",
] as const;

export type VideoReferenceType = "album_note" | "local_filename" | "cloud_link" | "external_link";

export type VideoReference = {
  type: VideoReferenceType;
  value: string;
};

export type PracticeTask = {
  id: string;
  classReviewId: string | null;
  title: string;
  keyPoints: string;
  focusTags: string[];
  isHighPriority: boolean;
  suggestedDurationMinutes?: number;
  /** Kept for old localStorage records. New UI stores minutes only. */
  durationUnit?: "minutes" | "songs";
  durationValue?: number;
  status: "active" | "practicing" | "done" | "digested" | "completed" | "paused";
  createdAt: string;
};

export type PracticeLog = {
  id: string;
  taskId: string;
  classId: string | null;
  date: string;
  /** Kept for old localStorage records. New UI records minutes only. */
  durationUnit: "minutes" | "songs";
  durationValue: number;
  durationMinutes: number | null;
  songsCount: number | null;
  practiceContent: string;
  progressScore: 1 | 2 | 3 | 4 | 5;
  nextFocus: string;
  createdAt: string;
};

export type ClassReview = {
  id: string;
  date: string;
  teacher: string;
  danceStyle: string;
  classTheme: string;
  difficulty?: string;
  classCondition?: "Tired" | "Okay" | "Great";
  whatILearned: string;
  notDigested: string;
  videoReference?: VideoReference;
  tasks: PracticeTask[];
  createdAt: string;
};

export type WeeklyReflection = {
  id: string;
  weekStart: string;
  improved: string;
  stillStuck: string;
  nextFocusNote: string;
  nextFocusTags: string[];
  updatedAt: string;
};

export function taskDuration(task: PracticeTask) {
  return `${taskDurationMinutes(task)} 分钟`;
}

export function logDuration(log: PracticeLog) {
  return `${log.durationMinutes ?? log.durationValue} 分钟`;
}

export function logDurationMinutes(log: PracticeLog) {
  return log.durationMinutes ?? log.durationValue ?? 0;
}

export function localDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function taskDurationMinutes(task: PracticeTask) {
  if (task.durationUnit === "songs") return task.suggestedDurationMinutes ?? 15;
  return task.durationValue ?? task.suggestedDurationMinutes ?? 15;
}
