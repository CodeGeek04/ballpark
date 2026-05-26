"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { getSupabase } from "@/lib/supabase-browser";
import type { Player, Room, Round, Submission } from "@/lib/types";
import { Lobby } from "./Lobby";
import { Round as RoundView } from "./Round";
import { Reveal } from "./Reveal";
import { Ended } from "./Ended";
import { InlineJoin } from "./InlineJoin";
import { Logo } from "@/components/Logo";
import { HowToPlayButton } from "@/components/HowToPlay";

type PublicQuestion = {
  id: string;
  prompt: string;
  unit: string | null;
  category: string | null;
  k: number;
};

export function RoomClient({
  initialRoom,
  initialPlayers,
  initialRound,
  initialQuestion,
  initialAnswer,
  initialCategory,
  initialSubmissions,
  initialScores,
}: {
  initialRoom: Room;
  initialPlayers: Player[];
  initialRound: Round | null;
  initialQuestion: PublicQuestion | null;
  initialAnswer: number | null;
  initialCategory: string | null;
  initialSubmissions: Submission[];
  initialScores: Record<string, number>;
}) {
  const [room, setRoom] = useState<Room>(initialRoom);
  const [players, setPlayers] = useState<Player[]>(initialPlayers);
  const [me, setMe] = useState<Player | null>(null);
  const [round, setRound] = useState<Round | null>(initialRound);
  const [question, setQuestion] = useState<PublicQuestion | null>(initialQuestion);
  const [submissions, setSubmissions] = useState<Submission[]>(initialSubmissions);
  const [revealAnswer, setRevealAnswer] = useState<number | null>(initialAnswer);
  const [revealCategory, setRevealCategory] = useState<string | null>(initialCategory);
  const [scores, setScores] = useState<Record<string, number>>(initialScores);
  const [mounted, setMounted] = useState(false);
  const sb = useMemo(() => getSupabase(), []);
  const roundRef = useRef<Round | null>(round);
  roundRef.current = round;

  useEffect(() => {
    const raw = sessionStorage.getItem(`ballpark.player.${room.code}`);
    if (raw) setMe(JSON.parse(raw) as Player);
    setMounted(true);
  }, [room.code]);

  async function refetchSubmissions(roundId: string) {
    const { data } = await sb.from("submissions").select("*").eq("round_id", roundId);
    if (data) setSubmissions(data as Submission[]);
    return (data as Submission[]) ?? [];
  }

  async function refetchScores(roomId: string) {
    const { data } = await sb
      .from("submissions")
      .select("player_id, score, round_id, rounds!inner(room_id)")
      .eq("rounds.room_id", roomId);
    if (!data) return;
    const totals: Record<string, number> = {};
    for (const s of data as unknown as { player_id: string; score: number | null }[]) {
      totals[s.player_id] = (totals[s.player_id] ?? 0) + (s.score ?? 0);
    }
    setScores(totals);
  }

  useEffect(() => {
    const channel = sb
      .channel(`room:${room.code}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "rooms", filter: `id=eq.${room.id}` }, (payload) => {
        if (payload.new) setRoom(payload.new as Room);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "players", filter: `room_id=eq.${room.id}` }, async () => {
        const { data } = await sb.from("players").select("*").eq("room_id", room.id).order("joined_at");
        if (data) setPlayers(data as Player[]);
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "rounds", filter: `room_id=eq.${room.id}` }, async (payload) => {
        const r = payload.new as Round;
        // Fetch the question for this new round BEFORE flipping `round` state.
        // Otherwise the view briefly renders with old data or falls through to Lobby.
        const { data: q } = await sb
          .from("questions")
          .select("id, prompt, unit, category, k")
          .eq("id", r.question_id)
          .single();
        // Batch the transition.
        setRevealAnswer(null);
        setRevealCategory(null);
        setSubmissions([]);
        if (q) setQuestion(q as PublicQuestion);
        setRound(r);
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "rounds", filter: `room_id=eq.${room.id}` }, async (payload) => {
        const r = payload.new as Round;
        const current = roundRef.current;
        if (!current || r.id !== current.id) return;
        if (r.revealed_at) {
          // Pre-fetch everything Reveal needs BEFORE flipping `round.revealed_at`,
          // so we never render a partial state.
          const [{ data: q }, subs] = await Promise.all([
            sb.from("questions").select("answer, category").eq("id", r.question_id).single(),
            refetchSubmissions(r.id),
          ]);
          if (q) {
            setRevealAnswer(Number((q as { answer: number }).answer));
            setRevealCategory((q as { category: string | null }).category);
          }
          // Re-sum scores from the fresh submissions (and other rounds via refetchScores).
          await refetchScores(room.id);
          setRound(r);
        } else {
          setRound(r);
        }
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "submissions" }, async (payload) => {
        const s = (payload.new ?? payload.old) as Submission;
        const current = roundRef.current;
        if (!current || !s || s.round_id !== current.id) return;
        await refetchSubmissions(current.id);
      })
      .subscribe();

    return () => {
      sb.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room.id, room.code]);

  if (!me) {
    // Before the sessionStorage read completes we don't know if this browser
    // already has a player on file. Render nothing for that single frame
    // instead of briefly showing the join form to someone who just created
    // the room on the previous page.
    if (!mounted) return null;
    // Visitor with no session — could be a shared link click. If the room is
    // still in lobby, let them join right here. Otherwise the game has already
    // started or ended; we can't slot them in mid-game.
    if (room.status === "lobby") {
      return (
        <main className="min-h-dvh w-full">
          <header className="px-6 sm:px-10 pt-6 flex justify-between items-center">
            <Logo size={32} />
            <HowToPlayButton />
          </header>
          <div className="px-6 sm:px-10 py-10">
            <InlineJoin room={room} onJoined={setMe} />
          </div>
        </main>
      );
    }
    return (
      <main className="min-h-dvh flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center space-y-4">
          <Logo />
          <p className="text-lg">This game is already in progress. Ask the host to start a new room.</p>
          <a href="/" className="inline-block underline font-mono">← back to start</a>
        </div>
      </main>
    );
  }

  const gameOver = room.current_round > room.round_count;
  const revealed = !!round?.revealed_at;

  let view: React.ReactNode = null;
  if (gameOver) {
    view = <Ended room={room} players={players} scores={scores} />;
  } else if (revealed && round && question && revealAnswer !== null) {
    view = (
      <Reveal
        room={room}
        round={round}
        question={question}
        answer={revealAnswer}
        category={revealCategory}
        players={players}
        submissions={submissions}
        scores={scores}
        me={me}
      />
    );
  } else if (round && question && !revealed) {
    view = <RoundView room={room} round={round} question={question} me={me} players={players} submissions={submissions} />;
  } else if (room.status === "lobby" && !round) {
    view = <Lobby room={room} players={players} me={me} />;
  }
  // Otherwise: in-between async state. Render nothing (no flash).

  return (
    <main className="min-h-dvh w-full">
      <header className="px-6 sm:px-10 pt-6 flex justify-between items-center gap-3">
        <Logo size={32} />
        <div className="flex items-center gap-3">
          <HowToPlayButton />
          {room.mode !== "solo" && (
            <div className="flex items-center gap-2 font-mono text-xs">
              <span className="opacity-60 hidden sm:inline">room</span>
              <span className="px-2 py-1 border-2 border-ink rounded-md font-bold tracking-[0.3em] bg-mustard">{room.code}</span>
            </div>
          )}
        </div>
      </header>
      <div className="px-6 sm:px-10 py-8">{view}</div>
    </main>
  );
}
