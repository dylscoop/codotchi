/**
 * statusline.mjs — Claude Code statusline renderer for claude-codotchi.
 *
 * Invoked by Claude Code on session events and every refreshInterval (1s).
 * Reads statusline JSON from stdin, advances the pet, renders output.
 *
 * Two display modes (cfg.statuslineMode, set via /codotchi emoji):
 *   "full"  (default) — multiline ANSI art + speech bubble / stat block.
 *   "emoji" — a single line with a moving emoji matching the pet's creature.
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
  loadIDEStateFile,
  loadUsageCache,
  saveUsageCache,
} from "./state.mjs";
import { pickPetEmoji, renderMovingEmojiLine, currentFrameIndex } from "./emoji.mjs";

// Usage scan cache TTL — accumulateDailyUsage() walks today's JSONL transcripts,
// which is too expensive to redo on every refresh once refreshInterval is 1s.
const USAGE_CACHE_TTL_MS = 10_000;

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
  // Cached: a full scan on every 1s refresh would be too expensive.
  let usage = loadUsageCache();
  if (!usage || (now - (usage.at ?? 0)) > USAGE_CACHE_TTL_MS) {
    usage = { ...accumulateDailyUsage(stdinJson.session_id), at: now };
    saveUsageCache(usage);
  }
  const { costUsd: dailyCostUsd, tokens: dailyTokens, hourlyCostUsd, messageCount } = usage;

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

  // Load IDE pets and determine which are active (saved within 60 seconds).
  const ACTIVE_IDE_THRESHOLD_MS = 60_000;
  const gameConfig = ge.LOCAL_PET_GAME_CONFIG ?? ge.DEFAULT_GAME_CONFIG;
  const idePets = [];
  for (const [ide, label] of [["vscode", "[VS Code]"], ["pycharm", "[PyCharm]"]]) {
    if (file._anchor?.ide === ide) continue; // already the primary pet, don't peek at it too
    const ideFile = loadIDEStateFile(ide);
    if (!ideFile || !ideFile.state) continue;
    const live = (now - (ideFile.savedAt ?? 0)) <= ACTIVE_IDE_THRESHOLD_MS;
    if (!live) continue;
    try {
      let ideState = ge.deserialiseState(ideFile.state);
      if (!ideState.alive) continue;
      const ideElapsedMs = now - (ideFile.savedAt ?? now);
      const ideElapsedTicks = Math.floor(ideElapsedMs / (ge.TICK_INTERVAL_SECONDS * 1000));
      if (ideElapsedTicks > 0) {
        ideState = ge.applyOfflineDecay(ideState, ideElapsedTicks, gameConfig);
      }
      idePets.push({ state: ideState, label });
    } catch {
      // skip corrupt IDE state
    }
  }

  const hasIDEPets = idePets.length > 0;
  const outputs = [];

  if (cfg.statuslineMode === "emoji") {
    // Compact one-line moving-emoji mode: no ANSI, just a shuffling emoji
    // (auto-matched to the pet's creature, or a user-pinned override).
    const frameIndex = currentFrameIndex(now);
    const columns = process.env.COLUMNS ? Number(process.env.COLUMNS) : undefined;
    if (!hasIDEPets) {
      const emoji = pickPetEmoji(state, cfg.statuslineEmoji);
      outputs.push(renderMovingEmojiLine(emoji, frameIndex, columns));
    }
    for (const { state: ideState, label } of idePets) {
      const emoji = pickPetEmoji(ideState, cfg.statuslineEmoji);
      outputs.push(renderMovingEmojiLine(emoji, frameIndex, columns, `${label} `));
    }
  } else if (cfg.terminalEnabled === false) {
    if (!hasIDEPets) {
      outputs.push(aa.stripAnsi(aa.buildStatusBlock(state)));
    }
    for (const { state: ideState } of idePets) {
      outputs.push(aa.stripAnsi(aa.buildStatusBlock(ideState)));
    }
  } else {
    // Only show the local Claude Code pet when no IDE pet is active — it is a
    // fallback placeholder and should be suppressed while an IDE extension is running.
    if (!hasIDEPets) {
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
        /*shoutThresholdUSD*/ shoutUsd,
        /*hourlyCostUSD*/ hourlyCostUsd,
        /*dailyMessages*/ messageCount
      );
      outputs.push(aa.buildSpeechBubble(
        state.stage,
        state.mood,
        speech.message,
        state.name,
        state.spriteType,
        undefined,
        speech.bubbleColor ?? bubbleColor,
        speech.tierEmoji
      ));
    }
    for (const { state: ideState, label } of idePets) {
      const ideSpeech = aa.buildContextualSpeech(
        ideState,
        0, 0, 0, 0, false, 0, 0, warnUsd, shoutUsd
      );
      outputs.push(aa.buildSpeechBubble(
        ideState.stage,
        ideState.mood,
        ideSpeech.message,
        ideState.name,
        ideState.spriteType,
        label,
        ideSpeech.bubbleColor ?? "green",
        ideSpeech.tierEmoji
      ));
    }
  }

  const output = outputs.join("\n");

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
