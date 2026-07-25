"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { AppShell, Header, SectionTitle } from "../components";
import { Icon } from "../icons";
import { DEFAULT_PREFERENCES, getDataRepository } from "../lib/data-repository";
import { AppPreferences } from "../lib/models";
import { createClient } from "../lib/supabase/client";

const SETTINGS_DURATION_OPTIONS = [10, 15, 20, 30] as const;
type AccountUser = { id: string; email?: string | null };

export default function Settings() {
  const [preferences, setPreferences] = useState<AppPreferences>(DEFAULT_PREFERENCES);
  const [saved, setSaved] = useState("");
  const [settingsError, setSettingsError] = useState("");
  const [preferencesLoading, setPreferencesLoading] = useState(true);
  const [preferencesSaving, setPreferencesSaving] = useState(false);
  const [user, setUser] = useState<AccountUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState("");

  useEffect(() => {
    let active = true;
    const query = new URLSearchParams(window.location.search);
    if (query.get("loggedOut") === "1") setSaved("已退出 Supabase 账号。本机 localStorage 数据没有被删除。");
    async function loadPreferences() {
      try {
        const repository = await getDataRepository();
        const nextPreferences = await repository.readPreferences();
        if (!active) return;
        setPreferences(nextPreferences);
        setSettingsError("");
      } catch (caught) {
        if (!active) return;
        setSettingsError(caught instanceof Error ? caught.message : "偏好设置读取失败，请稍后重试。");
      } finally {
        if (active) setPreferencesLoading(false);
      }
    }
    async function loadUser() {
      const response = await fetch("/auth/me", { cache: "no-store" });
      const payload = await response.json();
      if (!active) return;
      setUser(response.ok ? payload.user : null);
      setAuthLoading(false);
    }
    void loadPreferences();
    void loadUser();
    return () => {
      active = false;
    };
  }, []);

  async function updatePreferences(patch: Partial<AppPreferences>, message: string) {
    if (preferencesSaving) return;
    setPreferencesSaving(true);
    setSettingsError("");
    try {
      const repository = await getDataRepository();
      const next = await repository.savePreferences(patch);
      setPreferences(next);
      setSaved(message);
    } catch (caught) {
      setSettingsError(caught instanceof Error ? caught.message : "偏好设置保存失败，请稍后重试。");
    } finally {
      setPreferencesSaving(false);
    }
  }

  function updateDuration(value: number) {
    const duration = Math.max(1, Math.round(value));
    void updatePreferences({ defaultPracticeDurationMinutes: duration }, `默认练习时长已设为 ${duration} 分钟。`);
  }

  async function setAccountPassword(event: FormEvent) {
    event.preventDefault();
    if (!user) return setPasswordError("请先登录后再设置密码。");
    if (!newPassword || !confirmPassword) return setPasswordError("请输入新密码并再次确认。");
    if (newPassword.length < 6) return setPasswordError("密码至少需要 6 个字符。");
    if (newPassword !== confirmPassword) return setPasswordError("两次输入的密码不一致。");

    setPasswordLoading(true);
    setPasswordError("");
    setSaved("");
    try {
      const supabase = await createClient();
      const before = await supabase.auth.getUser();
      if (before.error || !before.data.user) {
        setUser(null);
        setPasswordError("登录状态已失效，请重新登录后再设置密码。");
        return;
      }
      const userIdBefore = before.data.user.id;
      const { error } = await supabase.auth.updateUser({ password:newPassword });
      if (error) {
        setPasswordError(error.message || "Password set failed.");
        return;
      }
      const after = await supabase.auth.getUser();
      if (after.error || !after.data.user || after.data.user.id !== userIdBefore) {
        setPasswordError("密码已提交，但账号状态验证失败，请重新登录检查。");
        return;
      }
      setUser({ id:after.data.user.id, email:after.data.user.email ?? null });
      setNewPassword("");
      setConfirmPassword("");
      setSaved("Password set successfully.");
    } catch {
      setPasswordError("Password set failed.");
    } finally {
      setPasswordLoading(false);
    }
  }

  return <AppShell active="/settings"><div className="page settings-page">
    <Header eyebrow="偏好设置" title="让记录更省力。" action={<Link className="round-button" href="/" aria-label="返回首页">←</Link>} />

    {saved && <p className="weekly-saved" role="status">✓ {saved}</p>}
    {settingsError && <p className="form-error" role="alert">{settingsError}</p>}

    <section className="form-panel settings-panel account-panel">
      <SectionTitle>账号</SectionTitle>
      <div className="settings-summary"><Icon name="spark" /><div><strong>{authLoading ? "正在检查登录状态" : user ? "已登录" : "未登录"}</strong><p>{user ? `当前账号：${user.email ?? "Supabase user"}` : "登录后可以读取已迁移的 Supabase 云端数据；未登录时继续使用本机数据。"}</p></div></div>
      {user ? <>
        <form className="real-form auth-form" onSubmit={setAccountPassword}>
          <label><span>New Password</span><input type="password" autoComplete="new-password" value={newPassword} onChange={event => setNewPassword(event.target.value)} /></label>
          <label><span>Confirm Password</span><input type="password" autoComplete="new-password" value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} /></label>
          {passwordError && <p className="form-error" role="alert">{passwordError}</p>}
          <button className="primary-button enabled account-action" type="submit" disabled={passwordLoading}>{passwordLoading ? "设置中…" : "Set Password"}</button>
        </form>
        <form action="/auth/logout" method="post"><button className="secondary-button account-action" type="submit">退出登录</button></form>
      </> : <Link className="primary-button enabled account-action" href="/login?next=/settings">登录 / 注册 <Icon name="arrow" /></Link>}
      <p className="settings-help">账号用于云端读取和保存已迁移数据；未登录或未完成迁移时，GroovinLog 会继续使用本机浏览器数据。</p>
    </section>

    <section className="form-panel settings-panel">
      <SectionTitle>练习默认值</SectionTitle>
      <div className="settings-summary"><Icon name="practice" /><div><strong>{preferencesLoading ? "正在读取" : `${preferences.defaultPracticeDurationMinutes} 分钟`}</strong><p>创建新的练习任务时默认带入，单个任务仍然可以手动修改。</p></div></div>
      <div className="quick-duration settings-duration-picks">
        {SETTINGS_DURATION_OPTIONS.map(value => <button type="button" disabled={preferencesLoading || preferencesSaving} className={preferences.defaultPracticeDurationMinutes === value ? "selected" : ""} key={value} onClick={() => updateDuration(value)}>{value} 分钟</button>)}
      </div>
      <label className="settings-number-field"><span>Custom</span><input aria-label="自定义默认练习时长" disabled={preferencesLoading || preferencesSaving} type="number" min="1" max="999" value={preferences.defaultPracticeDurationMinutes} onChange={event => updateDuration(Number(event.target.value))} /></label>
    </section>

    <section className="form-panel settings-panel">
      <SectionTitle>课程复盘显示</SectionTitle>
      <label className="switch-row settings-switch"><input type="checkbox" disabled={preferencesLoading || preferencesSaving} checked={preferences.showDifficulty} onChange={event => void updatePreferences({ showDifficulty:event.target.checked }, event.target.checked ? "已显示课程难度。" : "已默认隐藏课程难度。")} /><span><strong>Show Difficulty</strong><small>关闭后不再默认显示 Difficulty；历史数据不会删除。</small></span></label>
      <label className="switch-row settings-switch"><input type="checkbox" disabled={preferencesLoading || preferencesSaving} checked={preferences.showBodyStatus} onChange={event => void updatePreferences({ showBodyStatus:event.target.checked }, event.target.checked ? "已显示上课状态。" : "已默认隐藏上课状态。")} /><span><strong>Show Body Status</strong><small>关闭后不再默认显示 Body Status；历史数据不会删除。</small></span></label>
    </section>

    <section className="form-panel settings-panel">
      <SectionTitle>练习队列排序</SectionTitle>
      <p className="settings-help">Practice 页面首次加载时使用这个默认排序；进入页面后仍可临时切换。</p>
      <div className="sort-toggle" role="group" aria-label="默认练习排序">
        <button type="button" disabled={preferencesLoading || preferencesSaving} className={preferences.practiceQueueSortOrder === "newest" ? "selected" : ""} onClick={() => void updatePreferences({ practiceQueueSortOrder:"newest" }, "默认排序已设为最新优先。")}>最新优先</button>
        <button type="button" disabled={preferencesLoading || preferencesSaving} className={preferences.practiceQueueSortOrder === "oldest" ? "selected" : ""} onClick={() => void updatePreferences({ practiceQueueSortOrder:"oldest" }, "默认排序已设为最早优先。")}>最早优先</button>
      </div>
    </section>

    <div className="pwa-note settings-note"><Icon name="spark" /><p>登录且完成迁移后，偏好会保存到云端；否则保存在本机浏览器中。</p></div>
  </div></AppShell>;
}
