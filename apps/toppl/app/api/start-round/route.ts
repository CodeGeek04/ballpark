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

  const { data: pair, error: pickErr } = await sb
    .rpc("toppl_pick_pair", { p_room_id: roomId })
    .single();
  if (pickErr || !pair) {
    return NextResponse.json({ error: pickErr?.message ?? "no items" }, { status: 500 });
  }
  const itemA = (pair as { item_a: { id: string } }).item_a;
  const itemB = (pair as { item_b: { id: string } }).item_b;

  const nextIndex = room.current_round + 1;
  const deadline = new Date(Date.now() + room.round_seconds * 1000).toISOString();

  const { data: round, error: roundErr } = await sb
    .from("rounds")
    .insert({
      room_id: roomId,
      index: nextIndex,
      item_a_id: itemA.id,
      item_b_id: itemB.id,
      deadline_at: deadline,
    })
    .select("*")
    .single();
  if (roundErr || !round) return NextResponse.json({ error: roundErr?.message ?? "round insert failed" }, { status: 500 });

  await sb.from("rooms").update({ status: "playing", current_round: nextIndex }).eq("id", roomId);

  return NextResponse.json({ round, item_a: itemA, item_b: itemB });
}
