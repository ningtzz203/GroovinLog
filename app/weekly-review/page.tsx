"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AppShell, EmptyState, Header, SectionTitle } from "../components";
import { Icon } from "../icons";
import { FOCUS_TAGS, logDurationMinutes, PracticeLog, PracticeTask, WeeklyReflection } from "../lib/models";
import {
  readClassReviews,
  readPracticeLogs,
  readPracticeTasks,
  readWeeklyReflections,
  saveWeeklyReflection,
} from "../lib/storage";

function dateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function startOfWeek(date: Date) {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  const weekday = result.getDay();
  result.setDate(result.getDate() - (weekday === 0 ? 6 : weekday - 1));
  return result;
}

function endOfWeek(start: Date) {
  const result = new Date(start);
  result.setDate(result.getDate() + 6);
  result.setHours(23, 59, 59, 999);
  return result;
}

function inWeek(date: string, start: Date, end: Date) {
  const value = new Date(`${date}T12:00:00`);
  return value >= start && value <= end;
}

function weekLabel(start: Date, end: Date) {
  const startText = start.toLocaleDateString("zh-CN", { month:"short", day:"numeric" });
  const endText = end.toLocaleDateString("zh-CN", {
    month: start.getMonth() === end.getMonth() ? undefined : "short",
    day:"numeric",
    year: start.getFullYear() === end.getFullYear() ? undefined : "numeric",
  });
  return `${startText} — ${endText}`;
}

type FocusSummary = { name: string; minutes: number; sessions: number };

