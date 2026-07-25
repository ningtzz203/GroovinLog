"use client";

import type { AppPreferences, ClassReview, PracticeLog, PracticeTask, VideoReference, WeeklyReflection } from "../models";
import { DEFAULT_PREFERENCES } from "../storage";
import { createClient } from "./client";
import type { Database } from "./database.types";
import { MIGRATION_VERSION } from "./migration";

type CloudClient = Awaited<ReturnType<typeof createClient>>;
type CloudUser = { id: string; email?: string | null };
type ClassReviewRow = Database["public"]["Tables"]["class_reviews"]["Row"];
type ClassReviewInsert = Database["public"]["Tables"]["class_reviews"]["Insert"];
type PracticeTaskRow = Database["public"]["Tables"]["practice_tasks"]["Row"];
type PracticeTaskInsert = Database["public"]["Tables"]["practice_tasks"]["Insert"];
type PracticeTaskUpdate = Database["public"]["Tables"]["practice_tasks"]["Update"];
type PracticeLogRow = Database["public"]["Tables"]["practice_logs"]["Row"];
type PracticeLogInsert = Database["public"]["Tables"]["practice_logs"]["Insert"];
type WeeklyReflectionRow = Database["public"]["Tables"]["weekly_reflections"]["Row"];
type WeeklyReflectionInsert = Database["public"]["Tables"]["weekly_reflections"]["Insert"];
type UserPreferencesRow = Database["public"]["Tables"]["user_preferences"]["Row"];
type UserPreferencesInsert = Database["public"]["Tables"]["user_preferences"]["Insert"];
type LocalStorageMigrationRow = Database["public"]["Tables"]["local_storage_migrations"]["Row"];

export type CloudAuthState = {
  authenticated: boolean;
  user: CloudUser | null;
};

export type CloudDiagnosticSummary = {
  authenticated: boolean;
  counts: {
    classReviews: number;
    practiceTasks: number;
    practiceLogs: number;
    weeklyReflections: number;
    preferences: "exists" | "default" | "unavailable";
    reconstructedClassTasks: number;
  };
  reconstruction: {
    classReviewsWithTasks: number;
    classReviewTasksTotal: number;
    standaloneTasks: number;
  };
};

export type CloudMigrationEligibility = {
  authenticated: boolean;
  eligible: boolean;
  reason: "ready" | "not-authenticated" | "migration-not-found" | "cloud-error";
  migration: Pick<LocalStorageMigrationRow, "migration_version" | "source_fingerprint" | "status" | "completed_at"> | null;
  error?: string;
};

function sanitizeCloudError(error: unknown) {
  const message = error instanceof Error ? error.message : typeof error === "string" ? error : "Cloud storage request failed.";
  return message.replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, "[email]").slice(0, 500);
}

function throwCloudError(error: unknown, fallback: string): never {
  throw new Error(sanitizeCloudError(error) || fallback);
}

function assertNoCloudError(error: unknown, fallback: string) {
  if (error) throwCloudError(error, fallback);
}

async function getCloudClient() {
  return await createClient() as unknown as CloudClient;
}

async function requireAuthenticatedUser(supabase: CloudClient): Promise<CloudUser> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error("Please sign in before using cloud storage.");
  return { id:data.user.id, email:data.user.email ?? null };
}

export async function getCloudAuthState(): Promise<CloudAuthState> {
  const supabase = await getCloudClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return { authenticated:false, user:null };
  return { authenticated:true, user:{ id:data.user.id, email:data.user.email ?? null } };
}

export async function readCloudMigrationEligibility(): Promise<CloudMigrationEligibility> {
  const supabase = await getCloudClient();
  const auth = await getCloudAuthState();
  if (!auth.authenticated || !auth.user) {
    return { authenticated:false, eligible:false, reason:"not-authenticated", migration:null };
  }
  const { data, error } = await supabase
    .from("local_storage_migrations")
    .select("migration_version,source_fingerprint,status,completed_at")
    .eq("user_id", auth.user.id)
    .eq("migration_version", MIGRATION_VERSION)
    .eq("status", "succeeded")
    .order("completed_at", { ascending:false, nullsFirst:false })
    .limit(1)
    .maybeSingle();
  if (error) {
    return { authenticated:true, eligible:false, reason:"cloud-error", migration:null, error:sanitizeCloudError(error) };
  }
  if (!data) {
    return { authenticated:true, eligible:false, reason:"migration-not-found", migration:null };
  }
  return { authenticated:true, eligible:true, reason:"ready", migration:data };
}

