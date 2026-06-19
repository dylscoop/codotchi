/**
 * statusline.mjs — Claude Code statusline renderer for claude-codotchi.
 *
 * Invoked by Claude Code on session events and every refreshInterval (10s).
 * Reads statusline JSON from stdin, advances the pet, renders multiline ANSI output.
 *
 * Stdout: multiline ANSI text (one line per row of the art + stats block).
 * On error: exits silently (empty statusline is better than a crash message).
 */

import { createRequire } from "module";
import { fileURLToPath, pathToFileURL } from "url";
import path from "path";
import {
  loadStateFile,
  saveStateFile,
  loadConfig,
  accumulateDailyUsage,
} from "./state.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.join(__dirname, "..", "dist");
const require = createRequire(import.meta.url);

// Dynamic import from compiled dist/ — allows running before/after build.
async function loadEngine() {
  const ge = await import(pathToFileURL(path.join(distDir, "gameEngine.js")).href);
  const aa = await import(pathToFileURL(path.join(distDir, "asciiArt.js")).href);
  return { ge, aa };
}

async function main() {
  // Read stdin JSON (Claude Code passes statusline context).
  let stdinJson = {};
  let _rawStdin = "";
  try {
    if (!process.stdin.isTTY) {
      const raw = fs.readFileSync(0, "utf8").trim();
      _rawStdin = raw;
      if (raw) stdinJson = JSON.parse(raw);
    }
  } catch {
    // stdin not available in some test contexts — continue with empty object
  }
  const { ge, aa } = await loadEngine();
  const cfg = loadConfig();
  const now = Date.now();

  // Accumulate daily cost and tokens from the session's JSONL transcript.
  const { costUsd: dailyCostUsd, tokens: dailyTokens } = accumulateDailyUsage(stdinJson.session_id);

  // Load or create pet state.
  let file = loadStateFile();
  let state;
  if (!file || !file.state) {
    state = ge.createPet("Copilot", "codeling");
    file = {
      state: ge.serialiseState(state),
      savedAt: now,
      terminalEnabled: cfg.terminalEnabled,
      createdDate: new Date().toISOString().slice(0, 10),
      totalMessages: 0,
    };
  } else {
    state = ge.deserialiseState(file.state);
  }

  // Advance ticks based on elapsed real time.
  const elapsedMs = now - (file.savedAt ?? now);
  const elapsedTicks = Math.floor(elapsedMs / (ge.TICK_INTERVAL_SECONDS * 1000));

  if (elapsedTicks > 0) {
    // Apply offline decay for long gaps, then tick forward.
    const gameConfig = ge.LOCAL_PET_GAME_CONFIG ?? ge.DEFAULT_GAME_CONFIG;
    if (elapsedTicks > 60) {
      state = ge.applyOfflineDecay(state, elapsedTicks, gameConfig);
    } else {
      for (let i = 0; i < elapsedTicks; i++) {
        const result = ge.tick(state, gameConfig);
        state = result.state ?? result; // tick may return { state, events } or state directly
      }
    }
  }

  // Determine cost tier for speech bubble colour.
  const warnUsd = cfg.warnThresholdUsd ?? 30;
  const shoutUsd = cfg.shoutThresholdUsd ?? 50;
  let bubbleColor = "green";
  if (dailyCostUsd >= shoutUsd) bubbleColor = "red";
  else if (dailyCostUsd >= warnUsd) bubbleColor = "orange";

  let output;
  if (cfg.terminalEnabled === false) {
    output = aa.stripAnsi(aa.buildStatusBlock(state));
  } else {
    const speech = aa.buildContextualSpeech(
      state,
      /*filesEdited*/ 0,
      /*sessionMs*/ 0,
      /*timeSinceLastEditMs*/ 0,
      /*sessionUserMessages*/ file.totalMessages ?? 0,
      /*isOnProdBranch*/ false,
      /*dailyCostUSD*/ dailyCostUsd,
      /*dailyTokens*/ dailyTokens,
      /*warnThresholdUSD*/ warnUsd,
      /*shoutThresholdUSD*/ shoutUsd
    );
    output = aa.buildSpeechBubble(
      state.stage,
      state.mood,
      speech.message,
      state.name,
      state.spriteType,
      undefined,
      speech.bubbleColor ?? bubbleColor,
      speech.tierEmoji
    );
  }

  // Save updated state.
  file.state = ge.serialiseState(state);
  file.savedAt = now;
  file.terminalEnabled = cfg.terminalEnabled;
  saveStateFile(file);

  process.stdout.write(output + "\n");
}

// Need fs for stdin read.
import fs from "fs";

main().catch(() => process.exit(0));
