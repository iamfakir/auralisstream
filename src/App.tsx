import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  ArrowLeft,
  Check,
  ChevronRight,
  CreditCard,
  FolderOpen,
  Headphones,
  LoaderCircle,
  MoreHorizontal,
  Pause,
  Play,
  Plus,
  Search,
  Settings,
  X,
} from "lucide-react";
import {
  api,
  date,
  hours,
  type Diagnostics,
  type Preferences,
  type Session,
  type StudioState,
} from "./types";

type Page = "Sessions" | "Billing" | "Settings";
type Mutation = (
  method: string,
  params?: Record<string, unknown>,
) => Promise<StudioState>;
type Sheet =
  | { type: "create" }
  | { type: "rename"; session: Session }
  | {
      type: "confirm";
      title: string;
      description: string;
      label: string;
      danger?: boolean;
      run: () => Promise<unknown>;
    };

function SessionSheet({
  sheet,
  close,
  mutate,
}: {
  sheet: Sheet;
  close: () => void;
  mutate: Mutation;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [name, setName] = useState(
    sheet.type === "rename" ? sheet.session.name : "",
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  const title =
    sheet.type === "confirm"
      ? sheet.title
      : sheet.type === "create"
        ? "New session"
        : "Rename session";
  async function submit() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      if (sheet.type === "confirm") await sheet.run();
      else
        await mutate(
          sheet.type === "create" ? "create_session" : "rename_session",
          {
            name: name.trim(),
            ...(sheet.type === "rename"
              ? { session_id: sheet.session.id }
              : {}),
          },
        );
      close();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <dialog
      ref={ref}
      className="sheet"
      aria-labelledby="sheet-title"
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) close();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) close();
      }}
    >
      <h2 id="sheet-title">{title}</h2>
      <p className="sheet-description">
        {sheet.type === "confirm"
          ? sheet.description
          : "Choose a name for this session."}
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        {sheet.type !== "confirm" && (
          <label className="field">
            Session name
            <input
              autoFocus
              required
              maxLength={80}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Mix review"
            />
          </label>
        )}
        {sheet.type === "create" && (
          <details className="disclosure sheet-details">
            <summary>Session details</summary>
            <dl className="detail-list">
              <div>
                <dt>Channels</dt>
                <dd>Stereo</dd>
              </div>
              <div>
                <dt>Guest limit</dt>
                <dd>5</dd>
              </div>
              <div>
                <dt>Mode</dt>
                <dd>Local preview</dd>
              </div>
            </dl>
            <p className="caption">
              DAW capture and remote sharing are not available in this build.
            </p>
          </details>
        )}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <div className="sheet-actions">
          <button
            type="button"
            className="button secondary"
            disabled={busy}
            onClick={close}
          >
            Cancel
          </button>
          <button
            className={`button ${sheet.type === "confirm" && sheet.danger ? "destructive" : "primary"}`}
            disabled={busy || (sheet.type !== "confirm" && !name.trim())}
          >
            {busy && <LoaderCircle size={15} className="spin" />}
            {sheet.type === "confirm"
              ? sheet.label
              : sheet.type === "create"
                ? "Create session"
                : "Save name"}
          </button>
        </div>
      </form>
    </dialog>
  );
}

