"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabase } from "@/lib/supabase-browser";
import type { Item, Player, Pick, Room, Round } from "@/lib/types";
import { Lobby } from "./Lobby";
import { MultiRound } from "./MultiRound";
import { MultiReveal } from "./MultiReveal";
import { GameOver } from "./GameOver";

export function RoomClient({
  initialRoom,
  initialPlayers,
  initialRound,
  initialItemA,
  initialItemB,
  initialPicks,
}: {
  initialRoom: Room;
  initialPlayers: Player[];
  initialRound: Round | null;
  initialItemA: Item | null;
  initialItemB: Item | null;
  initialPicks: Pick[];
}) {
  const [room, setRoom] = useState<Room>(initialRoom);
  const [players, setPlayers] = useState<Player[]>(initialPlayers);
  const [me, setMe] = useState<Player | null>(null);
  const [round, setRound] = useState<Round | null>(initialRound);
  const [itemA, setItemA] = useState<Item | null>(initialItemA);
  const [itemB, setItemB] = useState<Item | null>(initialItemB);
  const [picks, setPicks] = useState<Pick[]>(initialPicks);
  const [mounted, setMounted] = useState(false);
  const sb = useMemo(() => getSupabase(), []);
  const router = useRouter();

  const roundRef = useRef<Round | null>(round);
  roundRef.current = round;
  const meRef = useRef<Player | null>(me);
  meRef.current = me;
  const channelRef = useRef<ReturnType<typeof sb.channel> | null>(null);

  const notifySync = () => {
    channelRef.current?.send({ type: "broadcast", event: "toppl_sync", payload: {} });
  };

  useEffect(() => {
    const raw = sessionStorage.getItem(`toppl.player.${room.code}`);
    if (raw) setMe(JSON.parse(raw) as Player);
    setMounted(true);
  }, [room.code]);

  async function refetchPicks(roundId: string) {
    const { data } = await sb.from("picks").select("*").eq("round_id", roundId);
    if (data) setPicks(data as Pick[]);
  }

  async function loadRoundDetail(r: Round) {
    const [{ data: a }, { data: b }] = await Promise.all([
      sb.from("items").select("*").eq("id", r.item_a_id).single(),
      sb.from("items").select("*").eq("id", r.item_b_id).single(),
    ]);
    if (a) setItemA(a as Item);
    if (b) setItemB(b as Item);
  }

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
      if (!roundRef.current || r.id !== roundRef.current.id || r.revealed_at !== roundRef.current.revealed_at) {
        await loadRoundDetail(r);
        await refetchPicks(r.id);
        setRound(r);
      }
    } else if (roundRef.current) {
      setRound(null);
      setItemA(null);
      setItemB(null);
      setPicks([]);
    }
  }

  useEffect(() => {
    const channel = sb
      .channel(`toppl:${room.code}`)
      .on("postgres_changes", { event: "*", schema: "toppl", table: "rooms", filter: `id=eq.${room.id}` }, (payload) => {
        if (payload.eventType === "DELETE") {
          if (meRef.current && !meRef.current.is_host) {
            try { sessionStorage.removeItem(`toppl.player.${room.code}`); } catch {}
            router.replace("/?abandoned=1");
          }
          return;
        }
        if (payload.new) {
          const next = payload.new as Room;
          setRoom(next);
          if (next.status === "lobby" && next.current_round === 0) {
            setRound(null);
            setItemA(null);
            setItemB(null);
            setPicks([]);
          }
        }
      })
      .on("postgres_changes", { event: "*", schema: "toppl", table: "players", filter: `room_id=eq.${room.id}` }, async () => {
        const { data } = await sb.from("players").select("*").eq("room_id", room.id).order("joined_at");
        if (data) setPlayers(data as Player[]);
      })
      .on("postgres_changes", { event: "INSERT", schema: "toppl", table: "rounds", filter: `room_id=eq.${room.id}` }, async (payload) => {
        const r = payload.new as Round;
        setPicks([]);
        await loadRoundDetail(r);
        setRound(r);
      })
      .on("postgres_changes", { event: "UPDATE", schema: "toppl", table: "rounds", filter: `room_id=eq.${room.id}` }, async (payload) => {
        const r = payload.new as Round;
        const current = roundRef.current;
        if (!current || r.id !== current.id) return;
        if (r.revealed_at) {
          await refetchPicks(r.id);
        }
        setRound(r);
      })
      .on("postgres_changes", { event: "*", schema: "toppl", table: "picks" }, async (payload) => {
        const p = (payload.new ?? payload.old) as Pick;
        const current = roundRef.current;
        if (!current || !p || p.round_id !== current.id) return;
        await refetchPicks(current.id);
      })
      .on("broadcast", { event: "toppl_sync" }, () => {
        resync().catch(() => {});
      })
      .subscribe();
    channelRef.current = channel;

    const interval = setInterval(() => {
      resync().catch(() => {});
    }, 2000);
    function onVisible() {
      if (document.visibilityState === "visible") resync().catch(() => {});
    }
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);

    function onLeave() {
      const m = meRef.current;
      if (!m) return;
      const payload = JSON.stringify({ roomId: room.id, playerId: m.id });
      try {
        navigator.sendBeacon("/api/leave-room", new Blob([payload], { type: "application/json" }));
      } catch {
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

  const wasKicked = !!me && players.length > 0 && !players.some((p) => p.id === me.id);

  if (wasKicked) {
    return (
      <main className="min-h-dvh w-full px-6 py-10 max-w-md mx-auto relative z-10">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] opacity-70" style={{ color: "var(--ember)" }}>kicked</p>
        <h1 className="font-display font-black text-4xl tracking-tight mt-2">the host removed you</h1>
        <p className="font-mono text-sm mt-3 opacity-80">no hard feelings. start your own room?</p>
        <a href="/" className="inline-block mt-6 px-4 py-2 rounded-md border-2 border-[var(--ink)] font-bold" style={{ background: "var(--ember)", color: "var(--ivory)" }}>start a new room →</a>
      </main>
    );
  }

  if (!me) {
    if (!mounted) return null;
    const isFull = players.length >= 8;
    if (room.status === "lobby" && !isFull) {
      return (
        <main className="min-h-dvh w-full px-6 py-10 max-w-md mx-auto relative z-10">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] opacity-70" style={{ color: "var(--ember)" }}>join room</p>
          <h1 className="font-display font-black text-4xl tracking-tight mt-2">
            room <span style={{ background: "var(--ember)", color: "var(--ivory)" }} className="px-1.5 rounded">{room.code}</span>
          </h1>
          <p className="font-mono text-sm mt-3 opacity-80">go back to <a href="/" className="underline">the home page</a> and pick the join tab to enter your name.</p>
        </main>
      );
    }
    return (
      <main className="min-h-dvh w-full px-6 py-10 max-w-md mx-auto relative z-10">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] opacity-70" style={{ color: "var(--ember)" }}>{isFull ? "room is full" : "in progress"}</p>
        <h1 className="font-display font-black text-4xl tracking-tight mt-2">no spot for you</h1>
        <p className="font-mono text-sm mt-3 opacity-80">{isFull ? "this room hit its 8-player limit." : "you can't slot into a game that's already running."}</p>
        <a href="/" className="inline-block mt-6 px-4 py-2 rounded-md border-2 border-[var(--ink)] font-bold" style={{ background: "var(--ember)", color: "var(--ivory)" }}>start a new room →</a>
      </main>
    );
  }

  const gameOver = room.current_round > room.round_count || (room.status === "ended" && !round);
  const revealed = !!round?.revealed_at;

  let view: React.ReactNode = null;
  if (gameOver) {
    view = <GameOver room={room} players={players} me={me} notifySync={notifySync} />;
  } else if (revealed && round && itemA && itemB) {
    view = <MultiReveal room={room} round={round} itemA={itemA} itemB={itemB} picks={picks} players={players} me={me} notifySync={notifySync} />;
  } else if (round && itemA && itemB && !revealed) {
    view = <MultiRound room={room} round={round} itemA={itemA} itemB={itemB} picks={picks} players={players} me={me} notifySync={notifySync} />;
  } else if (room.status === "lobby" && !round) {
    view = <Lobby room={room} players={players} me={me} notifySync={notifySync} />;
  }

  return (
    <main className="min-h-dvh w-full px-4 sm:px-6 py-6 relative z-10">
      <header className="flex justify-between items-center max-w-5xl mx-auto mb-6">
        <a href={process.env.NEXT_PUBLIC_PORTAL_URL || "https://doozy.fun"} className="font-mono text-[11px] uppercase tracking-[0.18em] opacity-70 underline underline-offset-4 decoration-2 hover:opacity-100">
          ← doozy
        </a>
        {room.mode === "multi" && (
          <div className="flex items-center gap-2 font-mono text-xs">
            <span className="opacity-60 hidden sm:inline">room</span>
            <span className="px-2 py-1 border-2 border-[var(--ink)] rounded font-bold tracking-[0.3em]" style={{ background: "var(--ember)", color: "var(--ivory)" }}>{room.code}</span>
          </div>
        )}
      </header>
      <div className="max-w-5xl mx-auto">{view}</div>
    </main>
  );
}
