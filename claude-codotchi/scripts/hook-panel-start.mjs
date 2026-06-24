/**
 * hook-panel-start.mjs — starts the panel HTTP+SSE server as a detached daemon.
 *
 * Called on SessionStart (after hook-session-start.mjs). Spawns panel-server.mjs
 * in the background so it outlives the hook process. Idempotent: if a server
 * is already running on the configured port (found via lock file), skips launch.
 */

import { spawn } from "child_process";
import fs   from "fs";
import path from "path";
import os   from "os";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function dataDir() {
  return process.env.CLAUDE_PLUGIN_DATA || path.join(os.homedir(), ".codotchi", "claude");
}

const LOCK_FILE    = path.join(dataDir(), "panel-lock.json");
const SERVER_SCRIPT= path.join(__dirname, "panel-server.mjs");

function isAlreadyRunning() {
  try {
    const lock = JSON.parse(fs.readFileSync(LOCK_FILE, "utf8"));
    if (!lock.pid) return false;
    // Check if process is alive (signal 0 = probe only)
    process.kill(lock.pid, 0);
    return true;
  } catch {
    return false;
  }
}

if (!isAlreadyRunning()) {
  const child = spawn(process.execPath, [SERVER_SCRIPT], {
    detached: true,
    stdio:    "ignore",
    env:      { ...process.env },
  });
  child.unref();
}

// Return control to Claude Code immediately
process.stdout.write(JSON.stringify({ continue: true }) + "\n");
