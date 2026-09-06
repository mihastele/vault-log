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

/** Load one entry by day, or null when the day has never been written. */
export async function loadEntry(day: string): Promise<EntryRow | null> {
  const db = await getDb();
  const rows = await db.select<EntryRow[]>(
    "SELECT id, day, title, body_md, created_at, updated_at FROM entries WHERE day = $1",
    [day],
  );
  return rows.length > 0 ? rows[0] : null;
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
