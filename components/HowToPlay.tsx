"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";

export function HowToPlayButton({ tone = "ink" }: { tone?: "ink" | "paper" }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="How to play"
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border-2 border-ink font-mono text-[11px] uppercase tracking-[0.08em] font-bold transition-all duration-150 ease-out hover:-translate-y-[1px] hover:shadow-stamp-sm ${tone === "ink" ? "bg-ink text-paper" : "bg-paper text-ink"}`}
      >
        <span className="text-[13px] leading-none">?</span>
        <span>how to play</span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            onClick={() => setOpen(false)}
          >
            <div className="absolute inset-0 bg-ink/40" aria-hidden />
            <motion.div
              initial={{ opacity: 0, y: 12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              className="relative max-w-lg w-full bg-paper border-2 border-ink rounded-card shadow-stamp p-7 max-h-[90vh] overflow-y-auto"
              role="dialog"
              aria-modal="true"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between mb-5">
                <div>
                  <p className="font-mono text-[11px] uppercase tracking-[0.18em] font-bold text-ember">the rules</p>
                  <h2 className="font-display font-bold text-3xl tracking-tight mt-1">how to play</h2>
                </div>
                <button
                  onClick={() => setOpen(false)}
                  aria-label="Close"
                  className="font-mono text-xl leading-none w-8 h-8 rounded-full border-2 border-ink flex items-center justify-center hover:bg-ink hover:text-paper transition-colors"
                >
                  x
                </button>
              </div>

              <ol className="space-y-4">
                <Step n="01" title="get a weird question">
                  Every round, you see a strange numerical question. Stuff like
                  {" "}<em className="not-italic font-bold">how many liters of jet fuel does Taylor Swift burn in a week</em>{" "}
                  or <em className="not-italic font-bold">how many subway swipes does the average New Yorker tap in a month</em>.
                </Step>
                <Step n="02" title="estimate, calculate, lock in">
                  You get 60 seconds. Calculators are fair game. Break it down: rough population, rough rate, rough scale.
                  Submit a single positive number.
                </Step>
                <Step n="03" title="score by closeness">
                  Closer guess, more points. Up to <span className="font-mono font-bold tnum">1000</span> for a perfect answer.
                  Order-of-magnitude misses still score partial credit — being 10x off gets you about a third of the points.
                  100x off zeroes you out.
                </Step>
              </ol>

              <div className="mt-6 border-2 border-ink rounded-card p-4 bg-mustard/30">
                <p className="font-mono text-[11px] uppercase tracking-[0.18em] font-bold opacity-70 mb-3">scoring at a glance</p>
                <ScoreRow off="exact" pts={1000} />
                <ScoreRow off="2x off" pts={800} />
                <ScoreRow off="5x off" pts={533} />
                <ScoreRow off="10x off" pts={333} />
                <ScoreRow off="30x off" pts={56} />
                <ScoreRow off="100x off" pts={0} />
                <p className="font-mono text-[11px] opacity-60 mt-3 leading-snug">
                  Scoring uses a log scale: <span className="tnum">1000 * (1 − |log10(guess / answer)| / 1.5)</span>, floored at 0.
                </p>
              </div>

              <div className="mt-6 grid sm:grid-cols-3 gap-3 font-mono text-xs">
                <Mode title="solo">play alone, 5 rounds, no lobby</Mode>
                <Mode title="free-for-all">2 to 8 players race</Mode>
                <Mode title="teams">2 teams, captain rotates each round</Mode>
              </div>

              <p className="mt-6 font-mono text-xs opacity-60 leading-snug">
                Tip: there is no "right" way to estimate. The point is to think bigger and smaller than you naturally would, then commit to a number.
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function Step({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-4">
      <span className="font-display font-bold text-2xl text-ember leading-none flex-shrink-0 mt-1 tnum">{n}</span>
      <div>
        <h3 className="font-display font-bold text-xl tracking-tight">{title}</h3>
        <p className="font-mono text-sm leading-snug mt-1">{children}</p>
      </div>
    </li>
  );
}

function ScoreRow({ off, pts }: { off: string; pts: number }) {
  const pct = pts / 10; // 1000 max -> 100%
  return (
    <div className="flex items-center gap-3 py-1">
      <span className="font-mono text-xs w-20 tnum">{off}</span>
      <div className="flex-1 h-2 bg-paper border-2 border-ink rounded-full overflow-hidden">
        <div className="h-full bg-ember" style={{ width: `${pct}%` }} />
      </div>
      <span className="font-mono text-xs w-10 text-right tnum font-bold">{pts}</span>
    </div>
  );
}

function Mode({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-card border-2 border-ink p-3 bg-paper">
      <p className="font-display font-bold text-sm">{title}</p>
      <p className="opacity-70 mt-1">{children}</p>
    </div>
  );
}

