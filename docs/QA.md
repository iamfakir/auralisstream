# Desktop alpha verification

Verified on macOS 15.7.3 / Apple Silicon, 27 October 2026.

- Production React/TypeScript and Rust release builds passed.
- TypeScript, unused-local checks, and rustfmt passed.
- Six Rust unit tests and two Node↔Rust integration tests passed.
- Thirty-eight checks against the packaged `.app` passed. Coverage includes the minimal Sessions screen; three-item navigation; renderer isolation; name-sheet autofocus, whitespace validation, collapsed details, Enter/Escape behavior, direct navigation and focus after creation; source/relay status; guest admission, volume, mute, host-command denial, mobile width, pause/resume, rename, removal and revocation; correct selection on a second creation; session search; separate sandbox balances; deferred diagnostics; settings; compact layout; interactive wireframe controls; persistence; cleared stale presence; and inspectable closed-session history.
- Glass material checks passed: the packaged sidebar renders backdrop blur, the creation sheet uses a translucent blurred surface, and reduced-transparency emulation disables blur and restores solid backgrounds.
- No renderer errors occurred.
- Glass light/dark session screens, empty state, creation sheet, billing, guest view, and wireframe were visually inspected. Screenshots are in `artifacts/`; the wireframe image is `docs/create-session-wireframe.png`.
- Interface copy was reviewed using the installed No AI Slop skill and its evaluation checklist. Promotional slogans and decorative headings were removed; controls use direct action labels.

Tests use a temporary user-data directory and remove it afterward. Normal workspace data is preserved.

Not checked: physical mobile devices, audible output through external audio hardware, Windows, remote networks, SFU/TURN, DAW capture, authentication, or payment processing. This is an unsigned local review app; no plugins are included.
