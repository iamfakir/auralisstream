import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "vite";

const build = spawn(
  "cargo",
  ["build", "--release", "--manifest-path", "native/Cargo.toml"],
  { stdio: "inherit" },
);
const [code] = await once(build, "exit");
if (code) process.exit(code);

// Await our own server so an occupied port cannot load another app into Electron.
const server = await createServer();
await server.listen();
server.printUrls();
const electron = spawn("node_modules/.bin/electron", ["."], {
  stdio: "inherit",
  env: { ...process.env, AURALIS_DEV_URL: "http://127.0.0.1:5173" },
});
const cleanup = () => { electron.kill(); void server.close(); };
process.on("SIGINT", cleanup);
process.on("SIGTERM", cleanup);
electron.on("error", error => { console.error(error); cleanup(); process.exitCode = 1; });
electron.on("exit", () => { void server.close(); });
