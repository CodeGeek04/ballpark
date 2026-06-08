"use client";

import { useState } from "react";
import { motion } from "motion/react";
import type { Item, Pick, Player, Room, Round } from "@/lib/types";

export function MultiReveal({
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
  const [busy, setBusy] = useState(false);
  const biggerId = Number(itemA.value) >= Number(itemB.value) ? itemA.id : itemB.id;
  const myPick = picks.find((p) => p.player_id === me.id);
  const wasCorrect = myPick?.picked_item_id === biggerId;
  const isLast = round.index >= room.round_count;

  async function next() {
    if (!me.is_host) return;
    setBusy(true);
    const endpoint = isLast ? "/api/end-game" : "/api/start-round";
    await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ roomId: room.id, playerId: me.id }),
    });
    notifySync?.();
    setBusy(false);
  }

  // sort players by current_streak desc then best_streak desc then name
  const ranked = [...players].sort((a, b) => b.current_streak - a.current_streak || b.best_streak - a.best_streak || a.name.localeCompare(b.name));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between font-mono text-xs uppercase tracking-[0.18em] opacity-70">
        <span>reveal · round {round.index} / {room.round_count}</span>
        <span style={{ color: wasCorrect ? "oklch(0.85 0.16 145)" : "var(--ember)" }} className="font-display font-black not-italic normal-case">
          {wasCorrect ? "you got it" : "you toppled"}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] items-center gap-4 md:gap-6 max-w-3xl mx-auto">
        <div className="flex justify-end">
          <RevealCard item={itemA} bigger={biggerId === itemA.id} pickedByMe={myPick?.picked_item_id === itemA.id} tilt={-5} />
        </div>
        <div
          className="text-center"
          style={{ fontFamily: "var(--font-serif), Georgia, serif", fontStyle: "italic", fontWeight: 900, fontSize: 42, letterSpacing: "-0.04em", transform: "rotate(-4deg)", color: "var(--ember)" }}
        >
          vs
        </div>
        <div className="flex justify-start">
          <RevealCard item={itemB} bigger={biggerId === itemB.id} pickedByMe={myPick?.picked_item_id === itemB.id} tilt={5} />
        </div>
      </div>

      <div className="rounded-md border-2 border-[var(--ivory)]/30 p-5">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] opacity-70 mb-4">streaks after this round</p>
        <ol className="space-y-2">
          {ranked.map((p, i) => {
            const got = picks.find((pp) => pp.player_id === p.id)?.is_correct === true;
            return (
              <motion.li
                key={p.id}
                layout
                transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                className="flex items-center gap-3 px-3 py-2 rounded-md border-2 border-[var(--ivory)]/30"
              >
                <span className="font-display font-bold text-xl w-6 tnum">{i + 1}</span>
                <span className="text-2xl">{p.avatar}</span>
                <span className="flex-1 font-bold tracking-tight">{p.name}</span>
                <span className="font-mono text-xs opacity-60" style={{ color: got ? "oklch(0.85 0.16 145)" : "var(--ember)" }}>
                  {got ? "+1" : "miss"}
                </span>
                <span className="font-display font-black text-xl tnum" style={{ color: p.current_streak > 0 ? "var(--ember)" : undefined }}>
                  {p.current_streak}🔥
                </span>
              </motion.li>
            );
          })}
        </ol>
      </div>

      {me.is_host && (
        <div className="flex justify-end">
          <button
            onClick={next}
            disabled={busy}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-md border-2 border-[var(--ink)] font-display font-black text-lg tracking-tight shadow-[6px_6px_0_var(--ink)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0_var(--ink)] transition-all disabled:opacity-40"
            style={{ background: "var(--ember)", color: "var(--ivory)" }}
          >
            {busy ? "…" : isLast ? "see final standings →" : "next round →"}
          </button>
        </div>
      )}
    </div>
  );
}

function RevealCard({ item, bigger, pickedByMe, tilt }: { item: Item; bigger: boolean; pickedByMe: boolean; tilt: number }) {
  return (
    <motion.div
      initial={{ rotate: tilt }}
      animate={{ rotate: bigger ? tilt * 0.5 : tilt * 2.4, scale: bigger ? 1.03 : 0.95, y: bigger ? 0 : 14 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="relative w-full max-w-[240px] aspect-[3/4] rounded-md p-4 sm:p-5 flex flex-col text-left"
      style={{
        background: "var(--ivory)",
        color: "var(--ink)",
        fontFamily: "var(--font-display), sans-serif",
        boxShadow: "inset 0 0 0 2px var(--ink), inset 0 0 0 4px var(--ivory), inset 0 0 0 5px var(--ink), 8px 10px 22px rgba(0,0,0,0.45)",
        opacity: bigger ? 1 : 0.65,
      }}
    >
      <span
        className="inline-block self-start font-mono font-bold text-[9px] tracking-[0.18em] px-2 py-1"
        style={{ background: "var(--ember)", color: "var(--ivory)" }}
      >
        {(item.category ?? "—").toUpperCase()}
      </span>
      <div
        className="mt-3 leading-[1.0]"
        style={{ fontFamily: "var(--font-serif), Georgia, serif", fontStyle: "italic", fontWeight: 900, fontSize: "clamp(17px, 2.2vw, 20px)", letterSpacing: "-0.015em" }}
      >
        {item.prompt}
      </div>
      <motion.div
        initial={{ opacity: 0, scale: 0.85 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.45, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
        className="flex-1 flex items-center justify-center tnum"
        style={{ fontFamily: "var(--font-display), sans-serif", fontWeight: 900, fontSize: "clamp(34px, 6vw, 56px)", lineHeight: 1, letterSpacing: "-0.04em", color: bigger ? "var(--ember)" : "var(--ink)" }}
      >
        {formatShortValue(Number(item.value))}
      </motion.div>
      <div className="pt-3 border-t-[1.5px] border-[var(--ink)] font-mono text-[10px] uppercase tracking-[0.18em] opacity-70">
        {item.unit}
      </div>
      <motion.div
        initial={{ opacity: 0, scale: 0.7 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.3, duration: 0.3 }}
        className="absolute -top-3 -right-3 font-mono text-[10px] font-bold tracking-[0.16em] px-2.5 py-1 rounded-full border-2 border-[var(--ink)]"
        style={{
          background: bigger ? "oklch(0.75 0.18 145)" : pickedByMe ? "var(--ember)" : "var(--ivory)",
          color: "var(--ink)",
        }}
      >
        {bigger ? "BIGGER" : pickedByMe ? "YOUR PICK" : "SMALLER"}
      </motion.div>
    </motion.div>
  );
}

function formatShortValue(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 1e12) return `${(v / 1e12).toFixed(1)}T`;
  if (abs >= 1e9) return `${(v / 1e9).toFixed(1)}B`;
  if (abs >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return Math.round(v).toLocaleString();
  return v.toLocaleString();
}
