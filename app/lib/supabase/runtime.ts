type SupabaseSsrModule = {
  createServerClient: (...args: unknown[]) => unknown;
  createBrowserClient: (...args: unknown[]) => unknown;
};

const runtimeImport = new Function("specifier", "return import(specifier)") as (specifier: string) => Promise<SupabaseSsrModule>;

export async function loadSupabaseSsr() {
  return runtimeImport("@supabase/ssr");
}
