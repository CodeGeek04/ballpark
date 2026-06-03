"use client";

import { useState } from "react";
import { motion } from "motion/react";
import type { Player, Room } from "@/lib/types";

export function GameOver({ room, players, me, notifySync }: { room: Room; players: Player[]; me: Player; notifySync?: () => void }) {
  const [busy, setBusy] = useState(false);
  const ranked = [...players].sort((a, b) => b.best_streak - a.best_streak || b.total_correct - a.total_correct || a.name.localeCompare(b.name));
  const winner = ranked[0];

  async function playAgain() {
    setBusy(true);
    await fetch("/api/restart-game", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ roomId: room.id, playerId: me.id }),
    });
    notifySync?.();
    setBusy(false);
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <p className="font-mono text-[11px] uppercase tracking-[0.22em] opacity-70" style={{ color: "var(--ember)" }}>final</p>
      <h1 className="font-display font-black text-5xl tracking-tight">that{`'`}s a game</h1>

      {winner && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="rounded-md p-7 text-center"
          style={{ background: "var(--ivory)", color: "var(--ink)", boxShadow: "inset 0 0 0 2px var(--ink), inset 0 0 0 4px var(--ivory), inset 0 0 0 5px var(--ink), 8px 10px 22px rgba(0,0,0,0.4)" }}
        >
          <p className="font-mono text-xs uppercase tracking-widest opacity-70">winner</p>
          <div className="text-6xl my-3">{winner.avatar}</div>
          <div className="font-display font-black text-3xl">{winner.name}</div>
          <div className="font-mono text-sm opacity-70 mt-1">best streak {winner.best_streak} · {winner.total_correct} correct</div>
        </motion.div>
      )}

      <div className="rounded-md border-2 border-[var(--ivory)]/30 p-5">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] opacity-70 mb-4">standings</p>
        <ol className="space-y-2">
          {ranked.map((p, i) => (
            <li key={p.id} className="flex items-center gap-3 px-2 py-1.5">
              <span className="font-display font-black text-xl w-6 tnum">{i + 1}</span>
              <span className="text-xl">{p.avatar}</span>
              <span className="flex-1 font-bold tracking-tight">{p.name}</span>
              <span className="font-mono text-xs opacity-60">{p.total_correct}/{room.round_count} right</span>
              <span className="font-display font-black text-xl tnum" style={{ color: "var(--ember)" }}>{p.best_streak}🔥</span>
            </li>
          ))}
        </ol>
      </div>

      <div className="flex items-center justify-between">
        <a href="/" className="font-mono underline underline-offset-4 decoration-2 hover:opacity-100 opacity-70">leave</a>
        {me.is_host ? (
          <button
            onClick={playAgain}
            disabled={busy}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-md border-2 border-[var(--ink)] font-display font-black text-lg tracking-tight shadow-[6px_6px_0_var(--ink)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0_var(--ink)] transition-all disabled:opacity-40"
            style={{ background: "var(--ember)", color: "var(--ivory)" }}
          >
            {busy ? "starting…" : "play again →"}
          </button>
        ) : (
          <span className="font-mono text-xs opacity-70">waiting for host to start a new game…</span>
        )}
      </div>
    </div>
  );
}
