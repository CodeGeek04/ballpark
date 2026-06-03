import Link from "next/link";

export function Logo({ size = 40 }: { size?: number }) {
  return (
    <Link
      href="/"
      aria-label="Ballpark home"
      className="inline-flex items-center gap-3 select-none rounded-md outline-none transition-transform duration-150 ease-out hover:-translate-y-[1px] focus-visible:ring-2 focus-visible:ring-ink focus-visible:ring-offset-2 focus-visible:ring-offset-paper"
    >
      <svg width={size} height={size} viewBox="0 0 40 40" fill="none" aria-hidden>
        <circle cx="20" cy="20" r="17" fill="#ff5b3a" stroke="#1a1a1a" strokeWidth="3" />
        <path d="M9 27 L20 9 L31 27 Z" fill="#fef7e8" stroke="#1a1a1a" strokeWidth="2.5" strokeLinejoin="round" />
        <circle cx="20" cy="22" r="2.5" fill="#1a1a1a" />
      </svg>
      <span className="font-display font-bold text-2xl tracking-tight">ballpark</span>
    </Link>
  );
}
