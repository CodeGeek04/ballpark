"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import type { Player, Room, Round as RoundT, Submission } from "@/lib/types";
import { PaperCard } from "@/components/PaperCard";
import { StampButton } from "@/components/StampButton";
import { ChipStamp } from "@/components/ChipStamp";

type Question = { id: string; prompt: string; unit: string | null; category: string | null; k: number };

export function Round({
  room,
  round,
  question,
  me,
  players,
  submissions,
  notifySync,
}: {
  room: Room;
  round: RoundT;
  question: Question;
  me: Player;
  players: Player[];
  submissions: Submission[];
  notifySync?: () => void;
}) {
  const deadline = useMemo(() => new Date(round.deadline_at).getTime(), [round.deadline_at]);
  const [now, setNow] = useState(Date.now());
  const [guess, setGuess] = useState("");
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const triggeredRevealRef = useRef(false);

  // Captain logic for teams: round-robin by join order × round index, both teams
  const captainsByTeam = useMemo(() => {
    if (room.mode !== "teams") return null;
    const result: Record<"A" | "B", string | null> = { A: null, B: null };
    for (const team of ["A", "B"] as const) {
      const mates = players
        .filter((p) => p.team === team)
        .sort((a, b) => a.joined_at.localeCompare(b.joined_at));
      if (mates.length) {
        const idx = (round.index - 1) % mates.length;
        result[team] = mates[idx]?.id ?? null;
      }
    }
    return result;
  }, [players, round.index, room.mode]);

  const myTeamCaptainId = room.mode === "teams" && me.team ? captainsByTeam?.[me.team] ?? null : null;
  const iAmCaptain = room.mode !== "teams" || myTeamCaptainId === me.id;
  const captainName = useMemo(
    () => players.find((p) => p.id === myTeamCaptainId)?.name ?? "",
    [players, myTeamCaptainId],
  );

  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(i);
  }, []);

  useEffect(() => {
    if (submissions.some((s) => s.player_id === me.id)) setSubmitted(true);
  }, [submissions, me.id]);

  const msLeft = Math.max(0, deadline - now);
  const pct = Math.max(0, Math.min(100, (msLeft / (room.round_seconds * 1000)) * 100));
  const secondsLeft = Math.ceil(msLeft / 1000);

  // Auto-reveal trigger: any client can call this. The API is idempotent —
  // if the round is already revealed, it returns the cached result.
  // We use a local ref only to dedupe concurrent fires from this same tab.
  function fireReveal() {
    if (triggeredRevealRef.current) return;
    if (round.revealed_at) return;
    triggeredRevealRef.current = true;
    fetch("/api/reveal-round", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ roundId: round.id }),
    })
      .then(() => notifySync?.())
      .catch(() => {
        triggeredRevealRef.current = false;
      });
  }

  // Timer-expiry trigger: any client fires once the deadline passes.
  useEffect(() => {
    if (msLeft > 0) return;
    fireReveal();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [msLeft]);

  // All-submitted trigger: any client whose locally-observed submission set
  // covers the eligible players fires reveal immediately.
  useEffect(() => {
    const eligible =
      room.mode === "teams"
        ? new Set([captainsByTeam?.A, captainsByTeam?.B].filter((x): x is string => !!x))
        : new Set(players.map((p) => p.id));
    if (!eligible.size) return;
    const submittedIds = new Set(submissions.map((s) => s.player_id));
    let allIn = true;
    for (const id of eligible) if (!submittedIds.has(id)) { allIn = false; break; }
    if (allIn) fireReveal();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submissions, players, captainsByTeam, room.mode]);

  async function submit() {
    const n = Number(guess);
    if (!isFinite(n) || n <= 0) {
      setError("enter a positive number");
      return;
    }
    // Optimistic UI: flip to locked the moment the user clicks. The user shouldn't
    // wait for a cross-region round-trip to see their own action reflected.
    setSubmitted(true);
    setError(null);

    // Optimistically check "all submitted" so reveal can fire without waiting
    // for the realtime echo of this submission.
    const justId = room.mode === "teams" ? myTeamCaptainId : me.id;
    const eligible =
      room.mode === "teams"
        ? new Set([captainsByTeam?.A, captainsByTeam?.B].filter((x): x is string => !!x))
        : new Set(players.map((p) => p.id));
    const known = new Set([...submissions.map((s) => s.player_id), justId].filter((x): x is string => !!x));
    let allIn = eligible.size > 0;
    for (const id of eligible) if (!known.has(id)) { allIn = false; break; }
    if (allIn) fireReveal();

    // Fire-and-handle the API call. On error, revert the UI.
    try {
      const res = await fetch("/api/submit-guess", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ roundId: round.id, playerId: me.id, guess: n }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "submit failed");
        setSubmitted(false);
        return;
      }
      notifySync?.();
    } catch (e) {
      setError("network error");
      setSubmitted(false);
    }
  }

  const submittedIds = new Set(submissions.map((s) => s.player_id));

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-5 font-mono text-xs">
        <span className="opacity-70">round {round.index} / {room.round_count}</span>
        <span className={`tabular-nums font-bold text-lg ${msLeft < 10000 ? "text-ember" : ""}`}>:{String(secondsLeft).padStart(2, "0")}</span>
      </div>

      <div className="relative h-3 border-2 border-ink rounded-full bg-paper overflow-hidden mb-6">
        <div
          className="absolute inset-y-0 left-0"
          style={{
            width: `${pct}%`,
            backgroundImage: "repeating-linear-gradient(45deg, #ff5b3a 0 8px, #ffb84d 8px 16px)",
            transition: "width 0.1s linear",
          }}
        />
      </div>

      <PaperCard>
        <div className="space-y-5">
          <div className="font-display font-bold text-[clamp(1.5rem,3.4vw,2.4rem)] leading-[1.1] tracking-[-0.02em]">
            {question.prompt}
          </div>
          {question.unit && (
            <p className="font-mono text-xs uppercase tracking-[0.18em] opacity-70">answer in {question.unit}</p>
          )}

          {!iAmCaptain && (
            <div className="rounded-card border-2 border-ink bg-mustard/40 p-4 font-mono text-sm">
              captain this round: <strong>{captainName}</strong>. they{`'`}re submitting for the team.
            </div>
          )}

          <div className="grid sm:grid-cols-[1fr_auto] gap-3 items-stretch">
            <input
              inputMode="decimal"
              autoFocus
              disabled={!iAmCaptain || submitted}
              value={guess}
              onChange={(e) => setGuess(e.target.value.replace(/[^0-9.eE+-]/g, ""))}
              onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
              placeholder="your guess"
              className="w-full bg-paper border-2 border-ink rounded-card px-5 py-4 font-mono text-3xl font-bold tnum focus:outline-none focus:shadow-stamp-sm disabled:opacity-50"
            />
            <StampButton onClick={submit} disabled={!iAmCaptain || busy || submitted || !guess} tone="ember" className="text-lg">
              {submitted ? "locked ✓" : busy ? "…" : "submit"}
            </StampButton>
          </div>
          {error && <p className="font-mono text-sm text-ember font-bold">{error}</p>}
        </div>
      </PaperCard>

      {room.mode !== "solo" && <div className="mt-6 flex flex-wrap gap-2">
        <span className="text-[11px] font-mono uppercase tracking-[0.12em] font-bold opacity-70 mr-2 self-center">locked in</span>
        <AnimatePresence>
          {players.map((p) => {
            const ok = submittedIds.has(p.id);
            return (
              <motion.div
                key={p.id}
                layout
                initial={{ opacity: 0.4 }}
                animate={{ opacity: ok ? 1 : 0.4, scale: ok ? 1 : 0.95 }}
                transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border-2 border-ink ${ok ? "bg-ember text-paper" : "bg-paper"}`}
              >
                <span>{p.avatar}</span>
                <span className="font-mono text-xs">{p.name}</span>
                {ok && <span className="font-bold">✓</span>}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>}
    </div>
  );
}
