/**
 * hook-post-tool.mjs — PostToolUse hook for claude-codotchi.
 *
 * Fires after Write / Edit / NotebookEdit tool calls.
 * Applies applyCodeActivity to reward coding — throttled by CODE_ACTIVITY_THROTTLE_SECONDS.
 * Periodically emits a pet speech systemMessage based on petSpeechIntervalMs config.
 *
 * Output JSON: { continue: true } or { continue: true, systemMessage: "<pet speech>" }
 */

import { fileURLToPath, pathToFileURL } from "url";
import path from "path";
import fs from "fs";
import { loadStateFile, saveStateFile, loadConfig, accumulateDailyUsage } from "./state.mjs";

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
  const cfg = loadConfig();
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

  // Periodic mid-session pet speech.
  let systemMessage;
  const intervalMs = cfg.petSpeechIntervalMs ?? 300000;
  if (intervalMs > 0) {
    const lastSpeechAt = file.lastPetSpeechAt ?? 0;
    if (now - lastSpeechAt >= intervalMs) {
      try {
        const aa = await import(pathToFileURL(path.join(distDir, "asciiArt.js")).href);
        const sessionId = hookInput.session_id ?? process.env.CLAUDE_CODE_SESSION_ID;
        const { costUsd: dailyCostUsd, tokens: dailyTokens } = accumulateDailyUsage(sessionId);
        const speech = aa.buildContextualSpeech(
          state, 0, 0, 0, file.totalMessages ?? 0, false,
          dailyCostUsd, dailyTokens,
          cfg.warnThresholdUsd ?? 30, cfg.shoutThresholdUsd ?? 50
        );
        const rawBubble = aa.buildSpeechBubble(
          state.stage, state.mood, speech.message, state.name, state.spriteType
        );
        systemMessage = aa.stripAnsi(rawBubble);
        file.lastPetSpeechAt = now;
      } catch {}
    }
  }

  saveStateFile(file);

  const output = { continue: true };
  if (systemMessage) output.systemMessage = systemMessage;
  process.stdout.write(JSON.stringify(output) + "\n");
}

main().catch(() => {
  process.stdout.write(JSON.stringify({ continue: true }) + "\n");
});
