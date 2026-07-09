"use client";

import { FormEvent, KeyboardEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell, Header } from "../components";
import { Icon } from "../icons";
import { ClassReview, FOCUS_TAGS, localDateKey, PracticeTask, VideoReferenceType } from "../lib/models";
import { readClassReviews, saveClassReview } from "../lib/storage";

type TaskDraft = {
  title: string;
  keyPoints: string;
  focusTags: string[];
  customFocus: string;
  isHighPriority: boolean;
  durationValue: number;
};

const emptyTask = (): TaskDraft => ({
  title: "", keyPoints: "", focusTags: [], customFocus: "", isHighPriority: false, durationValue: 15,
});

export default function AddClass() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [error, setError] = useState("");
  const [classInfo, setClassInfo] = useState({
    date: localDateKey(), teacher: "", danceStyle: "", classTheme: "", difficulty: "", customDifficulty: "", classCondition: "" as "" | "Tired" | "Okay" | "Great", whatILearned: "", notDigested: "",
  });
  const [savedTags, setSavedTags] = useState({ teachers: ["Mia", "Lynn", "Kai"], styles: ["Hiphop", "House", "Freestyle"] });
  const [videoType, setVideoType] = useState<VideoReferenceType>("album_note");
  const [videoValue, setVideoValue] = useState("");
  const [pickedFilename, setPickedFilename] = useState("");
  const [tasks, setTasks] = useState<TaskDraft[]>([emptyTask()]);

  const stepOneValid = useMemo(() => [classInfo.date, classInfo.teacher, classInfo.danceStyle, classInfo.classTheme].every(value => value.trim()), [classInfo]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const reviews = readClassReviews();
      setSavedTags({
        teachers: Array.from(new Set([...reviews.map(item => item.teacher), "Mia", "Lynn", "Kai"])).filter(Boolean).slice(0, 10),
        styles: Array.from(new Set([...reviews.map(item => item.danceStyle), "Hiphop", "House", "Freestyle"])).filter(Boolean).slice(0, 10),
      });
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  function updateClass(key: keyof typeof classInfo, value: string) {
    setClassInfo(current => ({ ...current, [key]: value }));
  }

  function updateTask(index: number, patch: Partial<TaskDraft>) {
    setTasks(current => current.map((task, taskIndex) => taskIndex === index ? { ...task, ...patch } : task));
  }

  function toggleFocus(index: number, focus: string) {
    const selected = tasks[index].focusTags;
    updateTask(index, { focusTags: selected.includes(focus) ? selected.filter(item => item !== focus) : [...selected, focus] });
  }

  function continueToTasks(event: FormEvent) {
    event.preventDefault();
    if (!stepOneValid) return setError("请填写日期、老师、舞种和课程主题后再继续。");
    setError("");
    setStep(2);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function saveReview(event: FormEvent) {
    event.preventDefault();
    const completedTasks = tasks.filter(task => task.title.trim());
    if (!completedTasks.length) return setError("请至少填写一个练习任务标题。");
    const missingFocus = completedTasks.some(task => !task.focusTags.length && !task.customFocus.trim());
    if (missingFocus) return setError("请为每个任务选择或添加至少一个 Focus。");

    const reviewId = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    const savedTasks: PracticeTask[] = completedTasks.map(task => ({
      id: crypto.randomUUID(), classReviewId: reviewId, title: task.title.trim(), keyPoints: task.keyPoints.trim(),
      focusTags: [...task.focusTags, ...(task.customFocus.trim() ? [task.customFocus.trim()] : [])],
      isHighPriority: task.isHighPriority, durationUnit: "minutes", durationValue: task.durationValue, suggestedDurationMinutes: task.durationValue, status: "active", createdAt,
    }));
    const difficulty = classInfo.difficulty === "Custom" ? classInfo.customDifficulty.trim() : classInfo.difficulty;
    const review: ClassReview = {
      id: reviewId, date: classInfo.date, teacher: classInfo.teacher, danceStyle: classInfo.danceStyle, classTheme: classInfo.classTheme,
      difficulty: difficulty || undefined, classCondition: classInfo.classCondition || undefined,
      whatILearned: classInfo.whatILearned, notDigested: classInfo.notDigested, tasks: savedTasks, createdAt,
      ...(videoValue.trim() ? { videoReference: { type: videoType, value: videoValue.trim() } } : {}),
    };
    saveClassReview(review);
    router.push(`/classes/${reviewId}?saved=1`);
  }

  function chooseTag(key: "teacher" | "danceStyle", value: string) {
    updateClass(key, value);
  }

  function acceptTagInput(event: KeyboardEvent<HTMLInputElement>, key: "teacher" | "danceStyle") {
    if (event.key === "Enter") {
      event.preventDefault();
      const value = event.currentTarget.value.trim();
      if (value) chooseTag(key, value);
    }
  }

  return <AppShell active="/add-class"><div className="page add-class-page">
    <Header eyebrow={`第 ${step}/2 步 · ${step === 1 ? "课程复盘" : "练习任务"}`} title={step === 1 ? "记下今天的收获。" : "安排下一步练习。"} action={step === 2 ? <button className="round-button" onClick={() => setStep(1)} aria-label="返回课程复盘">←</button> : undefined} />
    <div className="flow-progress" aria-label={`第 ${step}/2 步`}><i className="done" /><i className={step === 2 ? "done" : ""} /></div>

    {step === 1 ? <form onSubmit={continueToTasks} className="real-form">
      <section className="form-panel"><div className="form-step"><span>01</span><div><h2>课程信息</h2><p>填写必要信息，方便之后找到这节课</p></div></div>
        <div className="input-grid"><label><span>日期 *</span><input type="date" value={classInfo.date} onChange={e => updateClass("date", e.target.value)} /></label><label><span>课程主题 *</span><input placeholder="例如：Bounce & Arms" value={classInfo.classTheme} onChange={e => updateClass("classTheme", e.target.value)} /></label></div>
        <div className="repeatable-tag-field"><span>老师 *</span><div className="tag-picker compact">{savedTags.teachers.map(tag => <button type="button" className={classInfo.teacher === tag ? "selected" : ""} key={tag} onClick={() => chooseTag("teacher",tag)}>{tag}</button>)}</div><input aria-label="自定义老师" placeholder="输入新老师，按回车确认" value={classInfo.teacher && !savedTags.teachers.includes(classInfo.teacher) ? classInfo.teacher : ""} onChange={e => updateClass("teacher",e.target.value)} onKeyDown={e => acceptTagInput(e,"teacher")} /></div>
        <div className="repeatable-tag-field"><span>舞种 *</span><div className="tag-picker compact">{savedTags.styles.map(tag => <button type="button" className={classInfo.danceStyle === tag ? "selected" : ""} key={tag} onClick={() => chooseTag("danceStyle",tag)}>{tag}</button>)}</div><input aria-label="自定义舞种" placeholder="输入新舞种，按回车确认" value={classInfo.danceStyle && !savedTags.styles.includes(classInfo.danceStyle) ? classInfo.danceStyle : ""} onChange={e => updateClass("danceStyle",e.target.value)} onKeyDown={e => acceptTagInput(e,"danceStyle")} /></div>
        <div className="optional-block"><span>课程难度 <small>选填</small></span><div className="tag-picker compact">{[["Beginner zero","零基础"], ["Beginner","初级"], ["Improving","提高"], ["Custom","自定义"]].map(([value,label]) => <button type="button" className={classInfo.difficulty === value ? "selected" : ""} key={value} onClick={() => updateClass("difficulty",value)}>{label}</button>)}</div>{classInfo.difficulty === "Custom" && <input aria-label="自定义难度" placeholder="填写难度名称" value={classInfo.customDifficulty} onChange={e => updateClass("customDifficulty",e.target.value)} />}</div>
        <div className="optional-block"><span>上课状态 <small>选填</small></span><div className="feeling-picker">{([['Tired','疲惫'],['Okay','还行'],['Great','特别好']] as const).map(([value,label]) => <button type="button" className={classInfo.classCondition === value ? "selected" : ""} key={value} onClick={() => updateClass("classCondition",classInfo.classCondition === value ? "" : value)}>{value === "Tired" ? "◔" : value === "Okay" ? "●" : "✦"} {label}</button>)}</div></div>
      </section>
      <section className="form-panel"><div className="form-step"><span>02</span><div><h2>课堂复盘 <small>选填</small></h2><p>想快速保存课程时可以跳过</p></div></div>
        <label><span>今天学会了什么？</span><textarea rows={3} placeholder="简单记下一点就好" value={classInfo.whatILearned} onChange={e => updateClass("whatILearned", e.target.value)} /></label>
        <label><span>还有什么没消化？</span><textarea rows={3} placeholder="有没有之后想再练的内容？" value={classInfo.notDigested} onChange={e => updateClass("notDigested", e.target.value)} /></label>
      </section>
      <section className="form-panel"><div className="form-step"><span>03</span><div><h2>视频引用 <small>选填</small></h2><p>只记录复盘视频的位置，不会上传视频</p></div></div>
        <p className="limit-note">PWA 版本不会上传视频，也不能永久绑定 iOS 相册视频；这里只保存视频文件名、位置备注或链接，方便你之后回相册查找。</p>
        <div className="reference-types">{([['album_note','相册位置'],['local_filename','文件名'],['cloud_link','云端链接'],['external_link','其他链接']] as [VideoReferenceType,string][]).map(([type,label]) => <button type="button" key={type} className={videoType === type ? "selected" : ""} onClick={() => setVideoType(type)}>{label}</button>)}</div>
        <label><span>{videoType === "album_note" ? "相册位置" : videoType === "local_filename" ? "视频文件名" : "视频链接"}</span><input type={videoType.includes("link") ? "url" : "text"} placeholder={videoType === "album_note" ? "个人收藏 · 7月6日 Hiphop" : videoType === "local_filename" ? "IMG_2048.MOV" : "https://…"} value={videoValue} onChange={e => setVideoValue(e.target.value)} /></label>
        <label className="file-picker"><Icon name="play" /><span><strong>选择视频文件名</strong><small>仅读取文件名，不会上传、复制或保存视频本体。</small></span><input type="file" accept="video/*" onChange={e => { const name = e.target.files?.[0]?.name ?? ""; setPickedFilename(name); setVideoType("local_filename"); setVideoValue(name); }} /></label>
        {pickedFilename && <p className="picked-file">已选择：{pickedFilename}</p>}
      </section>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="primary-button enabled" type="submit">继续创建练习任务 <Icon name="arrow" /></button>
    </form> : <form onSubmit={saveReview} className="real-form">
      <div className="task-source-summary"><Icon name="spark" /><div><small>来自这节课</small><strong>{classInfo.classTheme}</strong><span>{classInfo.teacher} · {classInfo.danceStyle}</span></div></div>
      {tasks.map((task, index) => <section className="form-panel task-editor" key={index}><div className="task-editor-head"><div className="form-step"><span>{String(index + 1).padStart(2,"0")}</span><div><h2>练习任务</h2><p>用自己的话写下来</p></div></div>{tasks.length > 1 && <button type="button" onClick={() => setTasks(current => current.filter((_, i) => i !== index))}>删除</button>}</div>
        <label><span>任务标题 *</span><input placeholder="例如：把 Arm Bounce 连进 Groove" value={task.title} onChange={e => updateTask(index,{title:e.target.value})} /></label>
        <label><span>任务要点 <small>选填</small></span><textarea rows={3} placeholder="只在有帮助时补充提示" value={task.keyPoints} onChange={e => updateTask(index,{keyPoints:e.target.value})} /></label>
        <fieldset><legend>Focus *</legend><div className="tag-picker">{FOCUS_TAGS.map(focus => <button type="button" className={task.focusTags.includes(focus) ? "selected" : ""} key={focus} onClick={() => toggleFocus(index,focus)}>{focus}</button>)}</div></fieldset>
        <label><span>自定义 Focus</span><input placeholder="添加自定义标签" value={task.customFocus} onChange={e => updateTask(index,{customFocus:e.target.value})} /></label>
        <div className="duration-editor"><span>练习倒计时 <small>选填</small></span><div className="quick-duration task-duration-picks">{[5,10,15,20,30].map(value => <button type="button" className={task.durationValue === value ? "selected" : ""} key={value} onClick={() => updateTask(index,{durationValue:value})}>{value} 分钟</button>)}</div><label><span>自定义分钟数</span><input aria-label={`任务 ${index + 1} 时长`} type="number" min="1" max="999" value={task.durationValue} onChange={e => updateTask(index,{durationValue:Math.max(1,Number(e.target.value))})} /></label></div>
        <div className="task-options single"><label className="switch-row"><input type="checkbox" checked={task.isHighPriority} onChange={e => updateTask(index,{isHighPriority:e.target.checked})} /><span><strong>高优先级</strong><small>让这个任务更靠前显示</small></span></label></div>
      </section>)}
      <button className="secondary-button" type="button" onClick={() => setTasks(current => [...current, emptyTask()])}><Icon name="plus" /> 再添加一个任务</button>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="primary-button enabled" type="submit">保存课程和任务 <Icon name="arrow" /></button>
    </form>}
  </div></AppShell>;
}
