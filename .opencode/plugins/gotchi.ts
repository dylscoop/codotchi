/**
 * gotchi.ts
 *
 * OpenCode plugin — brings your gotchi into the terminal as a living companion.
 *
 * What this plugin does:
 *   - Loads the shared cross-IDE pet state from ~/.config/gotchi/state.json
 *     (Windows: %APPDATA%/gotchi/state.json) on startup.
 *   - Runs a tick timer every TICK_INTERVAL_SECONDS to advance the game.
 *   - Hooks into file.edited events to reward coding activity.
 *   - Hooks into session.idle to flag idle state.
 *   - Hooks into server.connected to print a greeting speech bubble.
 *   - Registers the `gotchi` custom tool for slash-command interactions.
 *
 * Slash commands (invoked via /gotchi in the OpenCode TUI):
 *   /gotchi              → print status
 *   /gotchi feed         → give a meal
 *   /gotchi snack        → give a snack
 *   /gotchi play         → play (happiness boost)
 *   /gotchi pat          → pat (gentle happiness boost)
 *   /gotchi sleep        → put to sleep
 *   /gotchi wake         → wake up
 *   /gotchi clean        → clean up droppings
 *   /gotchi medicine     → give medicine (cure sickness)
 */

import * as fs   from "fs";
import * as path from "path";
import * as os   from "os";
import { tool }  from "@opencode-ai/plugin";
import type { Plugin } from "@opencode-ai/plugin";

import {
  PetState,
  tick,
  createPet,
  applyOfflineDecay,
  applyCodeActivity,
  feedMeal,
  startSnack,
  consumeSnack,
  play,
  pat,
  sleep,
  wake,
  clean,
  giveMedicine,
  scold,
  serialiseState,
  deserialiseState,
  DEFAULT_GAME_CONFIG,
  TICK_INTERVAL_SECONDS,
  CODE_ACTIVITY_THROTTLE_SECONDS,
} from "./gameEngine.js";

import {
  renderSpeechBubble,
  renderStatus,
  renderToast,
} from "./asciiArt.js";

// ---------------------------------------------------------------------------
// Shared state file helpers
// ---------------------------------------------------------------------------

function getSharedStatePath(): string {
  const base =
    process.platform === "win32"
      ? process.env["APPDATA"] ?? path.join(os.homedir(), "AppData", "Roaming")
      : path.join(os.homedir(), ".config");
  return path.join(base, "gotchi", "state.json");
}

interface SharedStateFile {
  state: Record<string, unknown>;
  savedAt: number;
}

function loadFromSharedFile(): { state: PetState; savedAt: number } | null {
  try {
    const filePath = getSharedStatePath();
    if (!fs.existsSync(filePath)) { return null; }
    const raw = JSON.parse(fs.readFileSync(filePath, "utf8")) as SharedStateFile;
    if (!raw.state || typeof raw.savedAt !== "number") { return null; }
    return { state: deserialiseState(raw.state), savedAt: raw.savedAt };
  } catch {
    return null;
  }
}

function saveToSharedFile(state: PetState): void {
  try {
    const filePath = getSharedStatePath();
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) { fs.mkdirSync(dir, { recursive: true }); }
    const payload: SharedStateFile = {
      state: serialiseState(state) as Record<string, unknown>,
      savedAt: Date.now(),
    };
    fs.writeFileSync(filePath, JSON.stringify(payload), "utf8");
  } catch {
    // Best-effort — never crash the plugin if the shared file is unavailable.
  }
}

// ---------------------------------------------------------------------------
// Meals-per-cycle counter (plugin-local, reset on wake)
// ---------------------------------------------------------------------------

let mealsThisCycle = 0;

// ---------------------------------------------------------------------------
// Plugin state
// ---------------------------------------------------------------------------

let petState: PetState | null = null;
let lastSavedAt = 0;
let tickTimer: ReturnType<typeof setInterval> | undefined;
let isIdle = false;
let lastCodeActivityMs = 0;

