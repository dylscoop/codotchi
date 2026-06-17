/**
 * hook-post-tool.mjs — PostToolUse hook for claude-codotchi.
 *
 * Fires after Write / Edit / NotebookEdit tool calls.
 * Applies applyCodeActivity to reward coding — throttled by CODE_ACTIVITY_THROTTLE_SECONDS.
 *
 * Output JSON: { continue: true }
 */

import { fileURLToPath, pathToFileURL } from "url";
import path from "path";
import fs from "fs";
import { loadStateFile, saveStateFile } from "./state.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.join(__dirname, "..", "dist");

async function main() {
  // Hook stdin: { hook_event, tool_name, tool_input, tool_output, cwd, ... }
  let hookInput = {};
  try {
    const raw = fs.readFileSync("/dev/stdin", "utf8").trim();
    if (raw) hookInput = JSON.parse(raw);
  } catch {}

  const ge = await import(pathToFileURL(path.join(distDir, "gameEngine.js")).href);

  const now = Date.now();
  let file = loadStateFile();
  if (!file || !file.state) {
    process.stdout.write(JSON.stringify({ continue: true }) + "\n");
    return;
  }

  let state = ge.deserialiseState(file.state);

  // Throttle: only apply code activity if enough time has passed.
  const throttleMs = (ge.CODE_ACTIVITY_THROTTLE_SECONDS ?? 10) * 1000;
  const lastActivity = file.lastCodeActivityAt ?? 0;
  if (now - lastActivity >= throttleMs) {
    const gameConfig = ge.LOCAL_PET_GAME_CONFIG ?? ge.DEFAULT_GAME_CONFIG;
    const result = ge.applyCodeActivity
      ? ge.applyCodeActivity(state, gameConfig)
      : state;
    state = result.state ?? result;
    file.lastCodeActivityAt = now;
  }

  file.state = ge.serialiseState(state);
  file.savedAt = now;
  saveStateFile(file);

  process.stdout.write(JSON.stringify({ continue: true }) + "\n");
}

main().catch(() => {
  process.stdout.write(JSON.stringify({ continue: true }) + "\n");
});
