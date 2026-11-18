# Create session

Open [the interactive wireframe](create-session-wireframe.html) to review the three screens.

## Flow

1. **Sessions:** a list of saved sessions, or an empty state with one Create session button.
2. **New session:** a focused sheet with one required name field. Stereo, the five-guest limit, and the local-preview restriction appear under Session details.
3. **Session controls:** creation opens the newly created session. The screen shows source status, Preview listener, Pause, and Guests.

The name accepts 1–80 characters. Leading and trailing whitespace is removed. Empty names disable creation; control characters are rejected by Rust. Enter submits and Escape cancels. Creation disables the buttons while saving. Errors remain in the sheet. Cancelling creates no record.

## Controls after creation

- **Preview listener:** opens a separate guest window. Guests enter a name and click Listen, then can test playback with a quiet tone, adjust volume, or leave.
- **Pause / Resume:** updates connected guest windows and prevents playback while paused.
- **Guests:** shows real local participants, up to five. Remove disconnects that guest.
- **More:** rename, revoke preview access, or close the session. Revocation invalidates open previews; closing preserves the session in history.
- **Session details:** creation date, stereo channels, preview mode, and usage.

Remote sharing is unavailable until a relay and capture source are implemented. Preview activity never debits hours or takes a payment.

## UI changes

Removed the promotional hero, decorative waveform, metric tiles, signal-path illustration, side-panel slogans, and permanent activity feed. Sessions is now the starting screen. Billing and Settings remain in the sidebar. Diagnostics and notification settings are disclosed when requested.

Auralis's logo and indigo accent remain. System typography, frosted glass surfaces, larger text, and fewer visible controls replace the previous website-style layout. Background blur and highlight edges support light/dark appearance; reduced-transparency preferences use solid surfaces.

The repository-local [No AI Slop skill](../.agents/skills/no-ai-slop/SKILL.md) was installed from [petergyang/no-ai-slop](https://github.com/petergyang/no-ai-slop). Interface copy was checked against its [evaluation checklist](../.agents/skills/no-ai-slop/eval.md).

Design references: Apple's [sheets](https://developer.apple.com/design/human-interface-guidelines/sheets) and [disclosure controls](https://developer.apple.com/design/human-interface-guidelines/disclosure-controls).
