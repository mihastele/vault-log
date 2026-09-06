# MILESTONES.md — vault-log

## Product in one line

vault-log is a local-first, encrypted daily-journal desktop app (Tauri + React + TypeScript).
Your entries live on your machine. Sync to your own devices is opt-in and comes last.
If encryption or sync ever conflicts with "it just opens and lets me write," writing wins.

## How to read this file

- Each milestone has: **Goal**, **Scope in**, **Scope out (non-goals)**, **Tickets**, **Milestone checks**.
- Each ticket has: **Objective**, **Spec** (exact behavior, inputs/outputs, edge cases),
  **Checks** (how to prove it is done — a command or click-path plus expected evidence).
- A ticket is done only when every check passes. A milestone is done only when every
  ticket is done **and** every milestone check passes.
- Ticket IDs are stable: `PRE-*`, `M1-*`, `M2-*`, `M3-*`.

## Repo conventions (apply to all milestones)

- Every schema change ships as a migration file under `src-tauri/migrations/`.
  Never edit a shipped migration; add a new one. Migrations must apply cleanly
  from scratch on an empty profile.
- Every table holding user content must have a documented export path and delete
  path before the ticket merges (PRE-4 delete, PRE-5 export).
- Keep `README.md` current: if setup or run steps change, the README changes
  in the same unit of work.
- Storage backend for all milestones: one local SQLite file opened through the
  official Tauri SQL plugin (SQLite driver enabled by Cargo feature).
  Decision evidence: inspected official docs during planning.

---

## Milestone PRE — "Twenty-minute journal"

### Goal

A stranger installs the app and, within 20 minutes, writes today's entry, finds an
older entry via search, and exports an entry — and feels their journaling problem
is solved, not demoed.

### 20-minute walkthrough (the bar PRE must clear)

1. Open app → today's entry is already there, cursor in the editor (≤ 60 s after launch).
2. Type a few paragraphs → "Saved" indicator appears without pressing anything.
3. Write entries for two more days (backdated via day navigation or quick date switch).
4. Search one word → the right entry appears.
5. Export one entry to a `.md` file and open it in another program.
6. Quit, reopen → everything is still there.

### Scope in

- Day-based entries (one entry per calendar day), create/edit/autosave.
- Entry list + substring search.
- Markdown editing with a rendered read view.
- Local SQLite persistence; data survives restart.
- Single-entry and full Markdown export.
- Entry delete with confirm (the "how does this get deleted" answer).
- Packaged desktop build that runs outside dev mode.

### Scope out (non-goals for PRE)

- Passphrase encryption and lock screen (→ M1). PRE stores plaintext locally;
  the schema is chosen so M1 can migrate it (see PRE-2).
- Tags, favorites, calendar view (→ M2).
- Sync, backup files, multi-device (→ M2 backup, M3 sync).
- Attachments/images, WYSIWYG editing, collaboration.

### Tickets

#### PRE-1 — Open-to-typing in 60 seconds with autosave

**Status: partial 2026-09-06 — tsc, vite build, cargo check + cargo build, migration SQL via sqlite3, journal logic all green; remaining: cold-start cursor timing, kill-app persistence, quit-mid-debounce, Saved-indicator observation — all need a GUI run**

- **Objective:** Launching the app lands the user in today's entry, ready to type,
  and no edit is ever lost to a forgotten save button.
- **Spec:**
  - On launch the app opens today's entry (local date, `YYYY-MM-DD`); if none
    exists it is created on first keystroke, not before (no empty rows for days
    the user only viewed).
  - Editor autosaves with ~1 s debounce after the last keystroke; a status line
    shows `Saving…` then `Saved HH:MM:SS`.
  - If the app quits mid-debounce, at most the last ~1 s of typing may be lost;
    everything debounced before quit must be on disk (flush on window close).
  - Word count updates live; empty entry shows a one-line placeholder hint, not
    a tutorial modal.
