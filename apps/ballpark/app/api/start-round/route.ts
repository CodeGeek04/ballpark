import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase-server";

export const runtime = "nodejs";

type Body = { roomId: string; playerId: string };

export async function POST(req: Request) {
  const { roomId, playerId } = (await req.json()) as Body;
  if (!roomId || !playerId) return NextResponse.json({ error: "missing fields" }, { status: 400 });

  const sb = getServiceClient();
  const { data: room } = await sb.from("rooms").select("*").eq("id", roomId).maybeSingle();
  if (!room) return NextResponse.json({ error: "room not found" }, { status: 404 });
  if (room.host_player_id !== playerId) return NextResponse.json({ error: "only host can start" }, { status: 403 });
  if (room.status === "ended") return NextResponse.json({ error: "game already ended" }, { status: 409 });
  if (room.current_round >= room.round_count) return NextResponse.json({ error: "no more rounds" }, { status: 409 });

  // True random pick from the whole pool, excluding questions already used
  // in this room. We use the ballpark_pick_question RPC so the heavy lifting
  // (random ordering + not-in filter) happens in one Postgres round-trip.
  type QuestionRow = {
    id: string;
    prompt: string;
    answer: number;
    unit: string | null;
    category: string | null;
    source_url: string | null;
    k: number;
    cot_hint: string | null;
  };
  const { data: question, error: pickErr } = (await sb
    .rpc("ballpark_pick_question", { p_room_id: roomId })
    .single()) as { data: QuestionRow | null; error: { message: string } | null };
  if (pickErr || !question) {
    return NextResponse.json({ error: "no questions available" }, { status: 500 });
  }

  const nextIndex = room.current_round + 1;
  const deadline = new Date(Date.now() + room.round_seconds * 1000).toISOString();

  const { data: round, error: roundErr } = await sb
    .from("rounds")
    .insert({
      room_id: roomId,
      index: nextIndex,
      question_id: question.id,
      deadline_at: deadline,
    })
    .select("*")
    .single();
  if (roundErr || !round) return NextResponse.json({ error: roundErr?.message ?? "round insert failed" }, { status: 500 });

  await sb
    .from("rooms")
    .update({ status: "playing", current_round: nextIndex })
    .eq("id", roomId);

  // Return question without the answer to client (client fetches via API/lib).
  const { answer: _hide, ...questionPublic } = question;
  return NextResponse.json({ round, question: questionPublic });
}
