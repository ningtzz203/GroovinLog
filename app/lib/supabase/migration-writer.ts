"use client";

import { createClient } from "./client";
import { Database, Json } from "./database.types";
import {
  createSupabaseMigrationPayload,
  MIGRATION_VERSION,
  MigrationCounts,
  MigrationDryRunResult,
  normalizeMigrationSource,
  readMigrationSourceFromLocalStorage,
  dryRunMigration,
} from "./migration";

type MigrationStatus = "not-authenticated" | "already-migrated" | "succeeded" | "failed";
type MigrationRecordStatus = "pending" | "succeeded" | "failed";
type MigrationRecordInsert = Database["public"]["Tables"]["local_storage_migrations"]["Insert"];
type MigrationRecordPatch = Pick<MigrationRecordInsert, "imported_counts" | "error_message" | "completed_at">;

type MigrationUser = {
  id: string;
};

type VerificationResult = {
  ok: boolean;
  errors: string[];
};

export type MigrationWriteProgress = {
  classReviews: number;
  practiceTasks: number;
  practiceLogs: number;
  weeklyReflections: number;
  preferences: number;
  migrationRecord: boolean;
};

export type MigrationWriteResult = {
  status: MigrationStatus;
  migrationVersion: typeof MIGRATION_VERSION;
  sourceFingerprint?: string;
  dryRun?: MigrationDryRunResult;
  counts?: MigrationCounts;
  importedCounts?: MigrationCounts;
  progress: MigrationWriteProgress;
  verification?: VerificationResult;
  error?: string;
};

function emptyProgress(): MigrationWriteProgress {
  return {
    classReviews:0,
    practiceTasks:0,
    practiceLogs:0,
    weeklyReflections:0,
    preferences:0,
    migrationRecord:false,
  };
}

function sanitizeError(error: unknown) {
  const message = error instanceof Error ? error.message : typeof error === "string" ? error : "Migration failed.";
  return message.replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, "[email]").slice(0, 500);
}

function assertNoSupabaseError(error: unknown, fallback: string) {
  if (!error) return;
  throw new Error(sanitizeError(error) || fallback);
}

function sameSet(expected: string[], actual: string[]) {
  if (expected.length !== actual.length) return false;
  const actualSet = new Set(actual);
  return expected.every(id => actualSet.has(id));
}

function unique(values: string[]) {
  return Array.from(new Set(values));
}

function toJson(value: unknown): Json {
  return value as Json;
}

async function getAuthenticatedUser(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return { id:data.user.id } satisfies MigrationUser;
}

async function upsertMigrationRecord(
  supabase: Awaited<ReturnType<typeof createClient>>,
  user: MigrationUser,
  sourceFingerprint: string,
  status: MigrationRecordStatus,
  patch: Partial<MigrationRecordPatch> = {},
) {
  const record: MigrationRecordInsert = {
    user_id:user.id,
    migration_version:MIGRATION_VERSION,
    source_fingerprint:sourceFingerprint,
    status,
    ...patch,
  };
  const { error } = await supabase
    .from("local_storage_migrations")
    .upsert(record, { onConflict:"user_id,migration_version,source_fingerprint" });
  assertNoSupabaseError(error, "Failed to update migration record.");
}

async function markFailed(
  supabase: Awaited<ReturnType<typeof createClient>>,
  user: MigrationUser,
  sourceFingerprint: string,
  errorMessage: string,
  progress: MigrationWriteProgress,
) {
  await upsertMigrationRecord(supabase, user, sourceFingerprint, "failed", {
    error_message:sanitizeError(errorMessage),
    imported_counts:toJson(progress),
    completed_at:new Date().toISOString(),
  });
}

async function queryIds(
  supabase: Awaited<ReturnType<typeof createClient>>,
  table: "class_reviews" | "practice_tasks" | "practice_logs" | "weekly_reflections",
  userId: string,
  ids: string[],
) {
  const wanted = unique(ids);
  if (!wanted.length) return [];
  const { data, error } = await supabase.from(table).select("id").eq("user_id", userId).in("id", wanted);
  assertNoSupabaseError(error, `Failed to verify ${table}.`);
  return Array.isArray(data) ? data.map(row => String(row.id)) : [];
}

async function verifyMigratedData(
  supabase: Awaited<ReturnType<typeof createClient>>,
  user: MigrationUser,
  source: ReturnType<typeof normalizeMigrationSource>,
): Promise<VerificationResult> {
  const errors: string[] = [];
  const classIds = source.classReviews.map(item => item.id);
  const taskIds = source.practiceTasks.map(item => item.id);
  const logIds = source.practiceLogs.map(item => item.id);
  const weeklyIds = source.weeklyReflections.map(item => item.id);

  const cloudClassIds = await queryIds(supabase, "class_reviews", user.id, classIds);
  const cloudTaskIds = await queryIds(supabase, "practice_tasks", user.id, taskIds);
  const cloudLogIds = await queryIds(supabase, "practice_logs", user.id, logIds);
  const cloudWeeklyIds = await queryIds(supabase, "weekly_reflections", user.id, weeklyIds);

  if (!sameSet(classIds, cloudClassIds)) errors.push("ClassReview ID verification failed.");
  if (!sameSet(taskIds, cloudTaskIds)) errors.push("PracticeTask ID verification failed.");
  if (!sameSet(logIds, cloudLogIds)) errors.push("PracticeLog ID verification failed.");
  if (!sameSet(weeklyIds, cloudWeeklyIds)) errors.push("WeeklyReflection ID verification failed.");

  if (source.preferences) {
    const { data, error } = await supabase.from("user_preferences").select("user_id").eq("user_id", user.id).maybeSingle();
    assertNoSupabaseError(error, "Failed to verify user preferences.");
    if (!data) errors.push("UserPreferences verification failed.");
  }

  const classIdSet = new Set(cloudClassIds);
  const taskIdSet = new Set(cloudTaskIds);
  source.practiceTasks.forEach(task => {
    if (task.source === "class" && task.owningClassReviewId && !classIdSet.has(task.owningClassReviewId)) {
      errors.push(`PracticeTask ${task.id} references missing ClassReview ${task.owningClassReviewId}.`);
    }
  });
  source.practiceLogs.forEach(log => {
    if (!taskIdSet.has(log.taskId)) errors.push(`PracticeLog ${log.id} references missing PracticeTask ${log.taskId}.`);
    if (log.classId && !classIdSet.has(log.classId)) errors.push(`PracticeLog ${log.id} references missing ClassReview ${log.classId}.`);
  });

  return { ok:errors.length === 0, errors };
}

