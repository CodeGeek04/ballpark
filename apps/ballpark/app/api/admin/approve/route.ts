import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase-server";

export const runtime = "nodejs";

type Body = {
  id: string;
  prompt: string;
  answer: number;
  unit: string;
  category: string;
  source_url: string | null;
  cot_hint: string | null;
};

export async function POST(req: Request) {
  if (req.headers.get("x-admin-pass") !== process.env.ADMIN_REVIEW_PASSWORD) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = (await req.json()) as Body;
  if (!body.id || !body.prompt || !(body.answer > 0)) {
    return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  }
  const sb = getServiceClient();
  const { error: insertErr } = await sb.from("questions").insert({
    prompt: body.prompt.trim(),
    answer: body.answer,
    unit: body.unit?.trim() || null,
    category: body.category || null,
    source_url: body.source_url || null,
    cot_hint: body.cot_hint || null,
  });
  if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });
  await sb.from("questions_review").update({ status: "approved" }).eq("id", body.id);
  return NextResponse.json({ ok: true });
}
