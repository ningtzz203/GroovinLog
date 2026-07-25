"use client";

import type { AppPreferences, ClassReview, PracticeLog, PracticeTask, WeeklyReflection } from "./models";
import {
  appendPracticeTasksToClassReview,
  findPracticeTask,
  readClassReviews,
  readPracticeLogs,
  readPracticeTasks,
  readPreferences,
  readStandaloneTasks,
  readWeeklyReflections,
  saveClassReview,
  savePracticeLog,
  savePreferences,
  saveStandaloneTask,
  saveWeeklyReflection,
  updatePracticeTask,
} from "./storage";
import {
  appendPracticeTasksToClassReviewCloud,
  findClassReviewCloud,
  findPracticeTaskCloud,
  readClassReviewsCloud,
  readCloudMigrationEligibility,
  readPracticeLogsCloud,
  readPracticeTasksCloud,
  readPreferencesCloud,
  readWeeklyReflectionsCloud,
  saveClassReviewCloud,
  savePracticeLogCloud,
  savePreferencesCloud,
  saveStandaloneTaskCloud,
  saveWeeklyReflectionCloud,
  updatePracticeTaskCloud,
  type CloudMigrationEligibility,
} from "./supabase/cloud-storage";

export { DEFAULT_PREFERENCES } from "./storage";

export type DataBackend = "local" | "cloud";
export type DataBackendPreference = "auto" | DataBackend;

export type DataBackendResolution = {
  requested: DataBackendPreference;
  selected: DataBackend;
  cloud: CloudMigrationEligibility;
  fallbackReason: CloudMigrationEligibility["reason"] | null;
};

export type DataRepositoryOptions = {
  backend?: DataBackendPreference;
};

export type GroovinLogDataRepository = {
  backend: DataBackend;
  resolution: DataBackendResolution;
  readClassReviews: () => Promise<ClassReview[]>;
  readPracticeTasks: () => Promise<PracticeTask[]>;
  readStandaloneTasks: () => Promise<PracticeTask[]>;
  readPracticeLogs: () => Promise<PracticeLog[]>;
  readWeeklyReflections: () => Promise<WeeklyReflection[]>;
  readPreferences: () => Promise<AppPreferences>;
  findClassReview: (id: string) => Promise<ClassReview | undefined>;
  findPracticeTask: (id: string) => Promise<PracticeTask | undefined>;
  saveClassReview: (review: ClassReview) => Promise<void>;
  saveStandaloneTask: (task: PracticeTask) => Promise<void>;
  appendPracticeTasksToClassReview: (reviewId: string, tasks: PracticeTask[]) => Promise<ClassReview | undefined>;
  updatePracticeTask: (taskId: string, patch: Partial<PracticeTask>) => Promise<void>;
  savePracticeLog: (log: PracticeLog) => Promise<void>;
  saveWeeklyReflection: (reflection: WeeklyReflection) => Promise<void>;
  savePreferences: (preferences: Partial<AppPreferences>) => Promise<AppPreferences>;
};

function localClassReviewById(id: string) {
  return readClassReviews().find(review => review.id === id);
}

function createLocalRepository(resolution: DataBackendResolution): GroovinLogDataRepository {
  return {
    backend:"local",
    resolution,
    readClassReviews:async () => readClassReviews(),
    readPracticeTasks:async () => readPracticeTasks(),
    readStandaloneTasks:async () => readStandaloneTasks(),
    readPracticeLogs:async () => readPracticeLogs(),
    readWeeklyReflections:async () => readWeeklyReflections(),
    readPreferences:async () => readPreferences(),
    findClassReview:async id => localClassReviewById(id),
    findPracticeTask:async id => findPracticeTask(id),
    saveClassReview:async review => saveClassReview(review),
    saveStandaloneTask:async task => saveStandaloneTask(task),
    appendPracticeTasksToClassReview:async (reviewId, tasks) => appendPracticeTasksToClassReview(reviewId, tasks),
    updatePracticeTask:async (taskId, patch) => updatePracticeTask(taskId, patch),
    savePracticeLog:async log => savePracticeLog(log),
    saveWeeklyReflection:async reflection => saveWeeklyReflection(reflection),
    savePreferences:async preferences => savePreferences(preferences),
  };
}

function createCloudRepository(resolution: DataBackendResolution): GroovinLogDataRepository {
  return {
    backend:"cloud",
    resolution,
    readClassReviews:readClassReviewsCloud,
    readPracticeTasks:readPracticeTasksCloud,
    readStandaloneTasks:async () => (await readPracticeTasksCloud()).filter(task => task.classReviewId === null),
    readPracticeLogs:readPracticeLogsCloud,
    readWeeklyReflections:readWeeklyReflectionsCloud,
    readPreferences:readPreferencesCloud,
    findClassReview:findClassReviewCloud,
    findPracticeTask:findPracticeTaskCloud,
    saveClassReview:saveClassReviewCloud,
    saveStandaloneTask:saveStandaloneTaskCloud,
    appendPracticeTasksToClassReview:appendPracticeTasksToClassReviewCloud,
    updatePracticeTask:updatePracticeTaskCloud,
    savePracticeLog:savePracticeLogCloud,
    saveWeeklyReflection:saveWeeklyReflectionCloud,
    savePreferences:savePreferencesCloud,
  };
}

export async function resolveDataBackend(options: DataRepositoryOptions = {}): Promise<DataBackendResolution> {
  const requested = options.backend ?? "auto";
  if (requested === "local") {
    return {
      requested,
      selected:"local",
      cloud:{ authenticated:false, eligible:false, reason:"migration-not-found", migration:null },
      fallbackReason:null,
    };
  }

  const cloud = await readCloudMigrationEligibility();
  const selected: DataBackend = cloud.eligible ? "cloud" : "local";
  return {
    requested,
    selected,
    cloud,
    fallbackReason:selected === "local" ? cloud.reason : null,
  };
}

export async function getDataRepository(options: DataRepositoryOptions = {}): Promise<GroovinLogDataRepository> {
  const resolution = await resolveDataBackend(options);
  return resolution.selected === "cloud" ? createCloudRepository(resolution) : createLocalRepository(resolution);
}
