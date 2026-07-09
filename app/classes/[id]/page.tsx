"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { AppShell, EmptyState, Header, SectionTitle } from "../../components";
import { Icon } from "../../icons";
import { ClassReview, logDurationMinutes, PracticeLog, taskDuration, VideoReferenceType } from "../../lib/models";
import { readClassReviews, readPracticeLogs } from "../../lib/storage";

const referenceLabels: Record<VideoReferenceType,string> = { album_note:"相册位置", local_filename:"本地文件名", cloud_link:"云端链接", external_link:"外部链接" };

export default function ClassDetail() {
  const params = useParams<{id:string}>();
  const [review, setReview] = useState<ClassReview | null | undefined>(undefined);
  const [practiceLogs, setPracticeLogs] = useState<PracticeLog[]>([]);
  const [saveMessage, setSaveMessage] = useState("");
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setReview(readClassReviews().find(item => item.id === params.id) ?? null);
      setPracticeLogs(readPracticeLogs().filter(log => log.classId === params.id).sort((a,b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)));
      const query = new URLSearchParams(window.location.search);
      setSaveMessage(query.get("practiceSaved") === "1" ? "练习记录已保存" : query.get("saved") === "1" ? "课程和任务已保存" : "");
    }, 0);
    return () => window.clearTimeout(timer);
  }, [params.id]);

  return <AppShell active=""><div className="page class-detail-page">
    {review === undefined ? <EmptyState icon="spark" title="正在加载课程复盘" text="请稍候。" /> : review === null ? <><Header eyebrow="课程复盘" title="没有找到这节课" /><EmptyState icon="spark" title="此设备上没有这条课程记录" text="本地课程复盘只保存在创建它的浏览器中。" /><Link className="primary-button enabled" href="/add-class">添加课程复盘 <Icon name="arrow" /></Link></> : <>
      <Header eyebrow={`${review.date} · ${review.danceStyle.toUpperCase()}`} title={review.classTheme} action={<Link className="round-button" href="/add-class" aria-label="添加另一节课"><Icon name="plus" /></Link>} />
      {saveMessage && <div className="saved-banner" role="status"><span>✓</span><div><strong>{saveMessage}</strong><p>已保存在此设备。</p></div></div>}
      <section className="detail-hero"><span>授课老师</span><h2>{review.teacher}</h2><p>{review.danceStyle} · {review.date}</p>{(review.difficulty || review.classCondition) && <div className="class-meta-pills">{review.difficulty && <span>{review.difficulty === "Beginner zero" ? "零基础" : review.difficulty === "Beginner" ? "初级" : review.difficulty === "Improving" ? "提高" : review.difficulty}</span>}{review.classCondition && <span>{review.classCondition === "Tired" ? "◔ 疲惫" : review.classCondition === "Okay" ? "● 还行" : "✦ 特别好"}</span>}</div>}</section>
      {(review.whatILearned || review.notDigested) ? <>{review.whatILearned && <section><SectionTitle>今天学会了什么</SectionTitle><div className="reflection-card"><p>{review.whatILearned}</p></div></section>}{review.notDigested && <section><SectionTitle>还有什么没消化</SectionTitle><div className="reflection-card stuck"><p>{review.notDigested}</p></div></section>}</> : <section><SectionTitle>课堂复盘</SectionTitle><div className="no-reference">没有填写课堂复盘，也没关系。</div></section>}
      <section><SectionTitle>视频引用</SectionTitle>{review.videoReference ? <div className="video-reference"><Icon name="play" /><div><small>{referenceLabels[review.videoReference.type]}</small>{review.videoReference.type.includes("link") ? <a href={review.videoReference.value} target="_blank" rel="noreferrer">{review.videoReference.value}</a> : <strong>{review.videoReference.value}</strong>}<p>PWA 版本不会上传视频，也不能永久绑定 iOS 相册视频；这里只保存视频文件名、位置备注或链接。</p></div></div> : <div className="no-reference">没有添加视频引用。PWA 版本不会上传视频，也不能永久绑定 iOS 相册视频；这里只保存视频文件名、位置备注或链接。</div>}</section>
      <section><SectionTitle>练习任务</SectionTitle>{review.tasks.length ? <div className="detail-task-list">{review.tasks.map(task => <article key={task.id}><div><span>{task.status === "practicing" ? "练习中" : ["done","digested","completed"].includes(task.status) ? "已消化" : task.isHighPriority ? "高优先级" : "进行中"}</span><em>{taskDuration(task)}</em></div><h3>{task.title}</h3>{task.keyPoints && <p>{task.keyPoints}</p>}<div className="focus-row">{task.focusTags.map(tag => <span key={tag}>{tag}</span>)}</div><Link className="inline-log-link" href={`/practice/${task.id}/log`}>记录练习 <Icon name="arrow" size={15} /></Link></article>)}</div> : <div className="no-reference">这节课还没有关联练习任务。</div>}</section>
      <section><SectionTitle>练习记录</SectionTitle>{practiceLogs.length ? <><div className="history-summary"><div><strong>{practiceLogs.length}</strong><span>练习次数</span></div><div><strong>{practiceLogs.reduce((sum,log) => sum + logDurationMinutes(log),0)}</strong><span>分钟</span></div><div><strong>{Math.round(practiceLogs.reduce((sum,log) => sum + log.progressScore,0) / practiceLogs.length)}</strong><span>平均进步评分</span></div></div><div className="practice-history">{practiceLogs.map(log => { const task = review.tasks.find(item => item.id === log.taskId); return <article key={log.id}><div className="history-date"><strong>{new Date(`${log.date}T00:00:00`).toLocaleDateString("zh-CN",{day:"2-digit"})}</strong><span>{new Date(`${log.date}T00:00:00`).toLocaleDateString("zh-CN",{month:"short"})}</span></div><div><small>{task?.title ?? "练习"} · {logDurationMinutes(log)} 分钟</small><h3>{log.practiceContent}</h3><p>进步评分 {log.progressScore}/5</p>{log.nextFocus && <blockquote><b>下次注意</b> {log.nextFocus}</blockquote>}</div></article>})}</div></> : <div className="no-reference">还没有练习记录。第一次练习后会显示在这里。</div>}</section>
      <Link className="primary-button enabled" href="/practice">前往练习队列 <Icon name="arrow" /></Link>
    </>}
  </div></AppShell>;
}
