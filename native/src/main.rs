use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use std::fs::{self, OpenOptions};
use std::io::{self, BufRead, Read, Write};
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};
use uuid::Uuid;

const SCHEMA_VERSION: u32 = 1;
const MAX_SESSIONS: usize = 200;

#[derive(Clone, Serialize, Deserialize)]
struct Session {
    id: String,
    name: String,
    token: String,
    status: String,
    created_at: u64,
    updated_at: u64,
    #[serde(default)]
    listeners: Vec<Participant>,
}

#[derive(Clone, Serialize, Deserialize)]
struct Participant {
    id: String,
    name: String,
    joined_at: u64,
}

#[derive(Clone, Serialize, Deserialize)]
struct Preferences {
    studio_name: String,
    theme: String,
    notifications: bool,
}

#[derive(Clone, Serialize, Deserialize)]
struct Activity {
    id: String,
    timestamp: u64,
    title: String,
    detail: String,
}

#[derive(Clone, Serialize, Deserialize)]
struct State {
    schema_version: u32,
    sessions: Vec<Session>,
    preferences: Preferences,
    included_seconds: u64,
    purchased_seconds: u64,
    activity: Vec<Activity>,
}

impl Default for State {
    fn default() -> Self {
        Self {
            schema_version: SCHEMA_VERSION,
            sessions: vec![],
            preferences: Preferences {
                studio_name: "My studio".into(),
                theme: "day".into(),
                notifications: true,
            },
            included_seconds: 36_000,
            purchased_seconds: 0,
            activity: vec![],
        }
    }
}

fn now() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}

fn id() -> String {
    Uuid::new_v4().to_string()
}

fn text(params: &Value, field: &str, max: usize) -> Result<String, String> {
    let value = params
        .get(field)
        .and_then(Value::as_str)
        .unwrap_or("")
        .trim();
    if value.is_empty() || value.chars().count() > max || value.chars().any(char::is_control) {
        return Err(format!(
            "{field} must contain 1–{max} characters without control characters."
        ));
    }
    Ok(value.into())
}

impl State {
    fn log(&mut self, title: &str, detail: &str) {
        self.activity.insert(
            0,
            Activity {
                id: id(),
                timestamp: now(),
                title: title.into(),
                detail: detail.into(),
            },
        );
        self.activity.truncate(200);
    }

    fn session(&mut self, params: &Value) -> Result<&mut Session, String> {
        let session_id = text(params, "session_id", 36)?;
        self.sessions
            .iter_mut()
            .find(|s| s.id == session_id)
            .ok_or("Session not found.".into())
    }

    fn apply(&mut self, method: &str, params: &Value) -> Result<(), String> {
        match method {
            "create_session" => {
                let name = text(params, "name", 80)?;
                if self.sessions.len() >= MAX_SESSIONS {
                    return Err("This alpha supports up to 200 saved sessions.".into());
                }
                self.sessions.insert(
                    0,
                    Session {
                        id: id(),
                        name: name.clone(),
                        token: id(),
                        status: "ready".into(),
                        created_at: now(),
                        updated_at: now(),
                        listeners: vec![],
                    },
                );
                self.log("Session created", &name);
            }
            "rename_session" => {
                let name = text(params, "name", 80)?;
                let session = self.session(params)?;
                if session.status == "closed" {
                    return Err("Closed sessions cannot be renamed.".into());
                }
                session.name = name.clone();
                session.updated_at = now();
                self.log("Session renamed", &name);
            }
            "close_session" => {
                let session = self.session(params)?;
                if session.status == "closed" {
                    return Err("This session is already closed.".into());
                }
                session.status = "closed".into();
                session.listeners.clear();
                session.updated_at = now();
                let name = session.name.clone();
                self.log("Session closed", &name);
            }
            "set_paused" => {
                let paused = params
                    .get("paused")
                    .and_then(Value::as_bool)
                    .ok_or("A pause state is required.")?;
                let session = self.session(params)?;
                if session.status == "closed" {
                    return Err("This session is closed.".into());
                }
                session.status = if paused { "paused" } else { "ready" }.into();
                session.updated_at = now();
                let name = session.name.clone();
                self.log(
                    if paused {
                        "Preview paused"
                    } else {
                        "Preview resumed"
                    },
                    &name,
                );
            }
            "revoke_link" => {
                let session = self.session(params)?;
                if session.status == "closed" {
                    return Err("This session is closed.".into());
                }
                session.token = id();
                session.listeners.clear();
                session.updated_at = now();
                let name = session.name.clone();
                self.log("Preview access revoked", &name);
            }
            "join_preview" => {
                let name = text(params, "name", 50)?;
                let token = text(params, "token", 36)?;
                let participant_id = text(params, "participant_id", 36)?;
                let session = self.session(params)?;
                if session.status == "closed" || session.token != token {
                    return Err(
                        "This invitation is no longer available. Ask the host for a new preview."
                            .into(),
                    );
                }
                if session.status == "paused" {
                    return Err(
                        "The host has paused this preview. Try again when it resumes.".into(),
                    );
                }
                if session.listeners.iter().any(|p| p.id == participant_id) {
                    return Ok(());
                }
                if session.listeners.len() >= 5 {
                    return Err("This preview is full (5 guests).".into());
                }
                session.listeners.push(Participant {
                    id: participant_id,
                    name: name.clone(),
                    joined_at: now(),
                });
                self.log("Guest joined preview", &name);
            }
            "leave_preview" | "remove_listener" => {
                let participant_id = text(params, "participant_id", 36)?;
                let session = self.session(params)?;
                session.listeners.retain(|p| p.id != participant_id);
            }
            "update_preferences" => {
                let studio_name = text(params, "studio_name", 60)?;
                let theme = text(params, "theme", 5)?;
                if theme != "day" && theme != "night" {
                    return Err("Choose day or night theme.".into());
                }
                let notifications = params
                    .get("notifications")
                    .and_then(Value::as_bool)
                    .ok_or("Notification preference is required.")?;
                self.preferences = Preferences {
                    studio_name,
                    theme,
                    notifications,
                };
            }
            "add_sandbox_credit" => {
                // Sandbox credits never represent a payment or production entitlement.
                self.purchased_seconds = self.purchased_seconds.saturating_add(18_000);
                self.log("Sandbox top-up added", "5 test hours · no payment taken");
            }
            _ => return Err("Unknown command.".into()),
        }
        Ok(())
    }
}

