# Project State

## Current Facts

| Item             | Value                                             | Set on     |
| ---------------- | ------------------------------------------------- | ---------- |
| Repo             | vault-log (local, Tauri + React + TS template)    | 2026-09-06 |
| License          | TBD                                               |            |
| Backend          | Tauri 2 (Rust, `src-tauri/`), identifier `com.vaultlog.app` | 2026-09-06 |
| Frontend         | React 19 + TypeScript + Vite                      | 2026-09-06 |
| Database         | SQLite via official Tauri SQL plugin (planned, PRE-2) | 2026-09-06 |
| Product          | Local-first encrypted daily-journal desktop app; sync opt-in later | 2026-09-06 |
| Plan             | MILESTONES.md (PRE + M1 + M2 + M3, awaiting approval) | 2026-09-06 |
| Secrets location | None yet (no secrets; never commit any)           | 2026-09-06 |

## Open decisions

- M1 kickoff: exact KDF + AEAD construction and parameters.
- M3 kickoff: sync transport (ADR in M3-1).
- License TBD — set before accepting any copyleft-licensed dependency.

## Log

### 2026-09-06 — Milestone design (MILESTONES.md drafted)

- No prior state file existed; created this one. Repo was a fresh Tauri+React+TS template (single "first commit").
- User choices: encrypted daily journal; local + optional sync; PRE focus = write + find entries.
- Wrote MILESTONES.md: PRE "Twenty-minute journal" (6 tickets), M1 "Locked vault" (5),
  M2 "Memory" (5), M3 "Optional sync" (4). Each ticket has Objective/Spec/Checks;
  each milestone has Goal, Scope in/out, milestone checks.
- Storage decision grounded in inspected official docs (Tauri SQL plugin page).
- STOPPED — next: user approves plan or requests changes; then PRE-1.

### 2026-09-06 — Plan approved

- User approved MILESTONES.md as written.
- STOPPED — next: start PRE-1 (open-to-typing + autosave) on user go-ahead.

### 2026-09-06 — ticket-runner skill created

- Created project skill `.agents/skills/ticket-runner/` (SKILL.md): next-ticket →
  implement → verify checks → mark done/partial → commit + push. Validator clean.
- STOPPED — next: invoke the skill (or start PRE-1 manually).

### 2026-09-06 — PRE-1 partial (ticket-runner run)

- Implemented editor (today's entry, date switch, 1 s autosave, Saved indicator,
  word count, flush on close/hide) + minimal SQLite storage it depends on
  (plugin-sql, migration 001_init.sql, sql capabilities). PRE-2 verification stays
  for its own run.
- Static checks green: tsc, vite build, migration SQL via sqlite3 (UNIQUE enforced),
  journal logic via node. Rust side parse-checked only (no webkit dev headers here).
- Runtime GUI checks + full Rust compile need a GUI-capable machine — ticket marked
  partial with the remaining checks named.

### 2026-09-06 — PRE-1 resumed (ticket-runner run)

- No code change: the implementation still matches the Spec.
- Full Rust compile now green (`cargo build` in src-tauri, exit 0); re-verified
  tsc, vite build, migration SQL via sqlite3.
- Status stays partial: cold-start cursor timing, kill-app persistence,
  quit-mid-debounce, Saved-indicator observation need a GUI run.

### 2026-09-06 — PRE-2 (ticket-runner run)

- No code change: 001_init.sql + parameterized save/load + title default
  (first Markdown heading, else date) already in place from PRE-1's storage slice.
- Verified headless: migration applies on an empty DB, UNIQUE(day) rejects
  duplicates, restart-intact follows from SQLite file semantics.
- Status partial: clean-profile launch + in-app restart checks need a GUI run.

### 2026-09-06 — PRE-3 (ticket-runner run)

- Implemented sidebar list + search: listEntries/searchEntries in src/db.ts
  (parameterized LIKE, COLLATE NOCASE, ESCAPE wildcards, newest-first, blank
  query restores full list), sidebar in App.tsx (day/title/~80-char snippet,
  click-to-open, two empty states), sidebar layout in App.css.
- Verified: tsc green; search semantics (3-match newest-first, gibberish empty,
  literal % matched literally) via sqlite3; 200-row list query <1 ms.
- Status partial: in-app render timing, click latency, empty-states eyeball
  need a GUI run.