- **Checks:**
  - Cold start → cursor blinking in today's editor within 60 s (stopwatch, fresh profile).
  - Type a sentence, watch `Saving…` → `Saved <time>` with no clicks.
  - Kill the app 3 s after typing stops, reopen → sentence present.
  - Quit within the debounce window → at most that sentence fragment missing, nothing else.

#### PRE-2 — Local SQLite persistence with migration v1

**Status: partial 2026-09-06 — migration applies clean via sqlite3, UNIQUE(day) enforced, all writes parameterized, title default verified in code; remaining: clean-profile launch + restart checks in the app (GUI run)**

- **Objective:** Entries persist in a single local SQLite file, created and evolved
  only through versioned migrations.
- **Spec:**
  - Database file `vaultlog.db` in the platform app-data directory, opened via
    the Tauri SQL plugin (`sqlite:` path).
  - Migration `001_init.sql` creates `entries(id INTEGER PRIMARY KEY,
    day TEXT NOT NULL UNIQUE, title TEXT NOT NULL DEFAULT '',
    body_md TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL)`; `day` is the local calendar date `YYYY-MM-DD`.
  - All writes go through parameterized statements (no string-interpolated SQL).
  - `title` defaults to the first Markdown heading of the body, else the date.
- **Checks:**
  - Delete the profile dir, launch → app starts clean, migration applies, no errors in console.
  - `SELECT` the table after writing → one row per day, `day` unique constraint enforced
    (attempted duplicate insert fails, app does not create dupes).
  - Restart → all rows intact.

#### PRE-3 — Entry list + substring search

**Status: partial 2026-09-06 — tsc green; LIKE search (case-insensitive, newest-first, gibberish-empty, wildcard-escape) verified via sqlite3; 200-row list query <1 ms; remaining: in-app render timing, click latency, empty-states eyeball (GUI run)**

- **Objective:** The user can get back to any entry in seconds by scrolling or searching.
- **Spec:**
  - Sidebar lists entries reverse-chronological: day, title, first ~80 chars snippet.
  - Clicking an entry loads it into the editor (< 200 ms for the local DB).
  - Search box filters title + body, case-insensitive substring (`LIKE`-based is fine at
    PRE scale); clearing the box restores the full list.
  - Explicit empty states: "No entries yet — write today's" and "No matches for 'x'".
- **Checks:**
  - Seed 200 entries via SQL → list renders in ≤ 1 s, scrolls without jank (eyeball).
  - Search a word known to match 3 entries → exactly those 3, newest first.
  - Search gibberish → "No matches" state, editor content untouched.

#### PRE-4 — Read view (Markdown render) + delete with confirm

**Status: partial 2026-09-06 — tsc green; renderer covers headings/bold/italic/lists/links/code, script/img/javascript: links inert (node test), delete removes row from list+search (sqlite3); remaining: in-app read-view eyeball, opener behavior, delete-confirm + Esc flow (GUI run)**

- **Objective:** Entries are readable as formatted text, and deletion is possible,
  deliberate, and complete.
- **Spec:**
  - Edit/Read toggle per entry. Read view renders headings, bold, italic, lists,
    links (open externally via the opener plugin), inline code and code blocks.
  - Raw Markdown is never executed as HTML/JS (no script injection from entry text).
  - Delete button lives in Read view; clicking asks "Delete the entry for <day>?
    This cannot be undone." with Delete/Cancel; Cancel is default (Esc works).
  - Delete removes the row entirely; list, search, and export no longer show it.
- **Checks:**
  - Paste Markdown covering each supported element → Read view shows all formatted.
  - Paste `<script>alert(1)</script>` → shown as inert text, no alert, no network call.
  - Delete → confirm → entry gone from list, search, and full export; Esc leaves it intact.

#### PRE-5 — Markdown export (single entry + full)

**Status: partial 2026-09-06 — tsc + vite build + cargo check/build green; file format, sanitize, conflict/decline logic verified (node + 10-file loop); remaining: in-app save/folder dialogs, overwrite confirm, unwritable-location error (GUI run)**

- **Objective:** The user's words are never trapped: anything written can leave as
  plain Markdown files (the "how does this get exported" answer).
