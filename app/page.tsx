"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AppShell, EmptyState, Header, SectionTitle } from "./components";
import { Icon } from "./icons";
import { AIPracticeRecommendation, AIPracticeRecommendationInput } from "./lib/ai-practice-recommendation";
import { ClassReview, localDateKey, logDurationMinutes, PracticeLog, PracticeTask, taskDuration, taskDurationMinutes } from "./lib/models";
import { readClassReviews, readPracticeLogs, readPracticeTasks } from "./lib/storage";

function currentWeekStart() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - (date.getDay() === 0 ? 6 : date.getDay() - 1));
  return date;
}

function isThisWeek(value: string) {
  return new Date(`${value}T12:00:00`) >= currentWeekStart();
}

function isWithinLastDays(value: string, days: number) {
  const date = new Date(`${value}T12:00:00`);
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (days - 1));
  return date >= start;
}

function shortDateLabel(value: string) {
  const date = new Date(`${value}T12:00:00`);
  const today = localDateKey();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (value === today) return "今天";
  if (value === localDateKey(yesterday)) return "昨天";
  return date.toLocaleDateString("zh-CN", { weekday: "short", month: "numeric", day: "numeric" });
}

function daysSince(value: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  return Math.max(0, Math.floor((today.getTime() - date.getTime()) / 86_400_000));
}

