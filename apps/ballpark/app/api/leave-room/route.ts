import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase-server";

export const runtime = "nodejs";

type Body = { roomId: string; playerId: string };

// Beacon-friendly: also responds to text/plain bodies that sendBeacon sends.
export async function POST(req: Request) {
  let body: Body | null = null;
  try {
    const text = await req.text();
    body = text ? (JSON.parse(text) as Body) : null;
  } catch {
    body = null;
  }
  if (!body?.roomId || !body?.playerId) {
    return NextResponse.json({ error: "missing fields" }, { status: 400 });
  }

  const sb = getServiceClient();
  const { data: room } = await sb.from("rooms").select("*").eq("id", body.roomId).maybeSingle();
  if (!room) return NextResponse.json({ ok: true }); // already gone

  if (room.host_player_id === body.playerId) {
    // Host leaving — nuke the room. Cascades wipe players, rounds, subs.
    await sb.from("rooms").delete().eq("id", body.roomId);
  } else {
    // Non-host just removes themselves.
    await sb.from("players").delete().eq("id", body.playerId).eq("room_id", body.roomId);
  }

  return NextResponse.json({ ok: true });
}
