"use client";

import { FormEvent, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { AppShell, EmptyState, Header } from "../../../components";
import { Icon } from "../../../icons";
import { getDataRepository } from "../../../lib/data-repository";
import { localDateKey, PracticeLog, PracticeTask, taskDurationMinutes } from "../../../lib/models";

type LoadedTask = PracticeTask & { source: string };

export default function AddPracticeLog() {
  const params = useParams<{taskId:string}>();
  const router = useRouter();
  const [task, setTask] = useState<LoadedTask | null | undefined>(undefined);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [pendingLogId, setPendingLogId] = useState("");
  const [form, setForm] = useState({
    date:localDateKey(), durationValue:15,
    practiceContent:"", progressScore:3 as 1|2|3|4|5, nextFocus:"",
  });

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const repository = await getDataRepository();
        const found = await repository.findPracticeTask(params.taskId);
        if (!active) return;
        if (!found) return setTask(null);
        const review = found.classReviewId ? await repository.findClassReview(found.classReviewId) : undefined;
        if (!active) return;
        setTask({ ...found, source: review ? `${review.teacher} · ${review.danceStyle} · ${review.classTheme}` : "独立练习" });
        setError("");
        const timerMinutes = Number(new URLSearchParams(window.location.search).get("durationMinutes"));
        if (Number.isFinite(timerMinutes) && timerMinutes > 0) {
          setForm(current => ({ ...current, durationValue:Math.ceil(timerMinutes) }));
        } else {
          setForm(current => ({ ...current, durationValue:taskDurationMinutes(found) }));
        }
      } catch (caught) {
        if (!active) return;
        setTask(null);
        setError(caught instanceof Error ? caught.message : "练习任务读取失败，请稍后重试。");
      }
    };
    const timer = window.setTimeout(() => void load(),0);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  },[params.taskId]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!task || saving) return;
    if (!form.date) return setError("请选择练习日期。");
    if (!Number.isFinite(form.durationValue) || form.durationValue < 1) return setError("练习时长至少为 1 分钟。");
    if (!form.practiceContent.trim()) return setError("请简单记录这次练了什么。");
    if (!form.nextFocus.trim()) return setError("请给下一次练习留一条提示。");
    const logId = pendingLogId || crypto.randomUUID();
    setPendingLogId(logId);
    const log: PracticeLog = {
      id:logId, taskId:task.id, classId:task.classReviewId, date:form.date,
      durationUnit:"minutes", durationValue:form.durationValue,
      durationMinutes:form.durationValue,
      songsCount:null,
      practiceContent:form.practiceContent.trim(), progressScore:form.progressScore, nextFocus:form.nextFocus.trim(), createdAt:new Date().toISOString(),
    };
    setSaving(true);
    setError("");
    try {
      const repository = await getDataRepository();
      await repository.savePracticeLog(log);
      setPendingLogId("");
      router.push(task.classReviewId ? `/classes/${task.classReviewId}?practiceSaved=1` : "/practice?practiceSaved=1");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "练习记录保存失败，请稍后重试。若记录已保存但任务状态更新失败，请直接重试。");
    } finally {
      setSaving(false);
    }
  }

  if (task === undefined) return <AppShell active="/practice"><div className="page"><EmptyState icon="practice" title="正在加载练习任务" text="请稍候。" /></div></AppShell>;
  if (task === null) return <AppShell active="/practice"><div className="page"><Header eyebrow="练习记录" title="没有找到任务" /><EmptyState icon="practice" title="没有找到这个任务" text="请回到练习队列确认当前数据空间中是否存在。" /><Link href="/practice" className="primary-button enabled">返回练习队列 <Icon name="arrow" /></Link></div></AppShell>;

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
      <button className="primary-button enabled" type="submit" disabled={saving}>{saving ? "保存中…" : "保存练习记录"} <Icon name="arrow" /></button>
    </form>
  </div></AppShell>;
}