export default function Dashboard() {
  const [loaded, setLoaded] = useState(false);
  const [classes, setClasses] = useState<ClassReview[]>([]);
  const [tasks, setTasks] = useState<PracticeTask[]>([]);
  const [logs, setLogs] = useState<PracticeLog[]>([]);
  const [aiRecommendation, setAiRecommendation] = useState<AIPracticeRecommendation | null>(null);
  const [recommendationLoading, setRecommendationLoading] = useState(false);
  const [recommendationError, setRecommendationError] = useState("");
  const [recommendationSource, setRecommendationSource] = useState<"ai" | "local" | "">("");
  const [recommendationDecision, setRecommendationDecision] = useState<"" | "accepted">("");

  useEffect(() => {
    const load = () => {
      setClasses(readClassReviews());
      setTasks(readPracticeTasks());
      setLogs(readPracticeLogs());
      setLoaded(true);
    };
    load();
    window.addEventListener("groovinlog:updated", load);
    return () => window.removeEventListener("groovinlog:updated", load);
  }, []);

  const activeTasks = useMemo(() => tasks.filter(task => !["done", "digested", "completed"].includes(task.status)), [tasks]);
  const recommended = useMemo(() => [...activeTasks].sort((a, b) => {
    const practicedA = logs.some(log => log.taskId === a.id);
    const practicedB = logs.some(log => log.taskId === b.id);
    return Number(b.isHighPriority) - Number(a.isHighPriority) || Number(practicedA) - Number(practicedB) || b.createdAt.localeCompare(a.createdAt);
  }), [activeTasks, logs]);
  const recentLogs14d = useMemo(() => logs.filter(log => isWithinLastDays(log.date, 14)), [logs]);
  const recommendationMap = useMemo(() => new Map(aiRecommendation?.recommendations.map(item => [item.taskId, item]) ?? []), [aiRecommendation]);
  const displayTasks = useMemo(() => {
    if (!aiRecommendation?.recommendations.length) return recommended;
    const priority = new Map(aiRecommendation.recommendations.map((item, index) => [item.taskId, index]));
    return [...recommended].sort((a, b) => {
      const aPriority = priority.has(a.id) ? priority.get(a.id)! : 99;
      const bPriority = priority.has(b.id) ? priority.get(b.id)! : 99;
      return aPriority - bPriority;
    });
  }, [aiRecommendation, recommended]);
  const weekClasses = classes.filter(item => isThisWeek(item.date));
  const weekLogs = logs.filter(item => isThisWeek(item.date));
  const minutes = weekLogs.reduce((sum, log) => sum + logDurationMinutes(log), 0);
  const today = new Date(`${localDateKey()}T12:00:00`).toLocaleDateString("zh-CN", { weekday:"long", month:"long", day:"numeric" });
  const recentClassGroups = useMemo(() => {
    const recent = classes
      .filter(item => isWithinLastDays(item.date, 7))
      .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
    return recent.reduce<{ date: string; items: ClassReview[] }[]>((groups, item) => {
      const group = groups.find(entry => entry.date === item.date);
      if (group) group.items.push(item);
      else groups.push({ date: item.date, items: [item] });
      return groups;
    }, []);
  }, [classes]);
  const weekFocus = useMemo(() => {
    const counts = new Map<string, number>();
    weekLogs.forEach(log => {
      const task = tasks.find(item => item.id === log.taskId);
      task?.focusTags.forEach(tag => counts.set(tag, (counts.get(tag) ?? 0) + 1));
    });
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 4);
  }, [tasks, weekLogs]);

  useEffect(() => {
    setAiRecommendation(null);
    setRecommendationError("");
    setRecommendationSource("");
    setRecommendationDecision("");
  }, [tasks, logs, classes]);

  function buildLocalRecommendation(note = "记录还比较少，我先按高优先级、是否练过和创建时间帮你排一个简单顺序。") {
    const picks = recommended.slice(0, 3).map((task, index) => ({
      taskId:task.id,
      reason:task.isHighPriority ? "这是高优先级任务，适合作为这次练习的第一选择。" : logs.some(log => log.taskId === task.id) ? "这个任务已有练习记录，可以继续巩固。" : "这个任务还没有练习记录，适合先启动一次。",
      priority:(index + 1) as 1 | 2 | 3,
    }));
    return { recommendations:picks, sessionNote:note };
  }

  function buildRecommendationInput(): AIPracticeRecommendationInput {
    const recentClasses = classes.filter(item => isWithinLastDays(item.date, 14)).sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
    const focusMap = new Map<string, { name: string; sessions: number; minutes: number }>();
    recentLogs14d.forEach(log => {
      const task = tasks.find(item => item.id === log.taskId);
      const focusTags = task?.focusTags.length ? task.focusTags : ["其他"];
      const minutes = logDurationMinutes(log);
      focusTags.forEach(name => {
        const current = focusMap.get(name) ?? { name, sessions:0, minutes:0 };
        focusMap.set(name, { name, sessions:current.sessions + 1, minutes:current.minutes + Math.round(minutes / focusTags.length) });
      });
    });
    return {
      generatedAt:new Date().toISOString(),
      activeTasks:recommended.slice(0, 20).map(task => {
        const taskLogs = logs.filter(log => log.taskId === task.id).sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
        const recentTaskLogs = recentLogs14d.filter(log => log.taskId === task.id);
        const latest = taskLogs[0];
        return {
          id:task.id,
          title:task.title,
          keyPoints:task.keyPoints,
          focusTags:task.focusTags,
          isHighPriority:task.isHighPriority,
          durationMinutes:taskDurationMinutes(task),
          status:task.status,
          createdAt:task.createdAt,
          classReviewId:task.classReviewId,
          lastPracticedAt:latest?.date ?? null,
          practiceLogCount14d:recentTaskLogs.length,
          totalPracticeMinutes14d:recentTaskLogs.reduce((total, log) => total + logDurationMinutes(log), 0),
          daysSinceLastPractice:latest ? daysSince(latest.date) : null,
        };
      }),
      recentPracticeLogs:recentLogs14d.slice(0, 30).map(log => ({
        taskId:log.taskId,
        date:log.date,
        durationMinutes:logDurationMinutes(log),
        practiceContent:log.practiceContent,
        progressScore:log.progressScore,
        nextFocus:log.nextFocus,
      })),
      recentClasses:recentClasses.slice(0, 8).map(item => ({
        id:item.id,
        date:item.date,
        danceStyle:item.danceStyle,
        classTheme:item.classTheme,
        whatILearned:item.whatILearned,
        notDigested:item.notDigested,
      })),
      focusStats14d:Array.from(focusMap.values()).sort((a, b) => b.minutes - a.minutes || b.sessions - a.sessions).slice(0, 10),
    };
  }

  async function generatePracticeRecommendation() {
    if (recommendationLoading) return;
    if (!activeTasks.length) return setRecommendationError("还没有待练任务。先从课程复盘或练习队列创建一个任务吧。");
    setRecommendationDecision("");
    if (activeTasks.length === 1 || (activeTasks.length <= 2 && recentLogs14d.length === 0)) {
      setAiRecommendation(buildLocalRecommendation(activeTasks.length === 1 ? "现在只有一个待练任务，不需要调用 AI，直接开始就很好。" : "任务和练习记录还不多，我先用本地规则帮你排一下。"));
      setRecommendationSource("local");
      setRecommendationError("");
      return;
    }
    setRecommendationLoading(true);
    setRecommendationError("");
    try {
      const input = buildRecommendationInput();
      const response = await fetch("/api/ai/practice-recommendation", {
        method:"POST",
        headers:{ "Content-Type":"application/json" },
        body:JSON.stringify(input),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error ?? "AI 推荐失败，请稍后重试。");
      setAiRecommendation(payload.recommendation ?? null);
      setRecommendationSource("ai");
    } catch (error) {
      setAiRecommendation(buildLocalRecommendation("AI 推荐暂时不可用，我先用本地规则给你一个可开始的选择。"));
      setRecommendationSource("local");
      setRecommendationError(error instanceof Error ? error.message : "AI 推荐失败，请稍后重试。");
    } finally {
      setRecommendationLoading(false);
    }
  }

  function acceptRecommendation() {
    if (!aiRecommendation) return;
    setRecommendationDecision("accepted");
    setRecommendationError("");
  }

  function clearRecommendation() {
    setAiRecommendation(null);
    setRecommendationSource("");
    setRecommendationDecision("");
    setRecommendationError("");
  }

  return <AppShell active="/"><div className="page home-page">
    <Header eyebrow={today} title="今天练什么？" action={<div className="avatar">G</div>} />

    <section><SectionTitle link={recommended.length ? "/practice" : undefined}>Next Practice</SectionTitle>{recommended.length > 0 && <div className={`ai-recommendation-bar ${recommendationDecision === "accepted" ? "accepted" : ""}`}><div><Icon name="spark" /><span><strong>{recommendationDecision === "accepted" ? "已采纳这次推荐" : aiRecommendation ? recommendationSource === "ai" ? "AI 已推荐" : "已用本地规则推荐" : "需要一点选择辅助？"}</strong><small>{aiRecommendation?.sessionNote ?? "AI 只会从已有任务里挑，不会创建或修改任务。"}</small></span></div>{aiRecommendation ? <div className="recommendation-feedback"><button type="button" disabled={recommendationLoading || recommendationDecision === "accepted"} onClick={acceptRecommendation}>{recommendationDecision === "accepted" ? "已采纳" : "采纳"}</button><button type="button" disabled={recommendationLoading} onClick={generatePracticeRecommendation}>{recommendationLoading ? "推荐中…" : "重新推荐"}</button><button type="button" disabled={recommendationLoading} onClick={clearRecommendation}>不采纳</button></div> : <button type="button" disabled={recommendationLoading} onClick={generatePracticeRecommendation}>{recommendationLoading ? "推荐中…" : "AI 推荐"}</button>}</div>}{recommendationError && <p className="form-error recommendation-error" role="alert">{recommendationError}</p>}{!loaded ? <EmptyState icon="spark" title="正在加载" text="请稍候。" /> : recommended.length ? <div className="practice-carousel">{displayTasks.slice(0, 6).map(task => {
      const sourceClass = task.classReviewId ? classes.find(item => item.id === task.classReviewId) : undefined;
      const latestLog = logs.filter(log => log.taskId === task.id).sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))[0];
      const aiPick = recommendationMap.get(task.id);
      return <Link href={`/practice/${task.id}/log`} className={`practice-slide ${task.isHighPriority ? "priority" : ""}`} key={task.id}>
        <div className="slide-top"><span>{aiPick ? "AI Recommended" : task.isHighPriority ? "高优先级" : task.status === "practicing" ? "练习中" : "待练"}</span><em>{taskDuration(task)}</em></div>
        <h2>{task.title}</h2>
        <p>{sourceClass ? `${sourceClass.teacher} · ${sourceClass.danceStyle}` : "独立练习"}</p>
        {aiPick && <p className="ai-reason">{aiPick.reason}</p>}
        <div className="slide-focus">{task.focusTags.slice(0, 3).map(tag => <span key={tag}>{tag}</span>)}</div>
        <div className="slide-footer"><small>{latestLog ? `上次 ${latestLog.date}` : "尚未练习"}</small><strong>记录 <Icon name="arrow" size={14} /></strong></div>
      </Link>;
    })}</div> : <EmptyState icon="practice" title="暂无待练任务" text="完成课程复盘，或创建一个独立练习任务。" />}</section>

    <div className="quick-actions compact"><Link href="/add-class"><Icon name="plus" /><span><strong>添加课程</strong><small>下课后快速记</small></span></Link><Link href="/practice"><Icon name="practice" /><span><strong>练习队列</strong><small>查看全部任务</small></span></Link></div>

    <section><SectionTitle>近七日课程</SectionTitle>{recentClassGroups.length ? <div className="recent-class-groups">{recentClassGroups.map(group => <div className="recent-class-group" key={group.date}><div className="group-date"><strong>{shortDateLabel(group.date)}</strong><span>{group.items.length} 节课</span></div><div className="compact-class-list">{group.items.map(item => { const classLogs = logs.filter(log => log.classId === item.id); return <Link href={`/classes/${item.id}`} className="compact-class-card" key={item.id}><div><span>{item.danceStyle}</span><h3>{item.classTheme}</h3><p>{item.teacher}</p></div><small>{classLogs.length} 练习 · {item.tasks.length} 任务</small></Link>; })}</div></div>)}</div> : <div className="no-reference">近七日课程会显示在这里。</div>}</section>

    <section><SectionTitle>本周主要练了什么</SectionTitle><div className="week-compact-card"><div className="week-compact-stats"><div><strong>{weekClasses.length}</strong><span>课程</span></div><div><strong>{weekLogs.length}</strong><span>练习</span></div><div><strong>{minutes}</strong><span>分钟</span></div></div>{weekFocus.length ? <div className="week-focus-chips">{weekFocus.map(([tag, count]) => <span key={tag}>{tag}<small>{count}</small></span>)}</div> : <p>本周 Focus 会根据练习记录自动汇总。</p>}</div></section>

    <div className="pwa-note home-note"><Icon name="spark" /><p>当前数据保存在本机浏览器中，清除浏览器数据或更换设备可能会丢失记录。<Link href="/settings">偏好设置</Link></p></div>
  </div></AppShell>;
}
