import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase-server";

export const runtime = "nodejs";

type Body = { roundId: string };

export async function POST(req: Request) {
  const { roundId } = (await req.json()) as Body;
  if (!roundId) return NextResponse.json({ error: "missing fields" }, { status: 400 });

  const sb = getServiceClient();
  const { data: round } = await sb.from("rounds").select("*").eq("id", roundId).maybeSingle();
  if (!round) return NextResponse.json({ error: "round not found" }, { status: 404 });

  if (round.revealed_at) {
    // Idempotent return
    const { data: picks } = await sb.from("picks").select("*").eq("round_id", roundId);
    return NextResponse.json({ round, picks, alreadyRevealed: true });
  }

  // Load both items and compute the bigger one
  const [{ data: itemA }, { data: itemB }] = await Promise.all([
    sb.from("items").select("*").eq("id", round.item_a_id).single(),
    sb.from("items").select("*").eq("id", round.item_b_id).single(),
  ]);
  if (!itemA || !itemB) return NextResponse.json({ error: "items missing" }, { status: 500 });
  const biggerId = Number(itemA.value) >= Number(itemB.value) ? itemA.id : itemB.id;

  // Mark each pick correct/wrong and update player stats
  const { data: picks } = await sb.from("picks").select("*").eq("round_id", roundId);
  for (const p of picks ?? []) {
    const isCorrect = p.picked_item_id === biggerId;
    await sb.from("picks").update({ is_correct: isCorrect }).eq("id", p.id);

    const { data: player } = await sb.from("players").select("*").eq("id", p.player_id).single();
    if (player) {
      const nextStreak = isCorrect ? player.current_streak + 1 : 0;
      const nextBest = Math.max(player.best_streak, nextStreak);
      const nextTotal = player.total_correct + (isCorrect ? 1 : 0);
      await sb
        .from("players")
        .update({ current_streak: nextStreak, best_streak: nextBest, total_correct: nextTotal })
        .eq("id", player.id);
    }
  }

  // Mark round revealed
  await sb.from("rounds").update({ revealed_at: new Date().toISOString() }).eq("id", roundId);

  // Update room status
  const { data: room } = await sb.from("rooms").select("*").eq("id", round.room_id).single();
  if (room) {
    const isLast = round.index >= room.round_count;
    await sb.from("rooms").update({ status: isLast ? "ended" : "revealing" }).eq("id", room.id);
  }

  const { data: freshPicks } = await sb.from("picks").select("*").eq("round_id", roundId);
  return NextResponse.json({
    round: { ...round, revealed_at: new Date().toISOString() },
    picks: freshPicks,
    item_a: itemA,
    item_b: itemB,
    bigger_id: biggerId,
  });
}
