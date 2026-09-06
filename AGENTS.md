# Agents.md

This file tells any AI coding agent working in this repo how to operate.
The product principles below are not aspirations; they are constraints on
every piece of code written in this repo. Read `MISSION.md` (or equivalent)
if you need the full reasoning behind them.

Project name: `<TBD>`

## Session continuity

This project spans many sessions. `.agentic/PROJECT-STATE.md` is the record of what
has already been done.

### At the start of every session

1. Read `.agentic/PROJECT-STATE.md` in full.
2. Tell the user which milestone and task they left off on, and anything
   marked BLOCKED or NEEDS DECISION.

### After completing any task

Append a log entry to `.agentic/PROJECT-STATE.md`. Update the Current Facts table if
a value changed. Never rewrite or delete prior log entries.

### Never write to .agentic/PROJECT-STATE.md (or anywhere in the repo)

Private keys, `.pem` / `.key` contents, passwords, API tokens, cloud access
keys, database connection strings with credentials, payment-provider secret
keys, SMTP passwords. Record *locations* only, e.g.
`signing key at ~/.ssh/deploy.pem`, `secrets in .env (gitignored)`.

If you notice a secret has been committed, stop and tell the user before
doing anything else. Do not try to "fix" git history on your own.

### Example .agentic/PROJECT-STATE.md

```markdown
# Project State

## Current Facts

| Item                  | Value                          | Set on     |
| --------------------- | ------------------------------ | ---------- |
| Repo                  | github.com/<user>/<project>    | <date>     |
| License               | <TBD>                          |            |
| Backend               | <TBD>                          |            |
| Frontend              | <TBD>                          |            |
| Database              | <TBD>                          |            |
| Object storage        | <TBD>                          |            |
| Dev server URL        | http://localhost:3000          |            |
| Secrets location      | .env (gitignored), never repo  | <date>     |

## Open decisions

- <decision 1>
- <decision 2>

## Log

### <date> — Milestone 0: setup

- Wrote MISSION.md and agents.md
- Chose <license> because <reason>
- STOPPED — next: <next step>
```

# Product principles (hard constraints)

These are the reasons the project exists. Replace this section with the
actual principles for this project — 5-10 concrete, testable constraints,
not vague values. Each one should be specific enough that a piece of code
can obviously violate it. If a request conflicts with one of them, say so
before implementing, and propose an alternative that fits.

Example shape for a principle:

## <N>. <Principle name>

- <Concrete rule this implies for the code>
- <Concrete rule this implies for the UI/UX>
- <What to flag or refuse if a ticket asks for it anyway>

# Engineering rules

## Database

- Every schema change is a migration file in the migrations directory.
  Never change a live database by hand.
- After any schema change: regenerate types, run migrations from scratch
  on a clean database to confirm they apply, and explain the change in
  plain language before moving on.
- Access control (row-level or equivalent) on every table that holds user
  or sensitive content. After a schema change, confirm it is enabled on
  every affected table and report the result.
- Every table with user data needs a clear answer to "how does this get
  exported?" and "how does this get deleted?" before it's merged — if the
  project has data-export/deletion requirements.

## Storage / media (if applicable)

- Uploaded files are stored behind an interface, never directly on the
  app server's disk in production.
- Strip metadata that shouldn't be retained (e.g. EXIF/GPS from images) on
  upload by default, if privacy is a project principle.
- Enforce any storage/usage quotas at write time, server-side.

## Security

- Validate and authorize on the server. Client-side checks are UX only.
- Rate-limit anything that can be abused (login, signup, posting, messaging,
  invites). Use the minimum identifying data needed to do so.
- Dependencies: prefer fewer, well-maintained, appropriately licensed
  packages. Flag anything with a license incompatible with the project's
  license.

## Testing

- Once the test suite exists, run it after every major change and before
  declaring any task done.
- Every product principle above should eventually have at least one test
  that would fail if it were violated.

## Working style

- State the user's experience level and preferences here (e.g. "explain
  reasoning, don't over-explain basics" vs. "explain everything").
- Propose before you build when a change touches auth, payments, data
  retention, or anything in the product principles.
- Prefer boring, well-understood technology unless there's a specific
  reason not to.
- Keep the README current. If a step in setup changed, the README changes
  in the same commit.
