"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AppShell, Header, SectionTitle } from "../components";
import { Icon } from "../icons";
import { AppPreferences } from "../lib/models";
import { DEFAULT_PREFERENCES, readPreferences, savePreferences } from "../lib/storage";

const SETTINGS_DURATION_OPTIONS = [10, 15, 20, 30] as const;
type AccountUser = { email?: string | null };

export default function Settings() {
  const [preferences, setPreferences] = useState<AppPreferences>(DEFAULT_PREFERENCES);
  const [saved, setSaved] = useState("");
  const [user, setUser] = useState<AccountUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setPreferences(readPreferences());
    const query = new URLSearchParams(window.location.search);
    if (query.get("loggedOut") === "1") setSaved("已退出 Supabase 账号。本机 localStorage 数据没有被删除。");
    async function loadUser() {
      const response = await fetch("/auth/me", { cache: "no-store" });
      const payload = await response.json();
      if (!active) return;
      setUser(response.ok ? payload.user : null);
      setAuthLoading(false);
    }
    void loadUser();
    return () => {
      active = false;
    };
  }, []);

  function updatePreferences(patch: Partial<AppPreferences>, message: string) {
    const next = savePreferences(patch);
    setPreferences(next);
    setSaved(message);
  }

  function updateDuration(value: number) {
    const duration = Math.max(1, Math.round(value));
    updatePreferences({ defaultPracticeDurationMinutes: duration }, `默认练习时长已设为 ${duration} 分钟。`);
  }

  return <AppShell active="/settings"><div className="page settings-page">
    <Header eyebrow="偏好设置" title="让记录更省力。" action={<Link className="round-button" href="/" aria-label="返回首页">←</Link>} />

    {saved && <p className="weekly-saved" role="status">✓ {saved}</p>}

    <section className="form-panel settings-panel account-panel">
      <SectionTitle>账号</SectionTitle>
      <div className="settings-summary"><Icon name="spark" /><div><strong>{authLoading ? "正在检查登录状态" : user ? "已登录" : "未登录"}</strong><p>{user ? `当前账号：${user.email ?? "Supabase user"}` : "登录后可以识别你的 user.id，为后续把本机记录安全迁移到 Supabase 做准备。"}</p></div></div>
      {user ? <form action="/auth/logout" method="post"><button className="secondary-button account-action" type="submit">退出登录</button></form> : <Link className="primary-button enabled account-action" href="/login?next=/settings">登录 / 注册 <Icon name="arrow" /></Link>}
      <p className="settings-help">Phase 2 只建立身份认证；当前课程、练习和复盘仍然继续保存在本机浏览器中。</p>
    </section>

    <section className="form-panel settings-panel">
      <SectionTitle>练习默认值</SectionTitle>
      <div className="settings-summary"><Icon name="practice" /><div><strong>{preferences.defaultPracticeDurationMinutes} 分钟</strong><p>创建新的练习任务时默认带入，单个任务仍然可以手动修改。</p></div></div>
      <div className="quick-duration settings-duration-picks">
        {SETTINGS_DURATION_OPTIONS.map(value => <button type="button" className={preferences.defaultPracticeDurationMinutes === value ? "selected" : ""} key={value} onClick={() => updateDuration(value)}>{value} 分钟</button>)}
      </div>
      <label className="settings-number-field"><span>Custom</span><input aria-label="自定义默认练习时长" type="number" min="1" max="999" value={preferences.defaultPracticeDurationMinutes} onChange={event => updateDuration(Number(event.target.value))} /></label>
    </section>

    <section className="form-panel settings-panel">
      <SectionTitle>课程复盘显示</SectionTitle>
      <label className="switch-row settings-switch"><input type="checkbox" checked={preferences.showDifficulty} onChange={event => updatePreferences({ showDifficulty:event.target.checked }, event.target.checked ? "已显示课程难度。" : "已默认隐藏课程难度。")} /><span><strong>Show Difficulty</strong><small>关闭后不再默认显示 Difficulty；历史数据不会删除。</small></span></label>
      <label className="switch-row settings-switch"><input type="checkbox" checked={preferences.showBodyStatus} onChange={event => updatePreferences({ showBodyStatus:event.target.checked }, event.target.checked ? "已显示上课状态。" : "已默认隐藏上课状态。")} /><span><strong>Show Body Status</strong><small>关闭后不再默认显示 Body Status；历史数据不会删除。</small></span></label>
    </section>

    <section className="form-panel settings-panel">
      <SectionTitle>练习队列排序</SectionTitle>
      <p className="settings-help">Practice 页面首次加载时使用这个默认排序；进入页面后仍可临时切换。</p>
      <div className="sort-toggle" role="group" aria-label="默认练习排序">
        <button type="button" className={preferences.practiceQueueSortOrder === "newest" ? "selected" : ""} onClick={() => updatePreferences({ practiceQueueSortOrder:"newest" }, "默认排序已设为最新优先。")}>最新优先</button>
        <button type="button" className={preferences.practiceQueueSortOrder === "oldest" ? "selected" : ""} onClick={() => updatePreferences({ practiceQueueSortOrder:"oldest" }, "默认排序已设为最早优先。")}>最早优先</button>
      </div>
    </section>

    <div className="pwa-note settings-note"><Icon name="spark" /><p>这些偏好只保存在本机浏览器中，清除浏览器数据或更换设备可能会丢失设置。</p></div>
  </div></AppShell>;
}
