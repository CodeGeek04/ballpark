import { Game } from "./_components/Game";

export const dynamic = "force-dynamic";

export default function PlayPage() {
  return (
    <main className="min-h-dvh w-full px-4 sm:px-6 py-6 relative z-10">
      <Game />
    </main>
  );
}
