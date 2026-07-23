"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AppShell, EmptyState, Header, SectionTitle } from "../components";
import { Icon } from "../icons";
import { DEFAULT_PRACTICE_DURATION_OPTIONS, FOCUS_TAGS, logDurationMinutes, PracticeLog, PracticeTask, taskDuration, taskDurationMinutes } from "../lib/models";
import { readClassReviews, readPracticeLogs, readPreferences, readStandaloneTasks, savePreferences, saveStandaloneTask, updatePracticeTask } from "../lib/storage";

type DisplayTask = PracticeTask & { source: string; practiced?: boolean };
type EditTaskDraft = {
  title: string;
  keyPoints: string;
  focusTags: string[];
  customFocus: string;
  isHighPriority: boolean;
  durationValue: number;
};
type TimerState = {
  taskId: string;
  taskTitle: string;
  targetMinutes: number;
  elapsedSeconds: number;
  isRunning: boolean;
  completed: boolean;
  continueAfterDone: boolean;
};

function formatTimer(seconds: number) {
  const safe = Math.max(0, seconds);
  const minutes = Math.floor(safe / 60).toString().padStart(2, "0");
  const rest = (safe % 60).toString().padStart(2, "0");
  return `${minutes}:${rest}`;
}

function notifyTimerEnd() {
  navigator.vibrate?.([180, 90, 180]);
  try {
    const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const audio = new AudioContextClass();
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    oscillator.connect(gain);
    gain.connect(audio.destination);
    oscillator.frequency.value = 720;
    gain.gain.setValueAtTime(0.001, audio.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.18, audio.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.42);
    oscillator.start();
    oscillator.stop(audio.currentTime + 0.45);
  } catch {
    // Some browsers block audio until the next direct user gesture. The visual timer state still works.
  }
}