fn load(path: &Path) -> Result<State, String> {
    if !path.exists() {
        return Ok(State::default());
    }
    let bytes = fs::read(path).map_err(|e| format!("Cannot read saved state: {e}"))?;
    let mut state: State = serde_json::from_slice(&bytes)
        .map_err(|e| format!("Saved state is invalid; it has not been overwritten: {e}"))?;
    if state.schema_version != SCHEMA_VERSION {
        return Err("Unsupported saved-state version. Your data has not been changed.".into());
    }
    for session in &mut state.sessions {
        session.listeners.clear();
    }
    Ok(state)
}

fn save(path: &Path, state: &State) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let temp = path.with_extension(format!("{}.tmp", id()));
    let result = (|| -> Result<(), String> {
        let mut options = OpenOptions::new();
        options.write(true).create_new(true);
        #[cfg(unix)]
        {
            use std::os::unix::fs::OpenOptionsExt;
            options.mode(0o600);
        }
        let mut file = options.open(&temp).map_err(|e| e.to_string())?;
        file.write_all(&serde_json::to_vec_pretty(state).map_err(|e| e.to_string())?)
            .map_err(|e| e.to_string())?;
        file.sync_all().map_err(|e| e.to_string())?;
        fs::rename(&temp, path).map_err(|e| e.to_string())?;
        Ok(())
    })();
    if result.is_err() {
        let _ = fs::remove_file(&temp);
    }
    result
}

