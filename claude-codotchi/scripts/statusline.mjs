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
  localDateKey,
  saveUsageCache,
  loadRankCache,
  saveRankCache,
  computeLiveRank,
  idleFlagsForFile,
} from "./state.mjs";
import { pickPetEmoji, renderMovingEmojiLine, currentFrameIndex } from "./emoji.mjs";

// Usage scan cache TTL — accumulateDailyUsage() walks today's JSONL transcripts,
// which is too expensive to redo on every refresh once refreshInterval is 1s.
const USAGE_CACHE_TTL_MS = 3_000;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.join(__dirname, "..", "dist");
const require = createRequire(import.meta.url);

// Dynamic import from compiled dist/ — allows running before/after build.
async function loadEngine() {
  const ge = await import(pathToFileURL(path.join(distDir, "gameEngine.js")).href);
  const aa = await import(pathToFileURL(path.join(distDir, "asciiArt.js")).href);
  return { ge, aa };
}

/**
 * Speech for the pet's active attention call, or null when there is none.
 * The phrase changes once a minute rather than on every 1s refresh, so the
 * status line doesn't flicker between phrases.
 */
function activeCallSpeech(aa, petState, now) {
  const call = petState.activeAttentionCall;
  if (!call || !aa.attentionCallSpeech) return null;
  return aa.attentionCallSpeech(aa.attentionCallKey(call, petState.cravingFood), Math.floor(now / 60_000));
}

/** One-line "⚠ <name> wants <label> (<how>)" text for the plain status block. */
function callLine(call, name, ideLabel) {
  const how = ideLabel ? `answer in ${ideLabel.replace(/[[\]]/g, "")}`
    : call.command || "answer in the IDE";
  return `  ⚠ ${name} wants ${call.label} (${how})`;
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
  const todayKey = localDateKey(now);
  if (!usage || usage.day !== todayKey || (now - (usage.at ?? 0)) > USAGE_CACHE_TTL_MS) {
    usage = { ...accumulateDailyUsage(stdinJson.session_id), at: now, day: todayKey };
    saveUsageCache(usage);
  }
  const { costUsd: dailyCostUsd, tokens: dailyTokens, hourlyCostUsd, messageCount } = usage;

  // Fetch live rank from the leaderboard branch (cached 5 minutes).
  // Only attempted when the pet is alive — skipped otherwise.
  const RANK_CACHE_TTL_MS = 5 * 60 * 1000;

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
      state = ge.applyOfflineDecay(state, elapsedMs / 1000);
    } else {
      // Honour the IDE's idle flag for an IDE-anchored pet (BUG-S02).
      const { isIdle, isDeepIdle } = idleFlagsForFile(file);
      for (let i = 0; i < elapsedTicks; i++) {
        const result = ge.tick(state, isIdle, isDeepIdle, gameConfig);
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
        ideState = ge.applyOfflineDecay(ideState, ideElapsedMs / 1000);
      }
      idePets.push({ state: ideState, label });
    } catch {
      // skip corrupt IDE state
    }
  }

  const hasIDEPets = idePets.length > 0;

  // Fetch live rank from leaderboard/scores.json + live.json (cached 5 min).
  // CODOTCHI_NO_RANK=1 turns the rank line off entirely (no network, no cache)
  // — used by the integration tests so their output doesn't depend on the
  // live leaderboard.
  const rankDisabled = process.env.CODOTCHI_NO_RANK === "1";
  let rankData = rankDisabled ? null : loadRankCache();
  const activePetState = hasIDEPets ? idePets[0].state : state;
  if (!rankDisabled && activePetState.alive && (!rankData || (now - (rankData.at ?? 0)) > RANK_CACHE_TTL_MS)) {
    try {
      const base = "https://raw.githubusercontent.com/dylscoop/codotchi/leaderboard/leaderboard/";
      const [scoresRes, liveRes] = await Promise.all([
        fetch(base + "scores.json"),
        fetch(base + "live.json").catch(() => null),
      ]);
      if (scoresRes.ok) {
        const rankJson = await scoresRes.json();
        const scores = Array.isArray(rankJson) ? rankJson : (rankJson.scores ?? []);
        const liveJson = liveRes?.ok ? await liveRes.json().catch(() => []) : [];
        const { rank, total } = computeLiveRank(scores, liveJson, activePetState, now);
        rankData = { at: now, rank, total };
        saveRankCache(rankData);
      }
    } catch { /* network failure — keep stale cache */ }
  }

  const outputs = [];

  if (cfg.statuslineMode === "emoji") {
    // Compact one-line moving-emoji mode: no ANSI, just a shuffling emoji
    // (auto-matched to the pet's creature, or a user-pinned override).
    const frameIndex = currentFrameIndex(now);
    const columns = process.env.COLUMNS ? Number(process.env.COLUMNS) : undefined;
    const callSuffix = (petState) => {
      const call = activeCallSpeech(aa, petState, now);
      return call ? `⚠ wants ${call.label} ` : "";
    };
    if (!hasIDEPets) {
      const emoji = pickPetEmoji(state, cfg.statuslineEmoji);
      outputs.push(renderMovingEmojiLine(emoji, frameIndex, columns, `${state.name} ${callSuffix(state)}`));
    }
    for (const { state: ideState, label } of idePets) {
      const emoji = pickPetEmoji(ideState, cfg.statuslineEmoji);
      outputs.push(renderMovingEmojiLine(emoji, frameIndex, columns, `${label} ${ideState.name} ${callSuffix(ideState)}`));
    }
  } else if (cfg.terminalEnabled === false) {
    if (!hasIDEPets) {
      outputs.push(aa.stripAnsi(aa.buildStatusBlock(state)));
      const call = activeCallSpeech(aa, state, now);
      if (call) outputs.push(callLine(call, state.name));
    }
    for (const { state: ideState, label } of idePets) {
      outputs.push(aa.stripAnsi(aa.buildStatusBlock(ideState)));
      const call = activeCallSpeech(aa, ideState, now);
      if (call) outputs.push(callLine(call, ideState.name, label));
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
        /*lastHourCostUSD (shown as $X/hr)*/ hourlyCostUsd,
        /*lastHourTokens*/ 0,
        /*dailyMessages*/ messageCount,
        { costStyle: "hourlyRate" }
      );
      // An active attention call takes over the bubble.
      const call = activeCallSpeech(aa, state, now);
      outputs.push(aa.buildSpeechBubble(
        state.stage,
        call ? call.mood : state.mood,
        call ? call.message : speech.message,
        state.name,
        state.spriteType,
        undefined,
        call ? call.bubbleColor : (speech.bubbleColor ?? bubbleColor),
        call ? "⚠" : speech.tierEmoji
      ));
    }
    for (const { state: ideState, label } of idePets) {
      const ideSpeech = aa.buildContextualSpeech(
        ideState,
        0, 0, 0, 0, false, 0, 0, warnUsd, shoutUsd, 0, 0, 0, { costStyle: "hourlyRate" }
      );
      const call = activeCallSpeech(aa, ideState, now);
      outputs.push(aa.buildSpeechBubble(
        ideState.stage,
        call ? call.mood : ideState.mood,
        call ? call.message : ideSpeech.message,
        ideState.name,
        ideState.spriteType,
        label,
        call ? call.bubbleColor : (ideSpeech.bubbleColor ?? "green"),
        call ? "⚠" : ideSpeech.tierEmoji
      ));
    }
  }

  // Append live rank line when pet is alive and rank data is available.
  if (rankData && activePetState.alive) {
    outputs.push(`  Rank #${rankData.rank} of ${rankData.total} on the leaderboard`);
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
