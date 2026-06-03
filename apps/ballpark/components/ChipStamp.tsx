export function ChipStamp({
  children,
  rotate = -2,
  tone = "ember",
}: {
  children: React.ReactNode;
  rotate?: number;
  tone?: "ember" | "mustard" | "ink";
}) {
  const bg = tone === "ember" ? "bg-ember text-paper" : tone === "mustard" ? "bg-mustard text-ink" : "bg-ink text-paper";
  return (
    <span
      className={`inline-block px-2.5 py-1 text-[11px] font-bold tracking-[0.08em] uppercase rounded-full ${bg}`}
      style={{ transform: `rotate(${rotate}deg)` }}
    >
      {children}
    </span>
  );
}
