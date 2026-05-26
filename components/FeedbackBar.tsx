"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { PaperCard } from "@/components/PaperCard";
import { StampButton } from "@/components/StampButton";

export function FeedbackBar() {
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          content,
          name: name || null,
          context: typeof window !== "undefined" ? window.location.pathname : null,
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
    <section className="px-6 sm:px-10 pt-6 pb-12 max-w-3xl mx-auto">
      <AnimatePresence mode="wait">
        {!open ? (
          <motion.div
            key="trigger"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.2 }}
            className="flex items-center justify-between gap-3 rounded-card border-2 border-dashed border-ink/30 px-5 py-4"
          >
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] font-bold text-ember">feedback</p>
              <p className="font-mono text-sm mt-0.5 opacity-80">found a bug, hated a question, or have an idea? tell us.</p>
            </div>
            <StampButton onClick={() => setOpen(true)} tone="ink">say something →</StampButton>
          </motion.div>
        ) : (
          <motion.div
            key="form"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <PaperCard>
              {done ? (
                <div className="text-center py-4">
                  <div className="text-4xl mb-2">thanks</div>
                  <p className="font-mono text-sm opacity-70">we read every one.</p>
                  <button
                    onClick={() => { setOpen(false); setDone(false); setContent(""); setName(""); }}
                    className="mt-4 font-mono underline underline-offset-4"
                  >
                    close
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-mono text-[11px] uppercase tracking-[0.18em] font-bold text-ember">feedback</p>
                      <h3 className="font-display font-bold text-2xl tracking-tight">what{`'`}s on your mind?</h3>
                    </div>
                    <button
                      onClick={() => setOpen(false)}
                      aria-label="Close"
                      className="font-mono text-xl leading-none w-8 h-8 rounded-full border-2 border-ink flex items-center justify-center hover:bg-ink hover:text-paper"
                    >
                      x
                    </button>
                  </div>

                  <textarea
                    autoFocus
                    value={content}
                    onChange={(e) => setContent(e.target.value.slice(0, 2000))}
                    rows={4}
                    placeholder="bug report, idea, complaint, compliment — anything"
                    className="w-full bg-paper border-2 border-ink rounded-card px-4 py-3 font-mono text-sm leading-snug focus:outline-none focus:shadow-stamp-sm resize-none"
                  />
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value.slice(0, 30))}
                    placeholder="your name (optional)"
                    className="w-full bg-paper border-2 border-ink rounded-card px-4 py-2 font-mono text-sm focus:outline-none focus:shadow-stamp-sm"
                  />
                  {error && <p className="font-mono text-sm text-ember font-bold">{error}</p>}
                  <div className="flex justify-end">
                    <StampButton
                      onClick={submit}
                      disabled={busy || content.trim().length < 5}
                      tone="ember"
                    >
                      {busy ? "sending…" : "send →"}
                    </StampButton>
                  </div>
                </div>
              )}
            </PaperCard>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
