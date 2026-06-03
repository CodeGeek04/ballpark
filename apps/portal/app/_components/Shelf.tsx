"use client";

import { GameCard, type Game } from "./GameCard";

const GAMES: Game[] = [
  {
    slug: "ballpark",
    index: "01",
    name: "Ballpark",
    desc: "guess the weirdest number",
    blurb:
      "A strange number question lands. Sixty seconds, calculator allowed. Closest guess wins. 5,700 questions and counting.",
    example: "how many liters of jet fuel does Taylor Swift burn in a week?",
    meta: "solo · up to 8 · teams",
    status: "live",
    href: process.env.NEXT_PUBLIC_BALLPARK_URL || "https://ballpark.doozy.fun",
    rot: -4,
    gradient: "linear-gradient(165deg, oklch(0.58 0.18 28), oklch(0.42 0.2 24))",
    color: "oklch(0.97 0.02 80)",
  },
  {
    slug: "toppl",
    index: "02",
    name: "Toppl",
    desc: "bigger or smaller",
    blurb:
      "Two surprising quantities head to head. Pick the bigger one. Wrong picks knock you out. Longest streak wins.",
    example: "more pigeons in NYC or more Uber drivers in London?",
    meta: "solo · up to 8 · streak",
    status: "new",
    href: process.env.NEXT_PUBLIC_TOPPL_URL || "https://toppl.doozy.fun",
    rot: 1.8,
    gradient: "linear-gradient(165deg, oklch(0.72 0.16 82), oklch(0.54 0.18 70))",
    color: "oklch(0.16 0 0)",
  },
  {
    slug: "order-it",
    index: "03",
    name: "Order It",
    desc: "rank these four",
    blurb:
      "Four items, one ranking. Drag them into order by revenue, weight, year, or whatever the round asks. Partial credit for close.",
    example: "rank by revenue: Zomato, IPL, Maggi, Taj Mahal",
    meta: "2 to 8 players",
    status: "soon",
    href: "#",
    rot: -1.2,
    gradient: "linear-gradient(165deg, oklch(0.5 0.16 220), oklch(0.34 0.18 240))",
    color: "oklch(0.97 0.02 80)",
  },
  {
    slug: "timeline",
    index: "04",
    name: "Timeline",
    desc: "when did it happen",
    blurb:
      "An event lands. You place it on a shared timeline. Closer to the real date, more points. Pure addiction once you start.",
    example: "when did Wikipedia launch?",
    meta: "solo · up to 8",
    status: "soon",
    href: "#",
    rot: 3,
    gradient: "linear-gradient(165deg, oklch(0.62 0.16 145), oklch(0.42 0.18 150))",
    color: "oklch(0.97 0.02 80)",
  },
];

export function Shelf() {
  return (
    <div className="relative w-full max-w-6xl mx-auto" style={{ perspective: 1400 }}>
      <div className="relative" style={{ aspectRatio: "16 / 9" }}>
        {GAMES.map((g, i) => (
          <div
            key={g.slug}
            className="absolute"
            style={{
              left: `${6 + i * 22}%`,
              bottom: "calc(12% + 9px)",
              width: "19.5%",
              aspectRatio: "3 / 4.5",
            }}
          >
            <GameCard game={g} />
          </div>
        ))}

        {/* shelf */}
        <div
          className="absolute left-0 right-0 z-[2]"
          style={{
            bottom: "12%",
            height: 9,
            background: "var(--walnut-shelf, oklch(0.14 0.03 45))",
            boxShadow: "0 8px 20px rgba(0,0,0,0.65)",
          }}
        >
          <div
            className="absolute left-0 right-0"
            style={{
              top: 9,
              height: 26,
              background: "linear-gradient(180deg, rgba(0,0,0,0.55), transparent)",
            }}
          />
        </div>
      </div>
    </div>
  );
}
