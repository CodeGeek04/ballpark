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
  const { data: room } = await sb.from("rooms").select("*").eq("code", code.toUpperCase()).maybeSingle();
  if (!room) notFound();

  const { data: players } = await sb.from("players").select("*").eq("room_id", room.id).order("joined_at");

  const { data: latestRound } = await sb
    .from("rounds")
    .select("*")
    .eq("room_id", room.id)
    .order("index", { ascending: false })
    .limit(1)
    .maybeSingle();

  let initialQuestion: PublicQuestion | null = null;
  let initialAnswer: number | null = null;
  let initialCategory: string | null = null;
  let initialSubmissions: Submission[] = [];

  if (latestRound) {
    const { data: q } = await sb
      .from("questions")
      .select("id, prompt, unit, category, k, answer")
      .eq("id", (latestRound as Round).question_id)
      .single();
    if (q) {
      const { answer, category, ...rest } = q as PublicQuestion & { answer: number; category: string | null };
      initialQuestion = { ...rest, category };
      if ((latestRound as Round).revealed_at) {
        initialAnswer = Number(answer);
        initialCategory = category;
      }
    }
    const { data: subs } = await sb.from("submissions").select("*").eq("round_id", (latestRound as Round).id);
    initialSubmissions = (subs as Submission[]) ?? [];
  }

  const { data: allSubs } = await sb
    .from("submissions")
    .select("player_id, score, round_id, rounds!inner(room_id)")
    .eq("rounds.room_id", room.id);
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
