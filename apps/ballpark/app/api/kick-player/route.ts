import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase-server";

export const runtime = "nodejs";

type Body = { roomId: string; hostPlayerId: string; targetPlayerId: string };

export async function POST(req: Request) {
  const { roomId, hostPlayerId, targetPlayerId } = (await req.json()) as Body;
  if (!roomId || !hostPlayerId || !targetPlayerId) {
    return NextResponse.json({ error: "missing fields" }, { status: 400 });
  }
  if (hostPlayerId === targetPlayerId) {
    return NextResponse.json({ error: "host cannot kick themselves" }, { status: 400 });
  }

  const sb = getServiceClient();
  const { data: room } = await sb.from("rooms").select("*").eq("id", roomId).maybeSingle();
  if (!room) return NextResponse.json({ error: "room not found" }, { status: 404 });
  if (room.host_player_id !== hostPlayerId) {
    return NextResponse.json({ error: "only host can kick" }, { status: 403 });
  }
  if (room.status !== "lobby") {
    return NextResponse.json({ error: "kicking only allowed in lobby" }, { status: 409 });
  }

  const { error } = await sb
    .from("players")
    .delete()
    .eq("id", targetPlayerId)
    .eq("room_id", roomId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