function SessionRoom({
  session,
  mutate,
  showSheet,
  report,
}: {
  session: Session;
  mutate: Mutation;
  showSheet: (sheet: Sheet) => void;
  report: (text: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [menu, setMenu] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    headingRef.current?.focus();
  }, []);
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const dismiss = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenu(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenu(false);
    };
    document.addEventListener("click", dismiss);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("click", dismiss);
      document.removeEventListener("keydown", escape);
    };
  }, []);
  async function preview() {
    setBusy(true);
    try {
      await api("open_preview", { session_id: session.id });
    } catch (e) {
      report((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const closed = session.status === "closed";
  const status = closed
    ? "Closed"
    : session.status === "paused"
      ? "Preview paused"
      : "Local preview";
  return (
    <>
      <div className="page-heading room-heading">
        <div>
          <h1 ref={headingRef} tabIndex={-1}>
            {session.name}
          </h1>
          <span className={`session-status ${session.status}`}>
            <i />
            {status}
          </span>
        </div>
        {!closed && (
          <div className="session-menu" ref={menuRef}>
            <button
              className="icon-button"
              aria-label="Session actions"
              aria-expanded={menu}
              onClick={() => setMenu(!menu)}
            >
              <MoreHorizontal size={21} />
            </button>
            {menu && (
              <div className="dropdown">
                <button
                  onClick={() => {
                    setMenu(false);
                    showSheet({ type: "rename", session });
                  }}
                >
                  Rename session
                </button>
                <button
                  onClick={() => {
                    setMenu(false);
                    showSheet({
                      type: "confirm",
                      title: "Revoke preview access?",
                      description:
                        "Current guests will be disconnected. Open a new preview to invite them again.",
                      label: "Revoke access",
                      danger: true,
                      run: () =>
                        mutate("revoke_link", { session_id: session.id }),
                    });
                  }}
                >
                  Revoke preview access
                </button>
                <button
                  className="text-danger"
                  onClick={() => {
                    setMenu(false);
                    showSheet({
                      type: "confirm",
                      title: "Close session?",
                      description:
                        "Guests will be disconnected. The session will remain in your history.",
                      label: "Close session",
                      danger: true,
                      run: () =>
                        mutate("close_session", { session_id: session.id }),
                    });
                  }}
                >
                  Close session
                </button>
              </div>
            )}
          </div>
        )}
      </div>
      <section className="group source-group" aria-label="Audio source">
        <div className="source-row">
          <span className="source-symbol">
            <Headphones size={23} strokeWidth={1.5} />
          </span>
          <div>
            <h2>Audio source</h2>
            <p>Not connected</p>
          </div>
        </div>
        <p className="caption">
          DAW capture and remote sharing are not available in this build.
        </p>
        {!closed && (
          <div className="room-actions">
            <button
              className="button primary"
              disabled={busy || session.status === "paused"}
              onClick={() => {
                void preview();
              }}
            >
              {busy ? (
                <LoaderCircle className="spin" size={15} />
              ) : (
                <Headphones size={16} />
              )}
              Preview listener
            </button>
            <button
              className="button secondary"
              aria-label={
                session.status === "paused" ? "Resume preview" : "Pause preview"
              }
              onClick={() => {
                void mutate("set_paused", {
                  session_id: session.id,
                  paused: session.status !== "paused",
                }).catch((e) => report(e.message));
              }}
            >
              {session.status === "paused" ? (
                <Play size={15} />
              ) : (
                <Pause size={15} />
              )}
              {session.status === "paused" ? "Resume" : "Pause"}
            </button>
          </div>
        )}
      </section>
      <section className="guest-section">
        <div className="section-heading">
          <h2>Guests</h2>
          <span className="secondary-text">
            {session.listeners.length} of 5
          </span>
        </div>
        {session.listeners.length ? (
          <div className="group guest-list">
            {session.listeners.map((guest) => (
              <div className="listener-row" key={guest.id}>
                <span className="avatar">{guest.name[0].toUpperCase()}</span>
                <strong>{guest.name}</strong>
                <span className="secondary-text">Local preview</span>
                <button
                  className="icon-button"
                  aria-label={`Remove ${guest.name}`}
                  onClick={() =>
                    showSheet({
                      type: "confirm",
                      title: `Remove ${guest.name}?`,
                      description:
                        "Their current preview will be disconnected.",
                      label: "Remove guest",
                      danger: true,
                      run: () =>
                        mutate("remove_listener", {
                          session_id: session.id,
                          participant_id: guest.id,
                        }),
                    })
                  }
                >
                  <X size={16} />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="empty-guests">
            {closed
              ? "This session is closed."
              : "No guests yet. Open a listener preview to try it."}
          </p>
        )}
      </section>
      <details className="disclosure room-details">
        <summary>Session details</summary>
        <dl className="detail-list">
          <div>
            <dt>Created</dt>
            <dd>{date(session.created_at)}</dd>
          </div>
          <div>
            <dt>Channels</dt>
            <dd>Stereo</dd>
          </div>
          <div>
            <dt>Sharing</dt>
            <dd>Local preview only</dd>
          </div>
          <div>
            <dt>Billable usage</dt>
            <dd>0 seconds</dd>
          </div>
        </dl>
        <p className="caption">Previews do not use your balance.</p>
      </details>
    </>
  );
}

function SessionList({
  state,
  open,
  create,
}: {
  state: StudioState;
  open: (id: string) => void;
  create: () => void;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("Open");
  const sessions = state.sessions.filter(
    (s) =>
      (filter === "All" ||
        (filter === "Closed"
          ? s.status === "closed"
          : s.status !== "closed")) &&
      s.name.toLowerCase().includes(query.toLowerCase()),
  );
  if (!state.sessions.length)
    return (
      <div className="empty-state">
        <span className="empty-symbol">
          <Headphones size={34} strokeWidth={1.4} />
        </span>
        <h1>No sessions</h1>
        <p>Create a session to preview the listener experience.</p>
        <button className="button primary" onClick={create}>
          <Plus size={16} />
          Create session
        </button>
      </div>
    );
  return (
    <>
      <div className="page-heading">
        <h1>Sessions</h1>
      </div>
      <div className="list-controls">
        <div className="segmented" aria-label="Filter sessions">
          {["Open", "Closed", "All"].map((value) => (
            <button
              aria-pressed={value === filter}
              className={value === filter ? "selected" : ""}
              key={value}
              onClick={() => setFilter(value)}
            >
              {value}
            </button>
          ))}
        </div>
        <label className="search-field">
          <Search size={15} />
          <input
            aria-label="Search sessions"
            value={query}
            placeholder="Search"
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
      </div>
      <div className="group session-list">
        {sessions.map((session) => (
          <button
            className="session-list-row"
            key={session.id}
            onClick={() => open(session.id)}
          >
            <span className="list-session-icon">
              <Headphones size={19} strokeWidth={1.5} />
            </span>
            <span className="session-row-name">
              <strong>{session.name}</strong>
              <small>{date(session.created_at)}</small>
            </span>
            <span className="row-status">
              {session.status === "closed"
                ? "Closed"
                : session.status === "paused"
                  ? "Paused"
                  : "Local preview"}
            </span>
            <ChevronRight size={16} />
          </button>
        ))}
        {!sessions.length && (
          <div className="list-empty">
            <h2>
              {query
                ? "No matching sessions"
                : filter === "Closed"
                  ? "No closed sessions"
                  : "No open sessions"}
            </h2>
            <p>
              {query
                ? "Try a different name."
                : "Your sessions will appear here."}
            </p>
          </div>
        )}
      </div>
      <p className="caption list-caption">
        Local previews only. Remote sharing is not connected.
      </p>
    </>
  );
}

function Billing({
  state,
  showSheet,
  mutate,
}: {
  state: StudioState;
  showSheet: (sheet: Sheet) => void;
  mutate: Mutation;
}) {
  return (
    <>
      <div className="page-heading">
        <h1>Billing</h1>
        <p>Sandbox balances. No payments are taken.</p>
      </div>
      <section className="group">
        <div className="balance-row">
          <span>Included hours</span>
          <strong>
            {hours(state.included_seconds)}
            <small> h</small>
          </strong>
        </div>
        <div className="balance-row">
          <span>Purchased hours</span>
          <strong>
            {hours(state.purchased_seconds)}
            <small> h</small>
          </strong>
        </div>
      </section>
      <div className="billing-action">
        <button
          className="button secondary"
          onClick={() =>
            showSheet({
              type: "confirm",
              title: "Add 5 test hours?",
              description:
                "This updates your local sandbox balance. No payment is taken.",
              label: "Add test hours",
              run: () => mutate("add_sandbox_credit"),
            })
          }
        >
          <Plus size={15} />
          Add 5 test hours
        </button>
      </div>
      <details className="disclosure">
        <summary>How hours work</summary>
        <div className="prose">
          <p>Local previews do not use your balance.</p>
          <p>
            For the live service, one host-hour covers 3,600 seconds of
            forwarding to one or more guests. Silence counts. Paused sharing and
            empty rooms do not.
          </p>
          <p>
            When time runs out, forwarding pauses and the session stays open.
          </p>
        </div>
      </details>
      <div className="section-heading spaced">
        <h2>Invoices</h2>
      </div>
      <p className="secondary-text">No invoices. Billing is not connected.</p>
      <details className="disclosure activity-disclosure">
        <summary>Activity history</summary>
        {state.activity.length ? (
          <div className="activity-list">
            {state.activity.map((event) => (
              <div className="activity-row" key={event.id}>
                <div>
                  <strong>{event.title}</strong>
                  <p>{event.detail}</p>
                </div>
                <time dateTime={new Date(event.timestamp * 1000).toISOString()}>
                  {date(event.timestamp)}
                </time>
              </div>
            ))}
          </div>
        ) : (
          <p className="caption">No activity yet.</p>
        )}
      </details>
    </>
  );
}

function SettingsPage({
  state,
  mutate,
  report,
}: {
  state: StudioState;
  mutate: Mutation;
  report: (text: string) => void;
}) {
  const [preferences, setPreferences] = useState<Preferences>(
    state.preferences,
  );
  const [busy, setBusy] = useState(false);
  const [diagnostics, setDiagnostics] = useState<Diagnostics | null>(null);
  useEffect(() => {
    setPreferences(state.preferences);
  }, [state.preferences]);
  return (
    <>
      <div className="page-heading">
        <h1>Settings</h1>
      </div>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            await mutate("update_preferences", preferences);
            report("Settings saved.");
          } catch (error) {
            report((error as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <section className="group settings-group">
          <label className="setting-row">
            <span>Studio name</span>
            <input
              required
              maxLength={60}
              value={preferences.studio_name}
              onChange={(e) =>
                setPreferences({ ...preferences, studio_name: e.target.value })
              }
            />
          </label>
          <label className="setting-row">
            <span>Appearance</span>
            <select
              value={preferences.theme}
              onChange={(e) =>
                setPreferences({
                  ...preferences,
                  theme: e.target.value as "day" | "night",
                })
              }
            >
              <option value="day">Light</option>
              <option value="night">Dark</option>
            </select>
          </label>
        </section>
        <button
          className="button primary save-settings"
          disabled={busy || !preferences.studio_name.trim()}
        >
          {busy && <LoaderCircle size={15} className="spin" />}Save settings
        </button>
        <details className="disclosure">
          <summary>Notification preference</summary>
          <label className="checkbox-field">
            <input
              type="checkbox"
              checked={preferences.notifications}
              onChange={(e) =>
                setPreferences({
                  ...preferences,
                  notifications: e.target.checked,
                })
              }
            />
            <span>Enable notifications</span>
          </label>
          <p className="caption">
            Preference saved locally. Notifications are not sent in this build.
          </p>
        </details>
      </form>
      <div className="section-heading spaced">
        <h2>About</h2>
        <span className="secondary-text">Version 0.1.0</span>
      </div>
      <p className="secondary-text about-copy">
        Auralis Streamer for macOS. Local preview build.
        <br />
        No audio capture or plugins are installed.
      </p>
      <details
        className="disclosure"
        onToggle={(e) => {
          if (e.currentTarget.open && !diagnostics)
            void api<Diagnostics>("get_diagnostics")
              .then(setDiagnostics)
              .catch((e) => report(e.message));
        }}
      >
        <summary>Diagnostics</summary>
        {diagnostics ? (
          <dl className="detail-list">
            {[
              ["Rust service", diagnostics.core],
              ["Platform", `${diagnostics.platform} / ${diagnostics.arch}`],
              ["Electron", diagnostics.electron],
              ["Relay", diagnostics.relay],
              ["Storage", "Local JSON"],
            ].map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="caption">Loading…</p>
        )}
        <button
          className="button secondary"
          onClick={() => {
            void api("open_data_folder").catch((e) => report(e.message));
          }}
        >
          <FolderOpen size={15} />
          Open data folder
        </button>
        <p className="caption">
          Sessions and preferences are saved on this Mac. No audio is recorded.
        </p>
      </details>
    </>
  );
}

export default function App() {
  const [state, setState] = useState<StudioState | null>(null);
  const [page, setPage] = useState<Page>("Sessions");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [toast, setToast] = useState("");
  const [failure, setFailure] = useState("");
  const fetchState = useCallback(
    () =>
      api("get_state")
        .then((next) => {
          setState(next);
          setFailure("");
        })
        .catch((e) => setFailure(e.message)),
    [],
  );
  useEffect(() => {
    void fetchState();
    return window.auralis?.onChange(() => {
      void fetchState();
    });
  }, [fetchState]);
  useEffect(() => {
    if (state) document.documentElement.dataset.theme = state.preferences.theme;
  }, [state?.preferences.theme]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 4000);
    return () => clearTimeout(timer);
  }, [toast]);
  async function mutate(method: string, params: Record<string, unknown> = {}) {
    const next = await api(method, params);
    setState(next);
    if (method === "create_session") {
      setPage("Sessions");
      setSelectedId(next.sessions[0].id);
    }
    if (method === "close_session") setSelectedId(null);
    return next;
  }
  const navigate = (next: Page) => {
    setPage(next);
    setSelectedId(null);
  };
  const create = () => setSheet({ type: "create" });
  if (!state)
    return (
      <main className="boot">
        <img src="./auralis-logo.svg" width="38" alt="Auralis" />
        <h1>{failure ? "Couldn’t open your studio" : "Opening Auralis"}</h1>
        <p>{failure || "Connecting to the local service…"}</p>
        {failure && (
          <button
            className="button primary"
            onClick={() => {
              void fetchState();
            }}
          >
            Try again
          </button>
        )}
      </main>
    );
  const selected = state.sessions.find((session) => session.id === selectedId);
  const navItems: { name: Page; icon: ReactNode }[] = [
    { name: "Sessions", icon: <Headphones size={18} /> },
    { name: "Billing", icon: <CreditCard size={18} /> },
    { name: "Settings", icon: <Settings size={18} /> },
  ];
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <aside className="sidebar">
        <div className="sidebar-drag" />
        <button
          className="brand"
          onClick={() => navigate("Sessions")}
          aria-label="Auralis Streamer home"
        >
          <img src="./auralis-logo.svg" alt="" />
          <span>
            auralis<span>Streamer</span>
          </span>
        </button>
        <nav aria-label="Main navigation">
          {navItems.map((item) => (
            <button
              key={item.name}
              aria-current={page === item.name ? "page" : undefined}
              className={`nav-item ${page === item.name ? "active" : ""}`}
              onClick={() => navigate(item.name)}
            >
              {item.icon}
              <span>{item.name}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <button className="balance-link" onClick={() => navigate("Billing")}>
            <span>
              {hours(state.included_seconds + state.purchased_seconds)} h
              available
            </span>
            <small>Sandbox balance</small>
          </button>
          <span className="alpha-label">Local alpha</span>
        </div>
      </aside>
      <div className="main-shell">
        <header className="toolbar">
          {selected && page === "Sessions" ? (
            <button className="back-button" onClick={() => setSelectedId(null)}>
              <ArrowLeft size={16} />
              Sessions
            </button>
          ) : (
            <span className="toolbar-title">
              {state.preferences.studio_name}
            </span>
          )}
          {page === "Sessions" && state.sessions.length > 0 && !selected && (
            <button className="button primary" onClick={create}>
              <Plus size={16} />
              Create session
            </button>
          )}
        </header>
        <main id="main-content" className="main-content">
          {failure && (
            <div className="inline-error" role="alert">
              <span>{failure}</span>
              <button
                className="text-button"
                onClick={() => {
                  void fetchState();
                }}
              >
                Reconnect
              </button>
            </div>
          )}
          {page === "Sessions" ? (
            selected ? (
              <SessionRoom
                key={selected.id}
                session={selected}
                mutate={mutate}
                showSheet={setSheet}
                report={setToast}
              />
            ) : (
              <SessionList state={state} open={setSelectedId} create={create} />
            )
          ) : page === "Billing" ? (
            <Billing state={state} showSheet={setSheet} mutate={mutate} />
          ) : (
            <SettingsPage state={state} mutate={mutate} report={setToast} />
          )}
        </main>
      </div>
      {sheet && (
        <SessionSheet
          sheet={sheet}
          close={() => setSheet(null)}
          mutate={mutate}
        />
      )}
      {toast && (
        <div className="toast" role="status">
          <Check size={16} />
          <span>{toast}</span>
          <button
            className="icon-button"
            aria-label="Dismiss notification"
            onClick={() => setToast("")}
          >
            <X size={15} />
          </button>
        </div>
      )}
    </div>
  );
}
