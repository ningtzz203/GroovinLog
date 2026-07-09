"use client";

import { FormEvent, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { AppShell, EmptyState, Header } from "../../../components";
import { Icon } from "../../../icons";
import { localDateKey, PracticeLog, PracticeTask, taskDurationMinutes } from "../../../lib/models";
import { findPracticeTask, readClassReviews, savePracticeLog } from "../../../lib/storage";

type LoadedTask = PracticeTask & { source: string };

export default function AddPracticeLog() {
  const params = useParams<{taskId:string}>();
  const router = useRouter();
  const [task, setTask] = useState<LoadedTask | null | undefined>(undefined);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    date:localDateKey(), durationValue:15,
    practiceContent:"", progressScore:3 as 1|2|3|4|5, nextFocus:"",
  });

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const found = findPracticeTask(params.taskId);
      if (!found) return setTask(null);
      const review = found.classReviewId ? readClassReviews().find(item => item.id === found.classReviewId) : undefined;
      setTask({ ...found, source: review ? `${review.teacher} · ${review.danceStyle} · ${review.classTheme}` : "独立练习" });
      const timerMinutes = Number(new URLSearchParams(window.location.search).get("durationMinutes"));
      if (Number.isFinite(timerMinutes) && timerMinutes > 0) {
        setForm(current => ({ ...current, durationValue:Math.ceil(timerMinutes) }));
      } else {
        setForm(current => ({ ...current, durationValue:taskDurationMinutes(found) }));
      }
    },0);
    return () => window.clearTimeout(timer);
  },[params.taskId]);

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!task) return;
    if (!form.date) return setError("请选择练习日期。");
    if (!Number.isFinite(form.durationValue) || form.durationValue < 1) return setError("练习时长至少为 1 分钟。");
    if (!form.practiceContent.trim()) return setError("请简单记录这次练了什么。");
    if (!form.nextFocus.trim()) return setError("请给下一次练习留一条提示。");
    const log: PracticeLog = {
      id:crypto.randomUUID(), taskId:task.id, classId:task.classReviewId, date:form.date,
      durationUnit:"minutes", durationValue:form.durationValue,
      durationMinutes:form.durationValue,
      songsCount:null,
      practiceContent:form.practiceContent.trim(), progressScore:form.progressScore, nextFocus:form.nextFocus.trim(), createdAt:new Date().toISOString(),
    };
    savePracticeLog(log);
    router.push(task.classReviewId ? `/classes/${task.classReviewId}?practiceSaved=1` : "/practice?practiceSaved=1");
  }

  if (task === undefined) return <AppShell active="/practice"><div className="page"><EmptyState icon="practice" title="正在加载练习任务" text="请稍候。" /></div></AppShell>;
  if (task === null) return <AppShell active="/practice"><div className="page"><Header eyebrow="练习记录" title="没有找到任务" /><EmptyState icon="practice" title="此设备上没有这个任务" text="本地任务只保存在创建它的浏览器中。" /><Link href="/practice" className="primary-button enabled">返回练习队列 <Icon name="arrow" /></Link></div></AppShell>;

  const quickValues = [5,10,15,20,30];
  return <AppShell active="/practice"><div className="page practice-log-page">
    <Header eyebrow="练习记录" title="今天练得怎么样？" action={<Link href="/practice" className="round-button" aria-label="关闭练习记录">×</Link>} />
    <div className="log-task-summary"><small>本次练习</small><h2>{task.title}</h2><p>{task.source}</p><div className="focus-row">{task.focusTags.map(tag => <span key={tag}>{tag}</span>)}</div></div>
    <form className="real-form" onSubmit={submit}>
      <section className="form-panel"><label><span>日期</span><input type="date" value={form.date} onChange={e => setForm(current => ({...current,date:e.target.value}))} /></label>
        <div className="duration-editor no-border"><span>练习时长</span><div className="quick-duration">{quickValues.map(value => <button type="button" className={form.durationValue === value ? "selected" : ""} key={value} onClick={() => setForm(current => ({...current,durationValue:value}))}>{value} 分钟</button>)}</div><label><span>自定义分钟数</span><input aria-label="自定义练习时长" type="number" min="1" value={form.durationValue} onChange={e => setForm(current => ({...current,durationValue:Math.max(1,Number(e.target.value))}))} /></label></div>
      </section>
      <section className="form-panel"><label><span>这次练了什么？ *</span><textarea rows={4} placeholder="简短、具体地记下来就好" value={form.practiceContent} onChange={e => setForm(current => ({...current,practiceContent:e.target.value}))} /></label></section>
      <section className="form-panel"><fieldset><legend>今天的进步评分 *</legend><div className="score-picker">{([1,2,3,4,5] as const).map(score => <button type="button" className={form.progressScore === score ? "selected" : ""} onClick={() => setForm(current => ({...current,progressScore:score}))} key={score}><strong>{score}</strong><small>{["还是卡住","好了一点","更熟悉了","顺畅很多","明显突破"][score-1]}</small></button>)}</div></fieldset>
        <label><span>下次要注意什么？ *</span><textarea rows={3} placeholder="给下一次练习留一条有用的提示" value={form.nextFocus} onChange={e => setForm(current => ({...current,nextFocus:e.target.value}))} /></label>
      </section>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="primary-button enabled" type="submit">保存练习记录 <Icon name="arrow" /></button>
    </form>
  </div></AppShell>;
}
