import { LandingForm } from "./_components/LandingForm";

export default function Home() {
  return (
    <main className="min-h-dvh w-full px-6 sm:px-10 py-8 relative z-10">
      <header className="flex justify-between items-start mb-6">
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

      <section className="grid lg:grid-cols-[1.1fr_1fr] gap-8 lg:gap-12 items-start max-w-6xl mx-auto pt-4">
        <div className="space-y-6">
          <p className="font-mono text-[11px] uppercase tracking-[0.22em] opacity-70">streak game · solo or with friends</p>
          <h2
            className="font-serif italic font-black text-[clamp(2.2rem,5.5vw,4rem)] leading-[0.95] tracking-[-0.02em]"
          >
            Pick the bigger one. <br />
            <span style={{ color: "var(--ember)" }}>Don{`'`}t miss.</span>
          </h2>
          <p className="font-sans text-base sm:text-lg leading-snug opacity-85 max-w-[58ch]">
            Two surprising quantities head to head. You pick which is bigger. Wrong picks reset your streak.
            Solo runs survival mode. Friends battle across 7 rounds, longest streak wins.
          </p>
          <ul className="font-mono text-sm space-y-1 opacity-75">
            <li>→ McDonald{`'`}s restaurants worldwide?</li>
            <li>→ Starbucks locations worldwide?</li>
            <li>→ Coffee cups Italy drinks per day?</li>
            <li>→ Cups of chai India drinks per day?</li>
          </ul>
        </div>

        <div className="flex justify-center lg:justify-end">
          <LandingForm />
        </div>
      </section>

      <footer className="text-xs font-mono opacity-50 mt-16 max-w-6xl mx-auto">a doozy game</footer>
    </main>
  );
}
