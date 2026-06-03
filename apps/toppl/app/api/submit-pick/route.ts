import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase-server";

export const runtime = "nodejs";

type Body = { roundId: string; playerId: string; pickedItemId: string };

export async function POST(req: Request) {
  const { roundId, playerId, pickedItemId } = (await req.json()) as Body;
  if (!roundId || !playerId || !pickedItemId) {
    return NextResponse.json({ error: "missing fields" }, { status: 400 });
  }

  const sb = getServiceClient();
  const { data: round } = await sb.from("rounds").select("deadline_at, revealed_at").eq("id", roundId).maybeSingle();
  if (!round) return NextResponse.json({ error: "round not found" }, { status: 404 });
  if (round.revealed_at) {
    return NextResponse.json({ error: "round already revealed" }, { status: 409 });
  }
  if (new Date(round.deadline_at).getTime() <= Date.now()) {
    return NextResponse.json({ error: "deadline passed" }, { status: 409 });
  }

  const { error } = await sb
    .from("picks")
    .upsert(
      { round_id: roundId, player_id: playerId, picked_item_id: pickedItemId },
      { onConflict: "round_id,player_id" },
    );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
