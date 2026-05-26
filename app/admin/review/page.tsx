"use client";

import { useEffect, useState } from "react";
import { Logo } from "@/components/Logo";
import { PaperCard } from "@/components/PaperCard";
import { StampButton } from "@/components/StampButton";
import { ChipStamp } from "@/components/ChipStamp";

type Pending = {
  id: string;
  prompt: string;
  answer: number;
  unit: string | null;
  category: string | null;
  source_url: string | null;
  cot_hint: string | null;
  model: string | null;
  created_at: string;
};

const CATEGORIES = [
  "Human Behavior",
  "Time & History",
  "Geography",
  "Biology",
  "Industry & Trade",
  "Money",
  "Weird Science",
  "Pop Culture",
  "Sports",
  "Food & Drink",
  "Travel & Transport",
  "Technology",
];

export default function ReviewPage() {
  const [pass, setPass] = useState("");
  const [authed, setAuthed] = useState(false);
  const [queue, setQueue] = useState<Pending[]>([]);
  const [idx, setIdx] = useState(0);
  const [draft, setDraft] = useState<Pending | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<{ liveCount: number; pendingCount: number } | null>(null);

  useEffect(() => {
    const saved = sessionStorage.getItem("ballpark.admin.pass");
    if (saved) {
      setPass(saved);
      setAuthed(true);
    }
  }, []);

  useEffect(() => {
    if (authed) refresh();
  }, [authed]);

  useEffect(() => {
    setDraft(queue[idx] ? { ...queue[idx] } : null);
  }, [queue, idx]);

  async function refresh() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/list", { headers: { "x-admin-pass": pass } });
      if (res.status === 401) {
        setAuthed(false);
        sessionStorage.removeItem("ballpark.admin.pass");
        setError("wrong password");
        return;
      }
      const data = await res.json();
      setQueue(data.pending ?? []);
      setIdx(0);
      setStats({ liveCount: data.liveCount ?? 0, pendingCount: data.pendingCount ?? 0 });
    } finally {
      setBusy(false);
    }
  }

  function authenticate(e: React.FormEvent) {
    e.preventDefault();
    sessionStorage.setItem("ballpark.admin.pass", pass);
    setAuthed(true);
  }

  async function approve() {
    if (!draft) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/approve", {
        method: "POST",
        headers: { "content-type": "application/json", "x-admin-pass": pass },
        body: JSON.stringify(draft),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "failed");
      next();
      setStats((s) => (s ? { liveCount: s.liveCount + 1, pendingCount: s.pendingCount - 1 } : s));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function reject() {
    if (!draft) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/reject", {
        method: "POST",
        headers: { "content-type": "application/json", "x-admin-pass": pass },
        body: JSON.stringify({ id: draft.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "failed");
      next();
      setStats((s) => (s ? { ...s, pendingCount: s.pendingCount - 1 } : s));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function next() {
    if (idx + 1 < queue.length) setIdx(idx + 1);
    else refresh();
  }

  function skip() {
    next();
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!authed || !draft || busy) return;
      if (e.target && (e.target as HTMLElement).tagName === "INPUT") return;
      if (e.target && (e.target as HTMLElement).tagName === "TEXTAREA") return;
      if (e.key === "a" || e.key === "A") approve();
      else if (e.key === "r" || e.key === "R") reject();
      else if (e.key === "s" || e.key === "S") skip();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (!authed) {
    return (
      <main className="min-h-dvh flex items-center justify-center p-6">
        <div className="w-full max-w-sm space-y-6">
          <Logo />
          <PaperCard>
            <form onSubmit={authenticate} className="space-y-4">
              <h2 className="font-display font-bold text-2xl">admin review</h2>
              <input
                type="password"
                autoFocus
                value={pass}
                onChange={(e) => setPass(e.target.value)}
                placeholder="password"
                className="w-full bg-paper border-2 border-ink rounded-card px-4 py-3 font-mono focus:outline-none focus:shadow-stamp-sm"
              />
              {error && <p className="font-mono text-sm text-ember font-bold">{error}</p>}
              <StampButton type="submit" tone="ember" className="w-full">enter →</StampButton>
            </form>
          </PaperCard>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-dvh px-6 sm:px-10 py-8 max-w-4xl mx-auto">
      <header className="flex items-center justify-between mb-8">
        <Logo size={32} />
        <div className="flex items-center gap-3 font-mono text-xs">
          {stats && (
            <>
              <span><span className="opacity-60">approved</span> <strong className="tnum">{stats.liveCount}</strong></span>
              <span className="opacity-30">·</span>
              <span><span className="opacity-60">pending</span> <strong className="tnum">{stats.pendingCount}</strong></span>
            </>
          )}
          <button onClick={refresh} className="underline hover:text-ember" disabled={busy}>refresh</button>
        </div>
      </header>

      {queue.length === 0 ? (
        <PaperCard>
          <div className="py-12 text-center">
            <div className="font-display font-bold text-3xl">inbox zero</div>
            <p className="font-mono text-sm opacity-70 mt-2">queue is empty. generate more with <code>pnpm questions:gen</code>.</p>
          </div>
        </PaperCard>
      ) : !draft ? null : (
        <div className="space-y-5">
          <div className="flex items-center justify-between font-mono text-xs">
            <span><span className="opacity-60">card</span> <strong className="tnum">{idx + 1}</strong> / {queue.length}</span>
            <span className="opacity-60">a · approve   r · reject   s · skip</span>
          </div>

          <PaperCard>
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={draft.category ?? ""}
                  onChange={(e) => setDraft({ ...draft, category: e.target.value })}
                  className="bg-paper border-2 border-ink rounded-full px-3 py-1 font-mono text-xs uppercase tracking-wider"
                >
                  {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                </select>
                {draft.model && <ChipStamp tone="ink" rotate={1}>{draft.model}</ChipStamp>}
              </div>

              <textarea
                value={draft.prompt}
                onChange={(e) => setDraft({ ...draft, prompt: e.target.value })}
                rows={2}
                className="w-full bg-paper border-2 border-ink rounded-card px-4 py-3 font-display font-bold text-2xl leading-tight tracking-tight focus:outline-none focus:shadow-stamp-sm resize-none"
              />

              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="block text-[11px] font-mono uppercase tracking-[0.12em] font-bold mb-1 opacity-70">answer</span>
                  <input
                    type="number"
                    value={draft.answer}
                    onChange={(e) => setDraft({ ...draft, answer: Number(e.target.value) })}
                    className="w-full bg-paper border-2 border-ink rounded-card px-4 py-3 font-mono text-xl font-bold tnum focus:outline-none focus:shadow-stamp-sm"
                  />
                </label>
                <label className="block">
                  <span className="block text-[11px] font-mono uppercase tracking-[0.12em] font-bold mb-1 opacity-70">unit</span>
                  <input
                    value={draft.unit ?? ""}
                    onChange={(e) => setDraft({ ...draft, unit: e.target.value })}
                    className="w-full bg-paper border-2 border-ink rounded-card px-4 py-3 font-mono focus:outline-none focus:shadow-stamp-sm"
                  />
                </label>
              </div>

              <label className="block">
                <span className="block text-[11px] font-mono uppercase tracking-[0.12em] font-bold mb-1 opacity-70">chain of thought hint</span>
                <textarea
                  value={draft.cot_hint ?? ""}
                  onChange={(e) => setDraft({ ...draft, cot_hint: e.target.value })}
                  rows={3}
                  className="w-full bg-paper border-2 border-ink rounded-card px-4 py-3 font-mono text-sm leading-snug focus:outline-none focus:shadow-stamp-sm resize-none"
                />
              </label>

              <label className="block">
                <span className="block text-[11px] font-mono uppercase tracking-[0.12em] font-bold mb-1 opacity-70">source url (optional)</span>
                <input
                  value={draft.source_url ?? ""}
                  onChange={(e) => setDraft({ ...draft, source_url: e.target.value })}
                  className="w-full bg-paper border-2 border-ink rounded-card px-4 py-3 font-mono text-sm focus:outline-none focus:shadow-stamp-sm"
                />
              </label>
            </div>
          </PaperCard>

          {error && <p className="font-mono text-sm text-ember font-bold">{error}</p>}

          <div className="flex gap-3 justify-end">
            <StampButton onClick={reject} disabled={busy} tone="ink">reject (r)</StampButton>
            <StampButton onClick={skip} disabled={busy} tone="paper">skip (s)</StampButton>
            <StampButton onClick={approve} disabled={busy} tone="ember" className="text-lg">approve (a) →</StampButton>
          </div>
        </div>
      )}
    </main>
  );
}
