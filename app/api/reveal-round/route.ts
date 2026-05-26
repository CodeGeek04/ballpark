import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase-server";
import { scoreGuess } from "@/lib/scoring";

export const runtime = "nodejs";

type Body = { roundId: string };

export async function POST(req: Request) {
  const { roundId } = (await req.json()) as Body;
  if (!roundId) return NextResponse.json({ error: "missing fields" }, { status: 400 });

  const sb = getServiceClient();
  const { data: round } = await sb.from("rounds").select("*").eq("id", roundId).maybeSingle();
  if (!round) return NextResponse.json({ error: "round not found" }, { status: 404 });
  if (round.revealed_at) {
    const { data: q } = await sb.from("questions").select("*").eq("id", round.question_id).single();
    const { data: subs } = await sb.from("submissions").select("*").eq("round_id", roundId);
    return NextResponse.json({ question: q, submissions: subs, alreadyRevealed: true });
  }

  const { data: question } = await sb.from("questions").select("*").eq("id", round.question_id).single();
  if (!question) return NextResponse.json({ error: "question missing" }, { status: 500 });

  const { data: submissions } = await sb.from("submissions").select("*").eq("round_id", roundId);
  for (const s of submissions ?? []) {
    const score = scoreGuess(Number(s.guess), Number(question.answer), Number(question.k));
    await sb.from("submissions").update({ score }).eq("id", s.id);
  }
  await sb.from("rounds").update({ revealed_at: new Date().toISOString() }).eq("id", roundId);

  // Update room status; check if game is over.
  const { data: room } = await sb.from("rooms").select("*").eq("id", round.room_id).single();
  if (room) {
    const isLast = round.index >= room.round_count;
    await sb.from("rooms").update({ status: isLast ? "ended" : "revealing" }).eq("id", room.id);
  }

  const { data: freshSubs } = await sb.from("submissions").select("*").eq("round_id", roundId);
  return NextResponse.json({ question, submissions: freshSubs });
}
