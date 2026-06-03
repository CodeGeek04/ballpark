import { createHash } from "node:crypto";
import { getServiceClient } from "@/lib/supabase-server";

export async function trackIdentity(req: Request, name: string) {
  try {
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
      req.headers.get("x-real-ip") ||
      "unknown";
    if (ip === "unknown" || !name) return;
    const ipHash = createHash("sha256").update(ip).digest("hex").slice(0, 32);
    const sb = getServiceClient();
    await sb.from("player_identities").upsert(
      { ip_hash: ipHash, name, last_seen: new Date().toISOString() },
      { onConflict: "ip_hash" },
    );
  } catch {
    // fire and forget
  }
}
