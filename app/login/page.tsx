"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppShell, Header } from "../components";
import { Icon } from "../icons";
import { createClient } from "../lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [magicLinkLoading, setMagicLinkLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [nextPath, setNextPath] = useState("/settings");

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    const next = query.get("next");
    if (next?.startsWith("/")) setNextPath(next);
    const errorCode = query.get("error");
    if (errorCode === "missing-code") setError("登录链接缺少验证码，请重新发送 Magic Link。");
    if (errorCode === "callback-failed") setError("登录链接已失效或验证失败，请重新发送 Magic Link。");
  }, []);

  async function submitPasswordLogin(event: FormEvent) {
    event.preventDefault();
    const normalizedEmail = email.trim();
    if (!normalizedEmail) return setError("请输入邮箱。");
    if (!password) return setError("请输入密码。");
    setPasswordLoading(true);
    setError("");
    setMessage("");

    try {
      const supabase = await createClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });
      if (signInError) {
        setError(signInError.message || "邮箱或密码不正确。");
        return;
      }
      router.push(nextPath);
      router.refresh();
    } catch {
      setError("登录失败，请稍后重试。");
    } finally {
      setPasswordLoading(false);
    }
  }

  async function submitMagicLink(event: FormEvent) {
    event.preventDefault();
    const normalizedEmail = email.trim();
    if (!normalizedEmail) return setError("请输入邮箱。");
    setMagicLinkLoading(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch("/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalizedEmail, next: nextPath }),
      });
      const payload = await response.json().catch(() => null) as { error?: string; ok?: boolean } | null;

      if (!response.ok) {
        setError(payload?.error || "Magic Link 发送失败，请稍后重试。");
        return;
      }
    } catch {
      setMessage("Magic Link 请求已发出。请先检查邮箱；如果没有收到，再重新发送。");
      return;
    } finally {
      setMagicLinkLoading(false);
    }

    setMessage("Magic Link 已发送。请打开邮箱，点击链接完成登录。");
  }

  return <AppShell active="/settings"><div className="page login-page">
    <Header eyebrow="Supabase Auth" title="登录 GroovinLog。" action={<Link className="round-button" href="/settings" aria-label="返回设置">←</Link>} />
    <section className="form-panel auth-panel">
      <div className="settings-summary"><Icon name="spark" /><div><strong>登录账号</strong><p>可以使用已设置的密码登录；没有密码时仍可发送 Magic Link。</p></div></div>
      <form className="real-form auth-form" onSubmit={submitPasswordLogin}>
        <label><span>Email</span><input type="email" autoComplete="email" inputMode="email" placeholder="you@example.com" value={email} onChange={event => setEmail(event.target.value)} /></label>
        <label><span>Password</span><input type="password" autoComplete="current-password" placeholder="输入已设置的密码" value={password} onChange={event => setPassword(event.target.value)} /></label>
        {error && <p className="form-error" role="alert">{error}</p>}
        {message && <p className="weekly-saved" role="status">✓ {message}</p>}
        <button className="primary-button enabled" type="submit" disabled={passwordLoading || magicLinkLoading}>{passwordLoading ? "登录中…" : "Log in"} <Icon name="arrow" /></button>
      </form>
      <form className="real-form auth-form" onSubmit={submitMagicLink}>
        <button className="secondary-button account-action" type="submit" disabled={passwordLoading || magicLinkLoading}>{magicLinkLoading ? "发送中…" : "发送 Magic Link"}</button>
      </form>
    </section>
    <div className="pwa-note settings-note"><Icon name="spark" /><p>登录成功后，GroovinLog 可以识别你的 user.id，为后续本地数据迁移到 Supabase 做准备。</p></div>
  </div></AppShell>;
}