export default function WeeklyReviewPage() {
  const [weekOffset, setWeekOffset] = useState(0);
  const [classes, setClasses] = useState<ReturnType<typeof readClassReviews>>([]);
  const [logs, setLogs] = useState<PracticeLog[]>([]);
  const [tasks, setTasks] = useState<PracticeTask[]>([]);
  const [savedReflections, setSavedReflections] = useState<WeeklyReflection[]>([]);
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState({
    improved:"",
    stillStuck:"",
    nextFocusNote:"",
    nextFocusTags:[] as string[],
  });

  const week = useMemo(() => {
    const start = startOfWeek(new Date());
    start.setDate(start.getDate() + weekOffset * 7);
    return { start, end:endOfWeek(start), key:dateKey(start) };
  }, [weekOffset]);

  useEffect(() => {
    const load = () => {
      setClasses(readClassReviews());
      setLogs(readPracticeLogs());
      setTasks(readPracticeTasks());
      setSavedReflections(readWeeklyReflections());
    };
    const timer = window.setTimeout(load, 0);
    window.addEventListener("groovinlog:updated", load);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("groovinlog:updated", load);
    };
  }, []);

  useEffect(() => {
    const reflection = savedReflections.find(item => item.weekStart === week.key);
    const timer = window.setTimeout(() => {
      setForm(reflection ? {
        improved:reflection.improved,
        stillStuck:reflection.stillStuck,
        nextFocusNote:reflection.nextFocusNote,
        nextFocusTags:reflection.nextFocusTags,
      } : { improved:"", stillStuck:"", nextFocusNote:"", nextFocusTags:[] });
      setSaved(false);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [savedReflections, week.key]);

  const summary = useMemo(() => {
    const weekClasses = classes.filter(item => inWeek(item.date, week.start, week.end));
    const weekLogs = logs.filter(item => inWeek(item.date, week.start, week.end));
    const weekTasks = tasks.filter(item => {
      const created = item.createdAt ? new Date(item.createdAt) : null;
      return created && created >= week.start && created <= week.end;
    });
    const digestedTasks = weekTasks.filter(item => ["done","digested","completed"].includes(item.status));
    const practicedTaskIds = new Set(weekLogs.map(log => log.taskId));
    const unpracticedTasks = weekTasks.filter(task => task.classReviewId && !practicedTaskIds.has(task.id));
    const tasksById = new Map(tasks.map(task => [task.id, task]));
    const focusMap = new Map<string, FocusSummary>();

    weekLogs.forEach(log => {
      const task = tasksById.get(log.taskId);
      const focusTags = task?.focusTags.length ? task.focusTags : ["其他"];
      const minutes = logDurationMinutes(log);
      const minutesPerFocus = minutes / focusTags.length;
      focusTags.forEach(name => {
        const current = focusMap.get(name) ?? { name, minutes:0, sessions:0 };
        focusMap.set(name, {
          name,
          minutes:current.minutes + minutesPerFocus,
          sessions:current.sessions + 1,
        });
      });
    });

    return {
      classes:weekClasses,
      logs:weekLogs,
      tasks:weekTasks,
      digestedTasks,
      unpracticedTasks,
      minutes:weekLogs.reduce((total, log) => total + logDurationMinutes(log), 0),
      focus:Array.from(focusMap.values()).sort((a,b) => b.minutes - a.minutes || b.sessions - a.sessions),
    };
  }, [classes, logs, tasks, week]);

  const maxFocusMinutes = Math.max(1, ...summary.focus.map(item => item.minutes));
  const hasActivity = summary.classes.length > 0 || summary.logs.length > 0 || summary.tasks.length > 0;
  const topFocus = summary.focus.slice(0, 2).map(item => item.name);
  const reflectionSaved = savedReflections.some(item => item.weekStart === week.key);

  function toggleFocus(focus: string) {
    setSaved(false);
    setForm(current => ({
      ...current,
      nextFocusTags:current.nextFocusTags.includes(focus)
        ? current.nextFocusTags.filter(item => item !== focus)
        : [...current.nextFocusTags, focus],
    }));
  }

  function saveReflection(event: FormEvent) {
    event.preventDefault();
    const reflection: WeeklyReflection = {
      id:savedReflections.find(item => item.weekStart === week.key)?.id ?? crypto.randomUUID(),
      weekStart:week.key,
      improved:form.improved.trim(),
      stillStuck:form.stillStuck.trim(),
      nextFocusNote:form.nextFocusNote.trim(),
      nextFocusTags:form.nextFocusTags,
      updatedAt:new Date().toISOString(),
    };
    saveWeeklyReflection(reflection);
    setSaved(true);
  }

  return <AppShell active="/weekly-review"><div className="page weekly-review-page">
    <Header eyebrow={weekLabel(week.start, week.end)} title={weekOffset === 0 ? "这一周的舞动" : "那一周的舞动"} action={<div className="week-nav"><button type="button" onClick={() => setWeekOffset(value => value - 1)} aria-label="上一周">←</button><button type="button" disabled={weekOffset === 0} onClick={() => setWeekOffset(value => Math.min(0, value + 1))} aria-label="下一周">→</button></div>} />

    <section className="week-lead"><span><Icon name="spark" /></span><h2>{summary.logs.length ? "这一周，你一直在练。" : summary.classes.length ? "下课只是开始。" : "从此刻开始就好。"}</h2><p>{summary.logs.length
      ? `你上了 ${summary.classes.length} 节课，完成 ${summary.logs.length} 次练习，共 ${summary.minutes} 分钟。${topFocus.length ? `主要关注了 ${topFocus.join(" 和 ")}。` : ""}`
      : summary.classes.length
        ? `你记录了 ${summary.classes.length} 节课。选一个小任务，把复盘变成练习吧。`
        : "不需要追赶任何分数。想记录课程或练习时，就从这里开始。"}</p></section>

    <div className="review-stats"><div><strong>{summary.classes.length}</strong><span>课程</span></div><div><strong>{summary.logs.length}</strong><span>练习次数</span></div><div><strong>{summary.minutes}</strong><span>分钟</span></div><div><strong>{summary.digestedTasks.length}</strong><span>已消化任务</span></div></div>
    <div className="weekly-conversion"><Icon name="practice" /><div><strong>本周创建了 {summary.tasks.length} 个任务</strong><span>{summary.unpracticedTasks.length ? `还有 ${summary.unpracticedTasks.length} 个课程任务尚未练习。` : summary.tasks.length ? "本周新建的课程任务都已经练过。" : "只创建你真正想再次练习的任务。"}</span></div></div>

    {!hasActivity && <EmptyState icon="review" title="这一周还是空白的" text="课程、练习记录和 Focus 分布会自动显示在这里。" />}

    <section><SectionTitle>本周 Focus</SectionTitle>{summary.focus.length ? <div className="focus-bars">{summary.focus.slice(0, 5).map(item => <div key={item.name}><span>{item.name}</span><i><b style={{width:`${Math.max(8, Math.round(item.minutes / maxFocusMinutes * 100))}%`}} /></i><em>{Math.round(item.minutes)}分</em></div>)}</div> : <div className="no-reference">记录一次练习后，这里会显示你的注意力分布。</div>}</section>

    <section><SectionTitle>尚未练习</SectionTitle>{summary.unpracticedTasks.length ? <div className="weekly-unpracticed">{summary.unpracticedTasks.slice(0, 4).map(task => <Link href={`/practice/${task.id}/log`} key={task.id}><div><small>{task.isHighPriority ? "高优先级" : "本周创建"}</small><strong>{task.title}</strong><span>{task.focusTags.join(" · ")}</span></div><Icon name="arrow" /></Link>)}</div> : <div className="no-reference">{summary.tasks.length ? "本周创建的任务都已经有练习记录。" : "本周没有创建新的练习任务。"}</div>}</section>

    <section><SectionTitle>轻轻复盘一下</SectionTitle><form className="weekly-reflection-form real-form" onSubmit={saveReflection}>
      <label><span>01 · 这周有什么进步？ <small>选填</small></span><textarea rows={3} placeholder="一点小变化也值得记录" value={form.improved} onChange={event => { setSaved(false); setForm(current => ({...current, improved:event.target.value})); }} /></label>
      <label><span>02 · 还有什么卡住？ <small>选填</small></span><textarea rows={3} placeholder="只需要看见它，不必评判" value={form.stillStuck} onChange={event => { setSaved(false); setForm(current => ({...current, stillStuck:event.target.value})); }} /></label>
      <fieldset><legend>03 · 下周的 Focus <small>选填</small></legend><div className="tag-picker">{FOCUS_TAGS.map(focus => <button type="button" key={focus} className={form.nextFocusTags.includes(focus) ? "selected" : ""} onClick={() => toggleFocus(focus)}>{focus}</button>)}</div></fieldset>
      <label><span>写给下周的一句话</span><textarea rows={3} placeholder="下一次开始练习时，你想提醒自己什么？" value={form.nextFocusNote} onChange={event => { setSaved(false); setForm(current => ({...current, nextFocusNote:event.target.value})); }} /></label>
      {saved && <p className="weekly-saved" role="status">✓ 本周复盘已保存到此设备。</p>}
      <button className="primary-button enabled" type="submit">{reflectionSaved ? "更新本周复盘" : "保存本周复盘"} <Icon name="arrow" /></button>
    </form></section>
  </div></AppShell>;
}
