import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { getServiceClient } from "@/lib/supabase-server";

export const runtime = "nodejs";

type Body = {
  prompt: string;
  suggestedAnswer?: number | null;
  suggestedUnit?: string | null;
  notes?: string | null;
  submitterName?: string | null;
  submitterRoomCode?: string | null;
};

const PROMPT_ALLOWED = /^[A-Za-z0-9 \-.,'"!?():&%$/\n]+$/;

export async function POST(req: Request) {
  const body = (await req.json()) as Body;
  const prompt = (body.prompt ?? "").trim();
  if (prompt.length < 15 || prompt.length > 300) {
    return NextResponse.json({ error: "question must be 15–300 characters" }, { status: 400 });
  }
  if (!PROMPT_ALLOWED.test(prompt)) {
    return NextResponse.json({ error: "use plain text only — no emojis or special characters" }, { status: 400 });
  }

  const sb = getServiceClient();

  // Light rate-limit: hash IP, cap at 20 suggestions / 24h.
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";
  const ipHash = createHash("sha256").update(ip).digest("hex").slice(0, 32);
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count } = await sb
    .from("suggested_questions")
    .select("id", { count: "exact", head: true })
    .eq("ip_hash", ipHash)
    .gte("created_at", since);
  if ((count ?? 0) >= 20) {
    return NextResponse.json({ error: "thanks — you've hit the daily limit. try again tomorrow." }, { status: 429 });
  }

  const cleanAnswer =
    body.suggestedAnswer === null || body.suggestedAnswer === undefined || body.suggestedAnswer === 0
      ? null
      : Number(body.suggestedAnswer);
  if (cleanAnswer !== null && (!isFinite(cleanAnswer) || cleanAnswer < 0)) {
    return NextResponse.json({ error: "answer must be a positive number or left blank" }, { status: 400 });
  }

  const { error } = await sb.from("suggested_questions").insert({
    prompt,
    suggested_answer: cleanAnswer,
    suggested_unit: body.suggestedUnit?.trim() || null,
    notes: body.notes?.trim() || null,
    submitter_name: body.submitterName?.trim() || null,
    submitter_room_code: body.submitterRoomCode?.trim()?.toUpperCase() || null,
    ip_hash: ipHash,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
