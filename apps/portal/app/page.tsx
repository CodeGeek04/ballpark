import { Shelf } from "./_components/Shelf";

export default function Home() {
  return (
    <main className="min-h-dvh w-full px-6 sm:px-10 py-8 flex flex-col gap-8">
      <header className="flex justify-between items-start">
        <div>
          <h1 className="font-display font-black text-3xl sm:text-4xl tracking-tight text-[oklch(0.94_0.04_80)]">
            Doozy
          </h1>
          <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.18em] opacity-65 text-[oklch(0.88_0.03_80)]">
            four ways to guess
          </p>
        </div>
        <div className="text-right font-mono">
          <p className="text-[10px] uppercase tracking-[0.18em] opacity-60 text-[oklch(0.78_0.06_80)]">live now</p>
          <p className="font-display font-black text-2xl tnum text-[oklch(0.94_0.04_80)] mt-1 leading-none">2</p>
          <p className="text-[10px] opacity-70 mt-1 text-[oklch(0.78_0.06_80)]">games available</p>
        </div>
      </header>

      <section className="flex-1 flex items-end pb-10">
        <Shelf />
      </section>

      <footer className="text-xs font-mono opacity-50 text-[oklch(0.85_0.03_80)]">
        a small studio · made for the group chat
      </footer>
    </main>
  );
}
