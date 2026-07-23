"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { AppShell, EmptyState, Header, SectionTitle } from "../../components";
import { Icon } from "../../icons";
import { AIPracticeTaskDraft } from "../../lib/ai-practice";
import { AppPreferences, ClassReview, FOCUS_TAGS, logDurationMinutes, PracticeLog, PracticeTask, taskDuration, VideoReferenceType } from "../../lib/models";
import { appendPracticeTasksToClassReview, DEFAULT_PREFERENCES, readClassReviews, readPracticeLogs, readPreferences } from "../../lib/storage";

const referenceLabels: Record<VideoReferenceType,string> = { album_note:"相册位置", local_filename:"本地文件名", cloud_link:"云端链接", external_link:"外部链接" };

type AiDraftState = AIPracticeTaskDraft & {
  draftId: string;
  saved: boolean;
};

export default function ClassDetail() {
  const params = useParams<{id:string}>();
  const [review, setReview] = useState<ClassReview | null | undefined>(undefined);
  const [practiceLogs, setPracticeLogs] = useState<PracticeLog[]>([]);
  const [preferences, setPreferences] = useState<AppPreferences>(DEFAULT_PREFERENCES);
  const [saveMessage, setSaveMessage] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");
  const [aiDrafts, setAiDrafts] = useState<AiDraftState[]>([]);
  useEffect(() => {
    const load = () => {
      setReview(readClassReviews().find(item => item.id === params.id) ?? null);
      setPracticeLogs(readPracticeLogs().filter(log => log.classId === params.id).sort((a,b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)));
      setPreferences(readPreferences());
      const query = new URLSearchParams(window.location.search);
      setSaveMessage(query.get("practiceSaved") === "1" ? "练习记录已保存" : query.get("saved") === "1" ? "课程和任务已保存" : "");
    };
    const timer = window.setTimeout(load, 0);
    window.addEventListener("groovinlog:updated", load);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("groovinlog:updated", load);
    };
  }, [params.id]);

  async function generateAiTasks() {
    if (!review || aiLoading) return;
    setAiLoading(true);
    setAiError("");
    try {
      const response = await fetch("/api/ai/generate-practice-tasks", {
        method:"POST",
        headers:{ "Content-Type":"application/json" },
        body:JSON.stringify({
          danceStyle:review.danceStyle,
          classTheme:review.classTheme,
          whatILearned:review.whatILearned,
          notDigested:review.notDigested,
          existingTasks:review.tasks.map(task => ({ title:task.title, keyPoints:task.keyPoints, focusTags:task.focusTags })),
          defaultPracticeDuration:preferences.defaultPracticeDurationMinutes,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error ?? "生成失败，请稍后重试。");
      setAiDrafts(Array.isArray(payload.tasks) ? payload.tasks.map((task: AIPracticeTaskDraft) => ({ ...task, draftId:crypto.randomUUID(), saved:false })) : []);
      if (!payload.tasks?.length) setAiError("AI 没有生成可用任务，请重试或手动创建。");
    } catch (error) {
      setAiError(error instanceof Error ? error.message : "生成失败，请稍后重试。");
    } finally {
      setAiLoading(false);
    }
  }

  function updateAiDraft(draftId: string, patch: Partial<AIPracticeTaskDraft>) {
    setAiDrafts(current => current.map(draft => draft.draftId === draftId ? { ...draft, ...patch } : draft));
  }

  function toggleAiFocus(draftId: string, tag: string) {
    setAiDrafts(current => current.map(draft => {
      if (draft.draftId !== draftId) return draft;
      return { ...draft, focusTags:draft.focusTags.includes(tag) ? [] : [tag] };
    }));
  }

  function addAiDraft() {
    setAiDrafts(current => [...current, { draftId:crypto.randomUUID(), saved:false, title:"", keyPoints:"", focusTags:["全身"], suggestedDurationMinutes:preferences.defaultPracticeDurationMinutes, isHighPriority:false }]);
  }

  function draftToTask(draft: AiDraftState, createdAt: string): PracticeTask | null {
    if (!review) return null;
    const focusTags = draft.focusTags.filter(tag => FOCUS_TAGS.includes(tag as typeof FOCUS_TAGS[number])).slice(0, 1);
    if (!draft.title.trim() || !focusTags.length) return null;
    const minutes = Math.min(60, Math.max(5, Math.round(draft.suggestedDurationMinutes)));
    return {
      id:crypto.randomUUID(),
      classReviewId:review.id,
      title:draft.title.trim(),
      keyPoints:draft.keyPoints.trim(),
      focusTags,
      isHighPriority:draft.isHighPriority,
      suggestedDurationMinutes:minutes,
      durationUnit:"minutes",
      durationValue:minutes,
      status:"active",
      createdAt,
    };
  }

  function saveAiTasks(tasks: PracticeTask[], savedDraftIds: string[]) {
    if (!review || !tasks.length) return;
    const updated = appendPracticeTasksToClassReview(review.id, tasks);
    setReview(updated ?? { ...review, tasks:[...tasks, ...review.tasks] });
    setAiDrafts(current => current.map(draft => savedDraftIds.includes(draft.draftId) ? { ...draft, saved:true } : draft));
    setAiError("");
    setSaveMessage(`${tasks.length} 个 AI 建议任务已加入练习队列`);
  }

  function saveOneAiDraft(draftId: string) {
    const draft = aiDrafts.find(item => item.draftId === draftId);
    if (!draft || draft.saved) return;
    const task = draftToTask(draft, new Date().toISOString());
    if (!task) return setAiError("请先补全这条任务的标题和 Focus。");
    saveAiTasks([task], [draftId]);
  }

  function saveAiDrafts() {
    const pendingDrafts = aiDrafts.filter(draft => !draft.saved);
    const createdAt = new Date().toISOString();
    const entries = pendingDrafts.map(draft => ({ draftId:draft.draftId, task:draftToTask(draft, createdAt) })).filter((entry): entry is { draftId: string; task: PracticeTask } => Boolean(entry.task));
    const tasks = entries.map(entry => entry.task);
    if (!tasks.length) return setAiError("请至少保留一个未加入且有标题和 Focus 的任务。");
    saveAiTasks(tasks, entries.map(entry => entry.draftId));
  }

  return <AppShell active=""><div className="page class-detail-page">
    {review === undefined ? <EmptyState icon="spark" title="正在加载课程复盘" text="请稍候。" /> : review === null ? <><Header eyebrow="课程复盘" title="没有找到这节课" /><EmptyState icon="spark" title="此设备上没有这条课程记录" text="本地课程复盘只保存在创建它的浏览器中。" /><Link className="primary-button enabled" href="/add-class">添加课程复盘 <Icon name="arrow" /></Link></> : <>
      <Header eyebrow={`${review.date} · ${review.danceStyle.toUpperCase()}`} title={review.classTheme} action={<Link className="round-button" href="/add-class" aria-label="添加另一节课"><Icon name="plus" /></Link>} />
      {saveMessage && <div className="saved-banner" role="status"><span>✓</span><div><strong>{saveMessage}</strong><p>已保存在此设备。</p></div></div>}
      <section className="detail-hero compact-detail-hero"><div><span>老师</span><h2>{review.teacher}</h2></div><div><span>舞种</span><h2>{review.danceStyle}</h2></div><p>{review.date}</p>{((preferences.showDifficulty && review.difficulty) || (preferences.showBodyStatus && review.classCondition)) && <div className="class-meta-pills">{preferences.showDifficulty && review.difficulty && <span>{review.difficulty === "Beginner zero" ? "零基础" : review.difficulty === "Beginner" ? "初级" : review.difficulty === "Improving" ? "提高" : review.difficulty}</span>}{preferences.showBodyStatus && review.classCondition && <span>{review.classCondition === "Tired" ? "◔ 疲惫" : review.classCondition === "Okay" ? "● 还行" : "✦ 特别好"}</span>}</div>}</section>
      {(review.whatILearned || review.notDigested) ? <section><SectionTitle>课堂复盘</SectionTitle><div className="detail-reflection-grid">{review.whatILearned && <div className="reflection-card"><small>今天学会了什么</small><p>{review.whatILearned}</p></div>}{review.notDigested && <div className="reflection-card stuck"><small>下次练习线索</small><p>{review.notDigested}</p></div>}</div></section> : <section><SectionTitle>课堂复盘</SectionTitle><div className="no-reference">没有填写课堂复盘，也没关系。</div></section>}
      <section><SectionTitle>视频引用</SectionTitle>{review.videoReference ? <div className="video-reference"><Icon name="play" /><div><small>{referenceLabels[review.videoReference.type]}</small>{review.videoReference.type.includes("link") ? <a href={review.videoReference.value} target="_blank" rel="noreferrer">{review.videoReference.value}</a> : <strong>{review.videoReference.value}</strong>}<p>PWA 版本不会上传视频，也不能永久绑定 iOS 相册视频；这里只保存视频文件名、位置备注或链接。</p></div></div> : <div className="no-reference">没有添加视频引用。PWA 版本不会上传视频，也不能永久绑定 iOS 相册视频；这里只保存视频文件名、位置备注或链接。</div>}</section>
      <section><SectionTitle>练习任务</SectionTitle><div className="ai-task-box"><div><strong>AI 生成练习任务</strong><p>只会生成草稿；你确认后才会保存到练习队列。</p></div><button type="button" onClick={generateAiTasks} disabled={aiLoading}>{aiLoading ? "生成中…" : aiDrafts.length ? "重新生成" : "生成任务"}</button></div>{aiError && <p className="form-error" role="alert">{aiError}</p>}{aiDrafts.length > 0 && <div className="ai-draft-list real-form">{aiDrafts.map((draft, index) => <article className={`form-panel ai-draft-card ${draft.saved ? "saved" : ""}`} key={draft.draftId}><div className="task-editor-head"><strong>{draft.saved ? "已加入" : `建议任务 ${index + 1}`}</strong><button type="button" disabled={draft.saved} onClick={() => setAiDrafts(current => current.filter(item => item.draftId !== draft.draftId))}>{draft.saved ? "已保存" : "删除"}</button></div><label><span>任务标题 *</span><input disabled={draft.saved} value={draft.title} onChange={event => updateAiDraft(draft.draftId, { title:event.target.value })} /></label><label><span>任务要点</span><textarea disabled={draft.saved} rows={2} value={draft.keyPoints} onChange={event => updateAiDraft(draft.draftId, { keyPoints:event.target.value })} /></label><fieldset><legend>最核心 Focus *</legend><div className="tag-picker compact ai-focus-picker">{FOCUS_TAGS.map(tag => <button type="button" disabled={draft.saved} className={draft.focusTags.includes(tag) ? "selected" : ""} key={tag} onClick={() => toggleAiFocus(draft.draftId, tag)}>{tag}</button>)}</div></fieldset><div className="duration-editor no-border"><span>练习时长</span><div className="quick-duration task-duration-picks ai-duration-picks">{[10, 15, 20, 30].map(value => <button type="button" disabled={draft.saved} className={draft.suggestedDurationMinutes === value ? "selected" : ""} key={value} onClick={() => updateAiDraft(draft.draftId, { suggestedDurationMinutes:value })}>{value} 分钟</button>)}</div><label><span>自定义分钟数</span><input disabled={draft.saved} type="number" min="5" max="60" value={draft.suggestedDurationMinutes} onChange={event => updateAiDraft(draft.draftId, { suggestedDurationMinutes:Math.min(60, Math.max(5, Number(event.target.value))) })} /></label></div><label className="switch-row"><input type="checkbox" disabled={draft.saved} checked={draft.isHighPriority} onChange={event => updateAiDraft(draft.draftId, { isHighPriority:event.target.checked })} /><span><strong>高优先级</strong><small>保存后会在队列中靠前显示</small></span></label><button type="button" className="ai-add-one-button" disabled={draft.saved} onClick={() => saveOneAiDraft(draft.draftId)}>{draft.saved ? "已加入练习" : "加入练习"}</button></article>)}</div>}{aiDrafts.some(draft => !draft.saved) && <div className="ai-draft-actions"><button type="button" className="secondary-button" onClick={addAiDraft}><Icon name="plus" /> 添加草稿</button><button type="button" className="primary-button enabled" onClick={saveAiDrafts}>全部加入 <Icon name="arrow" /></button></div>}{review.tasks.length ? <div className="detail-task-list">{review.tasks.map(task => <article key={task.id}><div><span>{task.status === "practicing" ? "练习中" : ["done","digested","completed"].includes(task.status) ? "已消化" : task.isHighPriority ? "高优先级" : "进行中"}</span><em>{taskDuration(task)}</em></div><h3>{task.title}</h3>{task.keyPoints && <p>{task.keyPoints}</p>}<div className="focus-row">{task.focusTags.map(tag => <span key={tag}>{tag}</span>)}</div><Link className="inline-log-link" href={`/practice/${task.id}/log`}>记录练习 <Icon name="arrow" size={15} /></Link></article>)}</div> : <div className="no-reference">这节课还没有关联练习任务。</div>}</section>
      <section><SectionTitle>练习记录</SectionTitle>{practiceLogs.length ? <><div className="history-summary"><div><strong>{practiceLogs.length}</strong><span>练习次数</span></div><div><strong>{practiceLogs.reduce((sum,log) => sum + logDurationMinutes(log),0)}</strong><span>分钟</span></div><div><strong>{Math.round(practiceLogs.reduce((sum,log) => sum + log.progressScore,0) / practiceLogs.length)}</strong><span>平均进步评分</span></div></div><div className="practice-history">{practiceLogs.map(log => { const task = review.tasks.find(item => item.id === log.taskId); return <article key={log.id}><div className="history-date"><strong>{new Date(`${log.date}T00:00:00`).toLocaleDateString("zh-CN",{day:"2-digit"})}</strong><span>{new Date(`${log.date}T00:00:00`).toLocaleDateString("zh-CN",{month:"short"})}</span></div><div><small>{task?.title ?? "练习"} · {logDurationMinutes(log)} 分钟</small><h3>{log.practiceContent}</h3><p>进步评分 {log.progressScore}/5</p>{log.nextFocus && <blockquote><b>下次注意</b> {log.nextFocus}</blockquote>}</div></article>})}</div></> : <div className="no-reference">还没有练习记录。第一次练习后会显示在这里。</div>}</section>
      <Link className="primary-button enabled" href="/practice">前往练习队列 <Icon name="arrow" /></Link>
    </>}
  </div></AppShell>;
}