export async function runAuthenticatedLocalStorageMigration(): Promise<MigrationWriteResult> {
  const progress = emptyProgress();
  const supabase = await createClient();
  const user = await getAuthenticatedUser(supabase);
  if (!user) {
    return {
      status:"not-authenticated",
      migrationVersion:MIGRATION_VERSION,
      progress,
      error:"You must be signed in before migration.",
    };
  }

  const source = readMigrationSourceFromLocalStorage();
  const dryRun = await dryRunMigration(source);
  const normalized = normalizeMigrationSource(source);
  const sourceFingerprint = dryRun.sourceFingerprint;

  if (!dryRun.canMigrate) {
    return {
      status:"failed",
      migrationVersion:MIGRATION_VERSION,
      sourceFingerprint,
      dryRun,
      counts:dryRun.counts,
      progress,
      error:"Dry run failed. Fix validation errors before migration.",
    };
  }

  const { data: existingMigration, error: existingError } = await supabase
    .from("local_storage_migrations")
    .select("status")
    .eq("user_id", user.id)
    .eq("migration_version", MIGRATION_VERSION)
    .eq("source_fingerprint", sourceFingerprint)
    .maybeSingle();
  assertNoSupabaseError(existingError, "Failed to check existing migration.");
  if (existingMigration?.status === "succeeded") {
    return {
      status:"already-migrated",
      migrationVersion:MIGRATION_VERSION,
      sourceFingerprint,
      dryRun,
      counts:dryRun.counts,
      importedCounts:dryRun.counts,
      progress,
    };
  }

  try {
    await upsertMigrationRecord(supabase, user, sourceFingerprint, "pending", {
      imported_counts:null,
      error_message:null,
      completed_at:null,
    });
    progress.migrationRecord = true;

    const payload = createSupabaseMigrationPayload(normalized, user.id);
    if (payload.classReviews.length) {
      const { error } = await supabase.from("class_reviews").upsert(payload.classReviews, { onConflict:"id" });
      assertNoSupabaseError(error, "Failed to migrate class reviews.");
      progress.classReviews = payload.classReviews.length;
    }
    if (payload.practiceTasks.length) {
      const { error } = await supabase.from("practice_tasks").upsert(payload.practiceTasks, { onConflict:"id" });
      assertNoSupabaseError(error, "Failed to migrate practice tasks.");
      progress.practiceTasks = payload.practiceTasks.length;
    }
    if (payload.practiceLogs.length) {
      const { error } = await supabase.from("practice_logs").upsert(payload.practiceLogs, { onConflict:"id" });
      assertNoSupabaseError(error, "Failed to migrate practice logs.");
      progress.practiceLogs = payload.practiceLogs.length;
    }
    if (payload.weeklyReflections.length) {
      const { error } = await supabase.from("weekly_reflections").upsert(payload.weeklyReflections, { onConflict:"id" });
      assertNoSupabaseError(error, "Failed to migrate weekly reflections.");
      progress.weeklyReflections = payload.weeklyReflections.length;
    }
    if (payload.userPreferences) {
      const { error } = await supabase.from("user_preferences").upsert(payload.userPreferences, { onConflict:"user_id" });
      assertNoSupabaseError(error, "Failed to migrate user preferences.");
      progress.preferences = 1;
    }

    const verification = await verifyMigratedData(supabase, user, normalized);
    if (!verification.ok) throw new Error(verification.errors.join(" "));

    await upsertMigrationRecord(supabase, user, sourceFingerprint, "succeeded", {
      imported_counts:toJson(dryRun.counts),
      error_message:null,
      completed_at:new Date().toISOString(),
    });

    return {
      status:"succeeded",
      migrationVersion:MIGRATION_VERSION,
      sourceFingerprint,
      dryRun,
      counts:dryRun.counts,
      importedCounts:dryRun.counts,
      progress,
      verification,
    };
  } catch (caught) {
    const error = sanitizeError(caught);
    try {
      await markFailed(supabase, user, sourceFingerprint, error, progress);
    } catch {
      // If recording failure also fails, still return the original safe error.
    }
    return {
      status:"failed",
      migrationVersion:MIGRATION_VERSION,
      sourceFingerprint,
      dryRun,
      counts:dryRun.counts,
      progress,
      error,
    };
  }
}