/** Load state from shared file; if none exists, stay null (no pet yet). */
function loadState(): void {
  const shared = loadFromSharedFile();
  if (shared !== null) {
    const elapsedSeconds = (Date.now() - shared.savedAt) / 1_000;
    petState = applyOfflineDecay(shared.state, elapsedSeconds);
    lastSavedAt = shared.savedAt;
    // Reset meal counter when loading (we don't persist it cross-IDE)
    mealsThisCycle = 0;
  }
}

function saveState(): void {
  if (petState !== null) {
    saveToSharedFile(petState);
    lastSavedAt = Date.now();
  }
}

function applyTick(): void {
  if (petState === null || !petState.alive) { return; }
  const deepIdle = false; // the plugin has no deep-idle concept yet
  petState = tick(petState, isIdle, deepIdle, DEFAULT_GAME_CONFIG);
  saveState();

  // Surface key events as speech bubbles
  for (const event of petState.events) {
    switch (event) {
      case "auto_woke_up":
        mealsThisCycle = 0;
        renderSpeechBubble(petState.stage, petState.mood, "I feel rested! Time to code!", petState.name);
        break;
      case "died":
        renderSpeechBubble(petState.stage, "sad", "Goodbye... take care of the next one.", petState.name);
        break;
      case "died_of_old_age":
        renderSpeechBubble(petState.stage, "sleeping", "I lived a full life. Thank you for everything.", petState.name);
        break;
      case "evolved_to_baby":
      case "evolved_to_child":
      case "evolved_to_teen":
      case "evolved_to_adult":
      case "evolved_to_senior": {
        const stageName = event.replace("evolved_to_", "");
        renderSpeechBubble(petState.stage, petState.mood, `I evolved into a ${stageName}!`, petState.name);
        break;
      }
      case "attention_call_hunger":
        renderSpeechBubble(petState.stage, "sad", "I'm so hungry... please feed me!", petState.name);
        break;
      case "attention_call_unhappiness":
        renderSpeechBubble(petState.stage, "sad", "I'm feeling really sad. Play with me?", petState.name);
        break;
      case "attention_call_sick":
        renderSpeechBubble(petState.stage, "sick", "I don't feel well. I need medicine!", petState.name);
        break;
      case "attention_call_critical_health":
        renderSpeechBubble(petState.stage, "sick", "My health is critical! Please help me!", petState.name);
        break;
      case "attention_call_low_energy":
        renderSpeechBubble(petState.stage, "sad", "I'm exhausted... let me sleep!", petState.name);
        break;
      case "became_sick":
        renderToast(petState.stage, `${petState.name} has fallen sick.`);
        break;
      case "pooped":
        renderToast(petState.stage, `${petState.name} made a mess! (use /gotchi clean)`);
        break;
      case "attention_call_poop":
        renderSpeechBubble(petState.stage, "sad", "There is a mess here! Can you clean it up?", petState.name);
        break;
      case "attention_call_gift":
        renderSpeechBubble(petState.stage, "happy", "I brought you a gift! Use /gotchi pat to accept it.", petState.name);
        break;
      case "attention_call_misbehaviour":
        renderSpeechBubble(petState.stage, "neutral", "I'm acting up! Use /gotchi pat or /gotchi feed to discipline me.", petState.name);
        break;
    }
  }
}

// ---------------------------------------------------------------------------
// Plugin entry point
// ---------------------------------------------------------------------------

