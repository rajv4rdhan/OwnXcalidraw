/**
 * Reads and validates the server-side environment.
 *
 * These values are only ever read inside Vercel serverless functions, so the
 * Supabase secret key never reaches the browser bundle.
 */

const assertPresent = (names: readonly string[]) => {
  const missing = names.filter((name) => !process.env[name]);
  if (missing.length) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}`,
    );
  }
};

const AUTH_VARS = ["APP_PASSWORD", "SESSION_SECRET"] as const;
const SUPABASE_VARS = [
  "SUPABASE_URL",
  "SUPABASE_SECRET_KEY",
  "SUPABASE_BUCKET",
] as const;

export const readAuthEnv = () => {
  assertPresent(AUTH_VARS);
  return {
    appPassword: process.env.APP_PASSWORD!,
    sessionSecret: process.env.SESSION_SECRET!,
  };
};

export const readSupabaseEnv = () => {
  assertPresent(SUPABASE_VARS);
  return {
    supabaseUrl: process.env.SUPABASE_URL!,
    supabaseSecretKey: process.env.SUPABASE_SECRET_KEY!,
    bucket: process.env.SUPABASE_BUCKET!,
  };
};
