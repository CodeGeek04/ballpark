"use client";

import type { Player, Room } from "@/lib/types";
import { PaperCard } from "@/components/PaperCard";
import { ChipStamp } from "@/components/ChipStamp";

export function Ended({ room, players, scores }: { room: Room; players: Player[]; scores: Record<string, number> }) {
  if (room.mode === "solo") {
    const me = players[0];
    const total = me ? scores[me.id] ?? 0 : 0;
    const max = room.round_count * 1000;
    const verdict = verdictFor(total / max);
    return (
      <div className="max-w-xl mx-auto space-y-6">
        <ChipStamp tone="ember">final</ChipStamp>
        <h1 className="font-display font-bold text-5xl tracking-tight">that{`'`}s a wrap</h1>
        <PaperCard>
          <div className="text-center py-4">
            <div className="font-mono text-xs uppercase tracking-widest opacity-70">your score</div>
            <div className="font-display font-bold text-[7rem] leading-none tnum my-3 text-ember">{total}</div>
            <div className="font-mono text-sm opacity-60 tnum">out of {max.toLocaleString()}</div>
            <div className="mt-6 font-display font-bold text-2xl tracking-tight">{verdict}</div>
          </div>
        </PaperCard>
        <div className="flex justify-end">
          <a href="/" className="inline-block font-mono underline underline-offset-4 decoration-2 hover:text-ember">play again →</a>
        </div>
      </div>
    );
  }

  const ranked = [...players]
    .map((p) => ({ player: p, total: scores[p.id] ?? 0 }))
    .sort((a, b) => b.total - a.total);
  const winner = ranked[0];

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <ChipStamp tone="ember">final</ChipStamp>
      <h1 className="font-display font-bold text-5xl tracking-tight">that{`'`}s a game</h1>
      {winner && (
        <PaperCard>
          <div className="text-center py-6">
            <div className="font-mono text-xs uppercase tracking-widest opacity-70">winner</div>
            <div className="text-6xl my-3">{winner.player.avatar}</div>
            <div className="font-display font-bold text-3xl">{winner.player.name}</div>
            <div className="font-mono text-sm opacity-70 mt-1 tnum">{winner.total} points</div>
          </div>
        </PaperCard>
      )}
      <PaperCard>
        <ol className="space-y-2">
          {ranked.map((row, i) => (
            <li key={row.player.id} className="flex items-center gap-3 px-2 py-1.5">
              <span className="font-display font-bold text-xl w-6 tnum">{i + 1}</span>
              <span className="text-xl">{row.player.avatar}</span>
              <span className="flex-1 font-bold tracking-tight">{row.player.name}</span>
              <span className="font-display font-bold text-xl tnum">{row.total}</span>
            </li>
          ))}
        </ol>
      </PaperCard>
      <a href="/" className="inline-block underline font-mono">← play again</a>
    </div>
  );
}

function verdictFor(ratio: number): string {
  if (ratio >= 0.85) return "almost spooky.";
  if (ratio >= 0.7) return "you have the gift.";
  if (ratio >= 0.55) return "solid ballpark instincts.";
  if (ratio >= 0.4) return "respectable rounding.";
  if (ratio >= 0.25) return "the universe is large, you tried.";
  return "humbling. play again.";
}
