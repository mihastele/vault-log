/** Pure journal helpers. No Tauri imports here so this module stays unit-testable. */

export const AUTOSAVE_DEBOUNCE_MS = 1000;

/** Local calendar date as `YYYY-MM-DD`. */
export function todayDay(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** True for real calendar dates in `YYYY-MM-DD` form (rejects 2026-02-30 etc). */
export function isValidDay(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return (
    dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d
  );
}

/**
 * Entry title: first Markdown `#`-heading of the body, else the day.
 * Leading `#`s and surrounding whitespace are stripped; capped at 200 chars.
 */
export function deriveTitle(bodyMd: string, day: string): string {
  for (const line of bodyMd.split("\n")) {
    const m = /^#{1,6}\s+(.*)$/.exec(line);
    if (m) {
      const title = m[1].trim();
      if (title.length > 0) return title.slice(0, 200);
    }
  }
  return day;
}

/** Whitespace-separated word count. */
export function countWords(text: string): number {
  const words = text.trim().split(/\s+/).filter((w) => w.length > 0);
  return text.trim().length === 0 ? 0 : words.length;
}

/** Clock time as `HH:MM:SS` for the "Saved …" indicator. */
export function formatSavedTime(now: Date = new Date()): string {
  const h = String(now.getHours()).padStart(2, "0");
  const m = String(now.getMinutes()).padStart(2, "0");
  const s = String(now.getSeconds()).padStart(2, "0");
  return `${h}:${m}:${s}`;
}
