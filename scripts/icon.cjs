const { app, BrowserWindow } = require("electron");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
app.disableHardwareAcceleration();
app
  .whenReady()
  .then(async () => {
    const svg = fs
      .readFileSync(path.resolve("public/auralis-logo.svg"), "utf8")
      .replace(/<\?xml[^>]*>|<!DOCTYPE[^>]*>/g, "");
    const window = new BrowserWindow({
      width: 1024,
      height: 1024,
      show: false,
      transparent: true,
      frame: false,
      webPreferences: {
        offscreen: true,
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
      },
    });
    await window.loadURL(
      "data:text/html;charset=utf-8," +
        encodeURIComponent(
          `<html><body style="margin:0;background:transparent"><div style="width:1024px;height:1024px;background:#ECEEE3;border-radius:228px;display:flex;justify-content:center;align-items:center;box-sizing:border-box;border:1px solid #1D126E22"><div style="width:640px;height:590px">${svg}</div></div></body></html>`,
        ),
    );
    await window.webContents.executeJavaScript(
      "new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))",
    );
    const image = await window.webContents.capturePage();
    fs.writeFileSync("public/app-icon.png", image.toPNG());
    if (process.platform === "darwin") {
      const folder = path.resolve("artifacts/app.iconset");
      fs.mkdirSync(folder, { recursive: true });
      for (const size of [16, 32, 128, 256, 512]) {
        for (const scale of [1, 2]) {
          const name = `icon_${size}x${size}${scale === 2 ? "@2x" : ""}.png`;
          fs.writeFileSync(
            path.join(folder, name),
            image.resize({ width: size * scale, height: size * scale }).toPNG(),
          );
        }
      }
      execFileSync("iconutil", [
        "-c",
        "icns",
        folder,
        "-o",
        path.resolve("public/app-icon.icns"),
      ]);
    }
    console.log("Auralis app icon generated from the original logo.");
    app.quit();
  })
  .catch((error) => {
    console.error(error);
    app.exit(1);
  });
