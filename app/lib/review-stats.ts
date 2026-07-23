import { ClassReview, logDurationMinutes, PracticeLog, PracticeTask } from "./models";

export type ReviewRange = {
  start: Date;
  end: Date;
  key: string;
  label: string;
};

export type ReviewSummaryItem = {
  name: string;
  count: number;
  minutes?: number;
  sessions?: number;
};

export type ReviewStats = {
  classes: ClassReview[];
  logs: PracticeLog[];
  tasks: PracticeTask[];
  digestedTasks: PracticeTask[];
  activeTasks: PracticeTask[];
  pausedTasks: PracticeTask[];
  practicingTasks: PracticeTask[];
  unpracticedTasks: PracticeTask[];
  minutes: number;
  completionRate: number;
  focus: { name: string; minutes: number; sessions: number }[];
  danceStyles: ReviewSummaryItem[];
  taskStatus: ReviewSummaryItem[];
};

export type MonthlyTrendItem = {
  month: number;
  label: string;
  classes: number;
  sessions: number;
  minutes: number;
};

export function dateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function localDate(value: string) {
  return new Date(`${value.slice(0, 10)}T12:00:00`);
}

function startOfDay(date: Date) {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

export function startOfWeek(date: Date) {
  const result = startOfDay(date);
  const weekday = result.getDay();
  result.setDate(result.getDate() - (weekday === 0 ? 6 : weekday - 1));
  return result;
}

export function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function startOfYear(date: Date) {
  return new Date(date.getFullYear(), 0, 1);
}

export function addDays(date: Date, days: number) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

export function addMonths(date: Date, months: number) {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

export function addYears(date: Date, years: number) {
  return new Date(date.getFullYear() + years, 0, 1);
}

export function inDateRange(value: string, start: Date, end: Date) {
  const date = localDate(value);
  return date >= start && date < end;
}

export function weekRange(offset = 0): ReviewRange {
  const start = startOfWeek(new Date());
  start.setDate(start.getDate() + offset * 7);
  const end = addDays(start, 7);
  return {
    start,
    end,
    key:dateKey(start),
    label:`${start.toLocaleDateString("zh-CN", { month:"short", day:"numeric" })} — ${addDays(end, -1).toLocaleDateString("zh-CN", {
      month:start.getMonth() === addDays(end, -1).getMonth() ? undefined : "short",
      day:"numeric",
      year:start.getFullYear() === addDays(end, -1).getFullYear() ? undefined : "numeric",
    })}`,
  };
}

export function monthRange(offset = 0): ReviewRange {
  const start = addMonths(startOfMonth(new Date()), offset);
  const end = addMonths(start, 1);
  return {
    start,
    end,
    key:`${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}`,
    label:start.toLocaleDateString("zh-CN", { year:"numeric", month:"long" }),
  };
}

export function yearRange(offset = 0): ReviewRange {
  const start = addYears(startOfYear(new Date()), offset);
  const end = addYears(start, 1);
  return {
    start,
    end,
    key:String(start.getFullYear()),
    label:String(start.getFullYear()),
  };
}

function statusLabel(status: PracticeTask["status"]) {
  if (["done", "digested", "completed"].includes(status)) return "已消化";
  if (status === "practicing") return "练习中";
  if (status === "paused") return "暂停";
  return "进行中";
}

export function buildReviewStats({ classes, tasks, logs, start, end }: { classes: ClassReview[]; tasks: PracticeTask[]; logs: PracticeLog[]; start: Date; end: Date }): ReviewStats {
  const rangeClasses = classes.filter(item => inDateRange(item.date, start, end));
  const rangeLogs = logs.filter(item => inDateRange(item.date, start, end));
  const rangeTasks = tasks.filter(item => {
    const created = item.createdAt ? new Date(item.createdAt) : null;
    return Boolean(created && created >= start && created < end);
  });
  const digestedTasks = rangeTasks.filter(item => ["done", "digested", "completed"].includes(item.status));
  const activeTasks = rangeTasks.filter(item => item.status === "active");
  const pausedTasks = rangeTasks.filter(item => item.status === "paused");
  const practicingTasks = rangeTasks.filter(item => item.status === "practicing");
  const practicedTaskIds = new Set(rangeLogs.map(log => log.taskId));
  const unpracticedTasks = rangeTasks.filter(task => task.classReviewId && !practicedTaskIds.has(task.id));
  const tasksById = new Map(tasks.map(task => [task.id, task]));
  const focusMap = new Map<string, { name: string; minutes: number; sessions: number }>();

  rangeLogs.forEach(log => {
    const task = tasksById.get(log.taskId);
    const focusTags = task?.focusTags.length ? task.focusTags : ["其他"];
    const minutes = logDurationMinutes(log);
    const minutesPerFocus = minutes / focusTags.length;
    focusTags.forEach(name => {
      const current = focusMap.get(name) ?? { name, minutes:0, sessions:0 };
      focusMap.set(name, { name, minutes:current.minutes + minutesPerFocus, sessions:current.sessions + 1 });
    });
  });

  const danceStyleMap = new Map<string, number>();
  rangeClasses.forEach(item => {
    const name = item.danceStyle.trim() || "未标注";
    danceStyleMap.set(name, (danceStyleMap.get(name) ?? 0) + 1);
  });

  const statusMap = new Map<string, number>();
  rangeTasks.forEach(task => {
    const name = statusLabel(task.status);
    statusMap.set(name, (statusMap.get(name) ?? 0) + 1);
  });

  return {
    classes:rangeClasses,
    logs:rangeLogs,
    tasks:rangeTasks,
    digestedTasks,
    activeTasks,
    pausedTasks,
    practicingTasks,
    unpracticedTasks,
    minutes:rangeLogs.reduce((total, log) => total + logDurationMinutes(log), 0),
    completionRate:rangeTasks.length ? Math.round(digestedTasks.length / rangeTasks.length * 100) : 0,
    focus:Array.from(focusMap.values()).sort((a, b) => b.minutes - a.minutes || b.sessions - a.sessions),
    danceStyles:Array.from(danceStyleMap.entries()).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count),
    taskStatus:Array.from(statusMap.entries()).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count),
  };
}

