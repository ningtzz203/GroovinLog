"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AppShell, EmptyState, Header, SectionTitle } from "../components";
import { Icon } from "../icons";
import { AIWeeklyInsight, AIWeeklyInsightInput } from "../lib/ai-weekly-insight";
import { FOCUS_TAGS, logDurationMinutes, PracticeLog, PracticeTask, taskDurationMinutes, WeeklyReflection } from "../lib/models";
import {
  addDays,
  buildMonthlyActivity,
  buildMonthlyTrend,
  buildReviewStats,
  dateKey,
  monthRange,
  ReviewStats,
  weekRange,
  yearRange,
} from "../lib/review-stats";
import {
  readClassReviews,
  readPracticeLogs,
  readPracticeTasks,
  readWeeklyReflections,
  saveWeeklyReflection,
} from "../lib/storage";

type ReviewMode = "week" | "month" | "year";
const FOCUS_COLORS = ["#d9f570", "#ff765f", "#79b8e8", "#f7c65a", "#b7a8ff", "#8de0c0"];

function barWidth(value: number, max: number) {
  return `${Math.max(value > 0 ? 8 : 0, Math.round(value / Math.max(1, max) * 100))}%`;
}

function modeTitle(mode: ReviewMode, offset: number) {
  if (mode === "week") return offset === 0 ? "这一周的舞动" : "那一周的舞动";
  if (mode === "month") return offset === 0 ? "这个月记录了什么" : "那个月记录了什么";
  return offset === 0 ? "这一年的练习轨迹" : "那一年的练习轨迹";
}

function modeFocusTitle(mode: ReviewMode) {
  if (mode === "week") return "本周 Focus";
  if (mode === "month") return "本月 Focus";
  return "全年 Focus";
}

function hasActivity(summary: ReviewStats) {
  return summary.classes.length > 0 || summary.logs.length > 0 || summary.tasks.length > 0;
}

function FocusPanel({ summary }: { summary: ReviewStats }) {
  const maxFocusMinutes = Math.max(1, ...summary.focus.map(item => item.minutes));
  const totalFocusMinutes = summary.focus.reduce((total, item) => total + item.minutes, 0);
  const pieItems = useMemo(() => {
    const top = summary.focus.slice(0, 5);
    const otherMinutes = summary.focus.slice(5).reduce((total, item) => total + item.minutes, 0);
    return otherMinutes > 0 ? [...top, { name:"其他", minutes:otherMinutes, sessions:0 }] : top;
  }, [summary.focus]);
  const pieBackground = useMemo(() => {
    if (!pieItems.length || totalFocusMinutes <= 0) return "#e8e7e0";
    let cursor = 0;
    const parts = pieItems.map((item, index) => {
      const start = cursor;
      cursor += item.minutes / totalFocusMinutes * 100;
      return `${FOCUS_COLORS[index % FOCUS_COLORS.length]} ${start}% ${cursor}%`;
    });
    return `conic-gradient(${parts.join(", ")})`;
  }, [pieItems, totalFocusMinutes]);

  if (!summary.focus.length) return <div className="no-reference">记录一次练习后，这里会显示注意力分布。</div>;
  return <div className="weekly-focus-panel">
    <div className="focus-pie-wrap">
      <div className="focus-pie" style={{ background:pieBackground }}><span>{Math.round(totalFocusMinutes)}<small>分钟</small></span></div>
      <div className="focus-pie-legend">{pieItems.map((item, index) => <div key={item.name}><i style={{ background:FOCUS_COLORS[index % FOCUS_COLORS.length] }} /><span>{item.name}</span><em>{Math.round(item.minutes / totalFocusMinutes * 100)}%</em></div>)}</div>
    </div>
    <div className="focus-bars compact">{summary.focus.slice(0, 5).map(item => <div key={item.name}><span>{item.name}</span><i><b style={{ width:barWidth(item.minutes, maxFocusMinutes) }} /></i><em>{Math.round(item.minutes)}分</em></div>)}</div>
  </div>;
}

