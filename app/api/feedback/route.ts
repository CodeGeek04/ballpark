import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { getServiceClient } from "@/lib/supabase-server";

export const runtime = "nodejs";

type Body = {
  content: string;
  name?: string | null;
  email?: string | null;
  context?: string | null;
};

export async function POST(req: Request) {
  const body = (await req.json()) as Body;
  const content = (body.content ?? "").trim();
  if (content.length < 5 || content.length > 2000) {
    return NextResponse.json({ error: "say a little more" }, { status: 400 });
  }

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";
  const ipHash = createHash("sha256").update(ip).digest("hex").slice(0, 32);

  const sb = getServiceClient();

  // Light rate limit: 10/day per IP.
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count } = await sb
    .from("feedback")
    .select("id", { count: "exact", head: true })
    .eq("ip_hash", ipHash)
    .gte("created_at", since);
  if ((count ?? 0) >= 10) {
    return NextResponse.json({ error: "thanks — you've hit the daily limit" }, { status: 429 });
  }

  const { error } = await sb.from("feedback").insert({
    content,
    name: body.name?.trim() || null,
    email: body.email?.trim() || null,
    context: body.context?.slice(0, 200) || null,
    ip_hash: ipHash,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
