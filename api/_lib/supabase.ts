import { createClient } from "@supabase/supabase-js";

import { readSupabaseEnv } from "./env.ts";

import type { SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

/**
 * Returns a memoized Supabase client authenticated with the secret key.
 * The secret key bypasses RLS, which is why it must only run server-side.
 */
export const getSupabase = (): SupabaseClient => {
  if (!client) {
    const { supabaseUrl, supabaseSecretKey } = readSupabaseEnv();
    client = createClient(supabaseUrl, supabaseSecretKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
};
