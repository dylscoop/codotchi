/**
 * action.mjs — CLI handler for /codotchi slash command actions.
 *
 * Usage: node action.mjs <action> [value|name]
 *
 * Actions: status feed pat sleep wake clean medicine on off rename warnthreshold shoutthreshold orangethreshold redthreshold levels speechinterval
 *
 * Prints ANSI art + status block or plain confirmation text to stdout.
 * Claude Code surfaces this output as the slash command result.
 */

import { fileURLToPath, pathToFileURL } from "url";
import path from "path";
import {
  loadStateFile,
  saveStateFile,
  loadConfig,
  saveConfig,
  accumulateDailyUsage,
} from "./state.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.join(__dirname, "..", "dist");

async function loadEngine() {
  const ge = await import(pathToFileURL(path.join(distDir, "gameEngine.js")).href);
  const aa = await import(pathToFileURL(path.join(distDir, "asciiArt.js")).href);
  return { ge, aa };
}

function getOrCreateState(ge, file) {
  if (!file || !file.state) {
    const state = ge.createPet("Copilot", "codeling");
    return { state, isNew: true };
  }
  return { state: ge.deserialiseState(file.state), isNew: false };
}

async function main() {
  const args = process.argv.slice(2);
  const action = (args[0] ?? "status").toLowerCase();
  const valueArg = args[1];

  const { ge, aa } = await loadEngine();
  const cfg = loadConfig();
  const now = Date.now();
  const { costUsd: dailyCostUsd, tokens: dailyTokens } = accumulateDailyUsage(
    process.env.CLAUDE_CODE_SESSION_ID
  );

  let file = loadStateFile();
  let { state, isNew } = getOrCreateState(ge, file);
  if (!file) {
    file = {
      state: ge.serialiseState(state),
      savedAt: now,
      terminalEnabled: cfg.terminalEnabled,
      createdDate: new Date().toISOString().slice(0, 10),
      totalMessages: 0,
    };
  }

  const gameConfig = ge.LOCAL_PET_GAME_CONFIG ?? ge.DEFAULT_GAME_CONFIG;
  let message = "";
  let showArt = true;

  switch (action) {
    case "status":
      // Fall through to art render below.
      break;

    case "feed": {
      const result = ge.feedMeal(state, gameConfig);
      state = result.state ?? result;
      const ev = (result.events ?? []).find((e) => e.type === "meal_refused");
      message = ev ? "Not hungry right now." : "Nom nom! Hunger restored.";
      break;
    }

    case "pat": {
      const result = ge.pat(state, gameConfig);
      state = result.state ?? result;
      message = "Pat given! Happiness boosted.";
      break;
    }

    case "sleep": {
      if (state.sleeping) {
        message = "Already sleeping.";
      } else {
        const result = ge.sleep(state, gameConfig);
        state = result.state ?? result;
        message = "Goodnight! Zzzz...";
      }
      break;
    }

    case "wake": {
      if (!state.sleeping) {
        message = "Already awake!";
      } else {
        // wake = toggle sleep off; use sleep function if it toggles
        const result = ge.sleep(state, gameConfig);
        state = result.state ?? result;
        message = "Wakey wakey!";
      }
      break;
    }

    case "clean": {
      const result = ge.clean(state, gameConfig);
      state = result.state ?? result;
      message = "All cleaned up!";
      break;
    }

    case "medicine": {
      const result = ge.giveMedicine(state, gameConfig);
      state = result.state ?? result;
      const ev = (result.events ?? []).find((e) => e.type === "medicine_refused");
      message = ev
        ? "Not sick — medicine refused."
        : `Medicine given. ${state.sick ? "Still recovering..." : "Feeling better!"}`;
      break;
    }

    case "on":
      cfg.terminalEnabled = true;
      saveConfig(cfg);
      file.terminalEnabled = true;
      message = "ASCII art enabled.";
      showArt = false;
      break;

    case "off":
      cfg.terminalEnabled = false;
      saveConfig(cfg);
      file.terminalEnabled = false;
      message = "ASCII art disabled.";
      showArt = false;
      break;

    case "rename": {
      const newName = valueArg ?? args.slice(1).join(" ");
      if (!newName) {
        message = "Usage: /codotchi rename <name>";
        showArt = false;
      } else {
        state = { ...state, name: newName };
        message = `Renamed to ${newName}!`;
      }
      break;
    }

    case "warnthreshold": {
      const val = parseFloat(valueArg);
      if (isNaN(val) || val < 0) {
        message = "Usage: /codotchi warnthreshold <amount> (USD, e.g. 30)";
        showArt = false;
      } else {
        cfg.warnThresholdUsd = val;
        saveConfig(cfg);
        message = `Warning threshold set to $${val}.`;
        showArt = false;
      }
      break;
    }

    case "shoutthreshold": {
      const val = parseFloat(valueArg);
      if (isNaN(val) || val < 0) {
        message = "Usage: /codotchi shoutthreshold <amount> (USD, e.g. 50)";
        showArt = false;
      } else {
        cfg.shoutThresholdUsd = val;
        saveConfig(cfg);
        message = `Shout threshold set to $${val}.`;
        showArt = false;
      }
      break;
    }

    case "orangethreshold": {
      const val = parseFloat(valueArg);
      if (isNaN(val) || val < 0) {
        message = "Usage: /codotchi orangethreshold <amount> (USD, e.g. 30)";
        showArt = false;
      } else {
        cfg.warnThresholdUsd = val;
        saveConfig(cfg);
        message = `Orange threshold set to $${val}.`;
        showArt = false;
      }
      break;
    }

    case "redthreshold": {
      const val = parseFloat(valueArg);
      if (isNaN(val) || val < 0) {
        message = "Usage: /codotchi redthreshold <amount> (USD, e.g. 50)";
        showArt = false;
      } else {
        cfg.shoutThresholdUsd = val;
        saveConfig(cfg);
        message = `Red threshold set to $${val}.`;
        showArt = false;
      }
      break;
    }

    case "levels": {
      const orange = cfg.warnThresholdUsd ?? 30;
      const red = cfg.shoutThresholdUsd ?? 50;
      message = `Usage levels:\n🟢 Green  : $0 – $${orange}\n🟠 Orange : $${orange} – $${red}\n🔴 Red    : $${red}+\n\nSet with: /codotchi orangethreshold <n>  /codotchi redthreshold <n>`;
      showArt = false;
      break;
    }

    case "speechinterval": {
      if (valueArg === "off" || valueArg === "0") {
        cfg.petSpeechIntervalMs = 0;
        saveConfig(cfg);
        message = "Mid-session pet speech disabled.";
        showArt = false;
      } else {
        const secs = parseFloat(valueArg);
        if (isNaN(secs) || secs <= 0) {
          const currentSecs = cfg.petSpeechIntervalMs > 0 ? cfg.petSpeechIntervalMs / 1000 : 0;
          const currentLabel = currentSecs > 0 ? `${currentSecs}s` : "off";
          message = `Usage: /codotchi speechinterval <seconds|off>  (current: ${currentLabel})`;
          showArt = false;
        } else {
          cfg.petSpeechIntervalMs = secs * 1000;
          saveConfig(cfg);
          message = `Pet will speak every ${secs}s during active coding.`;
          showArt = false;
        }
      }
      break;
    }

    default:
      message = `Unknown action: ${action}. Try /codotchi help.`;
      showArt = false;
  }

  // Save state.
  file.state = ge.serialiseState(state);
  file.savedAt = now;
  saveStateFile(file);

  // Derive speech context for bubble colour and status message.
  const contextSpeech = aa.buildContextualSpeech(
    state, 0, 0, 0, file.totalMessages ?? 0, false,
    dailyCostUsd, dailyTokens,
    cfg.warnThresholdUsd ?? 30, cfg.shoutThresholdUsd ?? 50
  );
  const { bubbleColor, tierEmoji } = contextSpeech;

  // Render output.
  if (showArt && cfg.terminalEnabled !== false) {
    const art = aa.buildStatusBlock(state);
    if (message) {
      const bubble = aa.buildSpeechBubble(
        state.stage, state.mood, message,
        state.name, state.spriteType,
        undefined, bubbleColor, tierEmoji
      );
      process.stdout.write(bubble + "\n" + art + "\n");
    } else {
      // status action: show contextual speech bubble above stat block
      const bubble = aa.buildSpeechBubble(
        state.stage, state.mood, contextSpeech.message,
        state.name, state.spriteType,
        undefined, bubbleColor, tierEmoji
      );
      process.stdout.write(bubble + "\n" + art + "\n");
    }
  } else {
    if (message) process.stdout.write(message + "\n");
    else process.stdout.write(aa.stripAnsi(aa.buildStatusBlock(state)) + "\n");
  }
}

main().catch((err) => {
  process.stderr.write(`codotchi action error: ${err.message}\n`);
  process.exit(1);
});
