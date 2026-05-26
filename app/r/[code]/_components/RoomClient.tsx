"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabase } from "@/lib/supabase-browser";
import type { Player, Room, Round, Submission } from "@/lib/types";
import { Lobby } from "./Lobby";
import { Round as RoundView } from "./Round";
import { Reveal } from "./Reveal";
import { Ended } from "./Ended";
import { InlineJoin } from "./InlineJoin";
import { Logo } from "@/components/Logo";
import { HowToPlayButton } from "@/components/HowToPlay";
import { SuggestQuestionButton } from "@/components/SuggestQuestion";
import { ChipStamp } from "@/components/ChipStamp";

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
  const router = useRouter();
  const roundRef = useRef<Round | null>(round);
  roundRef.current = round;
  const meRef = useRef<Player | null>(me);
  meRef.current = me;
  const channelRef = useRef<ReturnType<typeof sb.channel> | null>(null);

  const notifySync = () => {
    channelRef.current?.send({ type: "broadcast", event: "ballpark_sync", payload: {} });
  };

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

  // Backstop sync: when the tab regains focus, or every 10 seconds, refetch
  // the room + latest round + players. This rescues us from any realtime
  // event the websocket missed (idle tabs, brief reconnects, mobile sleep).
  async function resync() {
    const [
      { data: freshRoom },
      { data: latestRound },
      { data: ps },
    ] = await Promise.all([
      sb.from("rooms").select("*").eq("id", room.id).maybeSingle(),
      sb.from("rounds").select("*").eq("room_id", room.id).order("index", { ascending: false }).limit(1).maybeSingle(),
      sb.from("players").select("*").eq("room_id", room.id).order("joined_at"),
    ]);
    if (freshRoom) setRoom(freshRoom as Room);
    if (ps) setPlayers(ps as Player[]);

    if (latestRound) {
      const r = latestRound as Round;
      const haveRoundId = roundRef.current?.id;
      const haveRevealedAt = roundRef.current?.revealed_at;
      const changedRound = r.id !== haveRoundId;
      const newlyRevealed = !!r.revealed_at && r.revealed_at !== haveRevealedAt;
      if (changedRound) {
        // Treat like a brand-new round arriving.
        const { data: q } = await sb
          .from("questions")
          .select("id, prompt, unit, category, k, answer")
          .eq("id", r.question_id)
          .single();
        if (q) {
          const { answer, category, ...rest } = q as PublicQuestion & { answer: number; category: string | null };
          setQuestion({ ...rest, category });
          if (r.revealed_at) {
            setRevealAnswer(Number(answer));
            setRevealCategory(category);
          } else {
            setRevealAnswer(null);
            setRevealCategory(null);
          }
        }
        await refetchSubmissions(r.id);
        setRound(r);
        await refetchScores(room.id);
      } else if (newlyRevealed) {
        const { data: q } = await sb.from("questions").select("answer, category").eq("id", r.question_id).single();
        if (q) {
          setRevealAnswer(Number((q as { answer: number }).answer));
          setRevealCategory((q as { category: string | null }).category);
        }
        await refetchSubmissions(r.id);
        await refetchScores(room.id);
        setRound(r);
      }
    } else if (roundRef.current) {
      // Room was restarted; rounds wiped.
      setRound(null);
      setQuestion(null);
      setSubmissions([]);
      setRevealAnswer(null);
      setRevealCategory(null);
    }
  }

  useEffect(() => {
    const channel = sb
      .channel(`room:${room.code}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "rooms", filter: `id=eq.${room.id}` }, (payload) => {
        // Host left the game — the room was deleted. Everyone else lands home.
        if (payload.eventType === "DELETE") {
          if (meRef.current && !meRef.current.is_host) {
            try { sessionStorage.removeItem(`ballpark.player.${room.code}`); } catch {}
            router.replace("/?abandoned=1");
          }
          return;
        }
        if (payload.new) {
          const next = payload.new as Room;
          setRoom(next);
          // Restart-game: host wiped rounds and reset status to lobby.
          // Clear round-derived client state so the view jumps cleanly back.
          if (next.status === "lobby" && next.current_round === 0) {
            setRound(null);
            setQuestion(null);
            setSubmissions([]);
            setRevealAnswer(null);
            setRevealCategory(null);
            setScores({});
          }
        }
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
      // Broadcast channel: any client can publish "state changed" here and
      // others react in <100ms. Far more reliable than postgres_changes for
      // hot user actions (start game, reveal, restart).
      .on("broadcast", { event: "ballpark_sync" }, () => {
        resync().catch(() => {});
      })
      .subscribe();
    channelRef.current = channel;

    // Backstop polling. Realtime postgres_changes can drop events if the tab
    // is idle/backgrounded or the websocket reconnects briefly. Re-sync every
    // 10s + immediately whenever the tab regains visibility.
    const interval = setInterval(() => {
      resync().catch(() => {});
    }, 2000);
    function onVisible() {
      if (document.visibilityState === "visible") resync().catch(() => {});
    }
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);

    // Beacon-fire on tab close: if the host leaves, nuke the room so other
    // players are sent home. Non-hosts just remove themselves. We use
    // sendBeacon which browsers actually deliver during unload (unlike fetch).
    function onLeave() {
      const m = meRef.current;
      if (!m) return;
      const payload = JSON.stringify({ roomId: room.id, playerId: m.id });
      try {
        navigator.sendBeacon("/api/leave-room", new Blob([payload], { type: "application/json" }));
      } catch {
        // best-effort fallback
        fetch("/api/leave-room", { method: "POST", body: payload, keepalive: true }).catch(() => {});
      }
    }
    window.addEventListener("pagehide", onLeave);

    return () => {
      sb.removeChannel(channel);
      channelRef.current = null;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
      window.removeEventListener("pagehide", onLeave);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room.id, room.code]);

  // Kick detection: if I have a `me` but the realtime-synced players list
  // no longer contains my id (and the load has happened — players is the
  // SSR-fetched initial list), the host removed me.
  const wasKicked = !!me && players.length > 0 && !players.some((p) => p.id === me.id);
  if (wasKicked) {
    return (
      <main className="min-h-dvh w-full">
        <header className="px-6 sm:px-10 pt-6 flex justify-between items-center">
          <Logo size={32} />
        </header>
        <div className="px-6 sm:px-10 py-10 max-w-md mx-auto">
          <ChipStamp tone="ink">kicked</ChipStamp>
          <h1 className="font-display font-bold text-4xl tracking-tight mt-3">the host removed you</h1>
          <p className="font-mono text-sm leading-snug mt-3 opacity-80">no hard feelings. start your own room?</p>
          <div className="mt-6">
            <a href="/" className="inline-flex items-center gap-2 px-4 py-2 rounded-card border-2 border-ink bg-ember text-paper font-bold shadow-stamp-sm">start a new room →</a>
          </div>
        </div>
      </main>
    );
  }

  if (!me) {
    // Before the sessionStorage read completes we don't know if this browser
    // already has a player on file. Render nothing for that single frame
    // instead of briefly showing the join form to someone who just created
    // the room on the previous page.
    if (!mounted) return null;

    const ROOM_CAPACITY = 8;
    const isFull = players.length >= ROOM_CAPACITY;
    const inProgress = room.status !== "lobby";

    if (room.status === "lobby" && !isFull) {
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

    // Room is full OR game already running. Show a calm dead-end with options.
    const reason = isFull && !inProgress ? "room is full" : "game already in progress";
    const detail = isFull && !inProgress
      ? `This room hit its 8-player limit. Start a new room and share the code.`
      : `You can't slot into a game that's already started. Ask the host to start a new room when this one ends.`;
    return (
      <main className="min-h-dvh w-full">
        <header className="px-6 sm:px-10 pt-6 flex justify-between items-center">
          <Logo size={32} />
          <HowToPlayButton />
        </header>
        <div className="px-6 sm:px-10 py-10 max-w-md mx-auto">
          <ChipStamp tone="ink">{reason}</ChipStamp>
          <h1 className="font-display font-bold text-4xl tracking-tight mt-3">no spot for you</h1>
          <p className="font-mono text-sm leading-snug mt-3 opacity-80">{detail}</p>
          <div className="mt-6 flex gap-3">
            <a href="/" className="inline-flex items-center gap-2 px-4 py-2 rounded-card border-2 border-ink bg-ember text-paper font-bold shadow-stamp-sm">start a new room →</a>
          </div>
        </div>
      </main>
    );
  }

  const gameOver = room.current_round > room.round_count;
  const revealed = !!round?.revealed_at;

  let view: React.ReactNode = null;
  if (gameOver) {
    view = <Ended room={room} players={players} scores={scores} me={me} notifySync={notifySync} />;
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
        notifySync={notifySync}
      />
    );
  } else if (round && question && !revealed) {
    view = <RoundView room={room} round={round} question={question} me={me} players={players} submissions={submissions} notifySync={notifySync} />;
  } else if (room.status === "lobby" && !round) {
    view = <Lobby room={room} players={players} me={me} notifySync={notifySync} />;
  }
  // Otherwise: in-between async state. Render nothing (no flash).

  return (
    <main className="min-h-dvh w-full">
      <header className="px-6 sm:px-10 pt-6 flex justify-between items-center gap-3">
        <Logo size={32} />
        <div className="flex items-center gap-2 flex-wrap">
          <SuggestQuestionButton roomCode={room.code} />
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