fn main() {
    let Some(path) = std::env::args().nth(1).map(PathBuf::from) else {
        eprintln!("Usage: auralis-core <state-file>");
        std::process::exit(1);
    };
    let mut state = match load(&path) {
        Ok(state) => state,
        Err(error) => {
            eprintln!("{error}");
            std::process::exit(1);
        }
    };
    let stdin = io::stdin();
    let mut input = stdin.lock();
    let mut stdout = io::stdout().lock();
    loop {
        let mut line = String::new();
        let read = input.by_ref().take(65_537).read_line(&mut line);
        match read {
            Ok(0) => break,
            Ok(_) if line.len() > 65_536 || !line.ends_with('\n') => {
                eprintln!("IPC request exceeds the size limit or is incomplete.");
                break;
            }
            Err(_) => break,
            _ => {}
        }
        let response = match serde_json::from_str::<Value>(&line) {
            Err(_) => json!({"id": null, "ok": false, "error": "Invalid JSON request."}),
            Ok(request) => {
                let request_id = request.get("id").cloned().unwrap_or(Value::Null);
                let method = request.get("method").and_then(Value::as_str).unwrap_or("");
                let params = request.get("params").cloned().unwrap_or(json!({}));
                let result = if method == "get_state" {
                    Ok(())
                } else {
                    let mut next = state.clone();
                    next.apply(method, &params).and_then(|()| {
                        save(&path, &next)?;
                        state = next;
                        Ok(())
                    })
                };
                match result {
                    Ok(()) => json!({"id": request_id, "ok": true, "data": state}),
                    Err(error) => json!({"id": request_id, "ok": false, "error": error}),
                }
            }
        };
        if writeln!(stdout, "{response}")
            .and_then(|()| stdout.flush())
            .is_err()
        {
            break;
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    fn session(state: &mut State) -> (String, String) {
        state
            .apply("create_session", &json!({"name": "Mix review"}))
            .unwrap();
        (
            state.sessions[0].id.clone(),
            state.sessions[0].token.clone(),
        )
    }
    #[test]
    fn validates_names_and_unknown_commands() {
        let mut state = State::default();
        for name in ["", "  ", "a\nb"] {
            assert!(
                state
                    .apply("create_session", &json!({"name": name}))
                    .is_err()
            );
        }
        assert!(
            state
                .apply("create_session", &json!({"name": "a".repeat(81)}))
                .is_err()
        );
        assert!(state.apply("pay", &json!({})).is_err());
        assert!(state.sessions.is_empty());
    }
    #[test]
    fn revoking_access_invalidates_old_tokens_and_removes_guests() {
        let mut state = State::default();
        let (sid, token) = session(&mut state);
        let join =
            json!({"session_id": sid, "token": token, "name": "Artist", "participant_id": id()});
        state.apply("join_preview", &join).unwrap();
        assert_eq!(state.sessions[0].listeners.len(), 1);
        state
            .apply("revoke_link", &json!({"session_id": sid}))
            .unwrap();
        assert!(state.sessions[0].listeners.is_empty());
        assert!(state.apply("join_preview", &join).is_err());
    }
    #[test]
    fn closed_and_paused_sessions_reject_joins() {
        let mut state = State::default();
        let (sid, token) = session(&mut state);
        let join =
            json!({"session_id": sid, "token": token, "name": "Artist", "participant_id": id()});
        state
            .apply("set_paused", &json!({"session_id": sid, "paused": true}))
            .unwrap();
        assert!(state.apply("join_preview", &join).is_err());
        state
            .apply("close_session", &json!({"session_id": sid}))
            .unwrap();
        assert!(state.apply("join_preview", &join).is_err());
        assert!(
            state
                .apply("set_paused", &json!({"session_id": sid, "paused": false}))
                .is_err()
        );
    }
    #[test]
    fn preview_is_idempotent_and_never_debits_hours() {
        let mut state = State::default();
        let (sid, token) = session(&mut state);
        let join =
            json!({"session_id": sid, "token": token, "name": "Artist", "participant_id": id()});
        state.apply("join_preview", &join).unwrap();
        state.apply("join_preview", &join).unwrap();
        assert_eq!(state.sessions[0].listeners.len(), 1);
        assert_eq!(state.included_seconds, 36_000);
        assert_eq!(state.purchased_seconds, 0);
        state.apply("add_sandbox_credit", &json!({})).unwrap();
        assert_eq!(state.purchased_seconds, 18_000);
    }
    #[test]
    fn limits_preview_to_five_guests() {
        let mut state = State::default();
        let (sid, token) = session(&mut state);
        for _ in 0..5 {
            state.apply("join_preview", &json!({"session_id": sid, "token": token, "name": "Guest", "participant_id": id()})).unwrap();
        }
        assert!(state.apply("join_preview", &json!({"session_id": sid, "token": token, "name": "Guest", "participant_id": id()})).is_err());
    }
    #[test]
    fn persistence_roundtrip_and_corrupt_file_protection() {
        let path = std::env::temp_dir().join(format!("auralis-test-{}.json", id()));
        let mut state = State::default();
        let (sid, token) = session(&mut state);
        state.apply("join_preview", &json!({"session_id": sid, "token": token, "name": "Guest", "participant_id": id()})).unwrap();
        save(&path, &state).unwrap();
        let restored = load(&path).unwrap();
        assert_eq!(restored.sessions[0].name, "Mix review");
        assert!(restored.sessions[0].listeners.is_empty());
        fs::write(&path, b"broken").unwrap();
        assert!(load(&path).is_err());
        assert_eq!(fs::read(&path).unwrap(), b"broken");
        fs::remove_file(path).unwrap();
    }
}
