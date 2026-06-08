import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cached: SupabaseClient<any, any, any> | null = null;

export function getServiceClient(): SupabaseClient<any, any, any> {
  if (cached) return cached;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Supabase env vars not configured: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing");
  }
  cached = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    db: { schema: "toppl" as any },
    global: { headers: { "x-application-name": "toppl" } },
  });
  return cached;
}