- **Spec:**
  - "Export this entry" opens a save dialog defaulting to `<day>.md`; file content
    is `# <title>\n\n<body_md>`.
  - "Export all" asks for a folder and writes one `<day>.md` per entry; existing
    same-name files require overwrite confirmation, never silent overwrite.
  - Filenames sanitize to `YYYY-MM-DD.md`; export fails loudly (dialog + message)
    on unwritable locations instead of writing partial output silently.
- **Checks:**
  - Export one entry → open the `.md` in another editor → title + body match.
  - Export all with 10 entries → 10 files, correct names and contents.
  - Export all into a folder containing one same-name file → confirmation appears;
    declining leaves the old file untouched.

#### PRE-6 — Packaged build + README

**Status: partial 2026-09-06 — README complete; `npm run tauri build` compiles release and produces working .deb + .rpm (contents verified: binary, .desktop, icons); AppImage step fails at linuxdeploy in this container; remaining: install on a clean profile + full 20-minute walkthrough (GUI machine)**

- **Objective:** PRE is a real installable app, not a dev-server demo, and a new
  contributor can run it from the README alone.
- **Spec:**
  - `npm run tauri build` produces an installer/bundle that launches outside dev mode.
  - README documents: prerequisites, `npm install`, `npm run dev` /
    `npm run tauri dev`, and the 20-minute walkthrough script above.
- **Checks:**
  - Fresh clone → follow README verbatim → app runs (no missing steps).
  - Installed bundle on a clean profile → the full 20-minute walkthrough passes
    inside 20 minutes.

### Milestone checks (PRE is done when…)

- [ ] The 20-minute walkthrough passes end-to-end on the packaged build, timed.
- [ ] `npx tsc --noEmit` and the production build are green.
- [ ] Deleting the profile and relaunching migrates cleanly (PRE-2 check repeated).

---

## Milestone M1 — "Locked vault"

### Goal

The journal becomes a vault: everything at rest is encrypted under the user's
passphrase, the app locks itself, and a forgotten passphrase fails loudly and
honestly instead of silently destroying data.

### Scope in

- Passphrase setup with explicit no-recovery acknowledgment.
- Encrypted-at-rest storage (migrates the PRE plaintext DB, keeps a verified backup first).
- Lock screen, manual + auto-lock, change passphrase.
- Honest wrong-password and data-loss behavior.

### Scope out

- Sync, sharing, device pairing (→ M3).
- User-facing backup/restore UX beyond the automatic pre-migration backup (→ M2-5).
- Plausible deniability / hidden volumes.

### Tickets

#### M1-1 — Passphrase setup + encrypted format + plaintext migration

- **Objective:** First launch after upgrade converts the vault to an encrypted
  format without risking the user's existing words.
- **Spec:**
  - Setup screen on first run (or upgrade with plaintext DB): passphrase input +
    confirmation, minimum 12 characters with a plain-language strength hint.
  - Checkbox "I understand a forgotten passphrase cannot be recovered" is required
    to continue; the exact recovery story (none) is stated, not implied.
  - Encryption properties (exact KDF/cipher chosen at M1 kickoff and recorded in
    the ticket before coding): passphrase-derived key via a memory-hard KDF with a
    per-vault random salt; authenticated encryption (AEAD) for all entry content;
    wrong passphrase fails authentication — never returns garbled plaintext.
  - Migration: write automatic plaintext backup `<profile>/backups/pre-m1-<ts>.db`,
    encrypt, then decrypt-verify every row before the app touches the backup;
    abort with the plaintext DB intact on any failure.
- **Checks:**
  - New user: setup → write entry → inspect DB file bytes → no entry text greppable.
  - Upgrade user: plaintext DB + 5 entries → setup → all 5 readable, backup file exists.
  - Corrupt one byte of the encrypted file (test copy) → app reports "vault damaged
    or wrong passphrase," shows no garbled text.
  - Passphrase under 12 chars or unchecked box → setup refuses with a reason.

#### M1-2 — Lock screen + unlock