export default function Practice() {
  const [savedTasks, setSavedTasks] = useState<DisplayTask[]>([]);
  const [filter, setFilter] = useState<"active" | "high" | "new" | "finished">("active");
  const [logs, setLogs] = useState<PracticeLog[]>([]);
  const [showComposer, setShowComposer] = useState(false);
  const [taskError, setTaskError] = useState("");
  const [saveMessage, setSaveMessage] = useState("");
  const [timer, setTimer] = useState<TimerState | null>(null);
  const notifiedTimerId = useRef("");
  const [defaultDuration, setDefaultDuration] = useState(15);
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");
  const [focusFilter, setFocusFilter] = useState("all");
  const [editingTaskId, setEditingTaskId] = useState("");
  const [editDraft, setEditDraft] = useState<EditTaskDraft>({ title:"", keyPoints:"", focusTags:[], customFocus:"", isHighPriority:false, durationValue:15 });
  const [draft, setDraft] = useState({ title:"", keyPoints:"", focusTags:[] as string[], customFocus:"", isHighPriority:false, durationValue:15 });

  useEffect(() => {
    const load = () => {
      const classTasks = readClassReviews().flatMap(review => review.tasks.map(task => ({ ...task, source: `${review.teacher} · ${review.danceStyle} · ${review.date}` })));
      const standalone = readStandaloneTasks().map(task => ({ ...task, source: "独立练习" }));
      const preferences = readPreferences();
      setSavedTasks([...standalone, ...classTasks]);
      setLogs(readPracticeLogs());
      setDefaultDuration(preferences.defaultPracticeDurationMinutes);
      setSortOrder(preferences.practiceQueueSortOrder);
      setDraft(current => current.title || current.keyPoints || current.focusTags.length || current.customFocus ? current : { ...current, durationValue:preferences.defaultPracticeDurationMinutes });
    };
    load();
    const feedbackTimer = window.setTimeout(() => {
      if (new URLSearchParams(window.location.search).get("practiceSaved") === "1") setSaveMessage("练习记录已保存到此设备。");
    }, 0);
    window.addEventListener("groovinlog:updated", load);
    return () => {
      window.clearTimeout(feedbackTimer);
      window.removeEventListener("groovinlog:updated", load);
    };
  }, []);

  const availableFocusTags = useMemo(() => {
    const activeTasks = savedTasks.filter(task => !["done","digested","completed"].includes(task.status));
    return Array.from(new Set(activeTasks.flatMap(task => task.focusTags))).slice(0, 14);
  }, [savedTasks]);

  useEffect(() => {
    if (focusFilter !== "all" && !availableFocusTags.includes(focusFilter)) setFocusFilter("all");
  }, [availableFocusTags, focusFilter]);

  const filtered = useMemo(() => savedTasks.filter(task => {
    const taskLogs = logs.filter(log => log.taskId === task.id);
    const matchesStatus = filter === "high" ? task.isHighPriority && !["done","digested","completed"].includes(task.status)
      : filter === "new" ? taskLogs.length === 0 && !["done","digested","completed"].includes(task.status)
      : filter === "finished" ? ["done","digested","completed"].includes(task.status)
      : ["active","practicing","paused"].includes(task.status);
    const matchesFocus = focusFilter === "all" || task.focusTags.includes(focusFilter);
    return matchesStatus && matchesFocus;
  }), [savedTasks, filter, focusFilter, logs]);

  const sortedTasks = useMemo(() => [...filtered].sort((a,b) => {
    const priority = Number(b.isHighPriority) - Number(a.isHighPriority);
    if (priority !== 0) return priority;
    return sortOrder === "newest" ? b.createdAt.localeCompare(a.createdAt) : a.createdAt.localeCompare(b.createdAt);
  }), [filtered, sortOrder]);

  const activeCount = savedTasks.filter(task => !["done","digested","completed"].includes(task.status)).length;

  useEffect(() => {
    if (!timer?.isRunning) return;
    const interval = window.setInterval(() => {
      setTimer(current => {
        if (!current?.isRunning) return current;
        const elapsedSeconds = current.elapsedSeconds + 1;
        const reachedTarget = elapsedSeconds >= current.targetMinutes * 60;
        if (reachedTarget && !current.continueAfterDone) {
          return { ...current, elapsedSeconds, isRunning:false, completed:true };
        }
        return { ...current, elapsedSeconds, completed:current.completed || reachedTarget };
      });
    }, 1000);
    return () => window.clearInterval(interval);
  }, [timer?.isRunning]);

  useEffect(() => {
    if (!timer?.completed || notifiedTimerId.current === timer.taskId) return;
    notifyTimerEnd();
    notifiedTimerId.current = timer.taskId;
  }, [timer?.completed, timer?.taskId]);

  function changeStatus(taskId: string, status: "digested" | "practicing") {
    updatePracticeTask(taskId,{status});
    setSaveMessage(status === "digested" ? "任务已标记为已消化。" : "任务已回到进行中。");
  }

  function startTimer(task: DisplayTask) {
    notifiedTimerId.current = "";
    setTimer({
      taskId: task.id,
      taskTitle: task.title,
      targetMinutes: taskDurationMinutes(task),
      elapsedSeconds: 0,
      isRunning: true,
      completed: false,
      continueAfterDone: false,
    });
  }

  function timerLogHref() {
    if (!timer) return "/practice";
    const minutes = Math.max(1, Math.ceil(timer.elapsedSeconds / 60));
    return `/practice/${timer.taskId}/log?durationMinutes=${minutes}`;
  }

  function toggleDraftFocus(focus: string) {
    setDraft(current => ({ ...current, focusTags: current.focusTags.includes(focus) ? current.focusTags.filter(item => item !== focus) : [...current.focusTags,focus] }));
  }

  function setPreferenceDuration(value: number) {
    const durationValue = Math.max(1, Math.round(value));
    const preferences = savePreferences({ defaultPracticeDurationMinutes:durationValue });
    setDefaultDuration(preferences.defaultPracticeDurationMinutes);
    setDraft(current => current.title || current.keyPoints || current.focusTags.length || current.customFocus ? current : { ...current, durationValue:preferences.defaultPracticeDurationMinutes });
    setSaveMessage(`默认练习时长已设为 ${preferences.defaultPracticeDurationMinutes} 分钟。`);
  }

  function changeSortOrder(value: "newest" | "oldest") {
    setSortOrder(value);
  }

  function startEditTask(task: DisplayTask) {
    setTaskError("");
    setEditingTaskId(task.id);
    setEditDraft({
      title:task.title,
      keyPoints:task.keyPoints,
      focusTags:task.focusTags,
      customFocus:"",
      isHighPriority:task.isHighPriority,
      durationValue:taskDurationMinutes(task),
    });
  }

  function toggleEditFocus(focus: string) {
    setEditDraft(current => ({ ...current, focusTags: current.focusTags.includes(focus) ? current.focusTags.filter(item => item !== focus) : [...current.focusTags, focus] }));
  }

  function saveEditedTask() {
    if (!editingTaskId) return;
    const focusTags = [...editDraft.focusTags, ...(editDraft.customFocus.trim() ? [editDraft.customFocus.trim()] : [])];
    if (!editDraft.title.trim()) return setTaskError("请填写任务标题。");
    if (!focusTags.length) return setTaskError("请选择或添加至少一个 Focus。");
    const minutes = Math.max(1, Math.round(editDraft.durationValue));
    updatePracticeTask(editingTaskId, {
      title:editDraft.title.trim(),
      keyPoints:editDraft.keyPoints.trim(),
      focusTags:Array.from(new Set(focusTags)).slice(0, 6),
      isHighPriority:editDraft.isHighPriority,
      durationUnit:"minutes",
      durationValue:minutes,
      suggestedDurationMinutes:minutes,
    });
    setEditingTaskId("");
    setTaskError("");
    setSaveMessage("练习任务已更新。");
  }

  function createStandaloneTask(event: FormEvent) {
    event.preventDefault();
    if (!draft.title.trim()) return setTaskError("请填写一个简短的任务标题。");
    if (!draft.focusTags.length && !draft.customFocus.trim()) return setTaskError("请选择或添加至少一个 Focus。");
    if (!Number.isFinite(draft.durationValue) || draft.durationValue < 1) return setTaskError("倒计时时长至少为 1 分钟。");
    saveStandaloneTask({
      id:crypto.randomUUID(), classReviewId:null, title:draft.title.trim(), keyPoints:draft.keyPoints.trim(),
      focusTags:[...draft.focusTags,...(draft.customFocus.trim() ? [draft.customFocus.trim()] : [])], isHighPriority:draft.isHighPriority,
      durationUnit:"minutes", durationValue:draft.durationValue, suggestedDurationMinutes:draft.durationValue,
      status:"active", createdAt:new Date().toISOString(),
    });
    setDraft({ title:"", keyPoints:"", focusTags:[], customFocus:"", isHighPriority:false, durationValue:defaultDuration });
    setTaskError("");
    setSaveMessage("独立任务已保存到练习队列。");
    setShowComposer(false);
  }

  return <AppShell active="/practice"><div className="page practice-page"><Header eyebrow="练习队列" title="今天想练什么？" />
    <section className="practice-preference-card"><div><small>默认练习时长</small><strong>{defaultDuration} 分钟</strong><p>创建课程任务或独立任务时会自动带入，单个任务仍可修改。</p></div><div className="quick-duration preference-duration-picks">{DEFAULT_PRACTICE_DURATION_OPTIONS.map(value => <button type="button" className={defaultDuration === value ? "selected" : ""} key={value} onClick={() => setPreferenceDuration(value)}>{value}</button>)}</div><label><span>自定义</span><input aria-label="默认练习时长" type="number" min="1" max="999" value={defaultDuration} onChange={e => setPreferenceDuration(Number(e.target.value))} /></label></section>
    <div className="practice-flow-note"><Icon name="spark" /><span><strong>主要从课程复盘创建任务</strong><small>Practice 页面负责查看、筛选和执行。临时自主练习可添加独立任务。</small></span><button type="button" onClick={() => setShowComposer(value => !value)}>{showComposer ? "收起独立任务" : "添加独立任务"}</button></div>
    {showComposer && <form className="standalone-composer real-form subtle-composer" onSubmit={createStandaloneTask}><div className="composer-heading"><Icon name="practice" /><div><strong>添加独立任务</strong><p>Free Practice Task · 不关联课程复盘。</p></div></div>
      <label><span>任务标题 *</span><input placeholder="你想练什么？" value={draft.title} onChange={e => setDraft(current => ({...current,title:e.target.value}))} /></label>
      <label><span>任务要点 <small>选填</small></span><textarea rows={2} placeholder="只在有帮助时补充提示" value={draft.keyPoints} onChange={e => setDraft(current => ({...current,keyPoints:e.target.value}))} /></label>
      <fieldset><legend>Focus *</legend><div className="tag-picker compact">{FOCUS_TAGS.map(focus => <button type="button" className={draft.focusTags.includes(focus) ? "selected" : ""} key={focus} onClick={() => toggleDraftFocus(focus)}>{focus}</button>)}</div></fieldset>
      <label><span>自定义 Focus</span><input placeholder="添加自定义标签" value={draft.customFocus} onChange={e => setDraft(current => ({...current,customFocus:e.target.value}))} /></label>
      <div className="duration-editor"><span>倒计时时长 <small>默认 {defaultDuration} 分钟，可修改</small></span><div className="quick-duration task-duration-picks">{DEFAULT_PRACTICE_DURATION_OPTIONS.map(value => <button type="button" className={draft.durationValue === value ? "selected" : ""} key={value} onClick={() => setDraft(current => ({...current,durationValue:value}))}>{value} 分钟</button>)}</div><label><span>自定义分钟数</span><input aria-label="独立任务时长" type="number" min="1" value={draft.durationValue} onChange={e => setDraft(current => ({...current,durationValue:Math.max(1,Number(e.target.value))}))} /></label></div>
      <label className="switch-row"><input type="checkbox" checked={draft.isHighPriority} onChange={e => setDraft(current => ({...current,isHighPriority:e.target.checked}))} /><span><strong>高优先级</strong><small>让这个任务更靠前显示</small></span></label>
      {taskError && <p className="form-error" role="alert">{taskError}</p>}<button className="primary-button enabled" type="submit">保存独立任务 <Icon name="arrow" /></button>
    </form>}
    {saveMessage && <p className="weekly-saved queue-feedback" role="status">✓ {saveMessage}</p>}
    <div className="queue-control-card"><div><Icon name="spark" /><span><strong>当前排序</strong><small>只影响当前页面；高优先级仍会优先显示。</small></span></div><div className="sort-toggle" role="group" aria-label="练习任务排序"><button type="button" className={sortOrder === "newest" ? "selected" : ""} onClick={() => changeSortOrder("newest")}>Newest</button><button type="button" className={sortOrder === "oldest" ? "selected" : ""} onClick={() => changeSortOrder("oldest")}>Oldest</button></div></div>
    <div className="focus-browser" aria-label="按 Focus 浏览练习任务"><button type="button" className={focusFilter === "all" ? "selected" : ""} onClick={() => setFocusFilter("all")}>全部 Focus</button>{availableFocusTags.map(tag => <button type="button" key={tag} className={focusFilter === tag ? "selected" : ""} onClick={() => setFocusFilter(tag)}>{tag}</button>)}</div>
    {timer && <section className={`practice-timer ${timer.completed ? "completed" : ""}`}><div><small>{timer.completed ? "倒计时结束" : "正在练习"}</small><h2>{timer.taskTitle}</h2><p>{timer.completed ? "趁记忆还清晰，记录一下刚才的练习。" : `${timer.targetMinutes} 分钟倒计时 · ${timer.continueAfterDone ? "提示后继续计时" : "提示后停止计时"}`}</p></div><strong>{formatTimer(timer.continueAfterDone ? timer.elapsedSeconds : Math.max(0, timer.targetMinutes * 60 - timer.elapsedSeconds))}</strong><label className="switch-row timer-switch"><input type="checkbox" checked={timer.continueAfterDone} disabled={timer.completed && !timer.isRunning} onChange={e => setTimer(current => current ? { ...current, continueAfterDone:e.target.checked } : current)} /><span><b>提示后继续计时</b><small>总时长会计入练习记录</small></span></label><div className="timer-actions">{timer.isRunning ? <button type="button" onClick={() => setTimer(current => current ? { ...current, isRunning:false } : current)}>暂停</button> : <button type="button" onClick={() => setTimer(current => current ? { ...current, isRunning:true } : current)}>{timer.completed ? "继续计时" : "继续"}</button>}<button type="button" onClick={() => setTimer(null)}>取消</button><Link href={timerLogHref()}>现在记录</Link></div></section>}
    <div className="filter-row"><button className={filter === "active" ? "selected" : ""} onClick={() => setFilter("active")}>进行中 <b>{activeCount}</b></button><button className={filter === "high" ? "selected" : ""} onClick={() => setFilter("high")}>高优先级</button><button className={filter === "new" ? "selected" : ""} onClick={() => setFilter("new")}>尚未练习</button><button className={filter === "finished" ? "selected" : ""} onClick={() => setFilter("finished")}>已消化</button></div>
    <section><SectionTitle>练习任务</SectionTitle><div className="practice-list">
      {savedTasks.length === 0 && <><EmptyState icon="practice" title="练习队列还是空的" text="先从课程复盘创建任务；如果只是自主练习，也可以添加独立任务。" /><Link className="secondary-button empty-state-action" href="/add-class"><Icon name="plus" /> 添加课程复盘</Link></>}
      {sortedTasks.map(task => {
        const taskLogs = logs.filter(log => log.taskId === task.id).sort((a,b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
        const totalMinutes = taskLogs.reduce((sum,log) => sum + logDurationMinutes(log),0);
        const latest = taskLogs[0];
        const statusLabel = task.status === "practicing" ? "练习中" : ["done","digested","completed"].includes(task.status) ? "已消化" : task.isHighPriority ? "高优先级" : task.classReviewId === null ? "独立任务" : "进行中";
        return <article className="practice-card" key={task.id}>{editingTaskId === task.id ? <div className="practice-edit-form real-form"><div className="task-editor-head"><strong>编辑练习任务</strong><button type="button" onClick={() => setEditingTaskId("")}>取消</button></div><label><span>任务标题 *</span><input value={editDraft.title} onChange={event => setEditDraft(current => ({ ...current, title:event.target.value }))} /></label><label><span>任务要点 <small>选填</small></span><textarea rows={2} value={editDraft.keyPoints} onChange={event => setEditDraft(current => ({ ...current, keyPoints:event.target.value }))} /></label><fieldset><legend>Focus *</legend><div className="tag-picker compact edit-focus-picker">{FOCUS_TAGS.map(focus => <button type="button" className={editDraft.focusTags.includes(focus) ? "selected" : ""} key={focus} onClick={() => toggleEditFocus(focus)}>{focus}</button>)}</div>{editDraft.focusTags.some(tag => !FOCUS_TAGS.includes(tag as typeof FOCUS_TAGS[number])) && <div className="tag-picker compact custom-focus-review">{editDraft.focusTags.filter(tag => !FOCUS_TAGS.includes(tag as typeof FOCUS_TAGS[number])).map(tag => <button type="button" className="selected" key={tag} onClick={() => toggleEditFocus(tag)}>{tag}</button>)}</div>}</fieldset><label><span>自定义 Focus</span><input placeholder="添加自定义标签" value={editDraft.customFocus} onChange={event => setEditDraft(current => ({ ...current, customFocus:event.target.value }))} /></label><div className="duration-editor no-border"><span>练习时长</span><div className="quick-duration task-duration-picks">{DEFAULT_PRACTICE_DURATION_OPTIONS.map(value => <button type="button" className={editDraft.durationValue === value ? "selected" : ""} key={value} onClick={() => setEditDraft(current => ({ ...current, durationValue:value }))}>{value} 分钟</button>)}</div><label><span>自定义分钟数</span><input type="number" min="1" value={editDraft.durationValue} onChange={event => setEditDraft(current => ({ ...current, durationValue:Math.max(1, Number(event.target.value)) }))} /></label></div><label className="switch-row"><input type="checkbox" checked={editDraft.isHighPriority} onChange={event => setEditDraft(current => ({ ...current, isHighPriority:event.target.checked }))} /><span><strong>高优先级</strong><small>让这个任务更靠前显示</small></span></label>{taskError && <p className="form-error" role="alert">{taskError}</p>}<button type="button" className="primary-button enabled" onClick={saveEditedTask}>保存修改 <Icon name="arrow" /></button></div> : <><div className="task-top"><span className={`priority-label ${task.isHighPriority ? "" : "medium"}`}>{statusLabel}</span><span><Icon name="clock" size={17} /> {taskDuration(task)}</span></div><h2>{task.title}</h2><p className="source">{task.source}</p><div className="focus-row">{task.focusTags.map(tag => <span key={tag}>{tag}</span>)}</div>{latest && <div className="practice-stats"><div><small>最近练习</small><strong>{latest.date}</strong></div><div><small>累计时长</small><strong>{totalMinutes} 分钟</strong></div></div>}{latest?.nextFocus && <div className="next-note"><small>下次注意</small><p>{latest.nextFocus}</p></div>}{!latest && task.keyPoints && <div className="next-note"><small>任务要点</small><p>{task.keyPoints}</p></div>}<div className="practice-actions"><button type="button" onClick={() => startTimer(task)}><Icon name="clock" size={17} /> 开始倒计时</button><Link className="log-practice-button" href={`/practice/${task.id}/log`}><Icon name="plus" size={17} /> 记录练习</Link></div><div className="task-card-footer">{task.classReviewId ? <Link href={`/classes/${task.classReviewId}`}>查看来源课程</Link> : <span>独立任务</span>}<div><button type="button" onClick={() => startEditTask(task)}>编辑</button>{!["done","digested","completed"].includes(task.status) && <button type="button" onClick={() => changeStatus(task.id,"digested")}>标记已消化</button>}{["done","digested","completed"].includes(task.status) && <button type="button" onClick={() => changeStatus(task.id,"practicing")}>恢复到进行中</button>}</div></div></>}</article>;
      })}
      {savedTasks.length > 0 && sortedTasks.length === 0 && <EmptyState icon="practice" title="这个分类里还没有任务" text={focusFilter === "all" ? "可以切换其他分类，或从课程复盘创建新任务。" : "可以换一个 Focus，或查看全部 Focus。"} />}
    </div></section>
  </div></AppShell>;
}
