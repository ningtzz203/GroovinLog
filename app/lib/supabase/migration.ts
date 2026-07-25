import { AppPreferences, ClassReview, PracticeLog, PracticeTask, VideoReferenceType, WeeklyReflection } from "../models";
import { readClassReviews, readPracticeLogs, readPreferences, readStandaloneTasks, readWeeklyReflections } from "../storage";
import { Database } from "./database.types";

export const MIGRATION_VERSION = "local-storage-v1";

export const MIGRATION_LOCAL_STORAGE_KEYS = {
  classReviews: "groovinlog.class-reviews.v1",
  standaloneTasks: "groovinlog.standalone-tasks.v1",
  practiceLogs: "groovinlog.practice-logs.v1",
  weeklyReflections: "groovinlog.weekly-reflections.v1",
  preferences: "groovinlog.preferences.v1",
} as const;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CLASS_CONDITIONS = new Set(["Tired", "Okay", "Great"]);
const TASK_STATUSES = new Set(["active", "practicing", "done", "digested", "completed", "paused"]);
const DURATION_UNITS = new Set(["minutes", "songs"]);
const SORT_ORDERS = new Set(["newest", "oldest"]);
const VIDEO_REFERENCE_TYPES = new Set(["album_note", "local_filename", "cloud_link", "external_link"]);

type ClassReviewInsert = Database["public"]["Tables"]["class_reviews"]["Insert"];
type PracticeTaskInsert = Database["public"]["Tables"]["practice_tasks"]["Insert"];
type PracticeLogInsert = Database["public"]["Tables"]["practice_logs"]["Insert"];
type WeeklyReflectionInsert = Database["public"]["Tables"]["weekly_reflections"]["Insert"];
type UserPreferencesInsert = Database["public"]["Tables"]["user_preferences"]["Insert"];

export type MigrationSource = {
  classReviews: ClassReview[];
  standaloneTasks: PracticeTask[];
  practiceLogs: PracticeLog[];
  weeklyReflections: WeeklyReflection[];
  preferences: AppPreferences | null;
};

export type NormalizedMigrationTask = PracticeTask & {
  source: "class" | "standalone";
  owningClassReviewId: string | null;
};

export type NormalizedVideoReference = {
  type: VideoReferenceType | string | null;
  value: string | null;
};

export type NormalizedClassReview = Omit<ClassReview, "tasks" | "videoReference"> & {
  videoReference: NormalizedVideoReference;
};

export type NormalizedMigrationSource = {
  classReviews: NormalizedClassReview[];
  practiceTasks: NormalizedMigrationTask[];
  practiceLogs: PracticeLog[];
  weeklyReflections: WeeklyReflection[];
  preferences: AppPreferences | null;
};

export type MigrationCounts = {
  classReviews: number;
  practiceTasks: number;
  classLinkedTasks: number;
  standaloneTasks: number;
  practiceLogs: number;
  weeklyReflections: number;
  preferences: number;
};

export type MigrationIssue = {
  entity: "ClassReview" | "PracticeTask" | "PracticeLog" | "WeeklyReflection" | "AppPreferences" | "VideoReference";
  id?: string;
  field?: string;
  message: string;
};

export type MigrationDuplicateId = {
  entity: "ClassReview" | "PracticeTask" | "PracticeLog" | "WeeklyReflection";
  id: string;
  count: number;
};

export type MigrationInvalidId = {
  entity: "ClassReview" | "PracticeTask" | "PracticeLog" | "WeeklyReflection";
  id: string;
  field: string;
};

export type MigrationDryRunResult = {
  canMigrate: boolean;
  counts: MigrationCounts;
  errors: MigrationIssue[];
  warnings: MigrationIssue[];
  relationshipIssues: MigrationIssue[];
  duplicateIds: MigrationDuplicateId[];
  invalidIds: MigrationInvalidId[];
  sourceFingerprint: string;
};

export type SupabaseMigrationPayload = {
  classReviews: ClassReviewInsert[];
  practiceTasks: PracticeTaskInsert[];
  practiceLogs: PracticeLogInsert[];
  weeklyReflections: WeeklyReflectionInsert[];
  userPreferences: UserPreferencesInsert | null;
};

function isUuid(value: string | null | undefined) {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

function isNonEmptyString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0;
}

