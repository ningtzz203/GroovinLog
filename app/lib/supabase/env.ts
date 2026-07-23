export type SupabasePublicEnv = {
  url: string;
  publishableKey: string;
};

export type SupabaseServerEnv = SupabasePublicEnv & {
  serviceRoleKey?: string;
};

export function getSupabasePublicEnv(): SupabasePublicEnv {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !publishableKey) {
    throw new Error("Supabase public environment variables are not configured.");
  }

  return { url, publishableKey };
}

export function getSupabaseServerEnv(): SupabaseServerEnv {
  return {
    ...getSupabasePublicEnv(),
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  };
}

export function hasSupabasePublicEnv() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
}
