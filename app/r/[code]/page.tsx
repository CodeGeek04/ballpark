import { notFound } from "next/navigation";
import { getServiceClient } from "@/lib/supabase-server";
import { RoomClient } from "./_components/RoomClient";
import type { Player, Room, Round, Submission } from "@/lib/types";

export const dynamic = "force-dynamic";

type PublicQuestion = {
  id: string;
  prompt: string;
  unit: string | null;
  category: string | null;
  k: number;
};

export default async function RoomPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const sb = getServiceClient();

  // The room is the only blocking lookup. Everything else can fan out in parallel.
  const { data: room } = await sb
    .from("rooms")
    .select("*")
    .eq("code", code.toUpperCase())
    .maybeSingle();
  if (!room) notFound();

  // Fan out the remaining queries in parallel — each was a separate round-trip
  // to Supabase before, which on cold starts compounded into 500ms+ of TTFB.
  const [
    { data: players },
    { data: latestRound },
    { data: allSubs },
  ] = await Promise.all([
    sb.from("players").select("*").eq("room_id", room.id).order("joined_at"),
    sb.from("rounds").select("*").eq("room_id", room.id).order("index", { ascending: false }).limit(1).maybeSingle(),
    sb
      .from("submissions")
      .select("player_id, score, round_id, rounds!inner(room_id)")
      .eq("rounds.room_id", room.id),
  ]);

  let initialQuestion: PublicQuestion | null = null;
  let initialAnswer: number | null = null;
  let initialCategory: string | null = null;
  let initialSubmissions: Submission[] = [];

  if (latestRound) {
    const r = latestRound as Round;
    const [{ data: q }, { data: subs }] = await Promise.all([
      sb.from("questions").select("id, prompt, unit, category, k, answer").eq("id", r.question_id).single(),
      sb.from("submissions").select("*").eq("round_id", r.id),
    ]);
    if (q) {
      const { answer, category, ...rest } = q as PublicQuestion & { answer: number; category: string | null };
      initialQuestion = { ...rest, category };
      if (r.revealed_at) {
        initialAnswer = Number(answer);
        initialCategory = category;
      }
    }
    initialSubmissions = (subs as Submission[]) ?? [];
  }

  const initialScores: Record<string, number> = {};
  for (const s of (allSubs ?? []) as unknown as { player_id: string; score: number | null }[]) {
    initialScores[s.player_id] = (initialScores[s.player_id] ?? 0) + (s.score ?? 0);
  }

  return (
    <RoomClient
      initialRoom={room as Room}
      initialPlayers={(players as Player[]) ?? []}
      initialRound={(latestRound as Round) ?? null}
      initialQuestion={initialQuestion}
      initialAnswer={initialAnswer}
      initialCategory={initialCategory}
      initialSubmissions={initialSubmissions}
      initialScores={initialScores}
    />
  );
}
