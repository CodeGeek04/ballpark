"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import type { Item, Pick, Player, Room, Round } from "@/lib/types";

export function MultiRound({
  room,
  round,
  itemA,
  itemB,
  picks,
  players,
  me,
  notifySync,
}: {
  room: Room;
  round: Round;
  itemA: Item;
  itemB: Item;
  picks: Pick[];
  players: Player[];
  me: Player;
  notifySync?: () => void;
}) {
  const deadline = useMemo(() => new Date(round.deadline_at).getTime(), [round.deadline_at]);
  const [now, setNow] = useState(Date.now());
  const [picked, setPicked] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const triggeredRevealRef = useRef(false);

  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(i);
  }, []);

  useEffect(() => {
    const mine = picks.find((p) => p.player_id === me.id);
    if (mine) setPicked(mine.picked_item_id);
  }, [picks, me.id]);

  const msLeft = Math.max(0, deadline - now);
  const pct = Math.max(0, Math.min(100, (msLeft / (room.round_seconds * 1000)) * 100));
  const secondsLeft = Math.ceil(msLeft / 1000);

  function fireReveal() {
    if (triggeredRevealRef.current) return;
    if (round.revealed_at) return;
    triggeredRevealRef.current = true;
    fetch("/api/reveal-round", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ roundId: round.id }),
    })
      .then(() => notifySync?.())
      .catch(() => { triggeredRevealRef.current = false; });
  }

  // Deadline-driven reveal
  useEffect(() => {
    if (msLeft > 0) return;
    fireReveal();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [msLeft]);

  // All-submitted reveal: when picks for every player are in, fire.
  useEffect(() => {
    const submittedIds = new Set(picks.map((p) => p.player_id));
    if (players.length > 0 && players.every((p) => submittedIds.has(p.id))) fireReveal();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [picks, players]);

  async function pick(itemId: string) {
    if (picked) return;
    setPicked(itemId);
    setError(null);
    try {
      const res = await fetch("/api/submit-pick", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ roundId: round.id, playerId: me.id, pickedItemId: itemId }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "pick failed");
        setPicked(null);
        return;
      }
      notifySync?.();
      // optimistic all-submitted check
      const submittedIds = new Set([...picks.map((p) => p.player_id), me.id]);
      if (players.every((p) => submittedIds.has(p.id))) fireReveal();
    } catch {
      setError("network error");
      setPicked(null);
    }
  }

  const submittedIds = new Set(picks.map((p) => p.player_id));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between font-mono text-xs">
        <span className="opacity-70 uppercase tracking-[0.18em]">round {round.index} / {room.round_count}</span>
        <span className={`font-display font-black text-xl tnum ${msLeft < 8000 ? "text-[var(--ember)]" : ""}`}>:{String(secondsLeft).padStart(2, "0")}</span>
      </div>

      <div className="relative h-3 border-2 border-[var(--ink)] rounded-full overflow-hidden" style={{ background: "var(--ivory)" }}>
        <div
          className="absolute inset-y-0 left-0"
          style={{
            width: `${pct}%`,
            backgroundImage: "repeating-linear-gradient(45deg, var(--ember) 0 8px, oklch(0.75 0.18 70) 8px 16px)",
            transition: "width 0.1s linear",
          }}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] items-center gap-4 md:gap-6 mt-2">
        <Card item={itemA} onPick={pick} picked={picked} tilt={-5} disabled={!!picked} />
        <div
          className="text-center"
          style={{ fontFamily: "var(--font-serif), Georgia, serif", fontStyle: "italic", fontWeight: 900, fontSize: 42, letterSpacing: "-0.04em", transform: "rotate(-4deg)", color: "var(--ember)" }}
        >
          vs
        </div>
        <Card item={itemB} onPick={pick} picked={picked} tilt={5} disabled={!!picked} />
      </div>

      {error && <p className="font-mono text-sm text-center font-bold" style={{ color: "var(--ember)" }}>{error}</p>}

      <div className="flex flex-wrap gap-2 justify-center mt-4">
        <span className="text-[11px] font-mono uppercase tracking-[0.12em] font-bold opacity-70 self-center mr-2">locked in</span>
        <AnimatePresence>
          {players.map((p) => {
            const ok = submittedIds.has(p.id);
            return (
              <motion.div
                key={p.id}
                layout
                animate={{ opacity: ok ? 1 : 0.4, scale: ok ? 1 : 0.95 }}
                transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border-2 ${ok ? "border-[var(--ink)] bg-[var(--ember)] text-[var(--ivory)]" : "border-[var(--ivory)]/40"}`}
              >
                <span>{p.avatar}</span>
                <span className="font-mono text-xs">{p.name}</span>
                {ok && <span className="font-bold">✓</span>}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}

function Card({ item, onPick, picked, tilt, disabled }: { item: Item; onPick: (id: string) => void; picked: string | null; tilt: number; disabled: boolean }) {
  const isPicked = picked === item.id;
  return (
    <motion.button
      type="button"
      aria-label={item.prompt}
      onClick={() => !disabled && onPick(item.id)}
      disabled={disabled}
      initial={{ rotate: tilt }}
      animate={{ rotate: isPicked ? 0 : tilt, scale: isPicked ? 1.04 : 1, y: isPicked ? -6 : 0 }}
      whileHover={!disabled ? { scale: 1.02, rotate: 0, y: -6 } : undefined}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="relative w-full aspect-[3/4.3] rounded-md p-4 sm:p-5 flex flex-col text-left disabled:cursor-default cursor-pointer"
      style={{
        background: "var(--ivory)",
        color: "var(--ink)",
        fontFamily: "var(--font-display), sans-serif",
        boxShadow: "inset 0 0 0 2px var(--ink), inset 0 0 0 4px var(--ivory), inset 0 0 0 5px var(--ink), 8px 10px 22px rgba(0,0,0,0.45)",
      }}
    >
      <span
        className="inline-block self-start font-mono font-bold text-[9px] tracking-[0.18em] px-2 py-1"
        style={{ background: "var(--ember)", color: "var(--ivory)" }}
      >
        {(item.category ?? "—").toUpperCase()}
      </span>
      <div
        className="mt-3 leading-[0.98]"
        style={{ fontFamily: "var(--font-serif), Georgia, serif", fontStyle: "italic", fontWeight: 900, fontSize: "clamp(20px, 3vw, 26px)", letterSpacing: "-0.015em" }}
      >
        {item.prompt}
      </div>
      <div className="mt-auto pt-3 border-t-[1.5px] border-[var(--ink)]">
        <div className="font-mono text-[10px] uppercase tracking-[0.18em] opacity-70">{item.unit}</div>
        <div className="mt-1 font-display font-black" style={{ fontFamily: "var(--font-serif), Georgia, serif", fontStyle: "italic", color: "var(--ember)", fontSize: "clamp(22px, 3.5vw, 30px)", lineHeight: 1 }}>
          ?
        </div>
      </div>
      {isPicked && (
        <motion.div
          initial={{ opacity: 0, scale: 0.7 }}
          animate={{ opacity: 1, scale: 1 }}
          className="absolute -top-3 -right-3 font-mono text-[10px] font-bold tracking-[0.16em] px-2.5 py-1 rounded-full border-2 border-[var(--ink)]"
          style={{ background: "var(--ember)", color: "var(--ivory)" }}
        >
          YOUR PICK
        </motion.div>
      )}
    </motion.button>
  );
}
