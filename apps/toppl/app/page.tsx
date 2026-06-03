export default function Home() {
  return (
    <main className="min-h-dvh w-full px-6 sm:px-10 py-8 flex flex-col gap-10 relative z-10">
      <header className="flex justify-between items-start">
        <div>
          <h1 className="font-display font-black text-3xl sm:text-4xl tracking-tight">Toppl</h1>
          <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.18em] opacity-65">bigger or smaller</p>
        </div>
        <a
          href={process.env.NEXT_PUBLIC_PORTAL_URL || "https://doozy.fun"}
          className="font-mono text-[11px] uppercase tracking-[0.18em] opacity-70 underline underline-offset-4 decoration-2 hover:opacity-100"
        >
          ← doozy
        </a>
      </header>

      <section className="flex-1 flex items-center justify-center">
        <div className="max-w-2xl text-center space-y-8">
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] opacity-70">streak mode · solo</p>
          <h2
            className="font-serif italic font-black text-[clamp(2.5rem,6vw,4.5rem)] leading-[0.95] tracking-[-0.02em]"
          >
            Pick the bigger one. <br />
            <span style={{ color: "var(--ember)" }}>Don{`'`}t miss.</span>
          </h2>
          <p className="font-sans text-base sm:text-lg leading-snug opacity-85 max-w-[58ch] mx-auto">
            Two surprising quantities head to head. You pick which is bigger. Wrong picks knock you out.
            Longest streak wins. No signup.
          </p>
          <div className="pt-2">
            <a
              href="/play"
              className="inline-flex items-center gap-2 px-7 py-4 rounded-md border-2 border-[var(--ink)] bg-[var(--ivory)] text-[var(--ink)] font-display font-black text-xl tracking-tight shadow-[8px_8px_0_var(--ink)] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[4px_4px_0_var(--ink)] transition-all"
            >
              play solo →
            </a>
          </div>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] opacity-50">multiplayer coming soon</p>
        </div>
      </section>

      <footer className="text-xs font-mono opacity-50">a doozy game</footer>
    </main>
  );
}
