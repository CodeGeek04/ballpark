import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase-server";

export const runtime = "nodejs";

type Body = { roundId: string; playerId: string; guess: number };

export async function POST(req: Request) {
  const { roundId, playerId, guess } = (await req.json()) as Body;
  if (!roundId || !playerId || !isFinite(guess)) {
    return NextResponse.json({ error: "missing fields" }, { status: 400 });
  }
  if (guess <= 0) return NextResponse.json({ error: "guess must be positive" }, { status: 400 });

  const sb = getServiceClient();

  // Parallel: read deadline + revealed_at + player team in one round-trip total.
  const [{ data: round }, { data: player }] = await Promise.all([
    sb.from("rounds").select("deadline_at, revealed_at").eq("id", roundId).maybeSingle(),
    sb.from("players").select("team").eq("id", playerId).maybeSingle(),
  ]);

  if (!round) return NextResponse.json({ error: "round not found" }, { status: 404 });
  if (round.revealed_at) {
    // Race: reveal already fired (likely because everyone else just submitted).
    // Don't insert — the score loop has already run and this row would be a
    // NULL-score orphan.
    return NextResponse.json({ error: "round already revealed" }, { status: 409 });
  }
  if (new Date(round.deadline_at).getTime() <= Date.now()) {
    return NextResponse.json({ error: "deadline passed" }, { status: 409 });
  }
  if (!player) return NextResponse.json({ error: "player not found" }, { status: 404 });

  const { error } = await sb
    .from("submissions")
    .upsert(
      { round_id: roundId, player_id: playerId, team: player.team, guess },
      { onConflict: "round_id,player_id" },
    );
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
