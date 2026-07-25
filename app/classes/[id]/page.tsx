"use client";

import { FormEvent, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { AppShell, EmptyState, Header, SectionTitle } from "../../components";
import { Icon } from "../../icons";
import { AIPracticeTaskDraft } from "../../lib/ai-practice";
import { DEFAULT_PREFERENCES, getDataRepository } from "../../lib/data-repository";
import { AppPreferences, ClassReview, FOCUS_TAGS, logDurationMinutes, PracticeLog, PracticeTask, taskDuration, taskDurationMinutes, VideoReferenceType } from "../../lib/models";
import { PracticeTaskEditForm, PracticeTaskEditDraft } from "../../practice-task-edit-form";

const referenceLabels: Record<VideoReferenceType,string> = { album_note:"相册位置", local_filename:"本地文件名", cloud_link:"云端链接", external_link:"外部链接" };

type AiDraftState = AIPracticeTaskDraft & {
  draftId: string;
  saved: boolean;
};

type ClassEditDraft = {
  date: string;
  teacher: string;
  danceStyle: string;
  classTheme: string;
  difficulty: string;
  classCondition: "" | "Tired" | "Okay" | "Great";
  whatILearned: string;
  notDigested: string;
  videoReferenceType: VideoReferenceType;
  videoReferenceValue: string;
};

export default function ClassDetail() {
  const params = useParams<{id:string}>();
  const router = useRouter();
  const [review, setReview] = useState<ClassReview | null | undefined>(undefined);
  const [practiceLogs, setPracticeLogs] = useState<PracticeLog[]>([]);
  const [preferences, setPreferences] = useState<AppPreferences>(DEFAULT_PREFERENCES);
  const [loadError, setLoadError] = useState("");
  const [saveMessage, setSaveMessage] = useState("");
  const [editingClass, setEditingClass] = useState(false);
  const [classDraft, setClassDraft] = useState<ClassEditDraft | null>(null);
  const [classActionPending, setClassActionPending] = useState("");
  const [classError, setClassError] = useState("");
  const [confirmingClassDelete, setConfirmingClassDelete] = useState(false);
  const [confirmingLogDeleteId, setConfirmingLogDeleteId] = useState("");
  const [editingTaskId, setEditingTaskId] = useState("");
  const [confirmingTaskDeleteId, setConfirmingTaskDeleteId] = useState("");
  const [taskDraft, setTaskDraft] = useState<PracticeTaskEditDraft>({ title:"", keyPoints:"", focusTags:[], customFocus:"", isHighPriority:false, durationValue:15 });
  const [taskActionPending, setTaskActionPending] = useState("");
  const [taskError, setTaskError] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");
  const [aiDrafts, setAiDrafts] = useState<AiDraftState[]>([]);
  const [savingAiTasks, setSavingAiTasks] = useState(false);
  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const repository = await getDataRepository();
        const [nextReview, logs, nextPreferences] = await Promise.all([
          repository.findClassReview(params.id),
          repository.readPracticeLogs(),
          repository.readPreferences(),
        ]);
        if (!active) return;
        setReview(nextReview ?? null);
        setPracticeLogs(logs.filter(log => log.classId === params.id).sort((a,b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)));
        setPreferences(nextPreferences);
        setLoadError("");
	        const query = new URLSearchParams(window.location.search);
	        setSaveMessage(query.get("practiceDeleted") === "1" ? "练习记录已删除" : query.get("practiceSaved") === "1" ? "练习记录已保存" : query.get("saved") === "1" ? "课程和任务已保存" : "");
      } catch (caught) {
        if (!active) return;
        setReview(null);
        setLoadError(caught instanceof Error ? caught.message : "课程数据读取失败，请稍后重试。");
      }
    };
    const timer = window.setTimeout(load, 0);
    window.addEventListener("groovinlog:updated", load);
    return () => {
      active = false;
      window.clearTimeout(timer);
      window.removeEventListener("groovinlog:updated", load);
    };
	  }, [params.id]);

  function startClassEdit(current: ClassReview) {
    setClassError("");
    setConfirmingClassDelete(false);
    setClassDraft({
      date:current.date,
      teacher:current.teacher,
      danceStyle:current.danceStyle,
      classTheme:current.classTheme,
      difficulty:current.difficulty ?? "",
      classCondition:current.classCondition ?? "",
      whatILearned:current.whatILearned,
      notDigested:current.notDigested,
      videoReferenceType:current.videoReference?.type ?? "album_note",
      videoReferenceValue:current.videoReference?.value ?? "",
    });
    setEditingClass(true);
  }

  async function saveClassEdit(event: FormEvent) {
    event.preventDefault();
    if (!review || !classDraft || classActionPending) return;
    if (!classDraft.date || !classDraft.teacher.trim() || !classDraft.danceStyle.trim() || !classDraft.classTheme.trim()) {
      return setClassError("请填写日期、老师、舞种和课程主题。");
    }
    setClassActionPending("save");
    setClassError("");
    try {
      const repository = await getDataRepository();
      const patch: Partial<Omit<ClassReview, "id" | "tasks" | "createdAt">> = {
        date:classDraft.date,
        teacher:classDraft.teacher.trim(),
        danceStyle:classDraft.danceStyle.trim(),
        classTheme:classDraft.classTheme.trim(),
        difficulty:classDraft.difficulty.trim() || undefined,
        classCondition:classDraft.classCondition || undefined,
        whatILearned:classDraft.whatILearned.trim(),
        notDigested:classDraft.notDigested.trim(),
        videoReference:classDraft.videoReferenceValue.trim() ? { type:classDraft.videoReferenceType, value:classDraft.videoReferenceValue.trim() } : undefined,
      };
      await repository.updateClassReview(review.id, patch);
      const updated = await repository.findClassReview(review.id);
      setReview(updated ?? { ...review, ...patch });
      setEditingClass(false);
      setClassDraft(null);
      setSaveMessage("课程复盘已更新");
    } catch (caught) {
      setClassError(caught instanceof Error ? caught.message : "课程复盘更新失败，请稍后重试。");
    } finally {
      setClassActionPending("");
    }
  }

  async function deleteClass() {
    if (!review || classActionPending) return;
    setClassActionPending("delete");
    setClassError("");
    try {
      const repository = await getDataRepository();
      await repository.deleteClassReview(review.id);
      router.push("/?classDeleted=1");
    } catch (caught) {
      setClassError(caught instanceof Error ? caught.message : "课程删除失败，请稍后重试。");
      setClassActionPending("");
    }
  }

  async function deletePracticeLog(logId: string) {
    if (classActionPending) return;
    setClassActionPending(`delete-log:${logId}`);
    setClassError("");
    try {
      const repository = await getDataRepository();
      await repository.deletePracticeLog(logId);
      const logs = await repository.readPracticeLogs();
      setPracticeLogs(logs.filter(log => log.classId === params.id).sort((a,b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)));
      setConfirmingLogDeleteId("");
      setSaveMessage("练习记录已删除");
    } catch (caught) {
      setClassError(caught instanceof Error ? caught.message : "练习记录删除失败，请稍后重试。");
    } finally {
      setClassActionPending("");
    }
  }

  function startEditTask(task: PracticeTask) {
    setTaskError("");
    setEditingTaskId(task.id);
    setTaskDraft({
      title:task.title,
      keyPoints:task.keyPoints,
      focusTags:task.focusTags,
      customFocus:"",
      isHighPriority:task.isHighPriority,
      durationValue:taskDurationMinutes(task),
    });
  }

  function toggleEditFocus(focus: string) {
    setTaskDraft(current => ({ ...current, focusTags:current.focusTags.includes(focus) ? current.focusTags.filter(item => item !== focus) : [...current.focusTags, focus] }));
  }

  async function saveEditedTask() {
    if (!review || !editingTaskId || taskActionPending) return;
    const focusTags = [...taskDraft.focusTags, ...(taskDraft.customFocus.trim() ? [taskDraft.customFocus.trim()] : [])];
    if (!taskDraft.title.trim()) return setTaskError("请填写任务标题。");
    if (!focusTags.length) return setTaskError("请选择或添加至少一个 Focus。");
    const minutes = Math.max(1, Math.round(taskDraft.durationValue));
    setTaskActionPending(`edit:${editingTaskId}`);
    setTaskError("");
    try {
      const repository = await getDataRepository();
      await repository.updatePracticeTask(editingTaskId, {
        title:taskDraft.title.trim(),
        keyPoints:taskDraft.keyPoints.trim(),
        focusTags:Array.from(new Set(focusTags)).slice(0, 6),
        isHighPriority:taskDraft.isHighPriority,
        durationUnit:"minutes",
        durationValue:minutes,
        suggestedDurationMinutes:minutes,
      });
      const updated = await repository.findClassReview(review.id);
      setReview(updated ?? review);
      setEditingTaskId("");
      setSaveMessage("练习任务已更新");
    } catch (caught) {
      setTaskError(caught instanceof Error ? caught.message : "练习任务保存失败，请稍后重试。");
    } finally {
      setTaskActionPending("");
    }
  }

  async function deleteTask(taskId: string) {
    if (!review || taskActionPending) return;
    setTaskActionPending(`delete:${taskId}`);
    setTaskError("");
    try {
      const repository = await getDataRepository();
      await repository.deletePracticeTask(taskId);
      const [updated, logs] = await Promise.all([
        repository.findClassReview(review.id),
        repository.readPracticeLogs(),
      ]);
      setReview(updated ?? review);
      setPracticeLogs(logs.filter(log => log.classId === params.id).sort((a,b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)));
      setConfirmingTaskDeleteId("");
      if (editingTaskId === taskId) setEditingTaskId("");
      setSaveMessage("练习任务已删除，相关练习记录也已删除");
    } catch (caught) {
      setTaskError(caught instanceof Error ? caught.message : "练习任务删除失败，请稍后重试。");
    } finally {
      setTaskActionPending("");
    }
  }

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

  async function saveAiTasks(tasks: PracticeTask[], savedDraftIds: string[]) {
    if (!review || !tasks.length) return;
    if (savingAiTasks) return;
    setSavingAiTasks(true);
    setAiError("");
    try {
      const repository = await getDataRepository();
      const updated = await repository.appendPracticeTasksToClassReview(review.id, tasks);
      setReview(updated ?? { ...review, tasks:[...tasks, ...review.tasks] });
      setAiDrafts(current => current.map(draft => savedDraftIds.includes(draft.draftId) ? { ...draft, saved:true } : draft));
      setSaveMessage(`${tasks.length} 个 AI 建议任务已加入练习队列`);
    } catch (caught) {
      setAiError(caught instanceof Error ? caught.message : "练习任务保存失败，请稍后重试。");
    } finally {
      setSavingAiTasks(false);
    }
  }

  function saveOneAiDraft(draftId: string) {
    const draft = aiDrafts.find(item => item.draftId === draftId);
    if (!draft || draft.saved) return;
    const task = draftToTask(draft, new Date().toISOString());
    if (!task) return setAiError("请先补全这条任务的标题和 Focus。");
    void saveAiTasks([task], [draftId]);
  }

  function saveAiDrafts() {
    const pendingDrafts = aiDrafts.filter(draft => !draft.saved);
    const createdAt = new Date().toISOString();
    const entries = pendingDrafts.map(draft => ({ draftId:draft.draftId, task:draftToTask(draft, createdAt) })).filter((entry): entry is { draftId: string; task: PracticeTask } => Boolean(entry.task));
    const tasks = entries.map(entry => entry.task);
    if (!tasks.length) return setAiError("请至少保留一个未加入且有标题和 Focus 的任务。");
    void saveAiTasks(tasks, entries.map(entry => entry.draftId));
  }

  return <AppShell active=""><div className="page class-detail-page">
    {review === undefined ? <EmptyState icon="spark" title="正在加载课程复盘" text="请稍候。" /> : review === null ? <><Header eyebrow="课程复盘" title="没有找到这节课" />{loadError && <p className="form-error" role="alert">{loadError}</p>}<EmptyState icon="spark" title="没有找到这条课程记录" text="请确认当前登录状态和数据空间，或返回课程列表查看。" /><Link className="primary-button enabled" href="/add-class">添加课程复盘 <Icon name="arrow" /></Link></> : <>
	      <Header eyebrow={`${review.date} · ${review.danceStyle.toUpperCase()}`} title={review.classTheme} action={<Link className="round-button" href="/add-class" aria-label="添加另一节课"><Icon name="plus" /></Link>} />
	      {saveMessage && <div className="saved-banner" role="status"><span>✓</span><div><strong>{saveMessage}</strong><p>已保存。</p></div></div>}
	      <div className="record-actions"><button type="button" disabled={Boolean(classActionPending)} onClick={() => startClassEdit(review)}>Edit</button>{confirmingClassDelete ? <><button type="button" disabled={Boolean(classActionPending)} onClick={() => setConfirmingClassDelete(false)}>Cancel</button><button type="button" className="danger-button" disabled={Boolean(classActionPending)} onClick={() => void deleteClass()}>{classActionPending === "delete" ? "Deleting…" : "Delete Class"}</button></> : <button type="button" className="danger-link" disabled={Boolean(classActionPending)} onClick={() => setConfirmingClassDelete(true)}>Delete Class</button>}</div>
	      {confirmingClassDelete && <div className="danger-zone"><strong>Delete this class?</strong><p>这会永久删除这条课程复盘。相关 Practice Tasks 和 Practice Logs 不会被删除，但会解除和这节课的关联。</p></div>}
	      {classError && <p className="form-error" role="alert">{classError}</p>}
	      {editingClass && classDraft && <form className="real-form class-edit-form" onSubmit={saveClassEdit}><section className="form-panel"><div className="input-grid"><label><span>日期 *</span><input type="date" value={classDraft.date} onChange={event => setClassDraft(current => current ? { ...current, date:event.target.value } : current)} /></label><label><span>老师 *</span><input value={classDraft.teacher} onChange={event => setClassDraft(current => current ? { ...current, teacher:event.target.value } : current)} /></label></div><div className="input-grid"><label><span>舞种 *</span><input value={classDraft.danceStyle} onChange={event => setClassDraft(current => current ? { ...current, danceStyle:event.target.value } : current)} /></label><label><span>课程主题 *</span><input value={classDraft.classTheme} onChange={event => setClassDraft(current => current ? { ...current, classTheme:event.target.value } : current)} /></label></div><div className="input-grid"><label><span>难度 <small>选填</small></span><input value={classDraft.difficulty} onChange={event => setClassDraft(current => current ? { ...current, difficulty:event.target.value } : current)} /></label><label><span>上课状态 <small>选填</small></span><select value={classDraft.classCondition} onChange={event => setClassDraft(current => current ? { ...current, classCondition:event.target.value as ClassEditDraft["classCondition"] } : current)}><option value="">不填写</option><option value="Tired">疲惫</option><option value="Okay">还行</option><option value="Great">特别好</option></select></label></div></section><section className="form-panel"><label><span>今天学会了什么 <small>选填</small></span><textarea rows={3} value={classDraft.whatILearned} onChange={event => setClassDraft(current => current ? { ...current, whatILearned:event.target.value } : current)} /></label><label><span>还没消化什么 <small>选填</small></span><textarea rows={3} value={classDraft.notDigested} onChange={event => setClassDraft(current => current ? { ...current, notDigested:event.target.value } : current)} /></label></section><section className="form-panel"><label><span>视频引用类型</span><select value={classDraft.videoReferenceType} onChange={event => setClassDraft(current => current ? { ...current, videoReferenceType:event.target.value as VideoReferenceType } : current)}><option value="album_note">相册位置</option><option value="local_filename">本地文件名</option><option value="cloud_link">云端链接</option><option value="external_link">外部链接</option></select></label><label><span>视频位置 / 文件名 / 链接 <small>选填</small></span><input value={classDraft.videoReferenceValue} onChange={event => setClassDraft(current => current ? { ...current, videoReferenceValue:event.target.value } : current)} /></label></section><div className="ai-draft-actions"><button type="button" className="secondary-button" disabled={Boolean(classActionPending)} onClick={() => { setEditingClass(false); setClassDraft(null); setClassError(""); }}>Cancel</button><button type="submit" className="primary-button enabled" disabled={Boolean(classActionPending)}>{classActionPending === "save" ? "Saving…" : "Save Changes"} <Icon name="arrow" /></button></div></form>}
	      <section className="detail-hero compact-detail-hero"><div><span>老师</span><h2>{review.teacher}</h2></div><div><span>舞种</span><h2>{review.danceStyle}</h2></div><p>{review.date}</p>{((preferences.showDifficulty && review.difficulty) || (preferences.showBodyStatus && review.classCondition)) && <div className="class-meta-pills">{preferences.showDifficulty && review.difficulty && <span>{review.difficulty === "Beginner zero" ? "零基础" : review.difficulty === "Beginner" ? "初级" : review.difficulty === "Improving" ? "提高" : review.difficulty}</span>}{preferences.showBodyStatus && review.classCondition && <span>{review.classCondition === "Tired" ? "◔ 疲惫" : review.classCondition === "Okay" ? "● 还行" : "✦ 特别好"}</span>}</div>}</section>
      {(review.whatILearned || review.notDigested) ? <section><SectionTitle>课堂复盘</SectionTitle><div className="detail-reflection-grid">{review.whatILearned && <div className="reflection-card"><small>今天学会了什么</small><p>{review.whatILearned}</p></div>}{review.notDigested && <div className="reflection-card stuck"><small>下次练习线索</small><p>{review.notDigested}</p></div>}</div></section> : <section><SectionTitle>课堂复盘</SectionTitle><div className="no-reference">没有填写课堂复盘，也没关系。</div></section>}
      <section><SectionTitle>视频引用</SectionTitle>{review.videoReference ? <div className="video-reference"><Icon name="play" /><div><small>{referenceLabels[review.videoReference.type]}</small>{review.videoReference.type.includes("link") ? <a href={review.videoReference.value} target="_blank" rel="noreferrer">{review.videoReference.value}</a> : <strong>{review.videoReference.value}</strong>}<p>PWA 版本不会上传视频，也不能永久绑定 iOS 相册视频；这里只保存视频文件名、位置备注或链接。</p></div></div> : <div className="no-reference">没有添加视频引用。PWA 版本不会上传视频，也不能永久绑定 iOS 相册视频；这里只保存视频文件名、位置备注或链接。</div>}</section>
      <section><SectionTitle>练习任务</SectionTitle><div className="ai-task-box"><div><strong>AI 生成练习任务</strong><p>只会生成草稿；你确认后才会保存到练习队列。</p></div><button type="button" onClick={generateAiTasks} disabled={aiLoading || savingAiTasks}>{aiLoading ? "生成中…" : aiDrafts.length ? "重新生成" : "生成任务"}</button></div>{aiError && <p className="form-error" role="alert">{aiError}</p>}{aiDrafts.length > 0 && <div className="ai-draft-list real-form">{aiDrafts.map((draft, index) => <article className={`form-panel ai-draft-card ${draft.saved ? "saved" : ""}`} key={draft.draftId}><div className="task-editor-head"><strong>{draft.saved ? "已加入" : `建议任务 ${index + 1}`}</strong><button type="button" disabled={draft.saved || savingAiTasks} onClick={() => setAiDrafts(current => current.filter(item => item.draftId !== draft.draftId))}>{draft.saved ? "已保存" : "删除"}</button></div><label><span>任务标题 *</span><input disabled={draft.saved || savingAiTasks} value={draft.title} onChange={event => updateAiDraft(draft.draftId, { title:event.target.value })} /></label><label><span>任务要点</span><textarea disabled={draft.saved || savingAiTasks} rows={2} value={draft.keyPoints} onChange={event => updateAiDraft(draft.draftId, { keyPoints:event.target.value })} /></label><fieldset><legend>最核心 Focus *</legend><div className="tag-picker compact ai-focus-picker">{FOCUS_TAGS.map(tag => <button type="button" disabled={draft.saved || savingAiTasks} className={draft.focusTags.includes(tag) ? "selected" : ""} key={tag} onClick={() => toggleAiFocus(draft.draftId, tag)}>{tag}</button>)}</div></fieldset><div className="duration-editor no-border"><span>练习时长</span><div className="quick-duration task-duration-picks ai-duration-picks">{[10, 15, 20, 30].map(value => <button type="button" disabled={draft.saved || savingAiTasks} className={draft.suggestedDurationMinutes === value ? "selected" : ""} key={value} onClick={() => updateAiDraft(draft.draftId, { suggestedDurationMinutes:value })}>{value} 分钟</button>)}</div><label><span>自定义分钟数</span><input disabled={draft.saved || savingAiTasks} type="number" min="5" max="60" value={draft.suggestedDurationMinutes} onChange={event => updateAiDraft(draft.draftId, { suggestedDurationMinutes:Math.min(60, Math.max(5, Number(event.target.value))) })} /></label></div><label className="switch-row"><input type="checkbox" disabled={draft.saved || savingAiTasks} checked={draft.isHighPriority} onChange={event => updateAiDraft(draft.draftId, { isHighPriority:event.target.checked })} /><span><strong>高优先级</strong><small>保存后会在队列中靠前显示</small></span></label><button type="button" className="ai-add-one-button" disabled={draft.saved || savingAiTasks} onClick={() => saveOneAiDraft(draft.draftId)}>{draft.saved ? "已加入练习" : savingAiTasks ? "保存中…" : "加入练习"}</button></article>)}</div>}{aiDrafts.some(draft => !draft.saved) && <div className="ai-draft-actions"><button type="button" className="secondary-button" disabled={savingAiTasks} onClick={addAiDraft}><Icon name="plus" /> 添加草稿</button><button type="button" className="primary-button enabled" disabled={savingAiTasks} onClick={saveAiDrafts}>{savingAiTasks ? "保存中…" : "全部加入"} <Icon name="arrow" /></button></div>}{taskError && <p className="form-error" role="alert">{taskError}</p>}{editingTaskId && review.tasks.find(task => task.id === editingTaskId) && <PracticeTaskEditForm task={review.tasks.find(task => task.id === editingTaskId)!} draft={taskDraft} pending={taskActionPending} onCancel={() => { setEditingTaskId(""); setTaskError(""); }} onChange={patch => setTaskDraft(current => ({ ...current, ...patch }))} onToggleFocus={toggleEditFocus} onSave={() => void saveEditedTask()} />}{review.tasks.length ? <div className="detail-task-list">{review.tasks.map(task => <article key={task.id}><div><span>{task.status === "practicing" ? "练习中" : ["done","digested","completed"].includes(task.status) ? "已消化" : task.isHighPriority ? "高优先级" : "进行中"}</span><em>{taskDuration(task)}</em></div><h3>{task.title}</h3>{task.keyPoints && <p>{task.keyPoints}</p>}<div className="focus-row">{task.focusTags.map(tag => <span key={tag}>{tag}</span>)}</div><div className="record-actions compact"><button type="button" disabled={Boolean(taskActionPending)} onClick={() => startEditTask(task)}>Edit</button>{confirmingTaskDeleteId === task.id ? <><button type="button" disabled={Boolean(taskActionPending)} onClick={() => setConfirmingTaskDeleteId("")}>Cancel</button><button type="button" className="danger-link" disabled={Boolean(taskActionPending)} onClick={() => void deleteTask(task.id)}>{taskActionPending === `delete:${task.id}` ? "Deleting…" : "Delete Task"}</button></> : <button type="button" className="danger-link" disabled={Boolean(taskActionPending)} onClick={() => setConfirmingTaskDeleteId(task.id)}>Delete</button>}</div>{confirmingTaskDeleteId === task.id && <div className="danger-inline"><p>Delete this practice task? Related practice logs will also be permanently deleted.</p></div>}<Link className="inline-log-link" href={`/practice/${task.id}/log`}>记录练习 <Icon name="arrow" size={15} /></Link></article>)}</div> : <div className="no-reference">这节课还没有关联练习任务。</div>}</section>
      <section><SectionTitle>练习记录</SectionTitle>{practiceLogs.length ? <><div className="history-summary"><div><strong>{practiceLogs.length}</strong><span>练习次数</span></div><div><strong>{practiceLogs.reduce((sum,log) => sum + logDurationMinutes(log),0)}</strong><span>分钟</span></div><div><strong>{Math.round(practiceLogs.reduce((sum,log) => sum + log.progressScore,0) / practiceLogs.length)}</strong><span>平均进步评分</span></div></div><div className="practice-history">{practiceLogs.map(log => { const task = review.tasks.find(item => item.id === log.taskId); return <article key={log.id}><div className="history-date"><strong>{new Date(`${log.date}T00:00:00`).toLocaleDateString("zh-CN",{day:"2-digit"})}</strong><span>{new Date(`${log.date}T00:00:00`).toLocaleDateString("zh-CN",{month:"short"})}</span></div><div><small>{task?.title ?? "练习"} · {logDurationMinutes(log)} 分钟</small><h3>{log.practiceContent}</h3><p>进步评分 {log.progressScore}/5</p>{log.nextFocus && <blockquote><b>下次注意</b> {log.nextFocus}</blockquote>}<div className="record-actions compact"><Link href={`/practice/${log.taskId}/log?logId=${log.id}`}>Edit</Link>{confirmingLogDeleteId === log.id ? <><button type="button" disabled={Boolean(classActionPending)} onClick={() => setConfirmingLogDeleteId("")}>Cancel</button><button type="button" className="danger-link" disabled={Boolean(classActionPending)} onClick={() => void deletePracticeLog(log.id)}>{classActionPending === `delete-log:${log.id}` ? "Deleting…" : "Confirm Delete"}</button></> : <button type="button" className="danger-link" disabled={Boolean(classActionPending)} onClick={() => setConfirmingLogDeleteId(log.id)}>Delete</button>}</div></div></article>})}</div></> : <div className="no-reference">还没有练习记录。第一次练习后会显示在这里。</div>}</section>
      <Link className="primary-button enabled" href="/practice">前往练习队列 <Icon name="arrow" /></Link>
    </>}
  </div></AppShell>;
}