function isValidDateKey(value: unknown) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(`${value}T12:00:00`).getTime());
}

function normalizeVideoReference(review: ClassReview): NormalizedVideoReference {
  const type = review.videoReference?.type;
  const value = review.videoReference?.value.trim();
  if (!type || !value) return { type:null, value:null };
  return { type, value };
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(item => stableStringify(item)).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b));
    return `{${entries.map(([key, entry]) => `${JSON.stringify(key)}:${stableStringify(entry)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function fallbackFingerprint(input: string) {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

export async function createSourceFingerprint(source: NormalizedMigrationSource) {
  const encoded = new TextEncoder().encode(stableStringify(source));
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) return fallbackFingerprint(new TextDecoder().decode(encoded));
  const digest = await subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(digest)).map(byte => byte.toString(16).padStart(2, "0")).join("");
}

export function readMigrationSourceFromLocalStorage(): MigrationSource {
  const hasPreferences = typeof window !== "undefined" && window.localStorage.getItem(MIGRATION_LOCAL_STORAGE_KEYS.preferences) !== null;
  return {
    classReviews: readClassReviews(),
    standaloneTasks: readStandaloneTasks(),
    practiceLogs: readPracticeLogs(),
    weeklyReflections: readWeeklyReflections(),
    preferences: hasPreferences ? readPreferences() : null,
  };
}

export function normalizeMigrationSource(source: MigrationSource): NormalizedMigrationSource {
  const classReviews = source.classReviews.map(review => {
    const { tasks: _tasks, videoReference: _videoReference, ...rest } = review;
    return { ...rest, videoReference:normalizeVideoReference(review) };
  });
  const classLinkedTasks = source.classReviews.flatMap(review => review.tasks.map(task => ({
    ...task,
    source:"class" as const,
    owningClassReviewId:review.id,
  })));
  const standaloneTasks = source.standaloneTasks.map(task => ({
    ...task,
    source:"standalone" as const,
    owningClassReviewId:null,
    classReviewId:task.classReviewId ?? null,
  }));
  return {
    classReviews,
    practiceTasks:[...classLinkedTasks, ...standaloneTasks],
    practiceLogs:source.practiceLogs,
    weeklyReflections:source.weeklyReflections,
    preferences:source.preferences,
  };
}

function countsFor(source: NormalizedMigrationSource): MigrationCounts {
  const classLinkedTasks = source.practiceTasks.filter(task => task.source === "class").length;
  const standaloneTasks = source.practiceTasks.filter(task => task.source === "standalone").length;
  return {
    classReviews:source.classReviews.length,
    practiceTasks:source.practiceTasks.length,
    classLinkedTasks,
    standaloneTasks,
    practiceLogs:source.practiceLogs.length,
    weeklyReflections:source.weeklyReflections.length,
    preferences:source.preferences ? 1 : 0,
  };
}

function collectDuplicateIds<T extends { id: string }>(entity: MigrationDuplicateId["entity"], items: T[]) {
  const counts = new Map<string, number>();
  items.forEach(item => counts.set(item.id, (counts.get(item.id) ?? 0) + 1));
  return Array.from(counts.entries())
    .filter(([, count]) => count > 1)
    .map(([id, count]) => ({ entity, id, count }));
}

function pushInvalidId(invalidIds: MigrationInvalidId[], entity: MigrationInvalidId["entity"], id: string | null | undefined, field: string) {
  if (id && !isUuid(id)) invalidIds.push({ entity, id, field });
}

