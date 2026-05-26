"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import type { Player, Room } from "@/lib/types";
import { PaperCard } from "@/components/PaperCard";
import { StampButton } from "@/components/StampButton";
import { ChipStamp } from "@/components/ChipStamp";

export function Lobby({ room, players, me }: { room: Room; players: Player[]; me: Player }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState("");
  useEffect(() => {
    setShareUrl(`${window.location.origin}/r/${room.code}`);
  }, [room.code]);

  async function start() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/start-round", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ roomId: room.id, playerId: me.id }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "couldn't start");
      setBusy(false);
    }
  }

  function copy() {
    navigator.clipboard.writeText(shareUrl).catch(() => {});
  }

  const teamA = players.filter((p) => p.team === "A");
  const teamB = players.filter((p) => p.team === "B");

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex flex-wrap items-end gap-3 justify-between">
        <div>
          <ChipStamp tone="ember">{room.mode === "ffa" ? "free for all" : room.mode}</ChipStamp>
          <h1 className="font-display font-bold text-5xl tracking-tight mt-3">waiting for players</h1>
          <p className="mt-1 font-mono text-sm opacity-70">{players.length} in the lobby · max 6</p>
        </div>
        {me.is_host && (
          <StampButton onClick={start} disabled={busy || players.length < (room.mode === "teams" ? 2 : 1)} tone="ember" className="text-lg">
            {busy ? "starting…" : "start game →"}
          </StampButton>
        )}
      </div>

      <PaperCard>
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-[11px] font-mono uppercase tracking-[0.12em] font-bold">share this link</span>
          <code className="font-mono text-sm bg-paper border-2 border-ink rounded-md px-3 py-1 select-all">{shareUrl}</code>
          <button onClick={copy} className="font-mono text-xs underline underline-offset-4 hover:text-ember">copy</button>
        </div>
      </PaperCard>

      {room.mode === "teams" ? (
        <div className="grid sm:grid-cols-2 gap-4">
          <TeamPanel title="team mango" tone="ember" players={teamA} me={me} />
          <TeamPanel title="team kiwi" tone="mustard" players={teamB} me={me} />
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {players.map((p) => (
            <PlayerTile key={p.id} player={p} highlight={p.id === me.id} />
          ))}
          {Array.from({ length: Math.max(0, 6 - players.length) }).map((_, i) => (
            <div key={i} className="rounded-card border-2 border-dashed border-ink/40 py-6 px-4 text-center font-mono text-xs opacity-50">
              waiting…
            </div>
          ))}
        </div>
      )}

      {error && (
        <p className="font-mono text-sm text-ember font-bold">{error}</p>
      )}

      <div className="mt-10 grid sm:grid-cols-3 gap-4 font-mono text-sm opacity-80">
        <Rule n="01" text={`${room.round_count} rounds · ${room.round_seconds}s each`} />
        <Rule n="02" text="Closer guess = more points (1000 max)" />
        <Rule n="03" text="Order-of-magnitude misses still score" />
      </div>
    </div>
  );
}

function PlayerTile({ player, highlight }: { player: Player; highlight: boolean }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      className={`rounded-card border-2 border-ink p-4 flex items-center gap-3 ${highlight ? "bg-mustard shadow-stamp-sm" : "bg-paper"}`}
    >
      <span className="text-2xl">{player.avatar}</span>
      <div className="leading-tight">
        <div className="font-bold tracking-tight">{player.name}</div>
        {player.is_host && <div className="font-mono text-[10px] uppercase tracking-wider opacity-70">host</div>}
      </div>
    </motion.div>
  );
}

function TeamPanel({ title, tone, players, me }: { title: string; tone: "ember" | "mustard"; players: Player[]; me: Player }) {
  return (
    <div className={`rounded-card border-2 border-ink p-5 ${tone === "ember" ? "bg-ember/10" : "bg-mustard/30"}`}>
      <div className="flex items-center justify-between mb-3">
        <ChipStamp tone={tone}>{title}</ChipStamp>
        <span className="font-mono text-xs opacity-60">{players.length}</span>
      </div>
      <div className="space-y-2">
        {players.map((p) => (
          <PlayerTile key={p.id} player={p} highlight={p.id === me.id} />
        ))}
        {!players.length && <p className="font-mono text-xs opacity-50">waiting…</p>}
      </div>
    </div>
  );
}

function Rule({ n, text }: { n: string; text: string }) {
  return (
    <div className="flex gap-3 items-start">
      <span className="font-display font-bold text-2xl text-ember">{n}</span>
      <p>{text}</p>
    </div>
  );
}
