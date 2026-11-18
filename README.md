# Auralis Streamer

A local macOS desktop alpha for reviewing the India-first audio-sharing product. Electron hosts the React/TypeScript interface; a Rust child process owns session state, validation, and atomic persistence.

**This build is for checking the `.app`. It does not include VST3/AU plugins, audio capture, live DAW streaming, a deployed SFU/TURN service, cloud accounts, subscriptions, or payment processing.** It never reports a live connection or generates a public sharing link. Guest previews run on the same Mac; their optional 220 Hz test tone is generated locally and is not DAW audio.

## Run and build

Requires Node.js 22.12+ (tested on 22.22.1), npm, the Rust toolchain, and macOS with Xcode Command Line Tools. The current packaging script builds for the host platform and architecture.

```sh
npm ci
npm run dev          # Compile Rust, start Vite, launch Electron
npm run package      # Production UI + Rust executable + .app bundle
npm start            # Run the previously built production assets
npm test             # Rust unit tests and Node↔Rust integration tests
npm run check        # TypeScript and rustfmt checks
npm run test:app     # Packaged Electron smoke test; run package first
```

On Apple Silicon the bundle is `release/Auralis Streamer-darwin-arm64/Auralis Streamer.app`:

```sh
open "release/Auralis Streamer-darwin-arm64/Auralis Streamer.app"
```

The app is unsigned and not notarized; this is a local review build, not a distribution installer. No plugin is built or installed. Close the app before replacing an existing bundle with a new build.

## Try the workflow

1. Click **Create session**, enter a name, and press Enter. The app opens the new session directly.
2. Click **Preview listener**, enter a guest name, and click **Listen**.
3. Optionally play the quiet test tone; adjust volume or mute it.
4. In the host window, pause/resume previews, remove a guest, rename a session, or revoke access through **Session actions**. Revocation invalidates existing preview windows.
5. Add five **sandbox** hours in Billing. No payment occurs. Included and purchased balances remain separate, and previews never debit them.
6. Change the studio name or appearance in Settings, restart, and verify they persist.

## Structure and boundaries

- `src/`: React screens, shared types, theme tokens, local listener player.
- `public/`: original Auralis logo, bundled fonts, macOS app icon.
- `electron/`: sandboxed window lifecycle, scoped IPC bridge, Rust process transport.
- `native/`: Rust session state, guest admission, validation, persistence, and unit tests.
- `scripts/`: development launch, icon generation, and app packaging.
- `tests/`: bridge integration and packaged-app smoke tests.
- `docs/`: implementation status and production requirements.

A single Rust process reads bounded JSON-line requests over stdin and returns responses over stdout. It exposes no HTTP listener. Renderer windows have no Node.js access, cannot navigate to arbitrary URLs, cannot create unapproved windows, and are denied OS permission requests. Guest windows are restricted to their session and cannot invoke host operations. No user-to-user media connection is created.

State lives in Electron's user-data directory, normally `~/Library/Application Support/Auralis Streamer/studio.json`. Settings → Diagnostics → **Open data folder** reveals the actual path. Files are written through a temporary file and atomic rename, with owner-only file permissions on macOS. Invalid data or unknown schema versions fail visibly without overwriting the saved file. Connected guests are cleared on restart. Session history is limited to 200 sessions and the latest 200 activity entries.

For isolated testing, set `AURALIS_DATA_DIR` to a temporary directory. Never use the live application's data directory for automation. There are no API keys or payment credentials in this build.

## Design and wireframe

The simplified macOS-style interface starts in Sessions and has three navigation items: Sessions, Billing, and Settings. Create session opens a name sheet, then the new session's controls. Detailed settings stay collapsed until requested.

Auralis's original logo and indigo accent (`#1D126E`) remain. The app uses system fonts, frosted translucent surfaces, background blur, reflective edges, compact controls, and light/dark appearance. A solid-surface fallback respects reduced-transparency preferences. It does not load external fonts.

See [the interactive wireframe](docs/create-session-wireframe.html) and [the flow specification](docs/CREATE_SESSION.md).

The repository-local [No AI Slop skill](.agents/skills/no-ai-slop/SKILL.md) is installed from [petergyang/no-ai-slop](https://github.com/petergyang/no-ai-slop), with its source tracked in `skills-lock.json`.
