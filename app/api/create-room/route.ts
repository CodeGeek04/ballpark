import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase-server";
import { generateRoomCode } from "@/lib/code";
import type { RoomMode } from "@/lib/types";

export const runtime = "nodejs";

type Body = {
  mode: RoomMode;
  hostName: string;
  hostAvatar: string;
};

export async function POST(req: Request) {
  const { mode, hostName, hostAvatar } = (await req.json()) as Body;
  if (!mode || !hostName || !hostAvatar) {
    return NextResponse.json({ error: "missing fields" }, { status: 400 });
  }

  const sb = getServiceClient();

  // Try up to 5 codes to avoid collision.
  let code = "";
  for (let i = 0; i < 5; i++) {
    const candidate = generateRoomCode();
    const { data: existing } = await sb.from("rooms").select("id").eq("code", candidate).maybeSingle();
    if (!existing) {
      code = candidate;
      break;
    }
  }
  if (!code) return NextResponse.json({ error: "could not allocate code" }, { status: 500 });

  const { data: room, error: roomErr } = await sb
    .from("rooms")
    .insert({ code, mode })
    .select("*")
    .single();
  if (roomErr || !room) return NextResponse.json({ error: roomErr?.message ?? "room insert failed" }, { status: 500 });

  const { data: player, error: playerErr } = await sb
    .from("players")
    .insert({
      room_id: room.id,
      name: hostName,
      avatar: hostAvatar,
      is_host: true,
      team: mode === "teams" ? "A" : null,
    })
    .select("*")
    .single();
  if (playerErr || !player) return NextResponse.json({ error: playerErr?.message ?? "player insert failed" }, { status: 500 });

  await sb.from("rooms").update({ host_player_id: player.id }).eq("id", room.id);

  return NextResponse.json({ room: { ...room, host_player_id: player.id }, player });
}
