import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabasePublicEnv } from "./env";

type CookieToSet = {
  name: string;
  value: string;
  options: Parameters<Awaited<ReturnType<typeof cookies>>["set"]>[2];
};

export async function createClient() {
  const cookieStore = await cookies();
  const { url, publishableKey } = getSupabasePublicEnv();

  return createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: CookieToSet[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Server Components cannot always write cookies. The root proxy keeps
          // the auth session fresh for normal requests.
        }
      },
    },
  }) as unknown as {
    auth: {
      exchangeCodeForSession: (code: string) => Promise<{ error: Error | null }>;
      getUser: () => Promise<{ data: { user: { id: string; email?: string | null } | null }; error: Error | null }>;
      getClaims: () => Promise<unknown>;
      signInWithOtp: (input: { email: string; options?: { emailRedirectTo?: string; shouldCreateUser?: boolean } }) => Promise<{ error: Error | null }>;
      signOut: () => Promise<{ error: Error | null }>;
    };
    from: (table: string) => {
      upsert: (value: Record<string, unknown>, options?: Record<string, unknown>) => PromiseLike<{ error: Error | null }>;
    };
  };
}