function DistributionBars({ items, emptyText }: { items: { name: string; count: number }[]; emptyText: string }) {
  const max = Math.max(1, ...items.map(item => item.count));
  if (!items.length) return <div className="no-reference">{emptyText}</div>;
  return <div className="review-distribution-bars">{items.slice(0, 6).map(item => <div key={item.name}><span>{item.name}</span><i><b style={{ width:barWidth(item.count, max) }} /></i><em>{item.count}</em></div>)}</div>;
}

function TrendBars({ items, showClasses = false }: { items: { label: string; sessions: number; minutes: number; classes?: number }[]; showClasses?: boolean }) {
  const max = Math.max(1, ...items.map(item => item.minutes));
  return <div className="review-trend-bars">{items.map(item => <div key={item.label}><span>{item.label}</span><i><b style={{ width:barWidth(item.minutes, max) }} /></i><em>{item.minutes}分 · {item.sessions}练{showClasses ? ` · ${item.classes ?? 0}课` : ""}</em></div>)}</div>;
}

export default function WeeklyReviewPage() {
  const [reviewMode, setReviewMode] = useState<ReviewMode>("week");
  const [weekOffset, setWeekOffset] = useState(0);
  const [monthOffset, setMonthOffset] = useState(0);
  const [yearOffset, setYearOffset] = useState(0);
  const [classes, setClasses] = useState<ReturnType<typeof readClassReviews>>([]);
  const [logs, setLogs] = useState<PracticeLog[]>([]);
  const [tasks, setTasks] = useState<PracticeTask[]>([]);
  const [savedReflections, setSavedReflections] = useState<WeeklyReflection[]>([]);
  const [saved, setSaved] = useState(false);
  const [insight, setInsight] = useState<AIWeeklyInsight | null>(null);
  const [insightLoading, setInsightLoading] = useState(false);
  const [insightError, setInsightError] = useState("");
  const [insightSparse, setInsightSparse] = useState(false);
  const [form, setForm] = useState({
    improved:"",
    stillStuck:"",
    nextFocusNote:"",
    nextFocusTags:[] as string[],
  });

  const range = useMemo(() => reviewMode === "week" ? weekRange(weekOffset) : reviewMode === "month" ? monthRange(monthOffset) : yearRange(yearOffset), [monthOffset, reviewMode, weekOffset, yearOffset]);
  const activeOffset = reviewMode === "week" ? weekOffset : reviewMode === "month" ? monthOffset : yearOffset;
  const summary = useMemo(() => buildReviewStats({ classes, logs, tasks, start:range.start, end:range.end }), [classes, logs, range.end, range.start, tasks]);
  const topFocus = summary.focus.slice(0, 2).map(item => item.name);
  const reflectionSaved = savedReflections.some(item => item.weekStart === range.key);
  const monthlyActivity = useMemo(() => reviewMode === "month" ? buildMonthlyActivity(range.start, logs) : [], [logs, range.start, reviewMode]);
  const yearlyTrend = useMemo(() => reviewMode === "year" ? buildMonthlyTrend(range.start.getFullYear(), classes, logs) : [], [classes, logs, range.start, reviewMode]);
  const yearTotalClasses = yearlyTrend.reduce((total, item) => total + item.classes, 0);
  const taskStatusItems = summary.taskStatus.length ? summary.taskStatus : [
    { name:"进行中", count:summary.activeTasks.length },
    { name:"练习中", count:summary.practicingTasks.length },
    { name:"暂停", count:summary.pausedTasks.length },
    { name:"已消化", count:summary.digestedTasks.length },
  ].filter(item => item.count > 0);

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
    if (reviewMode !== "week") return;
    const reflection = savedReflections.find(item => item.weekStart === range.key);
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
  }, [range.key, reviewMode, savedReflections]);

  useEffect(() => {
    setInsight(null);
    setInsightError("");
    setInsightSparse(false);
    setInsightLoading(false);
  }, [range.key, reviewMode]);

  function changeRange(delta: number) {
    if (reviewMode === "week") setWeekOffset(value => Math.min(0, value + delta));
    if (reviewMode === "month") setMonthOffset(value => Math.min(0, value + delta));
    if (reviewMode === "year") setYearOffset(value => Math.min(0, value + delta));
  }

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
      id:savedReflections.find(item => item.weekStart === range.key)?.id ?? crypto.randomUUID(),
      weekStart:range.key,
      improved:form.improved.trim(),
      stillStuck:form.stillStuck.trim(),
      nextFocusNote:form.nextFocusNote.trim(),
      nextFocusTags:form.nextFocusTags,
      updatedAt:new Date().toISOString(),
    };
    saveWeeklyReflection(reflection);
    setSaved(true);
  }

  function buildWeeklyInsightInput(): AIWeeklyInsightInput {
    const logsByTaskId = new Map<string, PracticeLog[]>();
    summary.logs.forEach(log => logsByTaskId.set(log.taskId, [...(logsByTaskId.get(log.taskId) ?? []), log]));
    const taskMap = new Map<string, PracticeTask>();
    summary.tasks.forEach(task => taskMap.set(task.id, task));
    summary.logs.forEach(log => {
      const task = tasks.find(item => item.id === log.taskId);
      if (task) taskMap.set(task.id, task);
    });
    const taskInput = Array.from(taskMap.values()).slice(0, 20).map(task => {
      const taskLogs = logsByTaskId.get(task.id) ?? [];
      return {
        id:task.id,
        classReviewId:task.classReviewId,
        title:task.title,
        keyPoints:task.keyPoints,
        focusTags:task.focusTags,
        isHighPriority:task.isHighPriority,
        durationMinutes:taskDurationMinutes(task),
        status:task.status,
        createdAt:task.createdAt,
        hasPracticeLog:taskLogs.length > 0,
        practiceLogCount:taskLogs.length,
        totalPracticeMinutes:taskLogs.reduce((total, log) => total + logDurationMinutes(log), 0),
      };
    });
    const totalFocusMinutes = summary.focus.reduce((total, item) => total + item.minutes, 0);
    const sparseData = summary.logs.length < 2 || (summary.classes.length + summary.tasks.length + summary.logs.length) < 3;
    return {
      week:{ start:dateKey(range.start), end:dateKey(addDays(range.end, -1)), label:range.label },
      stats:{
        classCount:summary.classes.length,
        practiceLogCount:summary.logs.length,
        practiceMinutes:summary.minutes,
        taskCount:summary.tasks.length,
        digestedTaskCount:summary.digestedTasks.length,
        unpracticedTaskCount:summary.unpracticedTasks.length,
        sparseData,
      },
      focusDistribution:summary.focus.slice(0, 8).map(item => ({
        name:item.name,
        minutes:Math.round(item.minutes),
        sessions:item.sessions,
        percentage:totalFocusMinutes > 0 ? Math.round(item.minutes / totalFocusMinutes * 100) : 0,
      })),
      classes:summary.classes.slice(0, 10).map(item => ({
        id:item.id,
        date:item.date,
        danceStyle:item.danceStyle,
        classTheme:item.classTheme,
        whatILearned:item.whatILearned,
        notDigested:item.notDigested,
      })),
      tasks:taskInput,
      practiceLogs:summary.logs.slice(0, 30).map(log => ({
        id:log.id,
        taskId:log.taskId,
        classId:log.classId,
        date:log.date,
        durationMinutes:logDurationMinutes(log),
        practiceContent:log.practiceContent,
        progressScore:log.progressScore,
        nextFocus:log.nextFocus,
      })),
    };
  }

  async function generateWeeklyInsight() {
    if (reviewMode !== "week") return;
    if (!hasActivity(summary) || insightLoading) {
      if (!hasActivity(summary)) setInsightError("这一周还没有足够记录，先记录一节课或一次练习后再生成 Insight。");
      return;
    }
    setInsightLoading(true);
    setInsightError("");
    try {
      const input = buildWeeklyInsightInput();
      const response = await fetch("/api/ai/weekly-insight", {
        method:"POST",
        headers:{ "Content-Type":"application/json" },
        body:JSON.stringify(input),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error ?? "AI Insight 生成失败，请稍后重试。");
      setInsight(payload.insight ?? null);
      setInsightSparse(Boolean(payload.sparseData ?? input.stats.sparseData));
    } catch (error) {
      setInsight(null);
      setInsightError(error instanceof Error ? error.message : "AI Insight 生成失败，请稍后重试。");
    } finally {
      setInsightLoading(false);
    }
  }

  return <AppShell active="/weekly-review"><div className="page weekly-review-page">
    <Header eyebrow={range.label} title={modeTitle(reviewMode, activeOffset)} action={<div className="week-nav"><button type="button" onClick={() => changeRange(-1)} aria-label="上一个时间段">←</button><button type="button" disabled={activeOffset === 0} onClick={() => changeRange(1)} aria-label="下一个时间段">→</button></div>} />

    <div className="review-mode-toggle" role="group" aria-label="复盘时间维度">
      {(["week", "month", "year"] as ReviewMode[]).map(mode => <button type="button" key={mode} className={reviewMode === mode ? "selected" : ""} onClick={() => setReviewMode(mode)}>{mode === "week" ? "Week" : mode === "month" ? "Month" : "Year"}</button>)}
    </div>

    <section className="week-lead"><span><Icon name="spark" /></span><h2>{summary.logs.length ? "记录里有真实的练习轨迹。" : summary.classes.length ? "课堂已经留下线索。" : "这段时间还很安静。"}</h2><p>{summary.logs.length
      ? `你记录了 ${summary.classes.length} 节课，完成 ${summary.logs.length} 次练习，共 ${summary.minutes} 分钟。${topFocus.length ? `主要关注了 ${topFocus.join(" 和 ")}。` : ""}`
      : summary.classes.length
        ? `你记录了 ${summary.classes.length} 节课。等有练习记录后，这里会显示 Focus 和训练量。`
        : "这里只展示你真实记录过的数据，不代表能力评分或进步指数。"}</p></section>

    <div className="review-stats"><div><strong>{summary.classes.length}</strong><span>课程</span></div><div><strong>{summary.logs.length}</strong><span>练习次数</span></div><div><strong>{summary.minutes}</strong><span>分钟</span></div><div><strong>{summary.digestedTasks.length}</strong><span>已消化任务</span></div></div>
    <div className="weekly-conversion"><Icon name="practice" /><div><strong>{reviewMode === "week" ? "本周" : reviewMode === "month" ? "本月" : "全年"}创建了 {summary.tasks.length} 个任务</strong><span>{summary.tasks.length ? `完成率 ${summary.completionRate}%。${summary.unpracticedTasks.length ? `还有 ${summary.unpracticedTasks.length} 个课程任务尚未练习。` : "有记录的任务转化情况不错。"}` : "只统计这段时间真实创建的任务。"}</span></div></div>

    {!hasActivity(summary) && <EmptyState icon="review" title="当前时间范围暂无足够记录" text="课程、练习记录和 Focus 分布会在这里自动汇总。" />}

    <section><SectionTitle>{modeFocusTitle(reviewMode)}</SectionTitle><FocusPanel summary={summary} /></section>

    <section><SectionTitle>Dance Style 分布</SectionTitle><DistributionBars items={summary.danceStyles} emptyText="这个时间范围内还没有课程舞种记录。" /></section>

    <section><SectionTitle>任务状态</SectionTitle><DistributionBars items={taskStatusItems} emptyText="这个时间范围内还没有创建练习任务。" /></section>

    {reviewMode === "month" && <section><SectionTitle>本月练习活跃度</SectionTitle><TrendBars items={monthlyActivity} /></section>}
    {reviewMode === "year" && <section><SectionTitle>月度训练趋势</SectionTitle><div className="year-trend-summary"><div><strong>{yearTotalClasses}</strong><span>全年课程</span></div><div><strong>{yearlyTrend.reduce((total, item) => total + item.sessions, 0)}</strong><span>全年练习</span></div></div><TrendBars items={yearlyTrend} showClasses /></section>}

    {reviewMode === "week" && <section><SectionTitle>AI Weekly Insight</SectionTitle><div className="weekly-ai-panel"><div className="weekly-ai-head"><Icon name="spark" /><div><strong>AI 辅助观察</strong><p>只基于这一周已记录的数据，不代表能力评价，也不会自动修改任务。</p></div></div>{!hasActivity(summary) ? <div className="no-reference">这一周还没有足够记录，先记录一节课或一次练习后再生成 Insight。</div> : <><button type="button" className="secondary-button weekly-ai-button" disabled={insightLoading} onClick={generateWeeklyInsight}>{insightLoading ? "生成中…" : insight ? "重新生成 Insight" : "Generate Weekly Insight"}</button>{insightSparse && <p className="weekly-ai-note">本周记录较少，Insight 只能基于现有数据提供有限观察。</p>}{insightError && <p className="form-error" role="alert">{insightError}</p>}{insight && <div className="weekly-ai-result"><p>{insight.summary}</p>{insight.patterns.length > 0 && <div><small>记录中看到的模式</small><ul>{insight.patterns.map(item => <li key={item}>{item}</li>)}</ul></div>}{insight.gaps.length > 0 && <div><small>可能的转化缺口</small><ul>{insight.gaps.map(item => <li key={item}>{item}</li>)}</ul></div>}{insight.nextWeekSuggestions.length > 0 && <div><small>下周可以轻轻关注</small><ul>{insight.nextWeekSuggestions.map(item => <li key={item}>{item}</li>)}</ul></div>}</div>}</>}</div></section>}

    {reviewMode === "week" && <section><SectionTitle>尚未练习</SectionTitle>{summary.unpracticedTasks.length ? <div className="weekly-unpracticed">{summary.unpracticedTasks.slice(0, 4).map(task => <Link href={`/practice/${task.id}/log`} key={task.id}><div><small>{task.isHighPriority ? "高优先级" : "本周创建"}</small><strong>{task.title}</strong><span>{task.focusTags.join(" · ")}</span></div><Icon name="arrow" /></Link>)}</div> : <div className="no-reference">{summary.tasks.length ? "本周创建的任务都已经有练习记录。" : "本周没有创建新的练习任务。"}</div>}</section>}

    {reviewMode === "week" && <section><SectionTitle>轻轻复盘一下</SectionTitle><form className="weekly-reflection-form real-form" onSubmit={saveReflection}>
      <label><span>01 · 这周有什么进步？ <small>选填</small></span><textarea rows={3} placeholder="一点小变化也值得记录" value={form.improved} onChange={event => { setSaved(false); setForm(current => ({ ...current, improved:event.target.value })); }} /></label>
      <label><span>02 · 还有什么卡住？ <small>选填</small></span><textarea rows={3} placeholder="只需要看见它，不必评判" value={form.stillStuck} onChange={event => { setSaved(false); setForm(current => ({ ...current, stillStuck:event.target.value })); }} /></label>
      <fieldset><legend>03 · 下周的 Focus <small>选填</small></legend><div className="tag-picker">{FOCUS_TAGS.map(focus => <button type="button" key={focus} className={form.nextFocusTags.includes(focus) ? "selected" : ""} onClick={() => toggleFocus(focus)}>{focus}</button>)}</div></fieldset>
      <label><span>写给下周的一句话 <small>选填</small></span><textarea rows={3} placeholder="下一次开始练习时，你想提醒自己什么？" value={form.nextFocusNote} onChange={event => { setSaved(false); setForm(current => ({ ...current, nextFocusNote:event.target.value })); }} /></label>
      {saved && <p className="weekly-saved" role="status">✓ 本周复盘已保存到此设备。</p>}
      <button className="primary-button enabled" type="submit">{reflectionSaved ? "更新本周复盘" : "保存本周复盘"} <Icon name="arrow" /></button>
    </form></section>}
  </div></AppShell>;
}
