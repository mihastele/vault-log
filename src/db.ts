import Database from "@tauri-apps/plugin-sql";
import { deriveTitle } from "./journal";

export interface EntryRow {
  id: number;
  day: string;
  title: string;
  body_md: string;
  created_at: string;
  updated_at: string;
}

const DB_PATH = "sqlite:vaultlog.db";

let dbPromise: Promise<Database> | null = null;

/** Shared connection; migrations registered in Rust run before this resolves. */
export function getDb(): Promise<Database> {
  if (!dbPromise) dbPromise = Database.load(DB_PATH);
  return dbPromise;
}

export interface EntrySummary {
  day: string;
  title: string;
  snippet: string;
}

/** Load one entry by day, or null when the day has never been written. */
export async function loadEntry(day: string): Promise<EntryRow | null> {
  const db = await getDb();
  const rows = await db.select<EntryRow[]>(
    "SELECT id, day, title, body_md, created_at, updated_at FROM entries WHERE day = $1",
    [day],
  );
  return rows.length > 0 ? rows[0] : null;
}

/** Escape the LIKE wildcards so a search string matches literally. */
export function escapeLike(s: string): string {
  return s.replace(/[\\%_]/g, (c) => `\\${c}`);
}

/** All entries, newest first. Empty query callers use this for the full list. */
export async function listEntries(): Promise<EntrySummary[]> {
  const db = await getDb();
  const rows = await db.select<{ day: string; title: string; body_md: string }[]>(
    "SELECT day, title, body_md FROM entries ORDER BY day DESC",
  );
  return rows.map((r) => ({ day: r.day, title: r.title, snippet: makeSnippet(r.body_md) }));
}

/**
 * Case-insensitive substring search over title + body, newest first.
 * Empty/blank query returns the full list (PRE-3 clearing behavior).
 */
export async function searchEntries(query: string): Promise<EntrySummary[]> {
  if (query.trim() === "") return listEntries();
  const db = await getDb();
  const pattern = `%${escapeLike(query)}%`;
  const rows = await db.select<{ day: string; title: string; body_md: string }[]>(
    `SELECT day, title, body_md FROM entries
     WHERE title LIKE $1 ESCAPE '\\' COLLATE NOCASE
        OR body_md LIKE $1 ESCAPE '\\' COLLATE NOCASE
     ORDER BY day DESC`,
    [pattern],
  );
  return rows.map((r) => ({ day: r.day, title: r.title, snippet: makeSnippet(r.body_md) }));
}

function makeSnippet(bodyMd: string): string {
  return bodyMd.replace(/\s+/g, " ").trim().slice(0, 80);
}

export interface FullEntry {
  day: string;
  title: string;
  body_md: string;
}

/** Every entry, oldest first, for full export. */
export async function getAllEntries(): Promise<FullEntry[]> {
  const db = await getDb();
  return db.select<FullEntry[]>(
    "SELECT day, title, body_md FROM entries ORDER BY day ASC",
  );
}

/** Remove one entry entirely. Resolves when the row is gone. */
export async function deleteEntry(day: string): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM entries WHERE day = $1", [day]);
}

/**
 * Insert or update one entry. All values are bound parameters, never
 * interpolated into the SQL string.
 */
export async function saveEntry(day: string, bodyMd: string): Promise<void> {
  const db = await getDb();
  const now = new Date().toISOString();
  const title = deriveTitle(bodyMd, day);
  await db.execute(
    `INSERT INTO entries (day, title, body_md, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT(day) DO UPDATE SET
       title = excluded.title,
       body_md = excluded.body_md,
       updated_at = excluded.updated_at`,
    [day, title, bodyMd, now, now],
  );
}
