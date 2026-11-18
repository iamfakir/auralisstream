# Desktop alpha implementation status

This build follows the request to make an Electron + Rust `.app` for checking the experience, without creating VST3 or AU plugins. It is a local product prototype, not the commercial MVP.

## Available for review

| Area | Implemented behavior |
| --- | --- |
| Sessions | Starting screen; create through a name sheet, open the new session directly, search, filter, rename, pause, close, inspect history, revoke preview access |
| Guest experience | Isolated local window, display-name admission, explicit listening action, optional quiet test tone, volume and mute, leave |
| Listener management | Five-guest admission cap, remove participant, invalidate invitations, host pause reflected in guest UI |
| Billing UI | Clearly labeled sandbox, separate included/purchased hours, test top-ups, exhaustion explanation, no invented subscription or invoices |
| Settings | Studio name, light/dark appearance, disclosed notification preference and diagnostics, installed version, local data-folder access |
| Rust core | Validated state mutations, scoped Electron transport, owner-only atomic state file, history, restart recovery |

## Deliberately unavailable

No DAW capture, production encoding, network media forwarding, remote listener admission, production accounting, authentication, email, checkout, invoices, cancellation, PostgreSQL, or Redis is implemented. The app does not silently substitute peer-to-peer or local HTTP streaming for the required SFU architecture. Silence in the preview means no audio is supplied; only a deliberately activated local test tone plays.

## Production implementation requirements

Keep the required media path: DAW capture → companion → regional SFU → guest browsers. Evaluate self-hosted LiveKit with TURN, using stereo 48 kHz Opus targeting 256 kbps, encoded once and forwarded without server transcoding. Label delivered audio as compressed. Native capture remains a separate milestone and must preserve DAW pass-through during all failures.

A production Rust API service must provide authenticated versioned endpoints for sessions, guest admission, closure, revocation, balances, history, and checkout. Use PostgreSQL for durable entities and Redis for presence/coordination. Only server-generated, short-lived, session-scoped listener credentials belong in guest invitations. Store publisher credentials outside the renderer using platform credential storage.

Production usage must come from authoritative media forwarding intervals, never a renderer timer or this preview's guest list. Deduplicate event IDs and connection generations, union overlapping intervals, count transmitted silence, exclude paused/empty rooms, split at billing boundaries, and debit seconds without session rounding. Listener count must not multiply charges within plan limits. Exhaustion must stop forwarding while keeping session controls available. Payment-provider outages must not interrupt entitled audio forwarding.

Before distribution, replace sandbox values with real entitlements, implement identity and server-side authorization, integrate verified payment webhooks, review JUCE licensing if native plugins are pursued later, test real Indian network routes/mobile playback and reconnects, and sign/notarize the macOS app. Windows and AU remain outside this build.