function videoReferenceFromRow(row: ClassReviewRow): VideoReference | undefined {
  if (!row.video_reference_type || !row.video_reference_value) return undefined;
  return { type:row.video_reference_type, value:row.video_reference_value };
}

function classReviewFromRow(row: ClassReviewRow, tasks: PracticeTask[] = []): ClassReview {
  return {
    id:row.id,
    date:row.class_date,
    teacher:row.teacher,
    danceStyle:row.dance_style,
    classTheme:row.class_theme,
    difficulty:row.difficulty ?? undefined,
    classCondition:row.class_condition ?? undefined,
    whatILearned:row.what_i_learned,
    notDigested:row.not_digested,
    videoReference:videoReferenceFromRow(row),
    tasks,
    createdAt:row.created_at,
  };
}

function practiceTaskFromRow(row: PracticeTaskRow): PracticeTask {
  return {
    id:row.id,
    classReviewId:row.class_review_id,
    title:row.title,
    keyPoints:row.key_points,
    focusTags:row.focus_tags,
    isHighPriority:row.is_high_priority,
    suggestedDurationMinutes:row.suggested_duration_minutes ?? undefined,
    durationUnit:row.duration_unit ?? undefined,
    durationValue:row.duration_value ?? undefined,
    status:row.status,
    createdAt:row.created_at,
  };
}

function practiceLogFromRow(row: PracticeLogRow): PracticeLog {
  return {
    id:row.id,
    taskId:row.task_id,
    classId:row.class_review_id,
    date:row.practice_date,
    durationUnit:row.duration_unit,
    durationValue:row.duration_value,
    durationMinutes:row.duration_minutes,
    songsCount:row.songs_count,
    practiceContent:row.practice_content,
    progressScore:row.progress_score as PracticeLog["progressScore"],
    nextFocus:row.next_focus,
    createdAt:row.created_at,
  };
}

function weeklyReflectionFromRow(row: WeeklyReflectionRow): WeeklyReflection {
  return {
    id:row.id,
    weekStart:row.week_start,
    improved:row.improved,
    stillStuck:row.still_stuck,
    nextFocusNote:row.next_focus_note,
    nextFocusTags:row.next_focus_tags,
    updatedAt:row.updated_at,
  };
}

function preferencesFromRow(row: UserPreferencesRow | null): AppPreferences {
  if (!row) return DEFAULT_PREFERENCES;
  return {
    defaultPracticeDurationMinutes:row.default_practice_duration_minutes,
    practiceQueueSortOrder:row.practice_queue_sort_order,
    showDifficulty:row.show_difficulty,
    showBodyStatus:row.show_body_status,
  };
}

function classReviewToRow(review: ClassReview, userId: string): ClassReviewInsert {
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
    video_reference_type:review.videoReference?.value ? review.videoReference.type : null,
    video_reference_value:review.videoReference?.value ? review.videoReference.value : null,
    created_at:review.createdAt,
  };
}

