import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Module-level cache: in serverless, multiple requests can land on the same
// warm instance. Reusing the client avoids re-doing the TLS handshake to
// Supabase on every invocation (~150-300ms wasted otherwise).
let cached: SupabaseClient | null = null;

export function getServiceClient(): SupabaseClient {
  if (cached) return cached;
  cached = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { "x-application-name": "ballpark" } },
    },
  );
  return cached;
}
