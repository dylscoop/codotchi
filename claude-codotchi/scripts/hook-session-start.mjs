/**
 * hook-session-start.mjs — SessionStart hook for claude-codotchi.
 *
 * Spawns the pet if no state exists, then emits a greeting speech bubble
 * as a systemMessage back to Claude Code.
 *
 * Output JSON: { continue: true, systemMessage: "<greeting>" }
 */

import { fileURLToPath, pathToFileURL } from "url";
import path from "path";
import fs from "fs";
import { loadStateFile, saveStateFile, loadConfig, accumulateDailyUsage } from "./state.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.join(__dirname, "..", "dist");

async function main() {
  // Read hook stdin (ignored — SessionStart carries no meaningful payload for us).
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
  let state;

  if (!file || !file.state) {
    // First run — create a new local pet.
    state = ge.createPet ? ge.createPet("Copilot", "codeling") : null;
    if (!state) {
      process.stdout.write(JSON.stringify({ continue: true }) + "\n");
      return;
    }
    file = {
      state: ge.serialiseState(state),
      savedAt: now,
      terminalEnabled: cfg.terminalEnabled,
      createdDate: new Date().toISOString().slice(0, 10),
      totalMessages: 0,
    };
    saveStateFile(file);
  } else {
    state = ge.deserialiseState(file.state);
  }

  const speech = aa.buildContextualSpeech
    ? aa.buildContextualSpeech(state, 0, 0, 0, 0, false, dailyCostUsd, dailyTokens, cfg.warnThresholdUsd ?? 30, cfg.shoutThresholdUsd ?? 50)
    : { message: `${state.name ?? "Codotchi"} is ready!` };

  const rawBubble = aa.buildSpeechBubble
    ? aa.buildSpeechBubble(state.stage, state.mood, speech.message, state.name, state.spriteType)
    : speech.message;
  const greeting = aa.stripAnsi ? aa.stripAnsi(rawBubble) : rawBubble;

  process.stdout.write(
    JSON.stringify({ continue: true, systemMessage: greeting }) + "\n"
  );
}

main().catch(() => {
  process.stdout.write(JSON.stringify({ continue: true }) + "\n");
});
