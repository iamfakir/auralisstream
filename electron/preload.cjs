const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("auralis", {
  invoke: (method, params = {}) =>
    ipcRenderer.invoke("auralis:invoke", method, params),
  onChange: (callback) => {
    const handler = () => callback();
    ipcRenderer.on("auralis:changed", handler);
    return () => ipcRenderer.removeListener("auralis:changed", handler);
  },
  platform: process.platform,
});
