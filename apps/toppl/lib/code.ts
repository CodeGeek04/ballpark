export function normalizeCode(s: string): string {
  return s.trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 4);
}
