import Database from "@tauri-apps/plugin-sql";
import { BaseDirectory, mkdir, readFile, writeFile } from "@tauri-apps/plugin-fs";
import { deriveTitle } from "./journal";
import { encryptValue, maybeDecryptValue } from "./vault";

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
let currentPassphrase: string | null = null;

/** Shared connection; migrations registered in Rust run before this resolves. */
export function getDb(): Promise<Database> {
  if (!dbPromise) dbPromise = Database.load(DB_PATH);
  return dbPromise;
}

export function setVaultPassphrase(passphrase: string | null): void {
  currentPassphrase = passphrase;
}

export async function ensureVaultMeta(): Promise<void> {
  const db = await getDb();
  await db.execute(
    "CREATE TABLE IF NOT EXISTS vault_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)",
  );
}

export async function isVaultConfigured(): Promise<boolean> {
  const db = await getDb();
  await ensureVaultMeta();
  const rows = await db.select<{ value: string }[]>(
    "SELECT value FROM vault_meta WHERE key = $1",
    ["configured"],
  );
  return rows.some((row) => row.value === "true");
}

export async function verifyVaultPassphrase(passphrase: string): Promise<boolean> {
  const db = await getDb();
  const rows = await db.select<{ title: string; body_md: string }[]>(
    "SELECT title, body_md FROM entries ORDER BY day DESC LIMIT 1",
  );
  if (rows.length === 0) return true;

  try {
    await maybeDecryptValue(rows[0].title, passphrase);
    return true;
  } catch {
    return false;
  }
}

async function backupPlaintextDb(): Promise<string | null> {
  const db = await getDb();
  const countRows = await db.select<{ count: number }[]>("SELECT COUNT(*) AS count FROM entries");
  if ((countRows[0]?.count ?? 0) === 0) return null;

  await mkdir("backups", { baseDir: BaseDirectory.AppData, recursive: true });
  const path = `backups/pre-m1-${Date.now()}.db`;
  const data = await readFile("vaultlog.db", { baseDir: BaseDirectory.AppData });
  await writeFile(path, data, { baseDir: BaseDirectory.AppData });
  return path;
}

export async function initializeVault(passphrase: string): Promise<void> {
  const db = await getDb();
  await ensureVaultMeta();
  const configured = await isVaultConfigured();
  if (configured) {
    throw new Error("Vault is already configured.");
  }

  await backupPlaintextDb();
  const rows = await db.select<EntryRow[]>(
    "SELECT id, day, title, body_md, created_at, updated_at FROM entries ORDER BY day ASC",
  );

  for (const row of rows) {
    const encryptedTitle = await encryptValue(row.title, passphrase);
    const encryptedBody = await encryptValue(row.body_md, passphrase);
    await db.execute(
      `UPDATE entries
       SET title = $1,
           body_md = $2,
           updated_at = $3
       WHERE id = $4`,
      [encryptedTitle, encryptedBody, new Date().toISOString(), row.id],
    );
  }

  await db.execute(
    "INSERT INTO vault_meta (key, value) VALUES ($1, $2)",
    ["configured", "true"],
  );
  currentPassphrase = passphrase;
}

export interface EntrySummary {
  day: string;
  title: string;
  snippet: string;
}

async function decryptEntryRow(row: EntryRow): Promise<EntryRow> {
  if (!currentPassphrase) {
    return row;
  }

  const title = await maybeDecryptValue(row.title, currentPassphrase);
  const body_md = await maybeDecryptValue(row.body_md, currentPassphrase);
  return { ...row, title, body_md };
}

/** Load one entry by day, or null when the day has never been written. */
export async function loadEntry(day: string): Promise<EntryRow | null> {
  const db = await getDb();
  const rows = await db.select<EntryRow[]>(
    "SELECT id, day, title, body_md, created_at, updated_at FROM entries WHERE day = $1",
    [day],
  );
  if (rows.length === 0) return null;
  return decryptEntryRow(rows[0]);
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

  const decrypted = await Promise.all(
    rows.map(async (row) => ({
      ...row,
      title: currentPassphrase ? await maybeDecryptValue(row.title, currentPassphrase) : row.title,
      body_md: currentPassphrase ? await maybeDecryptValue(row.body_md, currentPassphrase) : row.body_md,
    })),
  );

  return decrypted.map((r) => ({ day: r.day, title: r.title, snippet: makeSnippet(r.body_md) }));
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

  const decrypted = await Promise.all(
    rows.map(async (row) => ({
      ...row,
      title: currentPassphrase ? await maybeDecryptValue(row.title, currentPassphrase) : row.title,
      body_md: currentPassphrase ? await maybeDecryptValue(row.body_md, currentPassphrase) : row.body_md,
    })),
  );

  return decrypted.map((r) => ({ day: r.day, title: r.title, snippet: makeSnippet(r.body_md) }));
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
  const rows = await db.select<FullEntry[]>(
    "SELECT day, title, body_md FROM entries ORDER BY day ASC",
  );

  const passphrase = currentPassphrase;
  if (!passphrase) return rows;

  const decrypted = await Promise.all(
    rows.map(async (row) => ({
      ...row,
      title: await maybeDecryptValue(row.title ?? "", passphrase),
      body_md: await maybeDecryptValue(row.body_md ?? "", passphrase),
    })),
  );

  return decrypted;
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
  const titleValue = currentPassphrase ? await encryptValue(title, currentPassphrase) : title;
  const bodyValue = currentPassphrase ? await encryptValue(bodyMd, currentPassphrase) : bodyMd;
  await db.execute(
    `INSERT INTO entries (day, title, body_md, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT(day) DO UPDATE SET
       title = excluded.title,
       body_md = excluded.body_md,
       updated_at = excluded.updated_at`,
    [day, titleValue, bodyValue, now, now],
  );
}
