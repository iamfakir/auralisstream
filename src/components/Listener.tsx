import { useCallback, useEffect, useRef, useState } from "react";
import {
  Headphones,
  LoaderCircle,
  Pause,
  Play,
  Volume2,
  VolumeX,
} from "lucide-react";
import { api, type Preview } from "../types";

export default function Listener() {
  const [preview, setPreview] = useState<Preview | null>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [volume, setVolume] = useState(35);
  const [tone, setTone] = useState(false);
  const audio = useRef<{ context: AudioContext; gain: GainNode } | null>(null);
  const fetchPreview = useCallback(
    () =>
      api<Preview>("get_preview")
        .then((next) => {
          setPreview(next);
          setError("");
        })
        .catch((e) => {
          setError(e.message);
          setPreview(null);
        }),
    [],
  );
  useEffect(() => {
    void fetchPreview();
    return window.auralis?.onChange(() => {
      void fetchPreview();
    });
  }, [fetchPreview]);
  useEffect(() => {
    if (preview?.theme) document.documentElement.dataset.theme = preview.theme;
  }, [preview?.theme]);
  const canHear =
    !!preview?.available &&
    !!preview.joined &&
    !preview.paused &&
    !preview.removed;
  useEffect(() => {
    if (!canHear) setTone(false);
  }, [canHear]);
  useEffect(() => {
    if (!tone || !canHear) return;
    const context = new AudioContext({ sampleRate: 48000 });
    const oscillator = context.createOscillator();
    oscillator.frequency.value = 220;
    const gain = context.createGain();
    gain.gain.value = (volume / 100) * 0.025;
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    audio.current = { context, gain };
    void context.resume().catch((e) => {
      setError(e.message);
      setTone(false);
    });
    return () => {
      oscillator.stop();
      oscillator.disconnect();
      gain.disconnect();
      void context.close();
      audio.current = null;
    };
  }, [tone, canHear]);
  useEffect(() => {
    audio.current?.gain.gain.setTargetAtTime(
      (volume / 100) * 0.025,
      audio.current.context.currentTime,
      0.03,
    );
  }, [volume]);
  async function join() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await api("join_preview", { name: name.trim() });
      await fetchPreview();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function leave() {
    setTone(false);
    setError("");
    setBusy(true);
    try {
      await api("leave_preview");
      await fetchPreview();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="listener-app">
      <header className="listener-toolbar">
        <img src="./auralis-logo.svg" alt="Auralis" />
        <span>Listener preview</span>
      </header>
      <div className="listener-content">
        <span className="listener-symbol">
          <Headphones size={30} strokeWidth={1.4} />
        </span>
        <h1>
          {preview?.available
            ? preview.name
            : preview
              ? "Session unavailable"
              : error
                ? "Connection interrupted"
                : "Connecting…"}
        </h1>
        <p className="listener-studio">
          {preview?.available
            ? preview.studio
            : preview
              ? "Ask the host to open a new preview."
              : error
                ? "Close this window and ask the host to open a new preview."
                : "Connecting to the local companion."}
        </p>
        {preview?.available && !preview.removed && (
          <section className="listener-controls">
            {preview.paused && (
              <p className="pause-notice" role="status">
                The host paused this preview.
              </p>
            )}
            {!preview.joined ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void join();
                }}
              >
                <label className="field">
                  Your name
                  <input
                    required
                    autoFocus
                    maxLength={50}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Display name"
                    autoComplete="given-name"
                  />
                </label>
                <button
                  className="button primary listen-button"
                  disabled={busy || !name.trim() || preview.paused}
                >
                  {busy ? (
                    <LoaderCircle size={16} className="spin" />
                  ) : (
                    <Play size={16} />
                  )}
                  Listen
                </button>
                <p className="caption">No account required.</p>
              </form>
            ) : (
              <>
                <p className="connection-label">
                  <i />
                  Connected to local preview
                </p>
                <div className="volume-control">
                  <button
                    className="icon-button"
                    aria-label={volume ? "Mute test tone" : "Unmute test tone"}
                    onClick={() => setVolume(volume ? 0 : 35)}
                  >
                    {volume ? <Volume2 size={19} /> : <VolumeX size={19} />}
                  </button>
                  <input
                    aria-label="Playback volume"
                    type="range"
                    min="0"
                    max="100"
                    value={volume}
                    onChange={(e) => setVolume(Number(e.target.value))}
                  />
                  <span>{volume}%</span>
                </div>
                <button
                  className="button secondary listen-button"
                  disabled={preview.paused}
                  aria-pressed={tone}
                  onClick={() => setTone(!tone)}
                >
                  {tone ? <Pause size={16} /> : <Play size={16} />}
                  {tone ? "Stop test tone" : "Play quiet test tone"}
                </button>
                {tone && (
                  <p className="caption tone-label">
                    220 Hz test tone. No DAW audio.
                  </p>
                )}
                <button
                  className="text-button leave-preview"
                  disabled={busy}
                  onClick={() => {
                    void leave();
                  }}
                >
                  Leave preview
                </button>
              </>
            )}
          </section>
        )}
        {preview?.removed && (
          <p className="error" role="alert">
            The host removed you from this preview. Ask for a new invitation.
          </p>
        )}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <p className="listener-footnote">
          Local preview. No DAW audio or hour charges.
        </p>
      </div>
    </main>
  );
}
