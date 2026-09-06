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
