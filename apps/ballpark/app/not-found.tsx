import { Logo } from "@/components/Logo";

export default function NotFound() {
  return (
    <main className="min-h-dvh flex items-center justify-center p-6">
      <div className="text-center space-y-4 max-w-md">
        <Logo />
        <h1 className="font-display font-bold text-5xl tracking-tight">404</h1>
        <p className="font-mono">that room doesn{`'`}t exist (or already ended).</p>
        <a href="/" className="inline-block underline font-mono">← back to start</a>
      </div>
    </main>
  );
}