- **Objective:** A locked app reveals nothing and unlocks only for the right passphrase.
- **Spec:**
  - Lock screen shows app name and password field only — no titles, snippets, counts,
    or search index readable while locked; React state holds no entry content.
  - Unlock verifies via AEAD open of a known header (constant-time comparison where
    applicable); success loads the journal, failure shows a generic "Wrong passphrase"
    with no hints about format, length, or which half was wrong.
  - Manual "Lock now" affordance (button; `Ctrl/Cmd+L` if cheap) always visible when unlocked.
  - Clipboard: the app never copies entry text on lock/unlock; OS clipboard untouched.
- **Checks:**
  - Lock → inspect window/DOM → zero entry text present.
  - Wrong passphrase → generic error, still locked, no attempt counter lockout that
    could be used to deny the owner (no wipe-after-N; see M1-5).
  - Correct passphrase → journal loads in ≤ 2 s for a 500-entry vault.

#### M1-3 — Auto-lock

- **Objective:** A walked-away-from laptop locks itself on a predictable schedule.
- **Spec:**
  - Defaults: auto-lock after 10 min without input; lock-on-window-blur OFF.
    Both configurable (timer 1–60 min, blur on/off) in Settings; settings persist.
  - Last-input tracking resets on key/mouse activity in the window only.
  - On auto-lock, unsaved debounce content is flushed first (same guarantee as PRE-1),
    then memory is cleared and the lock screen shows.
- **Checks:**
  - Set timer to 1 min, type, idle 70 s → locked, content flushed (reopen shows last sentence).
  - Enable blur-lock → alt-tab away → locked on return.
  - Settings survive restart.

#### M1-4 — Change passphrase

- **Objective:** Changing the passphrase re-encrypts everything and never leaves the
  vault half-migrated.
- **Spec:**
  - Flow: verify current passphrase → enter new twice (same 12-char + acknowledgment
    rules) → re-encrypt all rows under a fresh salt → decrypt-verify sample of rows
    → only then discard the old key material.
  - Cancel at any point before final verify leaves the old passphrase fully working.
  - Old passphrase stops working immediately after success.
- **Checks:**
  - Change → lock → old passphrase fails, new works, all entries readable.
  - Cancel mid-flow → old still works, entries intact.
  - Simulated crash between re-encrypt and verify (test hook or copied profile) →
    old passphrase still opens the vault.

#### M1-5 — Data-loss safeguards (the honest-failure ticket)

- **Objective:** No code path silently destroys the vault: every destructive outcome
  is either impossible or explicitly confirmed.
- **Spec:**
  - No auto-wipe on failed unlocks, ever. Failed attempts show the generic error only.
  - Uninstall/reinstall guidance in README: vault file location + "reinstall does not
    delete your vault; deleting the profile folder does."
  - Any future destructive action (beyond entry delete) must follow the PRE-4 pattern:
    named target + irreversibility statement + safe default.
- **Checks:**
  - 20 wrong passphrases in a row → vault intact, still unlockable with the right one.
  - Review every M1 dialog: each names its target and states irreversibility or it fails review.

### Milestone checks (M1 is done when…)

- [ ] Plaintext PRE vault upgrades to encrypted with zero entry loss (timed drill, 3 runs).
- [ ] Cold read of the vault file shows no greppable entry text.
- [ ] Threat-model note added to README: encryption covers at-rest theft; it does not
  cover a compromised running OS, screenshots, or plaintext exports the user made.
- [ ] `npx tsc --noEmit` and the production build are green.

---

## Milestone M2 — "Memory"

### Goal

A year of entries stays navigable: tags, favorites, a calendar, real full-text search,
and a backup/restore story the user can actually perform.

### Scope in

- Tags, favorites, calendar navigation.
- FTS-ranked search replacing the PRE substring filter.
- User-facing encrypted backup + restore, backup reminder.

### Scope out

- Sync and multi-device (→ M3). Backup files are portable by hand (USB, cloud drive)
  but the app performs no syncing.
- Attachments/images.

### Tickets

#### M2-1 — Tags

