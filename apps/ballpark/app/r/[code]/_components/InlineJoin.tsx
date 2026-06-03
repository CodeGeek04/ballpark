"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { PaperCard } from "@/components/PaperCard";
import { StampButton } from "@/components/StampButton";
import { AVATARS, loadIdentity, saveIdentity } from "@/lib/identity";
import type { Player, Room } from "@/lib/types";

export function InlineJoin({
  room,
  onJoined,
}: {
  room: Room;
  onJoined: (player: Player) => void;
}) {
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState(AVATARS[0]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const id = loadIdentity();
    if (id) {
      setName(id.name);
      setAvatar(id.avatar);
    }
  }, []);

  async function join() {
    if (name.trim().length < 2) {
      setError("name must be at least 2 characters");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      saveIdentity({ name, avatar });
      const res = await fetch("/api/join-room", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code: room.code, name, avatar }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "join failed");
      sessionStorage.setItem(`ballpark.player.${room.code}`, JSON.stringify(data.player));
      onJoined(data.player as Player);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  const canSubmit = name.trim().length >= 2 && !busy;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      className="max-w-md mx-auto"
    >
      <PaperCard>
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] font-bold text-ember mb-1">join room</p>
        <h2 className="font-display font-bold text-3xl tracking-tight">
          room <span className="bg-mustard px-1.5 rounded-md">{room.code}</span>
        </h2>
        <p className="font-mono text-sm opacity-70 mt-2">
          pick a name and avatar to join the {room.mode === "ffa" ? "free-for-all" : room.mode}.
        </p>

        <div className="space-y-4 mt-5">
          <label className="block">
            <span className="block text-[11px] font-mono uppercase tracking-[0.12em] font-bold mb-2">your name</span>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value.slice(0, 18))}
              onKeyDown={(e) => { if (e.key === "Enter") join(); }}
              placeholder="e.g. mango"
              className="w-full bg-paper border-2 border-ink rounded-card px-4 py-3 font-mono text-lg focus:outline-none focus:shadow-stamp-sm"
            />
          </label>

          <label className="block">
            <span className="block text-[11px] font-mono uppercase tracking-[0.12em] font-bold mb-2">your avatar</span>
            <div className="flex flex-wrap gap-2">
              {AVATARS.map((a) => (
                <button
                  key={a}
                  onClick={() => setAvatar(a)}
                  aria-pressed={avatar === a}
                  className={`h-10 w-10 rounded-full border-2 border-ink text-xl flex items-center justify-center transition-all duration-200 ease-out ${
                    avatar === a ? "bg-mustard shadow-stamp-sm -translate-x-[2px] -translate-y-[2px]" : "bg-paper"
                  }`}
                >
                  <span aria-hidden>{a}</span>
                </button>
              ))}
            </div>
          </label>

          {error && <p className="font-mono text-sm text-ember font-bold">{error}</p>}

          <StampButton onClick={join} disabled={!canSubmit} tone="ember" className="w-full text-lg">
            {busy ? "joining…" : "join room →"}
          </StampButton>
        </div>
      </PaperCard>
    </motion.div>
  );
}
