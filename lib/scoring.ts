export const DEFAULT_K = 1.5;

export function scoreGuess(guess: number, answer: number, k: number = DEFAULT_K): number {
  if (!isFinite(guess) || !isFinite(answer)) return 0;
  if (answer <= 0 || guess <= 0) return 0;
  const offMagnitudes = Math.abs(Math.log10(guess / answer));
  const ratio = Math.min(1, offMagnitudes / k);
  return Math.max(0, Math.round(1000 * (1 - ratio)));
}

export function logPercent(value: number, min: number, max: number): number {
  if (value <= 0) return 0;
  const lv = Math.log10(value);
  const lmin = Math.log10(Math.max(min, 1e-9));
  const lmax = Math.log10(Math.max(max, lmin + 1));
  return Math.max(0, Math.min(100, ((lv - lmin) / (lmax - lmin)) * 100));
}

export function bounds(values: number[]): { min: number; max: number } {
  const positives = values.filter((v) => v > 0);
  if (!positives.length) return { min: 1, max: 10 };
  const lo = Math.min(...positives);
  const hi = Math.max(...positives);
  return { min: lo / 3, max: hi * 3 };
}