- **Objective:** Entries can be labeled and filtered by tag.
- **Spec:**
  - Tag bar per entry; tags lowercase alphanumeric + `-`, max 32 chars; duplicates
    impossible (adding twice is a no-op).
  - New migration: `tags(entry_id, tag)` with FK to entries + index; deleting an
    entry deletes its tag rows.
  - Clicking a tag filters the list; multiple selected tags AND-combine; Esc clears.
- **Checks:**
  - Add/remove tags → persist across restart; dup add is a silent no-op.
  - Filter two tags → only entries with both; Esc restores full list.
  - Delete a tagged entry → its tag rows gone (query shows none orphaned).

#### M2-2 — Favorites

- **Objective:** Star entries and see only starred ones on demand.
- **Spec:**
  - Star toggle in list rows and Read view; `favorite INTEGER 0/1` column via migration.
  - "★ Favorites" filter chip; combines with tag filter and search query.
- **Checks:**
  - Star 3 entries → Favorites shows exactly those; unstar → removed.
  - Favorite + tag + search active together → intersection is correct.

#### M2-3 — Calendar view

- **Objective:** Navigate by month; see at a glance which days have entries.
- **Spec:**
  - Month grid, today highlighted, dots on days with entries; click a day opens it
    (existing) or starts it (empty, same first-keystroke rule as PRE-1).
  - Month navigation (prev/today/next); state survives view switching.
- **Checks:**
  - Month with scattered entries → dots match exactly the days with rows.
  - Click empty day → blank editor for that date; saving creates exactly one row.

#### M2-4 — Full-text search upgrade (FTS)

- **Objective:** Search stays instant and relevant at thousands of entries.
- **Spec:**
  - Migration adds a full-text index over title + body with insert/update/delete
    triggers (FTS5 if the bundled SQLite enables it — verify at implementation;
    fallback: ranked `LIKE` queries). Queries rank by match quality and return
    snippets with `<mark>`-style highlight ranges (rendered safely, same
    inert-HTML rule as PRE-4).
  - Combines with tag + favorites filters; empty query shows the plain list (PRE-3 behavior).
- **Checks:**
  - Seed 2,000 entries → typical one-word query returns in ≤ 300 ms (devtools timing).
  - Multi-word query ranks the entry containing all words first.
  - Delete an entry → it stops appearing in results (trigger check).

#### M2-5 — Encrypted backup + restore

- **Objective:** The user can back up and restore the whole vault with the passphrase
  they already have.
- **Spec:**
  - "Back up vault" writes one encrypted backup file (same M1 crypto) to a
    user-chosen path; filename `vaultlog-backup-<date>.vault`.
  - "Restore" asks for file + passphrase, verifies auth first, then asks for
    overwrite confirmation naming the current vault; cancel/failed-auth changes nothing.
  - "Last backup: never / <date>" banner appears after 7 days without a backup.
- **Checks:**
  - Backup → delete profile → restore with passphrase → all entries, tags,
    favorites intact.
  - Restore with wrong passphrase → clean failure, current vault untouched.
  - Set system clock +8 days (or test hook) → reminder banner appears.

### Milestone checks (M2 is done when…)

- [ ] 2,000 seeded entries: search ≤ 300 ms, list scrolls smoothly, calendar renders instantly.
- [ ] Backup → wipe → restore drill passes with tags/favorites intact.
- [ ] `npx tsc --noEmit` and the production build are green.

---

## Milestone M3 — "Optional sync"

### Goal

Two devices owned by one user converge on the same journal without accounts, without
a server we operate, and without ever silently losing words to a conflict.

### Scope in

- Explicit opt-in sync between the user's own devices.
- Offline-first: full local use always; sync when reachable.
- Conflict strategy that preserves both sides.
- Honest sync status and error UI.

### Scope out (non-goals)

- Real-time collaboration, shared/team journals, comments.
- Accounts, passwords-recovery-via-email, or any server we run storing user content.
- Automatic sync without explicit opt-in per device.

### Tickets

#### M3-1 — Transport decision (spike + ADR)

