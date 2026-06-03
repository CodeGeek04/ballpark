"use client";

import { useState } from "react";
import type { Player, Room } from "@/lib/types";
import { PaperCard } from "@/components/PaperCard";
import { StampButton } from "@/components/StampButton";
import { ChipStamp } from "@/components/ChipStamp";

export function Ended({
  room,
  players,
  scores,
  me,
  notifySync,
}: {
  room: Room;
  players: Player[];
  scores: Record<string, number>;
  me: Player;
  notifySync?: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function playAgain() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/restart-game", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ roomId: room.id, playerId: me.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "restart failed");
      notifySync?.();
      // Realtime UPDATE on rooms.status='lobby' takes over from here.
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  if (room.mode === "solo") {
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
        <div className="flex items-center justify-end gap-3">
          <a href="/" className="font-mono underline underline-offset-4 decoration-2 hover:text-ember">leave</a>
          <StampButton onClick={playAgain} disabled={busy} tone="ember" className="text-lg">
            {busy ? "starting…" : "play again →"}
          </StampButton>
        </div>
        {error && <p className="font-mono text-sm text-ember font-bold text-right">{error}</p>}
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

      <div className="flex items-center justify-between gap-3">
        <a href="/" className="font-mono underline underline-offset-4 decoration-2 hover:text-ember">leave</a>
        {me.is_host ? (
          <StampButton onClick={playAgain} disabled={busy} tone="ember" className="text-lg">
            {busy ? "starting…" : "play again →"}
          </StampButton>
        ) : (
          <span className="font-mono text-xs opacity-70">waiting for host to start a new game…</span>
        )}
      </div>
      {error && <p className="font-mono text-sm text-ember font-bold text-right">{error}</p>}
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
