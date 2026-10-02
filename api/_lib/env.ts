/**
 * Reads and validates the server-side environment.
 *
 * These values are only ever read inside Vercel serverless functions, so the
 * Supabase secret key never reaches the browser bundle.
 */

const REQUIRED = [
  "APP_PASSWORD",
  "SESSION_SECRET",
  "SUPABASE_URL",
  "SUPABASE_SECRET_KEY",
  "SUPABASE_BUCKET",
] as const;

export const readEnv = () => {
  const missing = REQUIRED.filter((name) => !process.env[name]);
  if (missing.length) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}`,
    );
  }

  return {
    appPassword: process.env.APP_PASSWORD!,
    sessionSecret: process.env.SESSION_SECRET!,
    supabaseUrl: process.env.SUPABASE_URL!,
    supabaseSecretKey: process.env.SUPABASE_SECRET_KEY!,
    bucket: process.env.SUPABASE_BUCKET!,
  };
};
