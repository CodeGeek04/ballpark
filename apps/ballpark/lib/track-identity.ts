import { createHash } from "node:crypto";
import { getServiceClient } from "@/lib/supabase-server";

/**
 * Record (or update) the persistent identity row for an IP.
 * One row per hashed IP. We upsert on conflict so visit_count and
 * last_seen stay current, and the name reflects whatever they used most
 * recently.
 */
export async function trackIdentity(req: Request, name: string) {
  try {
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
      req.headers.get("x-real-ip") ||
      "unknown";
    if (ip === "unknown" || !name) return;
    const ipHash = createHash("sha256").update(ip).digest("hex").slice(0, 32);
    const sb = getServiceClient();
    // PostgREST upsert: on conflict (ip_hash) merge name + last_seen + bump visit_count.
    // We use rpc-less upsert via SQL function for the visit_count math.
    await sb.rpc("ballpark_track_identity", { p_ip_hash: ipHash, p_name: name });
  } catch {
    // Never block the caller on telemetry.
  }
}
