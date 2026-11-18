const { spawn } = require("node:child_process");
const { createInterface } = require("node:readline");

class Core {
  constructor(binary, statePath) {
    this.pending = new Map();
    this.sequence = 0;
    this.failure = null;
    this.child = spawn(binary, [statePath], {
      stdio: ["pipe", "pipe", "pipe"],
    });
    let diagnostics = "";
    this.child.stderr.on("data", (data) => {
      diagnostics = (diagnostics + data).slice(-4000);
    });
    createInterface({ input: this.child.stdout }).on("line", (line) => {
      let response;
      try {
        response = JSON.parse(line);
      } catch {
        this.fail(new Error("The Rust service returned an invalid response."));
        return;
      }
      const pending = this.pending.get(response.id);
      if (!pending) return;
      this.pending.delete(response.id);
      clearTimeout(pending.timer);
      response.ok
        ? pending.resolve(response.data)
        : pending.reject(new Error(response.error));
    });
    this.child.on("error", (error) => this.fail(error));
    this.child.on("exit", () =>
      this.fail(
        new Error(
          diagnostics.trim() ||
            "The Rust service stopped. Restart the app to reconnect.",
        ),
      ),
    );
    this.child.stdin.on("error", (error) => this.fail(error));
  }
  fail(error) {
    this.failure = error;
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(error);
    }
    this.pending.clear();
  }
  call(method, params = {}) {
    if (this.failure) return Promise.reject(this.failure);
    if (this.pending.size >= 100)
      return Promise.reject(new Error("Too many requests. Please try again."));
    return new Promise((resolve, reject) => {
      const id = ++this.sequence;
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(
          new Error(
            "The Rust service did not respond. Restart the app to reconnect.",
          ),
        );
      }, 10_000);
      this.pending.set(id, { resolve, reject, timer });
      this.child.stdin.write(
        JSON.stringify({ id, method, params }) + "\n",
        (error) => {
          if (!error) return;
          this.pending.delete(id);
          clearTimeout(timer);
          reject(error);
        },
      );
    });
  }
  stop() {
    this.child.kill();
  }
}
module.exports = { Core };