export const plugin: Plugin = async (_ctx) => {
  // Load state on startup
  loadState();

  if (petState !== null) {
    renderSpeechBubble(
      petState.stage,
      petState.mood,
      petState.alive
        ? `I'm here! ${
            petState.hunger < 30 ? "I'm hungry... " :
            petState.sick        ? "I'm not feeling well. " :
            petState.energy < 20 ? "I'm sleepy. " :
            "I'm doing well!"
          }`
        : "My gotchi passed away. Start a new game in VS Code or PyCharm.",
      petState.name
    );
  }

  // Tick timer
  tickTimer = setInterval(() => {
    applyTick();
  }, TICK_INTERVAL_SECONDS * 1_000);

  // ---------------------------------------------------------------------------
  // Tool definition
  // ---------------------------------------------------------------------------
  const gotchiTool = tool({
    description:
      "Interact with your gotchi virtual pet. Use action='status' to see current stats, " +
      "or one of: feed, snack, play, pat, sleep, wake, clean, medicine, new_game.",
    args: {
      action: tool.schema
        .enum(["status", "feed", "snack", "play", "pat", "sleep", "wake", "clean", "medicine", "new_game"])
        .describe("The action to perform"),
      name: tool.schema
        .string()
        .optional()
        .describe("Pet name — only used when action=new_game"),
      petType: tool.schema
        .enum(["codeling", "bytebug", "pixelpup", "shellscript"])
        .optional()
        .describe("Pet type — only used when action=new_game"),
    },
    async execute({ action, name, petType }) {
      // Handle new_game first — does not require an existing pet
      if (action === "new_game") {
        const petName  = name    ?? "Gotchi";
        const petKind  = petType ?? "codeling";
        petState = createPet(petName, petKind, "neon");
        mealsThisCycle = 0;
        saveState();
        renderSpeechBubble(petState.stage, petState.mood, `Hi! I'm ${petName}. Nice to meet you!`, petName);
        return `New game started! Your ${petKind} named "${petName}" has hatched.`;
      }

      // All other actions require an existing pet
      if (petState === null) {
        return (
          "No pet found. Start a new game first:\n" +
          "  - In VS Code: open the Gotchi sidebar and choose New Game\n" +
          "  - In PyCharm: open the Gotchi panel and choose New Game\n" +
          "  - In OpenCode: use /gotchi new_game name=<name>"
        );
      }

      if (!petState.alive) {
        return `${petState.name} has passed away. Start a new game to continue.`;
      }

      switch (action) {
        case "status": {
          renderStatus({
            name:       petState.name,
            stage:      petState.stage,
            mood:       petState.mood,
            hunger:     petState.hunger,
            happiness:  petState.happiness,
            energy:     petState.energy,
            health:     petState.health,
            discipline: petState.discipline,
            weight:     petState.weight,
            ageDays:    petState.ageDays,
            alive:      petState.alive,
            sick:       petState.sick,
            sleeping:   petState.sleeping,
            poops:      petState.poops,
          });
          return `${petState.name} | Stage: ${petState.stage} | Hunger: ${petState.hunger} | Happiness: ${petState.happiness} | Energy: ${petState.energy} | Health: ${petState.health}`;
        }

        case "feed": {
          if (petState.sleeping) { return `${petState.name} is sleeping and can't eat right now.`; }
          petState = feedMeal(petState, mealsThisCycle);
          const refused = petState.events.includes("meal_refused");
          if (!refused) { mealsThisCycle += 1; }
          saveState();
          renderToast(petState.stage, refused
            ? `${petState.name} is too full for another meal.`
            : `${petState.name} enjoyed the meal! (hunger: ${petState.hunger})`);
          return refused
            ? `Meal refused — ${petState.name} has already had ${mealsThisCycle} meals this wake cycle.`
            : `Fed ${petState.name}. Hunger: ${petState.hunger}/100, Weight: ${petState.weight}.`;
        }

        case "snack": {
          if (petState.sleeping) { return `${petState.name} is sleeping.`; }
          petState = startSnack(petState);
          const refused = petState.events.includes("snack_refused");
          if (!refused) {
            // Apply snack consumption immediately (no floor animation in terminal)
            petState = consumeSnack(petState);
          }
          saveState();
          renderToast(petState.stage, refused
            ? `${petState.name} has had enough snacks.`
            : `${petState.name} gobbled up the snack!`);
          return refused
            ? `Snack refused — ${petState.name} has had too many snacks this cycle.`
            : `Gave ${petState.name} a snack. Hunger: ${petState.hunger}, Happiness: ${petState.happiness}.`;
        }

        case "play": {
          if (petState.sleeping) { return `${petState.name} is sleeping.`; }
          petState = play(petState);
          const refused = petState.events.includes("play_refused_no_energy");
          saveState();
          renderToast(petState.stage, refused
            ? `${petState.name} is too tired to play.`
            : `${petState.name} had fun playing!`);
          return refused
            ? `Play refused — ${petState.name} doesn't have enough energy. Let them sleep first.`
            : `Played with ${petState.name}. Happiness: ${petState.happiness}, Energy: ${petState.energy}.`;
        }

        case "pat": {
          if (petState.sleeping) { return `${petState.name} is sleeping.`; }
          petState = pat(petState);
          const refused = petState.events.includes("pat_refused_no_energy");
          saveState();
          renderToast(petState.stage, refused
            ? `${petState.name} is too tired even for a pat.`
            : `${petState.name} enjoyed the pat!`);
          return refused
            ? `Pat refused — ${petState.name} is too exhausted.`
            : `Patted ${petState.name}. Happiness: ${petState.happiness}.`;
        }

        case "sleep": {
          petState = sleep(petState);
          const already = petState.events.includes("already_sleeping");
          saveState();
          return already
            ? `${petState.name} is already sleeping.`
            : `${petState.name} is now sleeping. Energy will recharge.`;
        }

        case "wake": {
          petState = wake(petState);
          const already = petState.events.includes("already_awake");
          if (!already) { mealsThisCycle = 0; }
          saveState();
          return already
            ? `${petState.name} is already awake.`
            : `${petState.name} is now awake! Meal counter reset.`;
        }

        case "clean": {
          petState = clean(petState);
          const already = petState.events.includes("already_clean");
          saveState();
          renderToast(petState.stage, already
            ? `${petState.name}'s area is already clean.`
            : `Cleaned up after ${petState.name}.`);
          return already
            ? `Nothing to clean — ${petState.name}'s area is already spotless.`
            : `Cleaned up ${petState.name}'s mess. Poops remaining: 0.`;
        }

        case "medicine": {
          if (!petState.sick) {
            return `${petState.name} is not sick — medicine not needed.`;
          }
          petState = giveMedicine(petState);
          const cured = petState.events.includes("cured");
          saveState();
          renderToast(petState.stage, cured
            ? `${petState.name} is cured!`
            : `Gave ${petState.name} medicine (${petState.medicineDosesGiven}/3 doses).`);
          return cured
            ? `${petState.name} has been cured!`
            : `Gave medicine to ${petState.name}. Doses given: ${petState.medicineDosesGiven}/3.`;
        }

        default:
          return "Unknown action. Use one of: status, feed, snack, play, pat, sleep, wake, clean, medicine, new_game.";
      }
    },
  });

  // ---------------------------------------------------------------------------
  // Event hooks
  // ---------------------------------------------------------------------------
  return {
    tool: {
      gotchi: gotchiTool,
    },

    async event({ event }) {
      // file.edited → code activity reward (throttled)
      if (event.type === "file.edited") {
        isIdle = false;
        if (petState !== null && petState.alive && !petState.sleeping) {
          const nowMs = Date.now();
          if (nowMs - lastCodeActivityMs >= CODE_ACTIVITY_THROTTLE_SECONDS * 1_000) {
            lastCodeActivityMs = nowMs;
            petState = applyCodeActivity(petState);
            saveState();
          }
        }
        return;
      }

      // session.idle → flag idle for next tick
      if (event.type === "session.idle") {
        isIdle = true;
        // Save on idle so offline decay is accurate if the user closes OpenCode
        saveState();
        return;
      }

      // server.connected → greeting (fires once on startup/reconnect)
      if (event.type === "server.connected") {
        if (petState !== null && petState.alive) {
          const greet = petState.hunger < 30
            ? `I'm starving! Please run /gotchi feed`
            : petState.sick
            ? `I feel terrible... I need medicine (/gotchi medicine)`
            : petState.energy < 20
            ? `I'm exhausted. Let me sleep (/gotchi sleep)`
            : petState.happiness < 30
            ? `I've been so lonely. Play with me? (/gotchi play)`
            : `Hello! I'm ${petState.name}. Ready to code!`;
          renderSpeechBubble(petState.stage, petState.mood, greet, petState.name);
        }
        return;
      }

      // session.status → resume from idle when a new message arrives
      if (event.type === "session.status") {
        isIdle = false;
        return;
      }
    },
  };
};

export default plugin;
