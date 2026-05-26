"use client";

import { motion } from "motion/react";

export function StampButton({
  children,
  onClick,
  disabled,
  tone = "ember",
  type = "button",
  className = "",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  tone?: "ember" | "ink" | "paper" | "mustard";
  type?: "button" | "submit";
  className?: string;
}) {
  const bg =
    tone === "ember"
      ? "bg-ember text-paper"
      : tone === "ink"
        ? "bg-ink text-paper"
        : tone === "mustard"
          ? "bg-mustard text-ink"
          : "bg-paper text-ink";
  return (
    <motion.button
      type={type}
      onClick={onClick}
      disabled={disabled}
      whileTap={{ x: 3, y: 3, boxShadow: "0px 0px 0 #1a1a1a" }}
      transition={{ duration: 0.08, ease: [0.16, 1, 0.3, 1] }}
      className={`relative inline-flex items-center justify-center gap-2 px-5 py-3 rounded-card border-2 border-ink font-bold tracking-tight shadow-stamp-sm disabled:opacity-40 disabled:cursor-not-allowed ${bg} ${className}`}
    >
      {children}
    </motion.button>
  );
}
