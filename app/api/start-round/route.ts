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

  const { data: used } = await sb
    .from("rounds")
    .select("question_id")
    .eq("room_id", roomId);
  const usedIds = (used ?? []).map((r) => r.question_id);

  let query = sb.from("questions").select("*").limit(1);
  if (usedIds.length) query = query.not("id", "in", `(${usedIds.join(",")})`);
  const { data: pickList } = await query.order("created_at", { ascending: false });
  // Simple shuffle: pull a small window and pick randomly.
  const { data: window } = await sb
    .from("questions")
    .select("*")
    .limit(50);
  const eligible = (window ?? []).filter((q) => !usedIds.includes(q.id));
  const question = eligible.length
    ? eligible[Math.floor(Math.random() * eligible.length)]
    : pickList?.[0];
  if (!question) return NextResponse.json({ error: "no questions available" }, { status: 500 });

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