function practiceTaskToRow(task: PracticeTask, userId: string, classReviewId = task.classReviewId): PracticeTaskInsert {
  return {
    id:task.id,
    user_id:userId,
    class_review_id:classReviewId,
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

function practiceTaskPatchToRow(patch: Partial<PracticeTask>): PracticeTaskUpdate {
  const row: PracticeTaskUpdate = {};
  if ("classReviewId" in patch) row.class_review_id = patch.classReviewId ?? null;
  if ("title" in patch && patch.title !== undefined) row.title = patch.title;
  if ("keyPoints" in patch && patch.keyPoints !== undefined) row.key_points = patch.keyPoints;
  if ("focusTags" in patch && patch.focusTags !== undefined) row.focus_tags = patch.focusTags;
  if ("isHighPriority" in patch && patch.isHighPriority !== undefined) row.is_high_priority = patch.isHighPriority;
  if ("suggestedDurationMinutes" in patch) row.suggested_duration_minutes = patch.suggestedDurationMinutes ?? null;
  if ("durationUnit" in patch) row.duration_unit = patch.durationUnit ?? null;
  if ("durationValue" in patch) row.duration_value = patch.durationValue ?? null;
  if ("status" in patch && patch.status !== undefined) row.status = patch.status;
  if ("createdAt" in patch && patch.createdAt !== undefined) row.created_at = patch.createdAt;
  return row;
}

function practiceLogToRow(log: PracticeLog, userId: string): PracticeLogInsert {
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

function weeklyReflectionToRow(reflection: WeeklyReflection, userId: string): WeeklyReflectionInsert {
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

function preferencesToRow(preferences: Partial<AppPreferences>, userId: string): UserPreferencesInsert {
  return {
    user_id:userId,
    default_practice_duration_minutes:preferences.defaultPracticeDurationMinutes,
    practice_queue_sort_order:preferences.practiceQueueSortOrder,
    show_difficulty:preferences.showDifficulty,
    show_body_status:preferences.showBodyStatus,
  };
}

export async function readPracticeTasksCloud(): Promise<PracticeTask[]> {
  const supabase = await getCloudClient();
  await requireAuthenticatedUser(supabase);
  const { data, error } = await supabase.from("practice_tasks").select("*").order("created_at", { ascending:false });
  assertNoCloudError(error, "Failed to read cloud practice tasks.");
  return (data ?? []).map(practiceTaskFromRow);
}

export async function readClassReviewsCloud(): Promise<ClassReview[]> {
  const supabase = await getCloudClient();
  await requireAuthenticatedUser(supabase);
  const [{ data:classRows, error:classError }, { data:taskRows, error:taskError }] = await Promise.all([
    supabase.from("class_reviews").select("*").order("class_date", { ascending:false }).order("created_at", { ascending:false }),
    supabase.from("practice_tasks").select("*").order("created_at", { ascending:false }),
  ]);
  assertNoCloudError(classError, "Failed to read cloud class reviews.");
  assertNoCloudError(taskError, "Failed to read cloud practice tasks.");
  const tasksByClass = new Map<string, PracticeTask[]>();
  (taskRows ?? []).map(practiceTaskFromRow).forEach(task => {
    if (!task.classReviewId) return;
    tasksByClass.set(task.classReviewId, [...(tasksByClass.get(task.classReviewId) ?? []), task]);
  });
  return (classRows ?? []).map(row => classReviewFromRow(row, tasksByClass.get(row.id) ?? []));
}

export async function readPracticeLogsCloud(): Promise<PracticeLog[]> {
  const supabase = await getCloudClient();
  await requireAuthenticatedUser(supabase);
  const { data, error } = await supabase.from("practice_logs").select("*").order("practice_date", { ascending:false }).order("created_at", { ascending:false });
  assertNoCloudError(error, "Failed to read cloud practice logs.");
  return (data ?? []).map(practiceLogFromRow);
}

export async function readWeeklyReflectionsCloud(): Promise<WeeklyReflection[]> {
  const supabase = await getCloudClient();
  await requireAuthenticatedUser(supabase);
  const { data, error } = await supabase.from("weekly_reflections").select("*").order("week_start", { ascending:false });
  assertNoCloudError(error, "Failed to read cloud weekly reflections.");
  return (data ?? []).map(weeklyReflectionFromRow);
}

export async function readPreferencesCloud(): Promise<AppPreferences> {
  const supabase = await getCloudClient();
  const user = await requireAuthenticatedUser(supabase);
  const { data, error } = await supabase.from("user_preferences").select("*").eq("user_id", user.id).maybeSingle();
  assertNoCloudError(error, "Failed to read cloud preferences.");
  return preferencesFromRow(data ?? null);
}

async function readPreferencesCloudWithStatus(): Promise<{ preferences: AppPreferences; exists: boolean }> {
  const supabase = await getCloudClient();
  const user = await requireAuthenticatedUser(supabase);
  const { data, error } = await supabase.from("user_preferences").select("*").eq("user_id", user.id).maybeSingle();
  assertNoCloudError(error, "Failed to read cloud preferences.");
  return { preferences:preferencesFromRow(data ?? null), exists:Boolean(data) };
}

export async function findClassReviewCloud(id: string): Promise<ClassReview | undefined> {
  const reviews = await readClassReviewsCloud();
  return reviews.find(review => review.id === id);
}

export async function findPracticeTaskCloud(id: string): Promise<PracticeTask | undefined> {
  const tasks = await readPracticeTasksCloud();
  return tasks.find(task => task.id === id);
}

export async function saveClassReviewCloud(review: ClassReview): Promise<void> {
  const supabase = await getCloudClient();
  const user = await requireAuthenticatedUser(supabase);
  const { error:classError } = await supabase.from("class_reviews").upsert(classReviewToRow(review, user.id), { onConflict:"id" });
  assertNoCloudError(classError, "Failed to save cloud class review.");
  if (!review.tasks.length) return;
  const taskRows = review.tasks.map(task => practiceTaskToRow(task, user.id, review.id));
  const { error:taskError } = await supabase.from("practice_tasks").upsert(taskRows, { onConflict:"id" });
  assertNoCloudError(taskError, "Failed to save cloud class review tasks.");
}

export async function saveStandaloneTaskCloud(task: PracticeTask): Promise<void> {
  const supabase = await getCloudClient();
  const user = await requireAuthenticatedUser(supabase);
  const { error } = await supabase.from("practice_tasks").upsert(practiceTaskToRow(task, user.id, null), { onConflict:"id" });
  assertNoCloudError(error, "Failed to save cloud standalone task.");
}

export async function appendPracticeTasksToClassReviewCloud(reviewId: string, tasks: PracticeTask[]): Promise<ClassReview | undefined> {
  const supabase = await getCloudClient();
  const user = await requireAuthenticatedUser(supabase);
  const { data:review, error:reviewError } = await supabase.from("class_reviews").select("id").eq("user_id", user.id).eq("id", reviewId).maybeSingle();
  assertNoCloudError(reviewError, "Failed to check cloud class review.");
  if (!review) throw new Error("Cloud class review not found.");
  if (tasks.length) {
    const taskRows = tasks.map(task => practiceTaskToRow(task, user.id, reviewId));
    const { error:taskError } = await supabase.from("practice_tasks").upsert(taskRows, { onConflict:"id" });
    assertNoCloudError(taskError, "Failed to append cloud practice tasks.");
  }
  return await findClassReviewCloud(reviewId);
}

export async function updatePracticeTaskCloud(taskId: string, patch: Partial<PracticeTask>): Promise<void> {
  const supabase = await getCloudClient();
  const user = await requireAuthenticatedUser(supabase);
  const row = practiceTaskPatchToRow(patch);
  const { error } = await supabase.from("practice_tasks").update(row).eq("user_id", user.id).eq("id", taskId);
  assertNoCloudError(error, "Failed to update cloud practice task.");
}

export async function savePracticeLogCloud(log: PracticeLog): Promise<void> {
  const supabase = await getCloudClient();
  const user = await requireAuthenticatedUser(supabase);
  const { error:logError } = await supabase.from("practice_logs").upsert(practiceLogToRow(log, user.id), { onConflict:"id" });
  assertNoCloudError(logError, "Failed to save cloud practice log.");
  const { error:taskError } = await supabase.from("practice_tasks").update({ status:"practicing" }).eq("user_id", user.id).eq("id", log.taskId);
  assertNoCloudError(taskError, "Failed to update cloud practice task status.");
}

export async function saveWeeklyReflectionCloud(reflection: WeeklyReflection): Promise<void> {
  const supabase = await getCloudClient();
  const user = await requireAuthenticatedUser(supabase);
  const { error } = await supabase.from("weekly_reflections").upsert(weeklyReflectionToRow(reflection, user.id), { onConflict:"user_id,week_start" });
  assertNoCloudError(error, "Failed to save cloud weekly reflection.");
}

export async function savePreferencesCloud(preferences: Partial<AppPreferences>): Promise<AppPreferences> {
  const supabase = await getCloudClient();
  const user = await requireAuthenticatedUser(supabase);
  const next = { ...DEFAULT_PREFERENCES, ...preferences };
  const { data, error } = await supabase.from("user_preferences").upsert(preferencesToRow(next, user.id), { onConflict:"user_id" }).select("*").single();
  assertNoCloudError(error, "Failed to save cloud preferences.");
  return preferencesFromRow(data);
}

export async function readCloudDiagnosticSummary(): Promise<CloudDiagnosticSummary> {
  const auth = await getCloudAuthState();
  if (!auth.authenticated) {
    return {
      authenticated:false,
      counts:{ classReviews:0, practiceTasks:0, practiceLogs:0, weeklyReflections:0, preferences:"unavailable", reconstructedClassTasks:0 },
      reconstruction:{ classReviewsWithTasks:0, classReviewTasksTotal:0, standaloneTasks:0 },
    };
  }
  const [classReviews, practiceTasks, practiceLogs, weeklyReflections, preferencesResult] = await Promise.all([
    readClassReviewsCloud(),
    readPracticeTasksCloud(),
    readPracticeLogsCloud(),
    readWeeklyReflectionsCloud(),
    readPreferencesCloudWithStatus(),
  ]);
  const classReviewTasksTotal = classReviews.reduce((total, review) => total + review.tasks.length, 0);
  return {
    authenticated:true,
    counts:{
      classReviews:classReviews.length,
      practiceTasks:practiceTasks.length,
      practiceLogs:practiceLogs.length,
      weeklyReflections:weeklyReflections.length,
      preferences:preferencesResult.exists ? "exists" : "default",
      reconstructedClassTasks:classReviewTasksTotal,
    },
    reconstruction:{
      classReviewsWithTasks:classReviews.filter(review => review.tasks.length > 0).length,
      classReviewTasksTotal,
      standaloneTasks:practiceTasks.filter(task => task.classReviewId === null).length,
    },
  };
}
