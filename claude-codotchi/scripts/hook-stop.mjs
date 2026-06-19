/**
 * hook-stop.mjs — Stop hook for claude-codotchi.
 *
 * Fires when the Claude Code session ends or the agent stops.
 * Advances pet state one final time and emits a contextual farewell as a
 * systemMessage (visible in the Claude Code session summary area).
 *
 * Output JSON: { continue: true, systemMessage: "<farewell>" }
 */

import { fileURLToPath, pathToFileURL } from "url";
import path from "path";
import fs from "fs";
import { loadStateFile, saveStateFile, loadConfig, accumulateDailyUsage } from "./state.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.join(__dirname, "..", "dist");

async function main() {
  let hookInput = {};
  try {
    const raw = fs.readFileSync("/dev/stdin", "utf8").trim();
    if (raw) hookInput = JSON.parse(raw);
  } catch {}

  const ge = await import(pathToFileURL(path.join(distDir, "gameEngine.js")).href);
  const aa = await import(pathToFileURL(path.join(distDir, "asciiArt.js")).href);

  const cfg = loadConfig();
  const now = Date.now();
  const sessionId = hookInput.session_id ?? process.env.CLAUDE_CODE_SESSION_ID;
  const { costUsd: dailyCostUsd, tokens: dailyTokens } = accumulateDailyUsage(sessionId);
  let file = loadStateFile();
  if (!file || !file.state) {
    process.stdout.write(JSON.stringify({ continue: true }) + "\n");
    return;
  }

  let state = ge.deserialiseState(file.state);

  // Advance a few ticks for the session end.
  const gameConfig = ge.LOCAL_PET_GAME_CONFIG ?? ge.DEFAULT_GAME_CONFIG;
  const elapsedMs = now - (file.savedAt ?? now);
  const elapsedTicks = Math.min(
    Math.floor(elapsedMs / ((ge.TICK_INTERVAL_SECONDS ?? 3) * 1000)),
    20 // cap to avoid runaway decay on long sessions
  );
  for (let i = 0; i < elapsedTicks; i++) {
    const result = ge.tick(state, gameConfig);
    state = result.state ?? result;
  }

  // Increment message count.
  file.totalMessages = (file.totalMessages ?? 0) + 1;

  const speech = aa.buildContextualSpeech
    ? aa.buildContextualSpeech(state, 0, 0, 0, file.totalMessages, false, dailyCostUsd, dailyTokens, cfg.warnThresholdUsd ?? 30, cfg.shoutThresholdUsd ?? 50)
    : { message: `See you later! ${state.name ?? "Codotchi"} waves goodbye.` };

  const rawBubble = aa.buildSpeechBubble
    ? aa.buildSpeechBubble(state.stage, state.mood, speech.message, state.name, state.spriteType)
    : speech.message;
  const farewell = aa.stripAnsi ? aa.stripAnsi(rawBubble) : rawBubble;

  file.state = ge.serialiseState(state);
  file.savedAt = now;
  saveStateFile(file);

  process.stdout.write(
    JSON.stringify({ continue: true, systemMessage: farewell }) + "\n"
  );
}

main().catch(() => {
  process.stdout.write(JSON.stringify({ continue: true }) + "\n");
});
