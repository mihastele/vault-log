/** Pure export helpers. No Tauri imports here so this module stays unit-testable. */
import { isValidDay } from "./journal";

/** File content for one exported entry: `# <title>\n\n<body_md>`. */
export function singleEntryFile(title: string, bodyMd: string): string {
  return `# ${title}\n\n${bodyMd}`;
}

/**
 * Export file name for a day. Days are already `YYYY-MM-DD`; anything else
 * is sanitized to alphanumerics/dash/underscore so the name is always a
 * safe `<name>.md`.
 */
export function exportFileName(day: string): string {
  if (isValidDay(day)) return `${day}.md`;
  const safe = day.replace(/[^A-Za-z0-9-_]/g, "-").slice(0, 64) || "entry";
  return `${safe}.md`;
}

/** Days from `all` that already exist in `existingNames` (overwrite conflicts). */
export function findConflicts(allDays: string[], existingNames: Set<string>): string[] {
  return allDays.filter((d) => existingNames.has(exportFileName(d)));
}
