import { NextRequest, NextResponse } from "next/server";
import { createClient } from "../../lib/supabase/server";

function redirectUrl(request: NextRequest, path: string) {
  return new URL(path, request.url);
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = requestUrl.searchParams.get("next") || "/settings";

  if (!code) {
    return NextResponse.redirect(redirectUrl(request, "/login?error=missing-code"));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(redirectUrl(request, "/login?error=callback-failed"));
  }

  const { data: userResult } = await supabase.auth.getUser();
  const user = userResult.user;
  if (user) {
    await supabase.from("profiles").upsert({
      id: user.id,
      display_name: user.email?.split("@")[0] ?? null,
    }, { onConflict: "id" });
  }

  return NextResponse.redirect(redirectUrl(request, next.startsWith("/") ? next : "/settings"));
}