function validateClassReviews(source: NormalizedMigrationSource, errors: MigrationIssue[], warnings: MigrationIssue[], invalidIds: MigrationInvalidId[]) {
  source.classReviews.forEach(review => {
    pushInvalidId(invalidIds, "ClassReview", review.id, "id");
    if (!isValidDateKey(review.date)) errors.push({ entity:"ClassReview", id:review.id, field:"date", message:`ClassReview ${review.id} has invalid date.` });
    if (!isNonEmptyString(review.teacher)) errors.push({ entity:"ClassReview", id:review.id, field:"teacher", message:`ClassReview ${review.id} is missing teacher.` });
    if (!isNonEmptyString(review.danceStyle)) errors.push({ entity:"ClassReview", id:review.id, field:"danceStyle", message:`ClassReview ${review.id} is missing dance style.` });
    if (!isNonEmptyString(review.classTheme)) errors.push({ entity:"ClassReview", id:review.id, field:"classTheme", message:`ClassReview ${review.id} is missing class theme.` });
    if (review.classCondition && !CLASS_CONDITIONS.has(review.classCondition)) errors.push({ entity:"ClassReview", id:review.id, field:"classCondition", message:`ClassReview ${review.id} has invalid class condition.` });
    if (review.videoReference.type === null && review.videoReference.value === null) return;
    if (!review.videoReference.type || !review.videoReference.value) errors.push({ entity:"VideoReference", id:review.id, message:`ClassReview ${review.id} has incomplete video reference.` });
    if (review.videoReference.type && !VIDEO_REFERENCE_TYPES.has(review.videoReference.type)) errors.push({ entity:"VideoReference", id:review.id, field:"type", message:`ClassReview ${review.id} has invalid video reference type.` });
    if (review.videoReference.type === null && review.videoReference.value === null && review.createdAt) warnings.push({ entity:"VideoReference", id:review.id, message:`ClassReview ${review.id} video reference is empty and will migrate as null.` });
  });
}

function validatePracticeTasks(source: NormalizedMigrationSource, errors: MigrationIssue[], relationshipIssues: MigrationIssue[], invalidIds: MigrationInvalidId[]) {
  const classIds = new Set(source.classReviews.map(review => review.id));
  source.practiceTasks.forEach(task => {
    pushInvalidId(invalidIds, "PracticeTask", task.id, "id");
    pushInvalidId(invalidIds, "PracticeTask", task.classReviewId, "classReviewId");
    if (!isNonEmptyString(task.title)) errors.push({ entity:"PracticeTask", id:task.id, field:"title", message:`PracticeTask ${task.id} is missing title.` });
    if (!Array.isArray(task.focusTags)) errors.push({ entity:"PracticeTask", id:task.id, field:"focusTags", message:`PracticeTask ${task.id} has invalid focus tags.` });
    if (task.durationUnit && !DURATION_UNITS.has(task.durationUnit)) errors.push({ entity:"PracticeTask", id:task.id, field:"durationUnit", message:`PracticeTask ${task.id} has invalid duration unit.` });
    if (!TASK_STATUSES.has(task.status)) errors.push({ entity:"PracticeTask", id:task.id, field:"status", message:`PracticeTask ${task.id} has invalid status.` });
    if (task.source === "class") {
      if (!task.owningClassReviewId || !classIds.has(task.owningClassReviewId)) relationshipIssues.push({ entity:"PracticeTask", id:task.id, field:"owningClassReviewId", message:`PracticeTask ${task.id} is embedded in a missing ClassReview.` });
      if (task.classReviewId !== task.owningClassReviewId) relationshipIssues.push({ entity:"PracticeTask", id:task.id, field:"classReviewId", message:`PracticeTask ${task.id} classReviewId does not match its owning ClassReview.` });
      return;
    }
    if (task.classReviewId !== null) relationshipIssues.push({ entity:"PracticeTask", id:task.id, field:"classReviewId", message:`Standalone PracticeTask ${task.id} has a classReviewId.` });
  });
}

