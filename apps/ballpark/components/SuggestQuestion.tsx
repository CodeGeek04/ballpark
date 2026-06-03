"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { PaperCard } from "@/components/PaperCard";
import { StampButton } from "@/components/StampButton";

export function SuggestQuestionButton({ roomCode }: { roomCode?: string }) {
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
        aria-label="Suggest a question"
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border-2 border-ink bg-mustard text-ink font-mono text-[11px] uppercase tracking-[0.08em] font-bold transition-all duration-150 ease-out hover:-translate-y-[1px] hover:shadow-stamp-sm"
      >
        <span className="text-[13px] leading-none">+</span>
        <span>suggest one</span>
      </button>

      <AnimatePresence>
        {open && <SuggestModal onClose={() => setOpen(false)} roomCode={roomCode} />}
      </AnimatePresence>
    </>
  );
}

function SuggestModal({ onClose, roomCode }: { onClose: () => void; roomCode?: string }) {
  const [prompt, setPrompt] = useState("");
  const [knowsAnswer, setKnowsAnswer] = useState(false);
  const [answer, setAnswer] = useState("");
  const [unit, setUnit] = useState("");
  const [notes, setNotes] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/suggest-question", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          prompt,
          suggestedAnswer: knowsAnswer && answer ? Number(answer) : null,
          suggestedUnit: knowsAnswer && unit ? unit : null,
          notes: notes || null,
          submitterName: name || null,
          submitterRoomCode: roomCode || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "failed");
      setDone(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
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
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] font-bold text-ember">crowdsource</p>
            <h2 className="font-display font-bold text-3xl tracking-tight mt-1">suggest a question</h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="font-mono text-xl leading-none w-8 h-8 rounded-full border-2 border-ink flex items-center justify-center hover:bg-ink hover:text-paper transition-colors"
          >
            x
          </button>
        </div>

        {done ? (
          <div className="text-center py-6">
            <div className="text-5xl mb-3">✓</div>
            <h3 className="font-display font-bold text-2xl tracking-tight">got it, thanks!</h3>
            <p className="font-mono text-sm opacity-70 mt-2 leading-snug">
              we{`'`}ll look at it, find or estimate an answer, and add it to the pool.
            </p>
            <div className="mt-6 flex justify-center gap-3">
              <button
                onClick={() => {
                  setPrompt("");
                  setAnswer("");
                  setUnit("");
                  setNotes("");
                  setKnowsAnswer(false);
                  setDone(false);
                }}
                className="font-mono text-sm underline underline-offset-4"
              >
                suggest another
              </button>
              <StampButton onClick={onClose} tone="ember">done →</StampButton>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <label className="block">
              <span className="block text-[11px] font-mono uppercase tracking-[0.12em] font-bold mb-2">
                your question
              </span>
              <textarea
                autoFocus
                value={prompt}
                onChange={(e) => setPrompt(e.target.value.slice(0, 300))}
                rows={3}
                placeholder="how many auto rickshaws are running in mumbai at 6pm on a wednesday?"
                className="w-full bg-paper border-2 border-ink rounded-card px-4 py-3 font-mono text-base leading-snug focus:outline-none focus:shadow-stamp-sm resize-none"
              />
              <div className="mt-1 font-mono text-[10px] opacity-50 tabular-nums">{prompt.length}/300</div>
            </label>

            <div className="rounded-card border-2 border-ink p-3 bg-mustard/20">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setKnowsAnswer(!knowsAnswer)}
                  aria-pressed={knowsAnswer}
                  className={`h-5 w-5 rounded-md border-2 border-ink flex items-center justify-center transition-colors ${
                    knowsAnswer ? "bg-ink text-paper" : "bg-paper"
                  }`}
                >
                  {knowsAnswer && <span className="font-bold text-xs leading-none">✓</span>}
                </button>
                <span className="font-mono text-sm">i know roughly what the answer is</span>
              </div>
              {knowsAnswer && (
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <input
                    type="number"
                    value={answer}
                    onChange={(e) => setAnswer(e.target.value)}
                    placeholder="answer"
                    className="bg-paper border-2 border-ink rounded-card px-3 py-2 font-mono tnum focus:outline-none focus:shadow-stamp-sm"
                  />
                  <input
                    value={unit}
                    onChange={(e) => setUnit(e.target.value.slice(0, 30))}
                    placeholder="unit (liters, etc)"
                    className="bg-paper border-2 border-ink rounded-card px-3 py-2 font-mono focus:outline-none focus:shadow-stamp-sm"
                  />
                </div>
              )}
              {!knowsAnswer && (
                <p className="font-mono text-[11px] opacity-60 mt-2 leading-snug">
                  no problem — we{`'`}ll find or estimate it.
                </p>
              )}
            </div>

            <label className="block">
              <span className="block text-[11px] font-mono uppercase tracking-[0.12em] font-bold mb-2 opacity-70">
                anything else? (optional)
              </span>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value.slice(0, 400))}
                rows={2}
                placeholder="source, context, why you thought of it…"
                className="w-full bg-paper border-2 border-ink rounded-card px-4 py-3 font-mono text-sm focus:outline-none focus:shadow-stamp-sm resize-none"
              />
            </label>

            <label className="block">
              <span className="block text-[11px] font-mono uppercase tracking-[0.12em] font-bold mb-2 opacity-70">
                your name (optional)
              </span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value.slice(0, 30))}
                placeholder="so we can credit you"
                className="w-full bg-paper border-2 border-ink rounded-card px-4 py-3 font-mono focus:outline-none focus:shadow-stamp-sm"
              />
            </label>

            {error && <p className="font-mono text-sm text-ember font-bold">{error}</p>}

            <StampButton
              onClick={submit}
              disabled={busy || prompt.trim().length < 15}
              tone="ember"
              className="w-full text-lg"
            >
              {busy ? "sending…" : "send it in →"}
            </StampButton>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
