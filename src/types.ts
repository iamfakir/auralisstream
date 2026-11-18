export type Session = {
  id: string;
  name: string;
  token: string;
  status: "ready" | "paused" | "closed";
  created_at: number;
  updated_at: number;
  listeners: { id: string; name: string; joined_at: number }[];
};
export type Preferences = {
  studio_name: string;
  theme: "day" | "night";
  notifications: boolean;
};
export type StudioState = {
  schema_version: number;
  sessions: Session[];
  preferences: Preferences;
  included_seconds: number;
  purchased_seconds: number;
  activity: { id: string; timestamp: number; title: string; detail: string }[];
};
export type Preview = {
  available: boolean;
  name?: string;
  studio?: string;
  paused?: boolean;
  joined?: boolean;
  removed?: boolean;
  theme?: "day" | "night";
};
export type Diagnostics = {
  version: string;
  electron: string;
  platform: string;
  arch: string;
  core: string;
  dataPath: string;
  relay: string;
  mode: string;
  capture: string;
};
declare global {
  interface Window {
    auralis?: {
      invoke: <T = StudioState>(
        method: string,
        params?: Record<string, unknown>,
      ) => Promise<T>;
      onChange: (callback: () => void) => () => void;
      platform: string;
    };
  }
}
export const api = <T = StudioState>(
  method: string,
  params: Record<string, unknown> = {},
) => {
  if (!window.auralis)
    return Promise.reject(
      new Error("Open the Auralis Streamer desktop app to use this feature."),
    );
  return window.auralis.invoke<T>(method, params);
};
export const hours = (seconds: number) =>
  `${(seconds / 3600).toLocaleString("en-IN", { maximumFractionDigits: 1 })}`;
export const date = (seconds: number) =>
  new Date(seconds * 1000).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
