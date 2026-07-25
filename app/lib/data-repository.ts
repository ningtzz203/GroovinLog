"use client";

import type { AppPreferences, ClassReview, PracticeLog, PracticeTask, WeeklyReflection } from "./models";
import {
  clearAllUserData,
  appendPracticeTasksToClassReview,
  deleteClassReview,
  deletePracticeLog,
  deletePracticeTask,
  deleteWeeklyReflection,
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
  updateClassReview,
  updatePracticeLog,
  updatePracticeTask,
} from "./storage";
import {
  appendPracticeTasksToClassReviewCloud,
  clearAllUserDataCloud,
  deleteClassReviewCloud,
  deletePracticeLogCloud,
  deletePracticeTaskCloud,
  deleteWeeklyReflectionCloud,
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
  updateClassReviewCloud,
  updatePracticeLogCloud,
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
  updateClassReview: (reviewId: string, patch: Partial<Omit<ClassReview, "id" | "tasks" | "createdAt">>) => Promise<void>;
  deleteClassReview: (reviewId: string) => Promise<void>;
  saveStandaloneTask: (task: PracticeTask) => Promise<void>;
  appendPracticeTasksToClassReview: (reviewId: string, tasks: PracticeTask[]) => Promise<ClassReview | undefined>;
  updatePracticeTask: (taskId: string, patch: Partial<PracticeTask>) => Promise<void>;
  deletePracticeTask: (taskId: string) => Promise<void>;
  savePracticeLog: (log: PracticeLog) => Promise<void>;
  updatePracticeLog: (logId: string, patch: Partial<Omit<PracticeLog, "id" | "taskId" | "classId" | "createdAt">>) => Promise<void>;
  deletePracticeLog: (logId: string) => Promise<void>;
  saveWeeklyReflection: (reflection: WeeklyReflection) => Promise<void>;
  deleteWeeklyReflection: (reflectionId: string) => Promise<void>;
  savePreferences: (preferences: Partial<AppPreferences>) => Promise<AppPreferences>;
  clearAllUserData: () => Promise<void>;
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
    updateClassReview:async (reviewId, patch) => updateClassReview(reviewId, patch),
    deleteClassReview:async reviewId => deleteClassReview(reviewId),
    saveStandaloneTask:async task => saveStandaloneTask(task),
    appendPracticeTasksToClassReview:async (reviewId, tasks) => appendPracticeTasksToClassReview(reviewId, tasks),
    updatePracticeTask:async (taskId, patch) => updatePracticeTask(taskId, patch),
    deletePracticeTask:async taskId => deletePracticeTask(taskId),
    savePracticeLog:async log => savePracticeLog(log),
    updatePracticeLog:async (logId, patch) => updatePracticeLog(logId, patch),
    deletePracticeLog:async logId => deletePracticeLog(logId),
    saveWeeklyReflection:async reflection => saveWeeklyReflection(reflection),
    deleteWeeklyReflection:async reflectionId => deleteWeeklyReflection(reflectionId),
    savePreferences:async preferences => savePreferences(preferences),
    clearAllUserData:async () => clearAllUserData(),
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
    updateClassReview:updateClassReviewCloud,
    deleteClassReview:deleteClassReviewCloud,
    saveStandaloneTask:saveStandaloneTaskCloud,
    appendPracticeTasksToClassReview:appendPracticeTasksToClassReviewCloud,
    updatePracticeTask:updatePracticeTaskCloud,
    deletePracticeTask:deletePracticeTaskCloud,
    savePracticeLog:savePracticeLogCloud,
    updatePracticeLog:updatePracticeLogCloud,
    deletePracticeLog:deletePracticeLogCloud,
    saveWeeklyReflection:saveWeeklyReflectionCloud,
    deleteWeeklyReflection:deleteWeeklyReflectionCloud,
    savePreferences:savePreferencesCloud,
    clearAllUserData:clearAllUserDataCloud,
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
