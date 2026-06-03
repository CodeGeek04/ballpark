"use client";

import { motion } from "motion/react";
import type { Item } from "@/lib/items";
import { formatValue } from "@/lib/pairs";

export function GameOver({
  streak,
  best,
  finalPair,
  pickedId,
  correctId,
  onRestart,
}: {
  streak: number;
  best: number;
  finalPair?: [Item, Item];
  pickedId?: string;
  correctId?: string;
  onRestart: () => void;
}) {
  const isNewBest = streak > 0 && streak >= best;
  const verdict = verdictFor(streak);

  return (
    <div className="max-w-xl mx-auto py-6">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        className="text-center"
      >
        <p className="font-mono text-[11px] uppercase tracking-[0.24em] opacity-70 mb-2">{isNewBest ? "new best" : "game over"}</p>
        <h1 className="font-serif italic font-black text-[clamp(3rem,8vw,5rem)] leading-[0.95] tracking-[-0.02em]">
          {streak}
        </h1>
        <p className="font-mono text-sm opacity-70 mt-1">in a row</p>
        <p className="mt-6 font-display font-bold text-2xl tracking-tight">{verdict}</p>
      </motion.div>

      {finalPair && pickedId && correctId && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.25, duration: 0.4 }}
          className="mt-8 mx-auto max-w-md rounded-md p-4 sm:p-5 border-2 border-[var(--ivory)]/30"
        >
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] opacity-60 mb-3">where you toppled</p>
          {finalPair.map((it) => {
            const isWinner = it.id === correctId;
            const isYourPick = it.id === pickedId;
            return (
              <div key={it.id} className="flex items-baseline justify-between gap-3 py-1.5">
                <div className="flex items-baseline gap-2 min-w-0">
                  <span className="font-mono text-[10px] uppercase tracking-[0.16em] opacity-60 shrink-0">
                    {isWinner ? "bigger" : "smaller"}
                  </span>
                  <span className="font-serif italic font-bold text-base truncate">{it.prompt}</span>
                </div>
                <span className="font-display font-black tnum shrink-0" style={{ color: isWinner ? "var(--ember)" : undefined }}>
                  {formatValue(it.value, it.unit).split(" ").slice(0, 2).join(" ")}
                </span>
              </div>
            );
          })}
          <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.16em] opacity-60">
            you picked: <span className="text-[var(--ivory)] opacity-100">{finalPair.find((i) => i.id === pickedId)?.prompt}</span>
          </p>
        </motion.div>
      )}

      <div className="mt-8 flex items-center justify-center gap-4">
        <a href={process.env.NEXT_PUBLIC_PORTAL_URL || "/"} className="font-mono text-xs underline underline-offset-4 decoration-2 opacity-70 hover:opacity-100">
          leave
        </a>
        <button
          onClick={onRestart}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-md border-2 border-[var(--ink)] bg-[var(--ember)] text-[var(--ivory)] font-display font-bold text-lg tracking-tight shadow-[6px_6px_0_var(--ink)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0_var(--ink)] transition-all"
        >
          play again →
        </button>
      </div>
    </div>
  );
}

function verdictFor(streak: number): string {
  if (streak === 0) return "rough start. try again.";
  if (streak <= 2) return "warming up.";
  if (streak <= 5) return "respectable.";
  if (streak <= 10) return "you have the touch.";
  if (streak <= 20) return "this is your game.";
  return "spooky. send a screenshot.";
}