- **Objective:** Choose the sync transport on evidence, not preference, and write it down.
- **Spec:**
  - Time-boxed spike (≤ 2 days): prototype moving one entry device→device via the
    leading candidate (default candidate: user-chosen shared folder replica, which
    also composes with tools the user already trusts; challenger: direct local
    device pairing).
  - Decision recorded as an Architecture Decision Record in the repo: options tried,
    why the winner won, what would reverse the decision.
  - No production sync code merges before the ADR is accepted.
- **Checks:**
  - ADR exists, names ≥ 2 options with concrete rejection reasons.
  - Spike demo: one entry edited on device A appears on device B (test profiles fine).

#### M3-2 — Sync engine (push/pull, tombstones, conflict copies)

- **Objective:** Sync converges and never silently drops an entry, an edit, or a delete.
- **Spec:**
  - Sync cursor per replica; push/pull only rows changed since cursor.
  - Deletes replicate as tombstones (entry hidden, tombstone retained) so a delete
    on A deletes on B without resurrecting on next sync.
  - Concurrent edits to one entry → both versions kept: winner stays the entry,
    loser becomes a visible "conflict copy" entry flagged for review; no
    last-write-wins data loss.
  - All sync payloads encrypted with the vault crypto (transport sees ciphertext only).
- **Checks:**
  - A offline edits, B offline edits different entries → sync → both devices identical.
  - Same entry edited on both while offline → sync → one entry + one flagged conflict
    copy on both devices, zero words lost (diff the texts).
  - Delete on A while B edits offline → sync → tombstone wins visibly: entry gone,
    conflict copy of B's edit retained and flagged (delete never vaporizes unseen work).

#### M3-3 — Sync status + errors UI

- **Objective:** The user always knows whether their words are everywhere yet.
- **Spec:**
  - Status line: `Synced HH:MM` / `Syncing…` / `Offline — N changes pending` /
    `K conflicts need review`.
  - Conflicts list with per-conflict Keep mine / Keep theirs / Keep both; resolution
    syncs as a normal change.
  - Every failure (unreachable replica, corrupt payload, auth mismatch) shows what
    happened and what to do; retry is one click; failures never block local writing.
- **Checks:**
  - Unplug network / point at missing folder → Offline state + pending count grows
    as you type; reconnect → syncs.
  - Resolve a conflict each of the three ways → resolution sticks after re-sync.

#### M3-4 — Multi-device drill + recovery

- **Objective:** Prove the whole story on two real profiles, including disaster recovery.
- **Spec:**
  - Documented drill in README: two profiles, offline edits both sides, sync, conflict
    review, wipe device B, re-add B from A.
  - Re-adding a device is restore-equivalent: full vault arrives encrypted, unlocks
    with the existing passphrase, no re-setup of tags/favorites needed.
- **Checks:**
  - Full drill passes twice in a row without developer intervention beyond the doc.
  - Wiped device returns with identical entry/tag/favorite counts.

### Milestone checks (M3 is done when…)

- [ ] Two-profile drill passes; conflict copies preserve every word (diff-verified).
- [ ] Sync stays opted-out by default: fresh install never transmits anything.
- [ ] `npx tsc --noEmit` and the production build are green.

---

## Explicit non-goals (all milestones)

- Team/shared journals, comments, presence.
- Attachments and images (revisit only after M3, with its own storage-quota + EXIF-stripping spec).
- Mobile apps, web app, hosted service.
- WYSIWYG editing — Markdown is the format.

## Open questions

- M1 kickoff: exact KDF + AEAD construction and parameters (record in M1-1 before coding).
- M3 kickoff: transport per M3-1 ADR.
- Repo: license still TBD — must be set before any dependency with a copyleft license is accepted.
- Sync conflict UX details (beyond M3-3) at M3 kickoff.

## Sources

- Tauri SQL plugin (SQLite support, sqlx-based, Cargo-feature drivers, install shape):
  [https://v2.tauri.app/plugin/sql/](https://v2.tauri.app/plugin/sql/) — inspected 2026-09-06.
