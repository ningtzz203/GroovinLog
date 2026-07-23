import { NextResponse } from "next/server";
import { createClient } from "../../lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/settings?loggedOut=1", request.url), { status: 303 });
}

export async function GET(request: Request) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(new URL("/settings?loggedOut=1", request.url));
}
