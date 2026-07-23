"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { AppShell, Header } from "../components";
import { Icon } from "../icons";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [nextPath, setNextPath] = useState("/settings");

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    const next = query.get("next");
    if (next?.startsWith("/")) setNextPath(next);
    const errorCode = query.get("error");
    if (errorCode === "missing-code") setError("登录链接缺少验证码，请重新发送 Magic Link。");
    if (errorCode === "callback-failed") setError("登录链接已失效或验证失败，请重新发送 Magic Link。");
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const normalizedEmail = email.trim();
    if (!normalizedEmail) return setError("请输入邮箱。");
    setLoading(true);
    setError("");
    setMessage("");
    const response = await fetch("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: normalizedEmail, next: nextPath }),
    });
    const payload = await response.json();
    setLoading(false);
    if (!response.ok) {
      setError(payload?.error || "Magic Link 发送失败，请稍后重试。");
      return;
    }
    setMessage("Magic Link 已发送。请打开邮箱，点击链接完成登录。");
  }

  return <AppShell active="/settings"><div className="page login-page">
    <Header eyebrow="Supabase Auth" title="登录 GroovinLog。" action={<Link className="round-button" href="/settings" aria-label="返回设置">←</Link>} />
    <section className="form-panel auth-panel">
      <div className="settings-summary"><Icon name="spark" /><div><strong>使用邮箱 Magic Link 登录</strong><p>第一版只建立身份认证，不会上传、删除或迁移你当前浏览器里的 localStorage 数据。</p></div></div>
      <form className="real-form auth-form" onSubmit={submit}>
        <label><span>Email</span><input type="email" autoComplete="email" inputMode="email" placeholder="you@example.com" value={email} onChange={event => setEmail(event.target.value)} /></label>
        {error && <p className="form-error" role="alert">{error}</p>}
        {message && <p className="weekly-saved" role="status">✓ {message}</p>}
        <button className="primary-button enabled" type="submit" disabled={loading}>{loading ? "发送中…" : "发送 Magic Link"} <Icon name="arrow" /></button>
      </form>
    </section>
    <div className="pwa-note settings-note"><Icon name="spark" /><p>登录成功后，GroovinLog 可以识别你的 user.id，为后续本地数据迁移到 Supabase 做准备。</p></div>
  </div></AppShell>;
}
