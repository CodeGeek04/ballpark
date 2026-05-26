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
  // Players remain in place so anyone still on the page slides straight into
  // the new lobby.
  await sb.from("rounds").delete().eq("room_id", roomId);
  await sb
    .from("rooms")
    .update({ status: "lobby", current_round: 0 })
    .eq("id", roomId);

  return NextResponse.json({ ok: true });
}
