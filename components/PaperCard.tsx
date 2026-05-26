import { forwardRef } from "react";

export const PaperCard = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement> & { tone?: "paper" | "ink" }>(
  function PaperCard({ children, className = "", tone = "paper", ...rest }, ref) {
    const base =
      tone === "ink"
        ? "bg-ink text-paper border-2 border-ink shadow-stamp"
        : "bg-paper text-ink border-2 border-ink shadow-stamp";
    return (
      <div
        ref={ref}
        {...rest}
        className={`relative rounded-card p-6 ${base} ${className}`}
      >
        {children}
      </div>
    );
  },
);
