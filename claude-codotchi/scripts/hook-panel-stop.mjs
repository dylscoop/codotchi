/**
 * hook-panel-stop.mjs — gracefully shuts down the panel HTTP+SSE server.
 *
 * Called on Stop. Sends POST /shutdown to the server (preferred), then falls
 * back to SIGTERM via the saved PID. Removes the lock file either way.
 */

import fs   from "fs";
import path from "path";
import os   from "os";
import http from "http";

function dataDir() {
  return process.env.CLAUDE_PLUGIN_DATA || path.join(os.homedir(), ".codotchi", "claude");
}

const LOCK_FILE = path.join(dataDir(), "panel-lock.json");

function readLock() {
  try { return JSON.parse(fs.readFileSync(LOCK_FILE, "utf8")); }
  catch { return null; }
}

function httpShutdown(port) {
  return new Promise((resolve) => {
    try {
      const req = http.request(
        { hostname: "127.0.0.1", port, path: "/shutdown", method: "POST", timeout: 2000 },
        (res) => { res.resume(); res.on("end", resolve); }
      );
      req.on("error", resolve);
      req.on("timeout", () => { req.destroy(); resolve(); });
      req.end();
    } catch { resolve(); }
  });
}

async function main() {
  const lock = readLock();
  if (lock) {
    if (lock.port) await httpShutdown(lock.port);
    if (lock.pid) {
      try { process.kill(lock.pid, "SIGTERM"); } catch { /* already gone */ }
    }
    try { fs.unlinkSync(LOCK_FILE); } catch {}
  }
  process.stdout.write(JSON.stringify({ continue: true }) + "\n");
}

main();
