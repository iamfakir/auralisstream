import { packager } from "@electron/packager";
import { resolve } from "node:path";
const paths = await packager({
  dir: ".",
  out: "release",
  name: "Auralis Streamer",
  appBundleId: "com.auralis.streamer",
  appCategoryType: "public.app-category.music",
  appVersion: "0.1.0",
  platform: process.platform,
  arch: process.arch,
  icon: "public/app-icon.icns",
  overwrite: true,
  asar: true,
  extraResource: [resolve("native/target/release/auralis-core")],
  ignore: [
    /^\/node_modules/,
    /^\/native/,
    /^\/src/,
    /^\/scripts/,
    /^\/tests/,
    /^\/artifacts/,
    /^\/.git(?:\/|$)/,
    /^\/.openai/,
    /^\/.agents/,
    /skills-lock\.json/,
    /^\/release/,
    /tsconfig\.json/,
    /vite\.config\.ts/,
    /package-lock\.json/,
  ],
  prune: true,
});
console.log(paths.join("\n"));
