"use client";

import { motion } from "motion/react";
import type { Item } from "@/lib/items";
import { formatValue } from "@/lib/pairs";

type Props = {
  a: Item;
  b: Item;
  onPick: (id: string) => void;
  state: "playing" | "reveal";
  pickedId: string | null;
  correctId: string | null;
  streak: number;
  onNext?: () => void;
};

export function Pair({ a, b, onPick, state, pickedId, correctId, streak, onNext }: Props) {
  const wasCorrect = pickedId === correctId;

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-4 font-mono text-[11px] tracking-[0.24em] uppercase">
        <span className="opacity-70">pick the bigger</span>
        <span className="opacity-60">round {streak + 1}</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] items-center gap-4 md:gap-6">
        <Card item={a} state={state} pickedId={pickedId} correctId={correctId} onPick={onPick} tilt={-5} />
        <div
          className="text-center"
          style={{
            fontFamily: "var(--font-serif), Georgia, serif",
            fontStyle: "italic",
            fontWeight: 900,
            fontSize: 42,
            letterSpacing: "-0.04em",
            transform: "rotate(-4deg)",
            color: "var(--ember)",
          }}
        >
          vs
        </div>
        <Card item={b} state={state} pickedId={pickedId} correctId={correctId} onPick={onPick} tilt={5} />
      </div>

      {state === "reveal" && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="mt-8 flex flex-col items-center gap-3"
        >
          <div
            className="font-display font-black text-3xl tracking-tight"
            style={{ color: wasCorrect ? "oklch(0.85 0.16 145)" : "var(--ember)" }}
          >
            {wasCorrect ? "Right!" : "Toppled."}
          </div>
          <button
            onClick={onNext}
            className="inline-flex items-center gap-2 px-5 py-3 rounded-md border-2 border-[var(--ink)] bg-[var(--ivory)] text-[var(--ink)] font-display font-bold text-lg tracking-tight shadow-[6px_6px_0_var(--ink)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0_var(--ink)] transition-all"
          >
            {wasCorrect ? "next round →" : "see your streak →"}
          </button>
        </motion.div>
      )}
    </div>
  );
}

function Card({
  item,
  state,
  pickedId,
  correctId,
  onPick,
  tilt,
}: {
  item: Item;
  state: "playing" | "reveal";
  pickedId: string | null;
  correctId: string | null;
  onPick: (id: string) => void;
  tilt: number;
}) {
  const isRevealed = state === "reveal";
  const isWinner = isRevealed && correctId === item.id;
  const isPicked = pickedId === item.id;
  const isLoser = isRevealed && correctId !== item.id;
  const wrongPick = isRevealed && isPicked && pickedId !== correctId;

  return (
    <motion.button
      type="button"
      aria-label={item.prompt}
      onClick={() => state === "playing" && onPick(item.id)}
      disabled={state !== "playing"}
      initial={{ rotate: tilt }}
      animate={{
        rotate: isRevealed ? (isLoser ? tilt * 2.4 : tilt * 0.5) : tilt,
        scale: isRevealed && isWinner ? 1.03 : isLoser ? 0.95 : 1,
        y: isRevealed && isLoser ? 14 : 0,
      }}
      whileHover={state === "playing" ? { scale: 1.02, rotate: 0, y: -6 } : undefined}
      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
      className="relative w-full aspect-[3/4.3] rounded-md p-4 sm:p-5 flex flex-col text-left disabled:cursor-default cursor-pointer"
      style={{
        background: "var(--ivory)",
        color: "var(--ink)",
        fontFamily: "var(--font-display), sans-serif",
        boxShadow:
          "inset 0 0 0 2px var(--ink), inset 0 0 0 4px var(--ivory), inset 0 0 0 5px var(--ink), 8px 10px 22px rgba(0,0,0,0.45)",
        opacity: isLoser ? 0.65 : 1,
      }}
    >
      {/* category badge */}
      <span
        className="inline-block self-start font-mono font-bold text-[9px] tracking-[0.18em] px-2 py-1"
        style={{ background: "var(--ember)", color: "var(--ivory)" }}
      >
        {item.category.toUpperCase()}
      </span>

      {/* title */}
      <div
        className="mt-3 leading-[0.98]"
        style={{
          fontFamily: "var(--font-serif), Georgia, serif",
          fontStyle: "italic",
          fontWeight: 900,
          fontSize: "clamp(20px, 3vw, 26px)",
          letterSpacing: "-0.015em",
        }}
      >
        {item.prompt}
      </div>

      {/* divider + stat */}
      <div className="mt-auto pt-3 border-t-[1.5px] border-[var(--ink)]">
        <div className="font-mono text-[10px] uppercase tracking-[0.18em] opacity-70">{item.unit}</div>
        <div className="mt-1 font-display font-black tnum" style={{ fontSize: "clamp(22px, 3.5vw, 30px)", lineHeight: 1, letterSpacing: "-0.03em" }}>
          {isRevealed ? (
            <motion.span
              key="reveal"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              style={{ color: isWinner ? "var(--ember)" : "var(--ink)" }}
            >
              {formatShortValue(item.value)}
            </motion.span>
          ) : (
            <span style={{ fontFamily: "var(--font-serif), Georgia, serif", fontStyle: "italic", color: "var(--ember)" }}>?</span>
          )}
        </div>
      </div>

      {/* winner/loser pill */}
      {isRevealed && (
        <motion.div
          initial={{ opacity: 0, scale: 0.7 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.25, duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="absolute -top-3 -right-3 font-mono text-[10px] font-bold tracking-[0.16em] px-2.5 py-1 rounded-full border-2 border-[var(--ink)]"
          style={{
            background: isWinner ? "oklch(0.75 0.18 145)" : wrongPick ? "var(--ember)" : "var(--ivory)",
            color: "var(--ink)",
          }}
        >
          {isWinner ? "BIGGER" : isPicked ? "YOUR PICK" : "SMALLER"}
        </motion.div>
      )}
    </motion.button>
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
