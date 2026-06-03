import { ITEMS, type Item } from "./items";

const MIN_RATIO = 1.4; // skip near-equal coin-flip pairs
const MAX_RATIO = 1000; // skip absurd 10000x mismatches; less fun

/**
 * Pick a random pair of items that have a meaningful value gap.
 * Excludes any item ids the caller has already seen this run.
 */
export function pickPair(seen: Set<string>): [Item, Item] | null {
  const pool = ITEMS.filter((i) => !seen.has(i.id) && i.value > 0);
  if (pool.length < 2) return null;

  // Try a bounded number of times before giving up on the ratio gate.
  for (let tries = 0; tries < 200; tries++) {
    const a = pool[Math.floor(Math.random() * pool.length)];
    const b = pool[Math.floor(Math.random() * pool.length)];
    if (a.id === b.id) continue;
    const ratio = Math.max(a.value, b.value) / Math.min(a.value, b.value);
    if (ratio < MIN_RATIO || ratio > MAX_RATIO) continue;
    // Randomize left/right so the bigger one isn't predictable.
    return Math.random() < 0.5 ? [a, b] : [b, a];
  }
  // Fallback: just pick any two distinct items.
  const a = pool[0];
  const b = pool.find((i) => i.id !== a.id)!;
  return [a, b];
}

export function formatValue(value: number, unit: string): string {
  const abs = Math.abs(value);
  if (abs >= 1e12) return `${(value / 1e12).toFixed(2)} trillion ${unit}`;
  if (abs >= 1e9) return `${(value / 1e9).toFixed(2)} billion ${unit}`;
  if (abs >= 1e6) return `${(value / 1e6).toFixed(2)} million ${unit}`;
  if (abs >= 1e3) return `${Math.round(value).toLocaleString()} ${unit}`;
  return `${value.toLocaleString()} ${unit}`;
}
