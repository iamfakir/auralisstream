const { test } = require("node:test");
const assert = require("node:assert/strict");
const { mkdtemp, readFile, rm } = require("node:fs/promises");
const { tmpdir } = require("node:os");
const { join, resolve } = require("node:path");
const { Core } = require("../electron/core.cjs");
const binary = resolve("native/target/debug/auralis-core");

test("Rust bridge persists mutations and rejects invalid input without changing data", async () => {
  const dir = await mkdtemp(join(tmpdir(), "auralis-core-"));
  const statePath = join(dir, "studio.json");
  const core = new Core(binary, statePath);
  try {
    const initial = await core.call("get_state");
    assert.equal(initial.sessions.length, 0);
    const state = await core.call("create_session", { name: "A real session" });
    assert.equal(state.sessions[0].name, "A real session");
    const before = await readFile(statePath, "utf8");
    await assert.rejects(
      core.call("create_session", { name: "  " }),
      /name must contain/,
    );
    assert.equal(await readFile(statePath, "utf8"), before);
    const pending = Array.from({ length: 5 }, () => core.call("get_state"));
    for (const result of await Promise.all(pending))
      assert.equal(result.sessions.length, 1);
    assert.equal((await core.call("get_state")).included_seconds, 36000);
  } finally {
    core.stop();
    await rm(dir, { recursive: true, force: true });
  }
});

test("Rust service failure rejects pending and subsequent requests", async () => {
  const dir = await mkdtemp(join(tmpdir(), "auralis-core-"));
  const core = new Core(binary, join(dir, "studio.json"));
  try {
    await core.call("get_state");
    const exit = new Promise((resolve) => core.child.once("exit", resolve));
    core.stop();
    await exit;
    await assert.rejects(core.call("get_state"), /service stopped/);
    assert.equal(core.pending.size, 0);
  } finally {
    core.stop();
    await rm(dir, { recursive: true, force: true });
  }
});
