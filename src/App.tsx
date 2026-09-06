import { useEffect, useRef, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  AUTOSAVE_DEBOUNCE_MS,
  countWords,
  deriveTitle,
  formatSavedTime,
  isValidDay,
  todayDay,
} from "./journal";
import { openUrl } from "@tauri-apps/plugin-opener";
import { confirm as confirmDialog, message, open as openDialog, save } from "@tauri-apps/plugin-dialog";
import { exists as fsExists, writeTextFile } from "@tauri-apps/plugin-fs";
import { deleteEntry, getAllEntries, listEntries, loadEntry, saveEntry, searchEntries, type EntrySummary } from "./db";
import { exportFileName, singleEntryFile } from "./export";
import { renderMarkdown } from "./markdown";
import "./App.css";

type SaveState = "loading" | "ready" | "saving" | "saved" | "error";

export default function App() {
  const [day, setDay] = useState(todayDay());
  const [body, setBody] = useState("");
  const [exists, setExists] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("loading");
  const [savedAt, setSavedAt] = useState("");
  const [error, setError] = useState("");
  const [entries, setEntries] = useState<EntrySummary[]>([]);
  const [query, setQuery] = useState("");
  const [view, setView] = useState<"edit" | "read">("edit");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const cancelRef = useRef<HTMLButtonElement>(null);

  const editorRef = useRef<HTMLTextAreaElement>(null);
  const timerRef = useRef<number | null>(null);

  // Refs mirror state for use inside timers and the close handler.
  const dayRef = useRef(day);
  const bodyRef = useRef(body);
  const existsRef = useRef(exists);
  dayRef.current = day;
  bodyRef.current = body;
  existsRef.current = exists;

  function clearTimer() {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }

  /** Write pending text to disk. Skips days that were only viewed, never written. */
  async function flushPending() {
    clearTimer();
    const text = bodyRef.current;
    if (!existsRef.current && text.trim() === "") return;
    setSaveState("saving");
    try {
      await saveEntry(dayRef.current, text);
      existsRef.current = true;
      setExists(true);
      setSavedAt(formatSavedTime());
      setSaveState("saved");
      void refreshRef.current();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setSaveState("error");
    }
  }
  const flushRef = useRef(flushPending);
  flushRef.current = flushPending;

  const queryRef = useRef(query);
  queryRef.current = query;

  async function refreshList() {
    try {
      setEntries(await searchEntries(queryRef.current));
    } catch (e) {
      console.error("entry list refresh failed", e);
    }
  }
  const refreshRef = useRef(refreshList);
  refreshRef.current = refreshList;

  function scheduleSave() {
    clearTimer();
    setSaveState("saving");
    timerRef.current = window.setTimeout(() => {
      void flushRef.current();
    }, AUTOSAVE_DEBOUNCE_MS);
  }

  async function confirmDeleteEntry() {
    const target = dayRef.current;
    setConfirmDelete(false);
    try {
      await deleteEntry(target);
      setBody("");
      setExists(false);
      setView("edit");
      await refreshRef.current();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setSaveState("error");
    }
  }

  /** Loud export failure: inline status plus an error dialog, never silent. */
  async function failExport(e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    setError(`Export failed: ${msg}`);
    setSaveState("error");
    try {
      await message(`Export failed: ${msg}`, { title: "Export failed", kind: "error" });
    } catch {
      /* dialog unavailable (e.g. no window) — inline status still shows it */
    }
  }

  async function exportThisEntry() {
    try {
      await flushRef.current();
      const row = await loadEntry(dayRef.current);
      if (!row) {
        setError("Nothing to export for this day yet.");
        setSaveState("error");
        return;
      }
      const path = await save({
        defaultPath: exportFileName(dayRef.current),
        filters: [{ name: "Markdown", extensions: ["md"] }],
      });
      if (!path) return; // user cancelled the dialog
      await writeTextFile(path, singleEntryFile(row.title, row.body_md));
    } catch (e) {
      await failExport(e);
    }
  }

  async function exportAllEntries() {
    try {
      const dir = await openDialog({ directory: true, multiple: false, title: "Choose export folder" });
      if (!dir || Array.isArray(dir)) return; // user cancelled
      const rows = await getAllEntries();
      const conflicts: string[] = [];
      for (const r of rows) {
        if (await fsExists(`${dir}/${exportFileName(r.day)}`)) conflicts.push(exportFileName(r.day));
      }
      if (conflicts.length > 0) {
        const overwrite = await confirmDialog(
          `${conflicts.length} file(s) already exist (${conflicts.slice(0, 5).join(", ")}${conflicts.length > 5 ? ", …" : ""}). Overwrite them?`,
          { title: "Overwrite existing exports?", kind: "warning" },
        );
        if (!overwrite) return; // declining leaves the old files untouched
      }
      for (const r of rows) {
        await writeTextFile(`${dir}/${exportFileName(r.day)}`, singleEntryFile(r.title, r.body_md));
      }
    } catch (e) {
      await failExport(e);
    }
  }

  /** Open external links via the opener plugin; never navigate the webview. */
  async function onReadClick(e: React.MouseEvent) {
    const anchor = (e.target as HTMLElement).closest?.("a[href]");
    if (!anchor) return;
    e.preventDefault();
    try {
      await openUrl(anchor.getAttribute("href") ?? "");
    } catch (err) {
      console.error("open link failed", err);
    }
  }

  async function openDay(next: string) {
    if (next === dayRef.current) return;
    await flushRef.current();
    setSaveState("loading");
    setError("");
    try {
      const row = await loadEntry(next);
      setDay(next);
      setBody(row ? row.body_md : "");
      setExists(row !== null);
      setSaveState("ready");
      editorRef.current?.focus();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setSaveState("error");
    }
  }

  // Search the list as the user types. Only the latest request wins;
  // the editor body is never touched here.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rows = await searchEntries(query);
        if (!cancelled) setEntries(rows);
      } catch (e) {
        if (!cancelled) console.error("entry search failed", e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [query]);

  // Initial load: today's entry + full list, then focus the editor.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [row, rows] = await Promise.all([loadEntry(dayRef.current), listEntries()]);
        if (cancelled) return;
        setBody(row ? row.body_md : "");
        setExists(row !== null);
        setEntries(rows);
        setSaveState("ready");
        editorRef.current?.focus();
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : String(e));
        setSaveState("error");
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Flush pending text before the window closes so at most the debounce
  // window (~1 s) can be lost.
  useEffect(() => {
    let unlisten: (() => void) | null = null;
    try {
      const win = getCurrentWindow();
      win
        .onCloseRequested(async (event) => {
          event.preventDefault();
          try {
            await flushRef.current();
          } finally {
            await win.close();
          }
        })
        .then((fn) => {
          unlisten = fn;
        })
        .catch((e: unknown) => {
          console.error("close handler registration failed", e);
        });
    } catch (e) {
      console.error("close handler registration failed", e);
    }
    return () => {
      if (unlisten) unlisten();
    };
  }, []);

  // Cancel is the default in the delete dialog: focus it on open, Esc closes.
  useEffect(() => {
    if (!confirmDelete) return;
    cancelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setConfirmDelete(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [confirmDelete]);

  // Flush when the tab loses visibility as a second safety net.
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden") void flushRef.current();
    };
    document.addEventListener("visibilitychange", onHide);
    return () => document.removeEventListener("visibilitychange", onHide);
  }, []);

  function statusLine(): string {
    switch (saveState) {
      case "loading":
        return "Loading…";
      case "saving":
        return "Saving…";
      case "saved":
        return savedAt ? `Saved ${savedAt}` : "Saved";
      case "error":
        return error ? `Save failed: ${error}` : "Save failed";
      case "ready":
        return "Ready";
    }
  }

  return (
    <main className="journal">
      <aside className="journal-side">
        <input
          type="search"
          className="journal-search"
          value={query}
          placeholder="Search entries…"
          aria-label="Search entries"
          onChange={(e) => setQuery(e.currentTarget.value)}
        />
        <ul className="journal-list">
          {entries.map((e) => (
            <li key={e.day}>
              <button
                type="button"
                className={e.day === day ? "journal-item active" : "journal-item"}
                onClick={() => void openDay(e.day)}
                aria-current={e.day === day ? "true" : undefined}
              >
                <span className="journal-item-day">{e.day}</span>
                <span className="journal-item-title">{e.title}</span>
                <span className="journal-item-snippet">{e.snippet}</span>
              </button>
            </li>
          ))}
        </ul>
        {entries.length === 0 && query.trim() === "" && (
          <p className="journal-empty">No entries yet — write today&apos;s.</p>
        )}
        {entries.length === 0 && query.trim() !== "" && (
          <p className="journal-empty">No matches for &lsquo;{query.trim()}&rsquo;.</p>
        )}
      </aside>
      <section className="journal-main">
      <header className="journal-bar">
        <input
          type="date"
          className="journal-date"
          value={day}
          onChange={(e) => {
            if (isValidDay(e.currentTarget.value)) void openDay(e.currentTarget.value);
          }}
          aria-label="Entry date"
        />
        <span className="journal-title">{deriveTitle(body, day)}</span>
        <span className="journal-status" role="status">
          {statusLine()}
        </span>
      </header>
      <div className="journal-viewbar" role="tablist" aria-label="Entry view">
        <button
          type="button"
          role="tab"
          aria-selected={view === "edit"}
          className={view === "edit" ? "journal-tab active" : "journal-tab"}
          onClick={() => setView("edit")}
        >
          Edit
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={view === "read"}
          className={view === "read" ? "journal-tab active" : "journal-tab"}
          onClick={() => setView("read")}
        >
          Read
        </button>
        {view === "read" && (
          <button
            type="button"
            className="journal-delete"
            onClick={() => setConfirmDelete(true)}
          >
            Delete
          </button>
        )}
      </div>
      {view === "edit" ? (
        <textarea
          ref={editorRef}
          className="journal-editor"
          value={body}
          placeholder="Write today's entry…"
          aria-label="Entry text"
          onChange={(e) => {
            setBody(e.currentTarget.value);
            scheduleSave();
          }}
        />
      ) : (
        <article
          className="journal-read"
          aria-label="Rendered entry"
          onClick={(e) => void onReadClick(e)}
          dangerouslySetInnerHTML={{ __html: renderMarkdown(body) }}
        />
      )}
      {confirmDelete && (
        <div className="journal-dialog-backdrop">
          <div role="alertdialog" aria-modal="true" aria-label="Confirm delete" className="journal-dialog">
            <p>Delete the entry for {dayRef.current}? This cannot be undone.</p>
            <div className="journal-dialog-actions">
              <button type="button" className="journal-dialog-danger" onClick={() => void confirmDeleteEntry()}>
                Delete
              </button>
              <button type="button" ref={cancelRef} onClick={() => setConfirmDelete(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      <footer className="journal-foot">
        <span>{countWords(body)} words</span>
        <span className="journal-exports">
          <button type="button" onClick={() => void exportThisEntry()}>
            Export this entry
          </button>
          <button type="button" onClick={() => void exportAllEntries()}>
            Export all
          </button>
        </span>
      </footer>
      </section>
    </main>
  );
}
