"use client";

import { useState } from "react";

export type Game = {
  slug: string;
  index: string;
  name: string;
  desc: string;
  blurb: string;
  example: string;
  meta: string;
  status: "live" | "new" | "soon";
  href: string;
  rot: number;
  gradient: string;
  color: string;
};

export function GameCard({ game }: { game: Game }) {
  const [flipped, setFlipped] = useState(false);
  const isPlayable = game.status !== "soon";

  function go() {
    if (!isPlayable) return;
    window.location.href = game.href;
  }

  return (
    <div
      onClick={go}
      className="absolute inset-0 cursor-pointer group"
      style={{
        transformStyle: "preserve-3d",
        transform: `rotate(${game.rot}deg)`,
        transition: "transform 350ms cubic-bezier(0.16, 1, 0.3, 1)",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = `rotate(0deg) translateY(-14px)`;
        e.currentTarget.style.zIndex = "5";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = `rotate(${game.rot}deg) translateY(0)`;
        e.currentTarget.style.zIndex = "1";
      }}
    >
      <div
        className="absolute inset-0"
        style={{
          transformStyle: "preserve-3d",
          transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
          transition: "transform 600ms cubic-bezier(0.16, 1, 0.3, 1)",
        }}
      >
        {/* FRONT */}
        <div
          className="absolute inset-0 flex flex-col p-[18px]"
          style={{
            backfaceVisibility: "hidden",
            borderRadius: 5,
            background: game.gradient,
            color: game.color,
            boxShadow: "10px 10px 28px rgba(0,0,0,0.6), inset 0 0 0 1px rgba(255,255,255,0.05)",
          }}
        >
          <div className="font-mono text-[10px] tracking-[0.22em] opacity-70 font-semibold">{game.index}</div>
          <div className="font-display font-black text-[26px] tracking-[-0.03em] leading-none mt-[6px] whitespace-nowrap">
            {game.name}
          </div>
          <div className="font-sans text-[10.5px] font-medium opacity-80 mt-[10px] leading-[1.35]">{game.desc}</div>
          <button
            type="button"
            aria-label="More info"
            onClick={(e) => {
              e.stopPropagation();
              setFlipped(true);
            }}
            className="absolute bottom-3 right-3 w-6 h-6 rounded-full border-[1.5px] border-current opacity-50 hover:opacity-100 hover:scale-110 transition flex items-center justify-center"
            style={{ fontFamily: "var(--font-serif), Georgia, serif", fontStyle: "italic", fontWeight: 700, fontSize: 13 }}
          >
            i
          </button>
          {!isPlayable && (
            <div className="absolute top-3 right-3 font-mono text-[9px] tracking-[0.2em] opacity-60">
              soon
            </div>
          )}
        </div>

        {/* BACK */}
        <div
          className="absolute inset-0 flex flex-col p-[18px]"
          style={{
            backfaceVisibility: "hidden",
            transform: "rotateY(180deg)",
            borderRadius: 5,
            background: game.gradient,
            color: game.color,
            boxShadow: "10px 10px 28px rgba(0,0,0,0.6), inset 0 0 0 1px rgba(255,255,255,0.05)",
          }}
        >
          <div className="absolute inset-0 pointer-events-none rounded-[5px]" style={{ background: "rgba(0,0,0,0.18)" }} />
          <div className="relative font-mono text-[10px] tracking-[0.2em] uppercase opacity-75">
            {game.index} · {game.status}
          </div>
          <div className="relative font-display font-black text-[22px] tracking-[-0.025em] leading-none mt-[6px]">
            {game.name}
          </div>
          <div className="relative h-px my-3 opacity-25" style={{ background: "currentColor" }} />
          <div className="relative font-sans text-[10.5px] font-medium leading-[1.5] opacity-95">{game.blurb}</div>
          <div
            className="relative mt-[10px] px-2.5 py-2 rounded text-[10.5px] leading-[1.4] opacity-90"
            style={{ background: "rgba(0,0,0,0.18)", fontFamily: "var(--font-serif), Georgia, serif", fontStyle: "italic", fontWeight: 700 }}
          >
            {game.example}
          </div>
          <div className="relative mt-auto font-mono text-[9.5px] tracking-[0.12em] uppercase opacity-70">{game.meta}</div>
          <button
            type="button"
            aria-label="Close"
            onClick={(e) => {
              e.stopPropagation();
              setFlipped(false);
            }}
            className="absolute bottom-3 right-3 w-6 h-6 rounded-full border-[1.5px] border-current opacity-50 hover:opacity-100 hover:scale-110 transition flex items-center justify-center font-mono font-bold text-[11px]"
          >
            x
          </button>
        </div>
      </div>
    </div>
  );
}
