import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase-server";
import { normalizeCode } from "@/lib/code";

export const runtime = "nodejs";

type Body = { code: string; name: string; avatar: string };

export async function POST(req: Request) {
  const { code, name, avatar } = (await req.json()) as Body;
  const norm = normalizeCode(code ?? "");
  if (!norm || !name || !avatar) return NextResponse.json({ error: "missing fields" }, { status: 400 });

  const sb = getServiceClient();
  const { data: room } = await sb.from("rooms").select("*").eq("code", norm).maybeSingle();
  if (!room) return NextResponse.json({ error: "room not found" }, { status: 404 });
  if (room.status !== "lobby") return NextResponse.json({ error: "room already started" }, { status: 409 });

  const { count } = await sb.from("players").select("id", { count: "exact", head: true }).eq("room_id", room.id);
  if ((count ?? 0) >= 8) return NextResponse.json({ error: "room is full" }, { status: 409 });

  // Team mode: alternate team assignment by current count.
  const team = room.mode === "teams" ? ((count ?? 0) % 2 === 0 ? "B" : "A") : null;

  const { data: player, error } = await sb
    .from("players")
    .insert({ room_id: room.id, name, avatar, team })
    .select("*")
    .single();
  if (error || !player) return NextResponse.json({ error: error?.message ?? "insert failed" }, { status: 500 });

  return NextResponse.json({ room, player });
}
