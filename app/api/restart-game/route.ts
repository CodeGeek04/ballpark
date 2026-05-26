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
  if (room.host_player_id !== playerId) {
    return NextResponse.json({ error: "only host can restart" }, { status: 403 });
  }

  // Clean slate: wipe rounds (cascades to submissions) and reset the room.
  await sb.from("rounds").delete().eq("room_id", roomId);
  await sb
    .from("rooms")
    .update({ status: "lobby", current_round: 0 })
    .eq("id", roomId);

  // Solo: don't dump the player into a lobby with one person. Start round 1
  // inline so the next click after "play again" is on the question itself.
  if (room.mode === "solo") {
    type QuestionRow = { id: string };
    const { data: question } = (await sb
      .rpc("ballpark_pick_question", { p_room_id: roomId })
      .single()) as { data: QuestionRow | null };
    if (question) {
      const deadline = new Date(Date.now() + room.round_seconds * 1000).toISOString();
      await sb.from("rounds").insert({
        room_id: roomId,
        index: 1,
        question_id: question.id,
        deadline_at: deadline,
      });
      await sb.from("rooms").update({ status: "playing", current_round: 1 }).eq("id", roomId);
    }
  }

  return NextResponse.json({ ok: true });
}
