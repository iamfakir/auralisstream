const {
  app,
  BrowserWindow,
  ipcMain,
  shell,
  dialog,
  nativeImage,
} = require("electron");
const { join } = require("node:path");
const { randomUUID } = require("node:crypto");
const { Core } = require("./core.cjs");

if (process.env.AURALIS_DATA_DIR)
  app.setPath("userData", process.env.AURALIS_DATA_DIR);
app.setName("Auralis Streamer");
const development = !app.isPackaged && process.env.AURALIS_DEV_URL;
const publisherMethods = new Set([
  "get_state",
  "create_session",
  "rename_session",
  "close_session",
  "set_paused",
  "revoke_link",
  "remove_listener",
  "update_preferences",
  "add_sandbox_credit",
]);
const roles = new Map();
const blockedParticipants = new Set();
let core;
let mainWindow;

function changed() {
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) window.webContents.send("auralis:changed");
  }
}

function createWindow(preview) {
  const window = new BrowserWindow({
    title: preview ? "Auralis — listener preview" : "Auralis Streamer",
    width: preview ? 520 : 1120,
    height: preview ? 680 : 780,
    minWidth: preview ? 360 : 740,
    minHeight: 640,
    backgroundColor: "#FBFBFD",
    titleBarStyle: "hiddenInset",
    trafficLightPosition: { x: 22, y: 20 },
    show: false,
    webPreferences: {
      preload: join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  });
  roles.set(
    window.webContents.id,
    preview
      ? { type: "listener", ...preview, participantId: randomUUID() }
      : { type: "publisher" },
  );
  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  window.webContents.on("will-navigate", (event) => event.preventDefault());
  window.webContents.session.setPermissionRequestHandler(
    (_contents, _permission, callback) => callback(false),
  );
  window.webContents.session.setPermissionCheckHandler(() => false);
  window.once("ready-to-show", () => window.show());
  const query = preview ? { listener: "1" } : {};
  if (development) {
    const url = new URL(development);
    for (const [key, value] of Object.entries(query))
      url.searchParams.set(key, value);
    window.loadURL(url.href);
  } else window.loadFile(join(__dirname, "../dist/index.html"), { query });
  const contentsId = window.webContents.id;
  window.on("closed", () => {
    const role = roles.get(contentsId);
    roles.delete(contentsId);
    if (role?.type === "listener") {
      core
        .call("leave_preview", {
          session_id: role.sessionId,
          participant_id: role.participantId,
        })
        .then(changed)
        .catch(() => {});
      blockedParticipants.delete(role.participantId);
    }
  });
  return window;
}

ipcMain.handle("auralis:invoke", async (event, method, params) => {
  const role = roles.get(event.sender.id);
  if (
    !role ||
    typeof method !== "string" ||
    !params ||
    typeof params !== "object" ||
    Array.isArray(params)
  )
    throw new Error("Invalid request.");
  if (JSON.stringify(params).length > 16_000)
    throw new Error("Request is too large.");
  if (role.type === "listener") {
    if (method === "get_preview") {
      const state = await core.call("get_state");
      const session = state.sessions.find((s) => s.id === role.sessionId);
      if (
        !session ||
        session.status === "closed" ||
        session.token !== role.token
      )
        return { available: false };
      return {
        available: true,
        studio: state.preferences.studio_name,
        name: session.name,
        paused: session.status === "paused",
        joined: session.listeners.some((p) => p.id === role.participantId),
        removed: blockedParticipants.has(role.participantId),
        theme: state.preferences.theme,
      };
    }
    if (method !== "join_preview" && method !== "leave_preview")
      throw new Error("This command is restricted to the host.");
    if (
      method === "join_preview" &&
      blockedParticipants.has(role.participantId)
    )
      throw new Error(
        "The host removed you from this preview. Ask them to open a new invitation.",
      );
    await core.call(method, {
      session_id: role.sessionId,
      token: role.token,
      participant_id: role.participantId,
      name: params.name,
    });
    changed();
    return { ok: true };
  }
  if (method === "open_preview") {
    const state = await core.call("get_state");
    const session = state.sessions.find(
      (s) => s.id === params.session_id && s.status !== "closed",
    );
    if (!session) throw new Error("This session is no longer available.");
    createWindow({ sessionId: session.id, token: session.token });
    return { ok: true };
  }
  if (method === "open_data_folder") {
    await shell.openPath(app.getPath("userData"));
    return { ok: true };
  }
  if (method === "get_diagnostics")
    return {
      version: app.getVersion(),
      electron: process.versions.electron,
      platform: process.platform,
      arch: process.arch,
      core: core.failure ? "disconnected" : "connected",
      dataPath: app.getPath("userData"),
      relay: "not configured",
      mode: "local alpha",
      capture: "not installed",
    };
  if (!publisherMethods.has(method)) throw new Error("Unknown command.");
  const state = await core.call(method, params);
  if (method === "remove_listener")
    blockedParticipants.add(params.participant_id);
  if (method !== "get_state") changed();
  return state;
});

const lock = app.requestSingleInstanceLock();
if (!lock) app.quit();
else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });
  app.whenReady().then(async () => {
    const binary = app.isPackaged
      ? join(process.resourcesPath, "auralis-core")
      : join(__dirname, "../native/target/release/auralis-core");
    core = new Core(binary, join(app.getPath("userData"), "studio.json"));
    try {
      await core.call("get_state");
      mainWindow = createWindow();
      const icon = nativeImage.createFromPath(
        join(__dirname, "../public/app-icon.png"),
      );
      if (!icon.isEmpty() && app.dock) app.dock.setIcon(icon);
      app.on("activate", () => {
        if (!BrowserWindow.getAllWindows().length) mainWindow = createWindow();
      });
    } catch (error) {
      dialog.showErrorBox("Auralis could not start", error.message);
      app.quit();
    }
  });
  app.on("window-all-closed", () => app.quit());
  app.on("before-quit", () => {
    if (core) core.stop();
  });
}
