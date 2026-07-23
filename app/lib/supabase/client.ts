"use client";

import { getSupabasePublicEnv } from "./env";
import { loadSupabaseSsr } from "./runtime";

export async function createClient() {
  const { createBrowserClient } = await loadSupabaseSsr();
  const { url, publishableKey } = getSupabasePublicEnv();
  return createBrowserClient(url, publishableKey);
}
