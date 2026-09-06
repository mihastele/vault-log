---
name: ticket-runner
description: Implement the next open ticket from MILESTONES.md, verify its checks, mark it done or partial, commit and push.
---

# Ticket Runner

One run implements exactly one ticket, then stops. Invoking this skill is the
user's authorization to commit and push that ticket's work.

## 1. Find the next ticket

- Read `MILESTONES.md` top to bottom (milestone order PRE, M1, M2, M3 is priority order).
- The next ticket is the first `#### <ID> — <title>` heading with no
  `**Status: done …**` line directly under it.
- A ticket marked `**Status: partial …**` counts as the next ticket: resume it,
  starting from the remaining work named in its status line.
- If every ticket is marked done, report that and stop without touching git.

## 2. Implement to the Spec

- Implement exactly what the ticket's **Spec** bullets require — full scope, edge
  cases included. Do not pull in other tickets' scope.
- Follow the repo conventions in `MILESTONES.md` (versioned migrations, README
  updates, export/delete answers) and the rules in `AGENTS.md`.
- Never write secrets, tokens, or credentials into the repo. If you find a
  committed secret, stop and report before doing anything else.

## 3. Verify every check

- Run each **Checks** bullet of the ticket and record the evidence (command output,
  observed behavior). Run the repo's own verification for the touched area, at
  minimum `npx tsc --noEmit` and the production build when code changed.
- All checks green → status `done`. Any check failing or unverifiable → status
  `partial`, naming the remaining checks in the status line.

## 4. Mark the ticket

- Directly under the ticket's `####` heading, insert or update one line:
  `**Status: done YYYY-MM-DD**` or
  `**Status: partial YYYY-MM-DD — <what remains>**`.
- Append a log entry to `.agentic/PROJECT-STATE.md` (never rewrite prior entries).
- Tick a milestone checkbox only when that milestone check's own evidence exists;
  finishing a ticket alone does not tick milestone boxes.

## 5. Commit and push

- Run `git status`. Stage only the ticket's files (code, the two markdown updates).
  Unrelated changes stay uncommitted.
- The build must be green before committing. Never commit failing code.
- Message format: `<ID>: <title>` as subject, ticket checks evidence in the body.
- Commit on the current branch, then `git push` (plain push only).
- Forbidden: `--force`, `--amend` of existing commits, rebase, history rewrites,
  committing secrets, pushing to any branch but the current one.
- If the push fails, report the exact output and stop — do not retry with flags.

## 6. Report

- Ticket ID and title, final status (done or partial with remaining work), commit
  hash, push result. Stop. Do not start the next ticket.