function validatePracticeLogs(source: NormalizedMigrationSource, errors: MigrationIssue[], relationshipIssues: MigrationIssue[], invalidIds: MigrationInvalidId[]) {
  const taskById = new Map(source.practiceTasks.map(task => [task.id, task]));
  const classIds = new Set(source.classReviews.map(review => review.id));
  source.practiceLogs.forEach(log => {
    pushInvalidId(invalidIds, "PracticeLog", log.id, "id");
    pushInvalidId(invalidIds, "PracticeLog", log.taskId, "taskId");
    pushInvalidId(invalidIds, "PracticeLog", log.classId, "classId");
    if (!taskById.has(log.taskId)) relationshipIssues.push({ entity:"PracticeLog", id:log.id, field:"taskId", message:`PracticeLog ${log.id} references missing PracticeTask ${log.taskId}.` });
    if (log.classId && !classIds.has(log.classId)) relationshipIssues.push({ entity:"PracticeLog", id:log.id, field:"classId", message:`PracticeLog ${log.id} references missing ClassReview ${log.classId}.` });
    const task = taskById.get(log.taskId);
    if (task && log.classId && task.classReviewId && log.classId !== task.classReviewId) relationshipIssues.push({ entity:"PracticeLog", id:log.id, field:"classId", message:`PracticeLog ${log.id} classId conflicts with its PracticeTask classReviewId.` });
    if (!isValidDateKey(log.date)) errors.push({ entity:"PracticeLog", id:log.id, field:"date", message:`PracticeLog ${log.id} has invalid date.` });
    if (!DURATION_UNITS.has(log.durationUnit)) errors.push({ entity:"PracticeLog", id:log.id, field:"durationUnit", message:`PracticeLog ${log.id} has invalid duration unit.` });
    if (!Number.isFinite(log.durationValue) || log.durationValue < 1 || log.durationValue > 999) errors.push({ entity:"PracticeLog", id:log.id, field:"durationValue", message:`PracticeLog ${log.id} has invalid duration value.` });
    if (!Number.isFinite(log.progressScore) || log.progressScore < 1 || log.progressScore > 5) errors.push({ entity:"PracticeLog", id:log.id, field:"progressScore", message:`PracticeLog ${log.id} has invalid progress score.` });
    if (!isNonEmptyString(log.practiceContent)) errors.push({ entity:"PracticeLog", id:log.id, field:"practiceContent", message:`PracticeLog ${log.id} is missing practice content.` });
  });
}

function validateWeeklyReflections(source: NormalizedMigrationSource, errors: MigrationIssue[], relationshipIssues: MigrationIssue[], invalidIds: MigrationInvalidId[]) {
  const weekCounts = new Map<string, number>();
  source.weeklyReflections.forEach(reflection => {
    pushInvalidId(invalidIds, "WeeklyReflection", reflection.id, "id");
    weekCounts.set(reflection.weekStart, (weekCounts.get(reflection.weekStart) ?? 0) + 1);
    if (!isValidDateKey(reflection.weekStart)) errors.push({ entity:"WeeklyReflection", id:reflection.id, field:"weekStart", message:`WeeklyReflection ${reflection.id} has invalid weekStart.` });
    if (!Array.isArray(reflection.nextFocusTags)) errors.push({ entity:"WeeklyReflection", id:reflection.id, field:"nextFocusTags", message:`WeeklyReflection ${reflection.id} has invalid nextFocusTags.` });
  });
  Array.from(weekCounts.entries()).filter(([, count]) => count > 1).forEach(([weekStart]) => {
    relationshipIssues.push({ entity:"WeeklyReflection", field:"weekStart", message:`Duplicate WeeklyReflection weekStart ${weekStart}.` });
  });
}

function validatePreferences(source: NormalizedMigrationSource, errors: MigrationIssue[]) {
  const preferences = source.preferences;
  if (!preferences) return;
  if (!Number.isFinite(preferences.defaultPracticeDurationMinutes) || preferences.defaultPracticeDurationMinutes < 1 || preferences.defaultPracticeDurationMinutes > 999) errors.push({ entity:"AppPreferences", field:"defaultPracticeDurationMinutes", message:"AppPreferences has invalid default practice duration." });
  if (!SORT_ORDERS.has(preferences.practiceQueueSortOrder)) errors.push({ entity:"AppPreferences", field:"practiceQueueSortOrder", message:"AppPreferences has invalid practice queue sort order." });
}

export async function dryRunMigration(source: MigrationSource): Promise<MigrationDryRunResult> {
  const normalized = normalizeMigrationSource(source);
  const errors: MigrationIssue[] = [];
  const warnings: MigrationIssue[] = [];
  const relationshipIssues: MigrationIssue[] = [];
  const invalidIds: MigrationInvalidId[] = [];
  const duplicateIds = [
    ...collectDuplicateIds("ClassReview", normalized.classReviews),
    ...collectDuplicateIds("PracticeTask", normalized.practiceTasks),
    ...collectDuplicateIds("PracticeLog", normalized.practiceLogs),
    ...collectDuplicateIds("WeeklyReflection", normalized.weeklyReflections),
  ];

  validateClassReviews(normalized, errors, warnings, invalidIds);
  validatePracticeTasks(normalized, errors, relationshipIssues, invalidIds);
  validatePracticeLogs(normalized, errors, relationshipIssues, invalidIds);
  validateWeeklyReflections(normalized, errors, relationshipIssues, invalidIds);
  validatePreferences(normalized, errors);

  duplicateIds.forEach(item => {
    if (item.entity === "PracticeTask") relationshipIssues.push({ entity:"PracticeTask", id:item.id, message:`Duplicate PracticeTask id ${item.id}.` });
  });

  return {
    canMigrate:errors.length === 0 && relationshipIssues.length === 0 && duplicateIds.length === 0 && invalidIds.length === 0,
    counts:countsFor(normalized),
    errors,
    warnings,
    relationshipIssues,
    duplicateIds,
    invalidIds,
    sourceFingerprint:await createSourceFingerprint(normalized),
  };
}

