import type { NextConfig } from "next";

const supabaseRuntimeFiles = [
  "./node_modules/@supabase/**/*",
  "./node_modules/cookie/**/*",
  "./node_modules/tslib/**/*",
  "./node_modules/iceberg-js/**/*",
];

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/auth/login": supabaseRuntimeFiles,
    "/auth/callback": supabaseRuntimeFiles,
    "/auth/me": supabaseRuntimeFiles,
    "/auth/logout": supabaseRuntimeFiles,
  },
};

export default nextConfig;
