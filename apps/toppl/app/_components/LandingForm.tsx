"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { AVATARS, loadIdentity, saveIdentity } from "@/lib/identity";
import { normalizeCode } from "@/lib/code";
import type { RoomMode } from "@/lib/types";

type Tab = "play" | "join";

export function LandingForm() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("play");
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState(AVATARS[0]);
  const [mode, setMode] = useState<RoomMode>("solo");
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

  async function handlePlay() {
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
      sessionStorage.setItem(`toppl.player.${data.room.code}`, JSON.stringify(data.player));
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
      sessionStorage.setItem(`toppl.player.${data.room.code}`, JSON.stringify(data.player));
      router.push(`/r/${data.room.code}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }

  const canSubmit = name.trim().length >= 2 && (tab === "play" || normalizeCode(code).length === 4);

  return (
    <div className="w-full max-w-md rounded-md p-6 sm:p-7" style={{ background: "var(--ivory)", color: "var(--ink)", boxShadow: "inset 0 0 0 2px var(--ink), inset 0 0 0 4px var(--ivory), inset 0 0 0 5px var(--ink), 8px 10px 22px rgba(0,0,0,0.4)" }}>
      <div className="flex items-center gap-2 mb-5">
        <Tab active={tab === "play"} onClick={() => setTab("play")}>play</Tab>
        <Tab active={tab === "join"} onClick={() => setTab("join")}>join</Tab>
      </div>

      <div className="space-y-4">
        <Field label="your name">
          <input
            value={name}
            onChange={(e) => setName(e.target.value.slice(0, 18))}
            placeholder="e.g. mango"
            className="w-full bg-white border-2 border-[var(--ink)] rounded-md px-4 py-3 font-mono text-lg focus:outline-none"
          />
        </Field>

        <Field label="your avatar">
          <div className="flex flex-wrap gap-2">
            {AVATARS.map((a) => (
              <button
                key={a}
                onClick={() => setAvatar(a)}
                aria-pressed={avatar === a}
                className={`h-10 w-10 rounded-full border-2 border-[var(--ink)] text-xl flex items-center justify-center transition-all ${
                  avatar === a ? "bg-[var(--ember)] -translate-x-[2px] -translate-y-[2px] shadow-[3px_3px_0_var(--ink)]" : "bg-white"
                }`}
              >
                <span aria-hidden>{a}</span>
              </button>
            ))}
          </div>
        </Field>

        <AnimatePresence mode="wait">
          {tab === "play" ? (
            <motion.div key="play" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.18 }}>
              <Field label="mode">
                <div className="grid grid-cols-2 gap-2">
                  {(
                    [
                      { id: "solo", label: "solo · survival" },
                      { id: "multi", label: "friends · 7 rounds" },
                    ] as const
                  ).map((m) => (
                    <button
                      key={m.id}
                      onClick={() => setMode(m.id)}
                      aria-pressed={mode === m.id}
                      className={`rounded-md border-2 border-[var(--ink)] py-3 px-2 font-mono text-xs uppercase tracking-tight ${
                        mode === m.id ? "bg-[var(--ink)] text-[var(--ivory)] -translate-x-[2px] -translate-y-[2px] shadow-[3px_3px_0_var(--ink)]" : "bg-white"
                      } transition-all`}
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
                  className="w-full bg-white border-2 border-[var(--ink)] rounded-md px-4 py-3 font-mono text-3xl font-bold uppercase tracking-[0.4em] focus:outline-none"
                />
              </Field>
            </motion.div>
          )}
        </AnimatePresence>

        {error && <p className="font-mono text-sm font-bold" style={{ color: "var(--ember)" }}>{error}</p>}

        <button
          onClick={tab === "play" ? handlePlay : handleJoin}
          disabled={!canSubmit || busy}
          className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-md border-2 border-[var(--ink)] font-display font-black text-lg tracking-tight shadow-[6px_6px_0_var(--ink)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0_var(--ink)] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ background: "var(--ember)", color: "var(--ivory)" }}
        >
          {busy ? "…" : tab === "join" ? "join →" : mode === "solo" ? "play solo →" : "create room →"}
        </button>
      </div>
    </div>
  );
}

function Tab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`relative px-3 py-1.5 rounded-full font-mono text-xs uppercase tracking-tight border-2 border-[var(--ink)] transition-all ${
        active ? "bg-[var(--ember)] text-[var(--ivory)] -translate-x-[2px] -translate-y-[2px] shadow-[3px_3px_0_var(--ink)]" : "bg-white"
      }`}
    >
      {children}
    </button>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[11px] font-mono uppercase tracking-[0.14em] font-bold mb-2 opacity-80">{label}</span>
      {children}
    </label>
  );
}
