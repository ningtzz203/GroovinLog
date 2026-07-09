"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AppShell, EmptyState, Header, SectionTitle } from "./components";
import { Icon } from "./icons";
import { ClassReview, localDateKey, logDurationMinutes, PracticeLog, PracticeTask, taskDuration } from "./lib/models";
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

export default function Dashboard() {
  const [loaded, setLoaded] = useState(false);
  const [classes, setClasses] = useState<ClassReview[]>([]);
  const [tasks, setTasks] = useState<PracticeTask[]>([]);
  const [logs, setLogs] = useState<PracticeLog[]>([]);

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
  const weekClasses = classes.filter(item => isThisWeek(item.date));
  const weekLogs = logs.filter(item => isThisWeek(item.date));
  const minutes = weekLogs.reduce((sum, log) => sum + logDurationMinutes(log), 0);
  const next = recommended[0];
  const nextClass = next?.classReviewId ? classes.find(item => item.id === next.classReviewId) : undefined;
  const today = new Date(`${localDateKey()}T12:00:00`).toLocaleDateString("zh-CN", { weekday:"long", month:"long", day:"numeric" });

  return <AppShell active="/"><div className="page home-page">
    <Header eyebrow={today} title="继续跳起来吧。" action={<div className="avatar">G</div>} />
    <div className="pwa-note"><Icon name="spark" /><p>当前数据保存在本机浏览器中，清除浏览器数据或更换设备可能会丢失记录。</p></div>

    {!loaded ? <EmptyState icon="spark" title="正在加载" text="请稍候。" /> : next ? <section className="hero-card"><div><span className="tiny-label">下一项练习</span><h2>{next.title}</h2><p>{nextClass ? `${nextClass.teacher} · ${nextClass.danceStyle}` : "独立练习"}</p><div className="hero-meta"><span><Icon name="clock" size={17} /> {taskDuration(next)}</span>{next.focusTags[0] && <span>{next.focusTags[0].toUpperCase()}</span>}</div></div><Link href={`/practice/${next.id}/log`} aria-label={`记录练习：${next.title}`}><Icon name="play" size={30} /></Link></section> : <EmptyState icon="practice" title="暂无待练任务" text="完成课程复盘，或创建一个独立练习任务。" />}

    <div className="quick-actions"><Link href="/add-class"><Icon name="plus" /><span><strong>添加课程复盘</strong><small>记下今天学会的内容</small></span></Link><Link href="/practice"><Icon name="practice" /><span><strong>打开练习队列</strong><small>选择任务或记录练习</small></span></Link></div>

    <section><SectionTitle>本周</SectionTitle><div className="stats-grid"><div><strong>{weekClasses.length}</strong><span>课程</span></div><div><strong>{weekLogs.length}</strong><span>练习次数</span></div><div><strong>{minutes}<small>分钟</small></strong><span>练习时长</span></div><div className="accent"><strong>{activeTasks.length}</strong><span>待练任务</span></div></div></section>

    <section><SectionTitle link={recommended.length ? "/practice" : undefined}>接下来练什么</SectionTitle>{recommended.length ? <div className="task-stack">{recommended.slice(0, 2).map(task => <Link href={`/practice/${task.id}/log`} className="mini-task" key={task.id}><span className={`priority-dot ${task.isHighPriority ? "coral" : "blue"}`} /><div><small>{task.isHighPriority ? "高优先级" : "进行中"} · {taskDuration(task)}</small><h3>{task.title}</h3><p>{task.classReviewId ? "来自课程复盘" : "独立任务"}</p></div><Icon name="arrow" /></Link>)}</div> : <div className="no-reference">进行中的练习任务会显示在这里。</div>}</section>

    <section><SectionTitle>最近课程</SectionTitle>{classes.length ? <div className="class-scroll">{classes.slice(0, 4).map((item, index) => { const date = new Date(`${item.date}T12:00:00`); const classLogs = logs.filter(log => log.classId === item.id); return <Link href={`/classes/${item.id}`} className="class-card" key={item.id}><div className={`date-tile ${index % 3 === 1 ? "blue" : index % 3 === 2 ? "coral" : ""}`}><strong>{date.toLocaleDateString("zh-CN", { day:"2-digit" })}</strong><span>{date.toLocaleDateString("zh-CN", { month:"short" })}</span></div><span className="style-pill">{item.danceStyle}</span><h3>{item.classTheme}</h3><p>老师：{item.teacher}</p><div className="class-footer"><span>{classLogs.length} 次练习</span><span>{item.tasks.length} 个任务</span></div></Link>; })}</div> : <div className="no-reference">保存后的课程复盘会显示在这里。</div>}</section>
  </div></AppShell>;
}
