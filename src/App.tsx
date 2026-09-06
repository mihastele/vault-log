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
import { loadEntry, saveEntry } from "./db";
import "./App.css";

type SaveState = "loading" | "ready" | "saving" | "saved" | "error";

export default function App() {
  const [day, setDay] = useState(todayDay());
  const [body, setBody] = useState("");
  const [exists, setExists] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("loading");
  const [savedAt, setSavedAt] = useState("");
  const [error, setError] = useState("");

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
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setSaveState("error");
    }
  }
  const flushRef = useRef(flushPending);
  flushRef.current = flushPending;

  function scheduleSave() {
    clearTimer();
    setSaveState("saving");
    timerRef.current = window.setTimeout(() => {
      void flushRef.current();
    }, AUTOSAVE_DEBOUNCE_MS);
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

  // Initial load: today's entry, then focus the editor.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const row = await loadEntry(dayRef.current);
        if (cancelled) return;
        setBody(row ? row.body_md : "");
        setExists(row !== null);
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
      <footer className="journal-foot">{countWords(body)} words</footer>
    </main>
  );
}
