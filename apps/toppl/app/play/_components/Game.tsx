"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { pickPair } from "@/lib/pairs";
import type { Item } from "@/lib/items";
import { Pair } from "./Pair";
import { GameOver } from "./GameOver";

const BEST_KEY = "toppl.best.v1";

type State =
  | { phase: "playing"; pair: [Item, Item]; streak: number; seen: Set<string> }
  | { phase: "reveal"; pair: [Item, Item]; pickedId: string; correctId: string; streak: number; seen: Set<string> }
  | { phase: "gameover"; streak: number; finalPair?: [Item, Item]; pickedId?: string; correctId?: string };

function newRound(seen: Set<string>): [Item, Item] | null {
  return pickPair(seen);
}

export function Game() {
  const initialSeen = useMemo(() => new Set<string>(), []);
  const initialPair = useMemo(() => newRound(initialSeen), [initialSeen]);
  const [state, setState] = useState<State>(() =>
    initialPair
      ? { phase: "playing", pair: initialPair, streak: 0, seen: new Set([initialPair[0].id, initialPair[1].id]) }
      : { phase: "gameover", streak: 0 },
  );
  const [best, setBest] = useState(0);

  useEffect(() => {
    const v = Number(localStorage.getItem(BEST_KEY) ?? 0);
    if (isFinite(v) && v > 0) setBest(v);
  }, []);

  function handlePick(itemId: string) {
    if (state.phase !== "playing") return;
    const [a, b] = state.pair;
    const correctId = a.value >= b.value ? a.id : b.id;
    setState({ phase: "reveal", pair: state.pair, pickedId: itemId, correctId, streak: state.streak, seen: state.seen });
  }

  function handleNext() {
    if (state.phase !== "reveal") return;
    const wasCorrect = state.pickedId === state.correctId;
    if (!wasCorrect) {
      // game over
      const finalStreak = state.streak;
      if (finalStreak > best) {
        localStorage.setItem(BEST_KEY, String(finalStreak));
        setBest(finalStreak);
      }
      setState({
        phase: "gameover",
        streak: finalStreak,
        finalPair: state.pair,
        pickedId: state.pickedId,
        correctId: state.correctId,
      });
      return;
    }
    const nextSeen = new Set(state.seen);
    const next = pickPair(nextSeen);
    if (!next) {
      // ran out of items — treat as a clean finish
      const finalStreak = state.streak + 1;
      if (finalStreak > best) {
        localStorage.setItem(BEST_KEY, String(finalStreak));
        setBest(finalStreak);
      }
      setState({ phase: "gameover", streak: finalStreak });
      return;
    }
    nextSeen.add(next[0].id);
    nextSeen.add(next[1].id);
    setState({ phase: "playing", pair: next, streak: state.streak + 1, seen: nextSeen });
  }

  function handleRestart() {
    const seen = new Set<string>();
    const pair = pickPair(seen);
    if (!pair) {
      setState({ phase: "gameover", streak: 0 });
      return;
    }
    seen.add(pair[0].id);
    seen.add(pair[1].id);
    setState({ phase: "playing", pair, streak: 0, seen });
  }

  return (
    <div className="max-w-5xl mx-auto">
      <header className="flex items-center justify-between mb-6 font-mono text-[11px] tracking-[0.2em] uppercase">
        <a href={process.env.NEXT_PUBLIC_PORTAL_URL || "/"} className="opacity-60 hover:opacity-100">
          ← doozy
        </a>
        <div className="flex items-center gap-5">
          <span>
            <span className="opacity-50">streak</span>{" "}
            <span className="font-display font-black text-base text-[oklch(0.95_0.12_80)] tnum">
              {state.phase === "gameover" ? 0 : state.streak}
            </span>
          </span>
          <span>
            <span className="opacity-50">best</span>{" "}
            <span className="font-display font-black text-base tnum">{best}</span>
          </span>
        </div>
      </header>

      <AnimatePresence mode="wait">
        {state.phase === "playing" && (
          <motion.div key="playing" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}>
            <Pair a={state.pair[0]} b={state.pair[1]} onPick={handlePick} state="playing" pickedId={null} correctId={null} streak={state.streak} />
          </motion.div>
        )}

        {state.phase === "reveal" && (
          <motion.div key="reveal" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}>
            <Pair
              a={state.pair[0]}
              b={state.pair[1]}
              onPick={() => {}}
              state="reveal"
              pickedId={state.pickedId}
              correctId={state.correctId}
              streak={state.streak}
              onNext={handleNext}
            />
          </motion.div>
        )}

        {state.phase === "gameover" && (
          <motion.div key="gameover" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}>
            <GameOver streak={state.streak} best={best} finalPair={state.finalPair} pickedId={state.pickedId} correctId={state.correctId} onRestart={handleRestart} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
