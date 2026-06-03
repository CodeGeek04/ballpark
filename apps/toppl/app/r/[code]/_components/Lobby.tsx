"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import type { Player, Room } from "@/lib/types";

export function Lobby({ room, players, me, notifySync }: { room: Room; players: Player[]; me: Player; notifySync?: () => void }) {
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
      return;
    }
    notifySync?.();
  }

  async function kick(target: Player) {
    if (!confirm(`Kick ${target.name} from the room?`)) return;
    const res = await fetch("/api/kick-player", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ roomId: room.id, hostPlayerId: me.id, targetPlayerId: target.id }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "kick failed");
      return;
    }
    notifySync?.();
  }

  function copy() {
    navigator.clipboard.writeText(shareUrl).catch(() => {});
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3 justify-between">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] opacity-70" style={{ color: "var(--ember)" }}>lobby</p>
          <h1 className="font-display font-black text-5xl tracking-tight mt-1">waiting for players</h1>
          <p className="mt-1 font-mono text-sm opacity-70">{players.length} in the lobby · max 8 · {room.round_count} rounds</p>
        </div>
        {me.is_host && (
          <button
            onClick={start}
            disabled={busy || players.length < 1}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-md border-2 border-[var(--ink)] font-display font-black text-lg tracking-tight shadow-[6px_6px_0_var(--ink)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0_var(--ink)] transition-all disabled:opacity-40"
            style={{ background: "var(--ember)", color: "var(--ivory)" }}
          >
            {busy ? "starting…" : "start game →"}
          </button>
        )}
      </div>

      <div className="rounded-md border-2 border-dashed border-[var(--ivory)]/30 p-4">
        <div className="flex flex-wrap items-center gap-3 font-mono">
          <span className="text-[11px] uppercase tracking-[0.14em] opacity-70 font-bold">share link</span>
          <code className="text-sm bg-black/30 border border-[var(--ivory)]/20 rounded-md px-3 py-1 select-all">{shareUrl}</code>
          <button onClick={copy} className="text-xs underline hover:opacity-100 opacity-70">copy</button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {players.map((p) => (
          <PlayerTile key={p.id} player={p} highlight={p.id === me.id} canKick={me.is_host && !p.is_host && p.id !== me.id} onKick={kick} />
        ))}
        {Array.from({ length: Math.max(0, 8 - players.length) }).map((_, i) => (
          <div key={i} className="rounded-md border-2 border-dashed border-[var(--ivory)]/25 py-6 px-4 text-center font-mono text-xs opacity-50">
            waiting…
          </div>
        ))}
      </div>

      {error && <p className="font-mono text-sm font-bold" style={{ color: "var(--ember)" }}>{error}</p>}

      <div className="mt-8 grid sm:grid-cols-3 gap-4 font-mono text-sm opacity-80">
        <Rule n="01" text="pick which of two quantities is bigger" />
        <Rule n="02" text="wrong picks reset your streak to zero" />
        <Rule n="03" text="longest streak across 7 rounds wins" />
      </div>
    </div>
  );
}

function PlayerTile({ player, highlight, canKick, onKick }: { player: Player; highlight: boolean; canKick?: boolean; onKick?: (p: Player) => void }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      className={`relative group rounded-md border-2 border-[var(--ivory)]/30 p-4 flex items-center gap-3 ${highlight ? "bg-[var(--ember)]/20" : ""}`}
    >
      <span className="text-2xl">{player.avatar}</span>
      <div className="leading-tight min-w-0 flex-1">
        <div className="font-display font-bold tracking-tight truncate">{player.name}</div>
        {player.is_host && <div className="font-mono text-[10px] uppercase tracking-wider opacity-70">host</div>}
      </div>
      {canKick && onKick && (
        <button
          onClick={() => onKick(player)}
          aria-label={`kick ${player.name}`}
          className="absolute -top-2 -right-2 h-6 w-6 rounded-full border-2 border-[var(--ink)] bg-[var(--ivory)] text-[var(--ink)] font-mono text-xs font-bold opacity-0 group-hover:opacity-100 focus:opacity-100 hover:bg-[var(--ink)] hover:text-[var(--ivory)] transition-all"
        >
          x
        </button>
      )}
    </motion.div>
  );
}

function Rule({ n, text }: { n: string; text: string }) {
  return (
    <div className="flex gap-3 items-start">
      <span className="font-display font-bold text-2xl" style={{ color: "var(--ember)" }}>{n}</span>
      <p>{text}</p>
    </div>
  );
}