export function buildMonthlyTrend(year: number, classes: ClassReview[], logs: PracticeLog[]): MonthlyTrendItem[] {
  return Array.from({ length:12 }, (_, month) => {
    const start = new Date(year, month, 1);
    const end = new Date(year, month + 1, 1);
    const monthClasses = classes.filter(item => inDateRange(item.date, start, end));
    const monthLogs = logs.filter(item => inDateRange(item.date, start, end));
    return {
      month,
      label:new Date(year, month, 1).toLocaleDateString("en-US", { month:"short" }),
      classes:monthClasses.length,
      sessions:monthLogs.length,
      minutes:monthLogs.reduce((total, log) => total + logDurationMinutes(log), 0),
    };
  });
}

export function buildMonthlyActivity(start: Date, logs: PracticeLog[]) {
  const month = start.getMonth();
  const year = start.getFullYear();
  const weeks: MonthlyTrendItem[] = [];
  let cursor = new Date(year, month, 1);
  let index = 1;
  while (cursor.getMonth() === month) {
    const end = new Date(cursor);
    end.setDate(end.getDate() + 7);
    const cappedEnd = end.getMonth() === month ? end : new Date(year, month + 1, 1);
    const weekLogs = logs.filter(item => inDateRange(item.date, cursor, cappedEnd));
    weeks.push({
      month:index - 1,
      label:`W${index}`,
      classes:0,
      sessions:weekLogs.length,
      minutes:weekLogs.reduce((total, log) => total + logDurationMinutes(log), 0),
    });
    cursor = cappedEnd;
    index += 1;
  }
  return weeks;
}
