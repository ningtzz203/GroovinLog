import { NextRequest, NextResponse } from "next/server";
import { createClient } from "../../lib/supabase/server";

function cleanNext(value: unknown) {
  return typeof value === "string" && value.startsWith("/") ? value : "/settings";
}

function cleanEmail(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase().slice(0, 254) : "";
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "请求格式无效。" }, { status: 400 });
  }

  const source = body as { email?: unknown; next?: unknown };
  const email = cleanEmail(source.email);
  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "请输入有效邮箱。" }, { status: 400 });
  }

  const next = cleanNext(source.next);
  const emailRedirectTo = new URL(`/auth/callback?next=${encodeURIComponent(next)}`, request.url).toString();
  let error: Error | null;

  try {
    const supabase = await createClient();
    const result = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo,
        shouldCreateUser: true,
      },
    });
    error = result.error;
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : "Magic Link 请求失败，请稍后重试。";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  if (error) {
    const authError = error as Error & { code?: string; status?: number };
    return NextResponse.json({
      error: error.message || "Magic Link 发送失败，请稍后重试。",
      code: authError.code || "auth-sign-in-with-otp-failed",
      status: authError.status || 400,
    }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