### 2026-09-06 — PRE-4 (ticket-runner run)

- Implemented src/markdown.ts (headings, bold, italic, flat ul/ol, links via
  opener, inline + fenced code; input HTML-escaped first, javascript:/non-http
  targets never linked), Edit/Read toggle, delete-in-Read-view with the exact
  confirm text (Cancel default + Esc), db.deleteEntry.
- Verified: tsc green; all elements + script/img/javascript: inertness via
  node; delete clears list+search via sqlite3.
- Status partial: in-app read-view eyeball, opener behavior, confirm flow
  need a GUI run.

### 2026-09-06 — PRE-5 (ticket-runner run)

- Implemented export: dialog+fs plugins (npm + Cargo deps, lib.rs init,
  capabilities with dialog:default and $HOME-scoped allow-write-text-file /
  exists / mkdir; permission IDs read from the crate manifests), src/export.ts
  (file format, name sanitize, conflict detection), footer buttons, overwrite
  confirm (decline keeps old files), loud failure (status + error dialog).
- Verified: tsc, vite build, cargo check + cargo build green; format/sanitize/
  conflicts via node; 10-file loop incl. decline-untouched via files.
- Status partial: in-app dialogs + unwritable-location error need a GUI run.

### 2026-09-06 — PRE-6 (ticket-runner run)

- Wrote README (prereqs incl. webkit dev libs, install, dev/build, walkthrough
  script, tsc/build/cargo commands, export/delete answers, fresh-start note).
- `npm run tauri build`: release compiles (10m43s), .deb + .rpm produced and
  contents-verified (ELF binary, .desktop entry, icons). AppImage bundling
  fails at the linuxdeploy step in this container — packaging-env issue, not
  app code. Build touched no tracked files.
- Status partial: install on a clean profile + full 20-minute walkthrough need
  a GUI machine. PRE as a whole stays partial for the same reason: every
  ticket's remaining checks are GUI runtime observations.

### 2026-09-06 — website waitlist page

- Created `website_waitlist/` with a plain HTML/CSS/JS marketing page for
  vault-log built around the product story in `MILESTONES.md` and `README.md`.
- The page emphasizes privacy, local-first journaling, the idea of preserving
  a personal archive without social pressure, and includes a functioning email
  waitlist form that saves entries in `localStorage`.
- Validated the page is served successfully over a local static server and the
  JavaScript parses without syntax errors.
### 2026-09-07 — Visual restyle (user request, uncommitted)

- Rewrote src/App.css: journal-like theme (serif prose, system-sans chrome,
  deep-green accent, warm-neutral sidebar, full light/dark palettes via
  prefers-color-scheme, save-state dot, dimmed dialog backdrop, focus-visible
  rings, reduced-motion respected). One-line App.tsx hook (data-state).
- Verified: tsc clean, vite build green, all 24 JSX classes present in CSS.
- Not committed; user reviewing first.

### 2026-09-07 — PRE visual verification (headless Chrome vs production bundle)

- Served `dist/` (fresh `npm run build`, tsc exit 0) on :8471; drove
  headless Chrome 152 via a no-deps CDP script (`/tmp/cdp-visual.mjs`,
  evidence `/tmp/vaultlog-shots/`: results.json + 5 screenshots, all eyeballed).
- PRE-1: editor renders in ~350 ms with today's date, placeholder, "0 words";
  typing shows live word count + `Saving…`; failures are loud, never silent.
  Still needs the Tauri webview: autofocus + `Saved <time>` on success path,
  kill-app persistence, quit-mid-debounce (plain Chrome has no SQL plugin).
- PRE-3: both empty states render exactly; gibberish search leaves editor
  untouched. Still needs webview: 200-row render timing, click latency.
- PRE-4: Read view renders h1/bold/italic/lists/link/code; `<script>` inert
  (text shown, zero script elements, no execution); delete dialog exact text,
  Cancel focused, Esc closes. Still needs webview: opener behavior,
  delete-then-gone-from-list.
- PRE-2/5/6 unchanged (need webview/seeded DB/native dialogs/bundle install).
- Ticked PRE milestone check "tsc + production build green" (evidence this run).
- STOPPED — next: Tauri-webview run on a GUI machine for the remaining checks,
  then M1 kickoff (KDF/AEAD decision).
