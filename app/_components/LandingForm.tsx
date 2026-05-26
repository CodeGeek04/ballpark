"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { PaperCard } from "@/components/PaperCard";
import { StampButton } from "@/components/StampButton";
import { ChipStamp } from "@/components/ChipStamp";
import { AVATARS, loadIdentity, saveIdentity } from "@/lib/identity";
import { normalizeCode } from "@/lib/code";
import type { RoomMode } from "@/lib/types";

type Tab = "create" | "join";

export function LandingForm() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("create");
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState(AVATARS[0]);
  const [mode, setMode] = useState<RoomMode>("ffa");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const id = loadIdentity();
    if (id) {
      setName(id.name);
      setAvatar(id.avatar);
    }
  }, []);

  async function handleCreate() {
    setBusy(true);
    setError(null);
    try {
      saveIdentity({ name, avatar });
      const res = await fetch("/api/create-room", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mode, hostName: name, hostAvatar: avatar }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "failed");
      sessionStorage.setItem(`ballpark.player.${data.room.code}`, JSON.stringify(data.player));
      // Solo: skip the lobby — kick off round 1 before navigating so the player
      // lands directly on a question.
      if (mode === "solo") {
        await fetch("/api/start-round", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ roomId: data.room.id, playerId: data.player.id }),
        });
      }
      router.push(`/r/${data.room.code}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  async function handleJoin() {
    setBusy(true);
    setError(null);
    try {
      saveIdentity({ name, avatar });
      const norm = normalizeCode(code);
      const res = await fetch("/api/join-room", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code: norm, name, avatar }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "failed");
      sessionStorage.setItem(`ballpark.player.${data.room.code}`, JSON.stringify(data.player));
      router.push(`/r/${data.room.code}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  const canSubmit = name.trim().length >= 2 && (tab === "create" || normalizeCode(code).length === 4);

  return (
    <PaperCard className="w-full">
      <div className="flex items-center gap-2 mb-5">
        <TabPill active={tab === "create"} onClick={() => setTab("create")}>
          start a game
        </TabPill>
        <TabPill active={tab === "join"} onClick={() => setTab("join")}>
          join with code
        </TabPill>
      </div>

      <div className="space-y-5">
        <Field label="your name">
          <input
            value={name}
            onChange={(e) => setName(e.target.value.slice(0, 18))}
            placeholder="e.g. mango"
            className="w-full bg-paper border-2 border-ink rounded-card px-4 py-3 font-mono text-lg focus:outline-none focus:shadow-stamp-sm transition-shadow"
          />
        </Field>

        <Field label="your avatar">
          <div className="flex flex-wrap gap-2">
            {AVATARS.map((a) => (
              <button
                key={a}
                onClick={() => setAvatar(a)}
                aria-pressed={avatar === a}
                className={`h-10 w-10 rounded-full border-2 border-ink text-xl flex items-center justify-center transition-all duration-200 ease-out ${
                  avatar === a ? "bg-mustard shadow-stamp-sm -translate-x-[2px] -translate-y-[2px]" : "bg-paper hover:bg-paper"
                }`}
              >
                <span aria-hidden>{a}</span>
              </button>
            ))}
          </div>
        </Field>

        <AnimatePresence mode="wait">
          {tab === "create" ? (
            <motion.div key="create" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}>
              <Field label="game mode">
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      { id: "solo", label: "solo" },
                      { id: "ffa", label: "free-for-all" },
                      { id: "teams", label: "teams" },
                    ] as const
                  ).map((m) => (
                    <button
                      key={m.id}
                      onClick={() => setMode(m.id)}
                      aria-pressed={mode === m.id}
                      className={`rounded-card border-2 border-ink py-2.5 font-mono text-xs uppercase tracking-tight ${
                        mode === m.id ? "bg-ink text-paper shadow-stamp-sm -translate-x-[2px] -translate-y-[2px]" : "bg-paper"
                      } transition-all duration-150 ease-out`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </Field>
            </motion.div>
          ) : (
            <motion.div key="join" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.18 }}>
              <Field label="room code">
                <input
                  value={code}
                  onChange={(e) => setCode(normalizeCode(e.target.value))}
                  placeholder="ABCD"
                  maxLength={4}
                  className="w-full bg-paper border-2 border-ink rounded-card px-4 py-3 font-mono text-3xl font-bold uppercase tracking-[0.4em] focus:outline-none focus:shadow-stamp-sm"
                />
              </Field>
            </motion.div>
          )}
        </AnimatePresence>

        {error && <ChipStamp tone="ink">{error}</ChipStamp>}

        <StampButton
          onClick={tab === "create" ? handleCreate : handleJoin}
          disabled={!canSubmit || busy}
          className="w-full text-lg"
        >
          {busy
            ? "…"
            : tab === "join"
              ? "join →"
              : mode === "solo"
                ? "play →"
                : "create room →"}
        </StampButton>
      </div>
    </PaperCard>
  );
}

function TabPill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`relative px-3 py-1.5 rounded-full font-mono text-xs uppercase tracking-tight border-2 border-ink transition-all duration-150 ease-out ${
        active ? "bg-ember text-paper shadow-stamp-sm -translate-x-[2px] -translate-y-[2px]" : "bg-paper"
      }`}
    >
      {children}
    </button>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[11px] font-mono uppercase tracking-[0.12em] font-bold mb-2">{label}</span>
      {children}
    </label>
  );
}
