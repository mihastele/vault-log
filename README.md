# vault-log

A local-first, encrypted daily-journal desktop app (Tauri + React + TypeScript).
Your entries live on your machine. Sync to your own devices is opt-in and comes last.

> Status: PRE milestone ("Twenty-minute journal", plaintext storage). Passphrase
> encryption arrives in M1; see `MILESTONES.md`.

## Prerequisites

- Node.js 20+ and npm
- Rust stable toolchain (`rustup default stable`)
- Linux system libraries for Tauri dev (Debian/Ubuntu):
  `libwebkit2gtk-4.1-dev build-essential curl wget file libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev`

## Run from a fresh clone

```sh
npm install
npm run dev            # web-only preview in the browser (no Tauri backend; DB calls need the app)
npm run tauri dev      # full desktop app with local SQLite
```

## Build the installable app

```sh
npm run tauri build
```

The bundle (`.AppImage`/`.deb`/`.dmg`/`.msi` depending on OS) launches outside
dev mode with a clean profile. The SQLite file is `vaultlog.db` in the
platform app-data directory.

## 20-minute walkthrough (the bar PRE must clear)

1. Open app → today's entry is already there, cursor in the editor (≤ 60 s after launch).
2. Type a few paragraphs → "Saved" indicator appears without pressing anything.
3. Write entries for two more days (backdated via the date picker or the entry list).
4. Search one word → the right entry appears.
5. Export one entry to a `.md` file and open it in another program.
6. Quit, reopen → everything is still there.

## Useful commands

```sh
npx tsc --noEmit   # type-check
npm run build      # production web build (also runs the type-check)
cd src-tauri && cargo check   # type-check the Rust backend
```

## Data: export and delete

- Export: footer buttons "Export this entry" (`<day>.md`, `# <title>` + body)
  and "Export all" (one file per entry; overwrite asks first, declining keeps old files).
- Delete: Read view → Delete → confirm. The row is removed entirely; list,
  search, and export no longer show it.
- Fresh start: delete the profile app-data dir (incl. `vaultlog.db`) and relaunch;
  migration `001_init.sql` recreates the schema.