export function mapClassReviewToSupabaseRow(review: NormalizedClassReview, userId: string): ClassReviewInsert {
  return {
    id:review.id,
    user_id:userId,
    class_date:review.date,
    teacher:review.teacher,
    dance_style:review.danceStyle,
    class_theme:review.classTheme,
    difficulty:review.difficulty ?? null,
    class_condition:review.classCondition ?? null,
    what_i_learned:review.whatILearned,
    not_digested:review.notDigested,
    video_reference_type:VIDEO_REFERENCE_TYPES.has(review.videoReference.type ?? "") ? review.videoReference.type as VideoReferenceType : null,
    video_reference_value:review.videoReference.value,
    created_at:review.createdAt,
  };
}

export function mapPracticeTaskToSupabaseRow(task: NormalizedMigrationTask, userId: string): PracticeTaskInsert {
  return {
    id:task.id,
    user_id:userId,
    class_review_id:task.source === "standalone" ? null : task.owningClassReviewId,
    title:task.title,
    key_points:task.keyPoints,
    focus_tags:task.focusTags,
    is_high_priority:task.isHighPriority,
    suggested_duration_minutes:task.suggestedDurationMinutes ?? null,
    duration_unit:task.durationUnit ?? null,
    duration_value:task.durationValue ?? null,
    status:task.status,
    created_at:task.createdAt,
  };
}

export function mapPracticeLogToSupabaseRow(log: PracticeLog, userId: string): PracticeLogInsert {
  return {
    id:log.id,
    user_id:userId,
    task_id:log.taskId,
    class_review_id:log.classId,
    practice_date:log.date,
    duration_unit:log.durationUnit,
    duration_value:log.durationValue,
    duration_minutes:log.durationMinutes,
    songs_count:log.songsCount,
    practice_content:log.practiceContent,
    progress_score:log.progressScore,
    next_focus:log.nextFocus,
    created_at:log.createdAt,
  };
}

export function mapWeeklyReflectionToSupabaseRow(reflection: WeeklyReflection, userId: string): WeeklyReflectionInsert {
  return {
    id:reflection.id,
    user_id:userId,
    week_start:reflection.weekStart,
    improved:reflection.improved,
    still_stuck:reflection.stillStuck,
    next_focus_note:reflection.nextFocusNote,
    next_focus_tags:reflection.nextFocusTags,
    updated_at:reflection.updatedAt,
  };
}

export function mapPreferencesToSupabaseRow(preferences: AppPreferences, userId: string): UserPreferencesInsert {
  return {
    user_id:userId,
    default_practice_duration_minutes:preferences.defaultPracticeDurationMinutes,
    practice_queue_sort_order:preferences.practiceQueueSortOrder,
    show_difficulty:preferences.showDifficulty,
    show_body_status:preferences.showBodyStatus,
  };
}

export function createSupabaseMigrationPayload(source: NormalizedMigrationSource, userId: string): SupabaseMigrationPayload {
  return {
    classReviews:source.classReviews.map(review => mapClassReviewToSupabaseRow(review, userId)),
    practiceTasks:source.practiceTasks.map(task => mapPracticeTaskToSupabaseRow(task, userId)),
    practiceLogs:source.practiceLogs.map(log => mapPracticeLogToSupabaseRow(log, userId)),
    weeklyReflections:source.weeklyReflections.map(reflection => mapWeeklyReflectionToSupabaseRow(reflection, userId)),
    userPreferences:source.preferences ? mapPreferencesToSupabaseRow(source.preferences, userId) : null,
  };
}
