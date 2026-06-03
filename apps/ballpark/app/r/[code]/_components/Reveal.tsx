"use client";

import { useEffect, useState } from "react";
import { motion, useMotionValue, useTransform, animate } from "motion/react";
import type { Player, Room, Round, Submission } from "@/lib/types";
import { bounds, logPercent } from "@/lib/scoring";
import { PaperCard } from "@/components/PaperCard";
import { StampButton } from "@/components/StampButton";
import { ChipStamp } from "@/components/ChipStamp";

type Question = { id: string; prompt: string; unit: string | null; category: string | null; k: number };

export function Reveal({
  room,
  round,
  question,
  answer,
  category,
  players,
  submissions,
  scores,
  me,
  notifySync,
}: {
  room: Room;
  round: Round;
  question: Question;
  answer: number;
  category: string | null;
  players: Player[];
  submissions: Submission[];
  scores: Record<string, number>;
  me: Player;
  notifySync?: () => void;
}) {
  const all = submissions.map((s) => Number(s.guess)).concat([answer]);
  const { min, max } = bounds(all);
  const [showAnswer, setShowAnswer] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setShowAnswer(true), 1100);
    return () => clearTimeout(t);
  }, []);

  const isLast = round.index >= room.round_count;

  async function next() {
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

  const ranked = [...players]
    .map((p) => ({ player: p, total: scores[p.id] ?? 0 }))
    .sort((a, b) => b.total - a.total);

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="flex flex-wrap items-baseline gap-3">
        <ChipStamp tone="ember">round {round.index} reveal</ChipStamp>
        {category && <ChipStamp tone="ink" rotate={2}>{category}</ChipStamp>}
      </div>

      <PaperCard>
        <div className="space-y-2">
          <div className="font-display font-bold text-2xl tracking-tight leading-tight">{question.prompt}</div>
          <div className="font-mono text-sm opacity-70">true answer</div>
          <div className="font-display font-bold text-5xl tnum">
            <CountUp value={answer} />
            {question.unit && <span className="font-mono text-xl ml-2 opacity-70 font-normal">{question.unit}</span>}
          </div>
        </div>
      </PaperCard>

      <PaperCard>
        <div className="font-mono text-[11px] uppercase tracking-[0.18em] font-bold mb-6 opacity-70">where everyone landed</div>
        <div className="relative h-32">
          <div className="absolute inset-x-0 top-1/2 h-[2px] bg-ink" />
          <div className="absolute left-0 -bottom-1 font-mono text-[10px] opacity-60 tnum">{formatNum(min)}</div>
          <div className="absolute right-0 -bottom-1 font-mono text-[10px] opacity-60 tnum">{formatNum(max)}</div>

          {submissions.map((s) => {
            const p = players.find((pl) => pl.id === s.player_id);
            if (!p) return null;
            const pct = logPercent(Number(s.guess), min, max);
            return (
              <motion.div
                key={s.id}
                initial={{ left: "50%", opacity: 0, y: -10 }}
                animate={{ left: `${pct}%`, opacity: 1, y: 0 }}
                transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1], delay: 0.05 }}
                className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
              >
                <div className="flex flex-col items-center">
                  <div className="text-2xl drop-shadow-sm">{p.avatar}</div>
                  <div className="mt-1 font-mono text-[10px] tnum bg-paper border-2 border-ink rounded-md px-1.5 py-0.5">
                    {formatNum(Number(s.guess))}
                  </div>
                </div>
              </motion.div>
            );
          })}

          {showAnswer && (
            <motion.div
              initial={{ left: "50%", opacity: 0, y: 40, scale: 0.5 }}
              animate={{ left: `${logPercent(answer, min, max)}%`, opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
            >
              <div className="flex flex-col items-center">
                <div className="font-mono text-[10px] uppercase tracking-widest font-bold text-ember mb-1">answer</div>
                <div className="h-12 w-1 bg-ember" />
                <div className="mt-1 font-mono text-xs tnum bg-ember text-paper border-2 border-ink rounded-md px-2 py-0.5 font-bold">
                  {formatNum(answer)}
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </PaperCard>

      {room.mode === "solo" ? (
        <PaperCard>
          <div className="grid grid-cols-2 gap-6">
            <div>
              <div className="font-mono text-[11px] uppercase tracking-[0.18em] font-bold opacity-70">this round</div>
              <div className="font-display font-bold text-5xl tnum mt-1">
                +{submissions.find((s) => s.player_id === me.id)?.score ?? 0}
              </div>
            </div>
            <div>
              <div className="font-mono text-[11px] uppercase tracking-[0.18em] font-bold opacity-70">total so far</div>
              <div className="font-display font-bold text-5xl tnum mt-1 text-ember">
                {scores[me.id] ?? 0}
              </div>
            </div>
          </div>
        </PaperCard>
      ) : (
        <PaperCard>
          <div className="font-mono text-[11px] uppercase tracking-[0.18em] font-bold mb-4 opacity-70">standings</div>
          <ol className="space-y-2">
            {ranked.map((row, i) => {
              const sub = submissions.find((s) => s.player_id === row.player.id);
              return (
                <motion.li
                  key={row.player.id}
                  layout
                  transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                  className={`flex items-center gap-3 px-3 py-2 rounded-card border-2 border-ink ${i === 0 ? "bg-mustard" : "bg-paper"}`}
                >
                  <span className="font-display font-bold text-xl w-6 tnum">{i + 1}</span>
                  <span className="text-2xl">{row.player.avatar}</span>
                  <span className="flex-1 font-bold tracking-tight">{row.player.name}</span>
                  <span className="font-mono text-xs opacity-60 tnum">+{sub?.score ?? 0}</span>
                  <span className="font-display font-bold text-xl tnum">{row.total}</span>
                </motion.li>
              );
            })}
          </ol>
        </PaperCard>
      )}

      {me.is_host && (
        <div className="flex justify-end">
          <StampButton onClick={next} disabled={busy} tone="ember" className="text-lg">
            {busy ? "…" : isLast ? (room.mode === "solo" ? "see your score →" : "see final standings →") : "next round →"}
          </StampButton>
        </div>
      )}
    </div>
  );
}

function CountUp({ value }: { value: number }) {
  const mv = useMotionValue(0);
  const rounded = useTransform(mv, (n) => formatNum(n));
  useEffect(() => {
    const ctrl = animate(mv, value, { duration: 1.2, ease: [0.16, 1, 0.3, 1] });
    return ctrl.stop;
  }, [value, mv]);
  return <motion.span>{rounded}</motion.span>;
}

function formatNum(n: number): string {
  if (!isFinite(n)) return "—";
  const abs = Math.abs(n);
  if (abs >= 1e12) return `${(n / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return Math.round(n).toLocaleString();
  if (abs >= 1) return n.toFixed(0);
  return n.toFixed(2);
}
