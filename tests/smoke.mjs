import { _electron as electron } from "playwright";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";

const dataPath = await mkdtemp(join(tmpdir(), "auralis-app-"));
const executablePath = resolve(
  `release/Auralis Streamer-darwin-${process.arch}/Auralis Streamer.app/Contents/MacOS/Auralis Streamer`,
);
await mkdir("artifacts", { recursive: true });
const errors = [];
let application;
let checks = 0;
function check(condition, message) {
  assert.ok(condition, message);
  checks++;
  console.log(`✓ ${message}`);
}
const launch = () =>
  electron.launch({
    executablePath,
    env: { ...process.env, AURALIS_DATA_DIR: dataPath },
    timeout: 30000,
  });
const ready = async (page) => {
  await page.getByRole("navigation", { name: "Main navigation" }).waitFor();
  page.on("pageerror", (e) => errors.push(e.message));
};
const nav = (page, name) =>
  page
    .getByRole("navigation")
    .getByRole("button", { name, exact: true })
    .click();
const state = (page) => page.evaluate(() => window.auralis.invoke("get_state"));
async function menuAction(page, name) {
  await page.getByRole("button", { name: "Session actions" }).click();
  await page.getByRole("button", { name, exact: true }).click();
}
try {
  application = await launch();
  let host = await application.firstWindow();
  await ready(host);
  check(
    await host
      .locator(".sidebar")
      .evaluate((element) =>
        getComputedStyle(element).backdropFilter.includes("blur"),
      ),
    "Sidebar uses a frosted glass backdrop",
  );
  const cdp = await host.context().newCDPSession(host);
  await cdp.send("Emulation.setEmulatedMedia", {
    features: [{ name: "prefers-reduced-transparency", value: "reduce" }],
  });
  check(
    await host
      .locator(".sidebar")
      .evaluate(
        (element) => getComputedStyle(element).backdropFilter === "none",
      ),
    "Reduced transparency replaces blur with a solid surface",
  );
  await cdp.send("Emulation.setEmulatedMedia", { features: [] });
  await cdp.detach();
  await host.screenshot({
    path: "artifacts/sessions-empty-light.png",
    fullPage: true,
  });
  check(
    await host
      .getByRole("heading", { name: "No sessions", exact: true })
      .isVisible(),
    "App opens with a minimal Sessions screen",
  );
  check(
    (await host.getByRole("navigation").getByRole("button").count()) === 3,
    "Navigation contains only Sessions, Billing, and Settings",
  );
  check(
    await host.evaluate(
      () =>
        typeof window.require === "undefined" &&
        typeof window.process === "undefined",
    ),
    "Renderer has no Node.js access",
  );

  await host
    .getByRole("button", { name: "Create session", exact: true })
    .click();
  await host.getByRole("dialog").waitFor();
  check(
    await host.getByRole("dialog").evaluate((element) => {
      const style = getComputedStyle(element);
      return (
        style.backdropFilter.includes("blur") &&
        style.backgroundColor.startsWith("rgba(")
      );
    }),
    "Create session sheet has a translucent glass surface",
  );
  check(
    await host
      .getByLabel("Session name")
      .evaluate((element) => element === document.activeElement),
    "Create session focuses the name field",
  );
  check(
    await host
      .getByRole("dialog")
      .getByRole("button", { name: "Create session", exact: true })
      .isDisabled(),
    "Empty names disable creation",
  );
  await host.getByLabel("Session name").fill("   ");
  check(
    await host
      .getByRole("dialog")
      .getByRole("button", { name: "Create session", exact: true })
      .isDisabled(),
    "Whitespace-only names disable creation",
  );
  check(
    await host.locator(".sheet-details").evaluate((element) => !element.open),
    "Session details stay collapsed by default",
  );
  await host.getByLabel("Session name").press("Escape");
  await host.getByRole("dialog").waitFor({ state: "detached" });
  check(
    (await state(host)).sessions.length === 0,
    "Escape cancels without creating a session",
  );

  await host
    .getByRole("button", { name: "Create session", exact: true })
    .click();
  await host.getByLabel("Session name").fill("  Monsoon mix review  ");
  await host.screenshot({
    path: "artifacts/create-session-sheet.png",
    fullPage: true,
  });
  await host.getByLabel("Session name").press("Enter");
  await host
    .getByRole("heading", { name: "Monsoon mix review", exact: true })
    .waitFor();
  check(
    (await state(host)).sessions[0].name === "Monsoon mix review",
    "Enter creates the session, trims its name, and opens it directly",
  );
  check(
    await host
      .getByRole("heading", { name: "Monsoon mix review", exact: true })
      .evaluate((element) => element === document.activeElement),
    "Focus moves to the new session heading",
  );
  check(
    await host.getByText("Not connected", { exact: true }).isVisible(),
    "Session shows honest source status",
  );
  check(
    await host
      .getByText(
        "DAW capture and remote sharing are not available in this build.",
        { exact: true },
      )
      .isVisible(),
    "Remote sharing is explicitly unavailable",
  );
  await host.screenshot({
    path: "artifacts/session-room-light.png",
    fullPage: true,
  });

  const guestPromise = application.waitForEvent("window");
  await host
    .getByRole("button", { name: "Preview listener", exact: true })
    .click();
  const guest = await guestPromise;
  guest.on("pageerror", (e) => errors.push(e.message));
  await guest.getByLabel("Your name").fill("Meera");
  await guest.getByRole("button", { name: "Listen", exact: true }).click();
  await host
    .locator(".listener-row")
    .getByText("Meera", { exact: true })
    .waitFor();
  await guest.getByRole("button", { name: "Play quiet test tone" }).waitFor();
  check(true, "Guest joins without an account and appears in the host view");
  await guest.getByRole("button", { name: "Play quiet test tone" }).click();
  await guest.getByText("220 Hz test tone. No DAW audio.").waitFor();
  check(true, "Test playback clearly identifies its local audio source");
  await guest.getByRole("button", { name: "Mute test tone" }).click();
  check(
    (await guest
      .getByRole("slider", { name: "Playback volume" })
      .inputValue()) === "0",
    "Guest mute sets playback volume to zero",
  );
  await guest.getByRole("button", { name: "Stop test tone" }).click();
  check(
    await guest.evaluate(async () => {
      try {
        await window.auralis.invoke("create_session", { name: "Forbidden" });
        return false;
      } catch {
        return true;
      }
    }),
    "Guest windows cannot execute host commands",
  );
  await guest.screenshot({
    path: "artifacts/listener-light.png",
    fullPage: true,
  });
  const guestWindow = await application.browserWindow(guest);
  await guestWindow.evaluate((window) => window.setContentSize(390, 700));
  check(
    await guest.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    "Guest layout fits a mobile-width window",
  );
  await guest.screenshot({
    path: "artifacts/listener-mobile.png",
    fullPage: true,
  });

  await host
    .getByRole("button", { name: "Pause preview", exact: true })
    .click();
  await guest.getByText("The host paused this preview.").waitFor();
  check(
    await guest
      .getByRole("button", { name: "Play quiet test tone" })
      .isDisabled(),
    "Host pause prevents guest playback",
  );
  await host
    .getByRole("button", { name: "Resume preview", exact: true })
    .click();
  await guest
    .getByText("The host paused this preview.")
    .waitFor({ state: "detached" });
  check(
    await guest
      .getByRole("button", { name: "Play quiet test tone" })
      .isEnabled(),
    "Host resume enables playback again",
  );
  await menuAction(host, "Rename session");
  await host.getByLabel("Session name").fill("Monsoon final review");
  await host.getByRole("button", { name: "Save name", exact: true }).click();
  await guest
    .getByRole("heading", { name: "Monsoon final review", exact: true })
    .waitFor();
  check(true, "Renaming propagates to the listener window");

  await host.getByRole("button", { name: "Remove Meera", exact: true }).click();
  await host
    .getByRole("dialog")
    .getByRole("button", { name: "Remove guest", exact: true })
    .click();
  await guest
    .getByRole("alert")
    .filter({ hasText: "The host removed you" })
    .waitFor();
  check(
    (await guest
      .getByRole("button", { name: "Play quiet test tone" })
      .count()) === 0,
    "Removing a guest disconnects their preview",
  );
  await guest.close();
  const nextGuestPromise = application.waitForEvent("window");
  await host
    .getByRole("button", { name: "Preview listener", exact: true })
    .click();
  const nextGuest = await nextGuestPromise;
  await nextGuest.getByLabel("Your name").fill("Arjun");
  await nextGuest.getByRole("button", { name: "Listen", exact: true }).click();
  await host
    .locator(".listener-row")
    .getByText("Arjun", { exact: true })
    .waitFor();
  await menuAction(host, "Revoke preview access");
  await host
    .getByRole("dialog")
    .getByRole("button", { name: "Revoke access", exact: true })
    .click();
  await nextGuest
    .getByRole("heading", { name: "Session unavailable", exact: true })
    .waitFor();
  check(true, "Revocation invalidates an open invitation");
  await nextGuest.close();

  await host.locator(".back-button").click();
  await host.getByRole("heading", { name: "Sessions", exact: true }).waitFor();
  await host
    .getByRole("button", { name: "Create session", exact: true })
    .click();
  await host.getByLabel("Session name").fill("Second session");
  await host.getByLabel("Session name").press("Enter");
  await host
    .getByRole("heading", { name: "Second session", exact: true })
    .waitFor();
  check(
    (await state(host)).sessions.length === 2,
    "Creating another session opens the new one, not the previously selected one",
  );
  await menuAction(host, "Close session");
  await host
    .getByRole("dialog")
    .getByRole("button", { name: "Close session", exact: true })
    .click();
  await host.getByRole("heading", { name: "Sessions", exact: true }).waitFor();
  await host.getByRole("textbox", { name: "Search sessions" }).fill("no match");
  await host
    .getByRole("heading", { name: "No matching sessions", exact: true })
    .waitFor();
  await host.getByRole("textbox", { name: "Search sessions" }).fill("Monsoon");
  check(
    (await host.locator(".session-list-row").count()) === 1,
    "Search filters the session list",
  );
  await host.screenshot({
    path: "artifacts/sessions-list-light.png",
    fullPage: true,
  });

  await nav(host, "Billing");
  await host
    .getByRole("button", { name: "Add 5 test hours", exact: true })
    .click();
  await host
    .getByRole("dialog")
    .getByRole("button", { name: "Add test hours", exact: true })
    .click();
  const credits = await state(host);
  check(
    credits.purchased_seconds === 18000 && credits.included_seconds === 36000,
    "Sandbox top-up keeps included and purchased balances separate",
  );
  await host.screenshot({
    path: "artifacts/billing-light.png",
    fullPage: true,
  });
  await nav(host, "Settings");
  check(
    (await host.getByText("Rust service", { exact: true }).count()) === 0,
    "Diagnostics stay hidden until requested",
  );
  await host
    .getByRole("textbox", { name: "Studio name" })
    .fill("Chennai Studio");
  await host
    .getByRole("combobox", { name: "Appearance" })
    .selectOption("night");
  await host
    .getByRole("button", { name: "Save settings", exact: true })
    .click();
  await host.waitForFunction(
    () => document.documentElement.dataset.theme === "night",
  );
  check(true, "Settings save and apply dark appearance");
  await host.getByText("Diagnostics", { exact: true }).click();
  await host.getByText("Rust service", { exact: true }).waitFor();
  check(
    await host.getByText("connected", { exact: true }).isVisible(),
    "Diagnostics load on demand",
  );
  await host.screenshot({
    path: "artifacts/settings-dark.png",
    fullPage: true,
  });
  await nav(host, "Sessions");
  await host
    .locator(".session-list-row")
    .filter({ hasText: "Monsoon final review" })
    .click();
  await host
    .getByRole("heading", { name: "Monsoon final review", exact: true })
    .waitFor();
  if (
    await host.getByRole("button", { name: "Dismiss notification" }).isVisible()
  )
    await host.getByRole("button", { name: "Dismiss notification" }).click();
  await host.screenshot({
    path: "artifacts/session-room-dark.png",
    fullPage: true,
  });
  const hostWindow = await application.browserWindow(host);
  await hostWindow.evaluate((window) => window.setContentSize(780, 780));
  check(
    await host.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
    "Compact desktop layout has no horizontal overflow",
  );
  await host.screenshot({
    path: "artifacts/session-room-compact.png",
    fullPage: true,
  });

  const wireframePromise = application.waitForEvent("window");
  await application.evaluate(({ BrowserWindow }, path) => {
    const window = new BrowserWindow({
      width: 1480,
      height: 930,
      show: false,
      webPreferences: {
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
      },
    });
    void window.loadFile(path);
  }, resolve("docs/create-session-wireframe.html"));
  const wireframe = await wireframePromise;
  await wireframe
    .getByRole("heading", { name: "Create session", exact: true })
    .waitFor();
  await wireframe.screenshot({
    path: "docs/create-session-wireframe.png",
    fullPage: true,
  });
  await wireframe.locator("#start").click();
  await wireframe.getByLabel("Session name").fill("Wireframe check");
  await wireframe.getByLabel("Session name").press("Enter");
  await wireframe
    .locator("#room-name")
    .filter({ hasText: "Wireframe check" })
    .waitFor();
  await wireframe.locator("#pause").click();
  check(
    await wireframe.locator("#preview").isDisabled(),
    "Interactive wireframe supports creation and preview pause",
  );
  await wireframe.close();

  await application.close();
  application = await launch();
  host = await application.firstWindow();
  await ready(host);
  await host.waitForFunction(
    () => document.documentElement.dataset.theme === "night",
  );
  const restored = await state(host);
  check(
    restored.preferences.studio_name === "Chennai Studio" &&
      restored.sessions.some((s) => s.name === "Monsoon final review") &&
      restored.purchased_seconds === 18000,
    "Restart preserves sessions, credits, studio name, and appearance",
  );
  check(
    restored.sessions.every((s) => s.listeners.length === 0),
    "Restart clears stale guest presence",
  );
  await host
    .locator(".session-list-row")
    .filter({ hasText: "Monsoon final review" })
    .click();
  await menuAction(host, "Close session");
  await host
    .getByRole("dialog")
    .getByRole("button", { name: "Close session", exact: true })
    .click();
  await host.getByRole("heading", { name: "Sessions", exact: true }).waitFor();
  await host.getByRole("button", { name: "Closed", exact: true }).click();
  check(
    (await host.locator(".session-list-row").count()) === 2,
    "Closed sessions remain in history",
  );
  await host
    .locator(".session-list-row")
    .filter({ hasText: "Monsoon final review" })
    .click();
  check(
    await host
      .getByText("This session is closed.", { exact: true })
      .isVisible(),
    "Closed session details remain inspectable",
  );
  check(
    errors.length === 0,
    `No renderer errors (${errors.join("; ") || "clean"})`,
  );
  console.log(
    `\n${checks} packaged-app checks passed. Screenshots: artifacts/`,
  );
} catch (error) {
  if (application)
    for (const [i, page] of (await application.windows()).entries())
      await page
        .screenshot({ path: `artifacts/failure-${i}.png`, fullPage: true })
        .catch(() => {});
  throw error;
} finally {
  if (application) await application.close().catch(() => {});
  await rm(dataPath, { recursive: true, force: true });
}
