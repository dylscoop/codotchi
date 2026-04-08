/**
 * index.ts
 *
 * opencode-codotchi — npm-distributable OpenCode plugin.
 * Brings your codotchi into any terminal as a living companion.
 *
 * What this plugin does:
 *   - Loads the shared cross-IDE pet state from ~/.config/gotchi/state.json
 *     (Windows: %APPDATA%/gotchi/state.json) on startup.
 *   - Runs a tick timer every TICK_INTERVAL_SECONDS to advance the game.
 *   - Hooks into file.edited events to reward coding activity.
 *   - Hooks into session.idle to flag idle state.
 *   - Hooks into server.connected to queue a greeting notification.
 *   - Registers the `gotchi` custom tool for slash-command interactions.
 *
 * Slash commands (invoked via /codotchi in the OpenCode TUI):
 *   /codotchi              → show status (text + art if on)
 *   /codotchi feed         → give a meal
 *   /codotchi pat          → pat (gentle happiness boost)
 *   /codotchi sleep        → put to sleep
 *   /codotchi clean        → clean up droppings
 *   /codotchi medicine     → give medicine (cure sickness)
 *   /codotchi on           → enable ASCII art in tool details panel
 *   /codotchi off          → disable ASCII art (plain text stats only)
 *
 * Global install (from zip):
 *   1. Download opencode-codotchi-X.Y.Z.zip from Releases and extract it.
 *   2. cd opencode-codotchi-X.Y.Z && node bin/install.js --install
 *      Copies the /codotchi slash command, plugin source files, and adds
 *      the @opencode-ai/plugin dependency to ~/.config/opencode/package.json.
 *      OpenCode loads plugins from ~/.config/opencode/plugins/ automatically.
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
  pat,
  sleep,
  wake,
  clean,
  giveMedicine,
  serialiseState,
  deserialiseState,
  DEFAULT_GAME_CONFIG,
  TICK_INTERVAL_SECONDS,
  CODE_ACTIVITY_THROTTLE_SECONDS,
} from "./gameEngine.js";

import {
  buildSpeechBubble,
  buildStatusBlock,
  buildToast,
  buildContextualSpeech,
  stripAnsi,
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
  terminalEnabled?: boolean;
}

function loadFromSharedFile(): { state: PetState; savedAt: number; terminalEnabled: boolean } | null {
  try {
    const filePath = getSharedStatePath();
    if (!fs.existsSync(filePath)) { return null; }
    const raw = JSON.parse(fs.readFileSync(filePath, "utf8")) as SharedStateFile;
    if (!raw.state || typeof raw.savedAt !== "number") { return null; }
    return {
      state: deserialiseState(raw.state),
      savedAt: raw.savedAt,
      terminalEnabled: raw.terminalEnabled ?? false,
    };
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
      terminalEnabled,
    };
    fs.writeFileSync(filePath, JSON.stringify(payload), "utf8");
  } catch {
    // Best-effort — never crash the plugin if the shared file is unavailable.
  }
}

/** Persist only the terminalEnabled flag, leaving the rest of the file intact. */
function saveTerminalEnabled(): void {
  try {
    const filePath = getSharedStatePath();
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) { fs.mkdirSync(dir, { recursive: true }); }
    let existing: SharedStateFile = { state: {}, savedAt: Date.now(), terminalEnabled };
    if (fs.existsSync(filePath)) {
      try { existing = JSON.parse(fs.readFileSync(filePath, "utf8")) as SharedStateFile; } catch { /* ignore */ }
    }
    existing.terminalEnabled = terminalEnabled;
    fs.writeFileSync(filePath, JSON.stringify(existing), "utf8");
  } catch {
    // Best-effort.
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

// ---------------------------------------------------------------------------
// Display toggle (default off — art shown in tool details panel when on)
// ---------------------------------------------------------------------------

let terminalEnabled = false;

// ---------------------------------------------------------------------------
// Session coding activity stats (for contextual speech bubble commentary)
// ---------------------------------------------------------------------------

let sessionFilesEdited = 0;
let sessionStartMs = Date.now();

// ---------------------------------------------------------------------------
// Suppress text.complete art for one cycle after a gotchi tool call.
// When the user explicitly calls /codotchi <action>, the tool already shows
// a coloured sprite in the tool output. We skip the plain-text sprite for
// the immediately following LLM text response to avoid showing it twice.
// ---------------------------------------------------------------------------

let suppressNextTextArt = false;

// ---------------------------------------------------------------------------
// Pending notification queue
// Tick events fire outside any tool context, so we queue their messages
// and prepend them to the next tool result.
// ---------------------------------------------------------------------------

let pendingNotification: string | null = null;

// Stores the last execute() return value so tool.execute.after can mirror it
// to the details panel via output.output.
let lastToolOutput = "";

function queueNotification(msg: string): void {
  // If a notification is already pending, append (newline-separated)
  pendingNotification = pendingNotification ? pendingNotification + "\n" + msg : msg;
}

/** Drain and return any pending notification, then clear it. */
function drainNotification(): string {
  if (pendingNotification === null) { return ""; }
  const msg = pendingNotification;
  pendingNotification = null;
  return msg + "\n\n";
}

/**
 * Returns the contextual art header (speech bubble) when:
 *   - terminalEnabled is true, AND
 *   - a living pet exists in petState at the time of calling.
 * Always call this AFTER any state-mutating operation so the art
 * reflects the pet's updated stats.
 */
function artHeader(): string {
  if (!terminalEnabled || petState === null || !petState.alive) { return ""; }
  const speech = buildContextualSpeech(
    petState,
    sessionFilesEdited,
    Date.now() - sessionStartMs
  );
  return buildSpeechBubble(petState.stage, petState.mood, speech, petState.name) + "\n";
}

/** Load state from shared file; if none exists, stay null (no pet yet). */
function loadState(): void {
  const shared = loadFromSharedFile();
  if (shared !== null) {
    const elapsedSeconds = (Date.now() - shared.savedAt) / 1_000;
    petState = applyOfflineDecay(shared.state, elapsedSeconds);
    lastSavedAt = shared.savedAt;
    terminalEnabled = shared.terminalEnabled;
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

  // Surface key events as queued notifications (no active tool context here)
  for (const event of petState.events) {
    switch (event) {
      case "auto_woke_up":
        mealsThisCycle = 0;
        queueNotification(terminalEnabled
          ? buildSpeechBubble(petState.stage, petState.mood, "I feel rested! Time to code!", petState.name)
          : `[${petState.name}] I feel rested! Time to code!`);
        break;
      case "died":
        queueNotification(terminalEnabled
          ? buildSpeechBubble(petState.stage, "sad", "Goodbye... take care of the next one.", petState.name)
          : `[${petState.name}] Goodbye... take care of the next one.`);
        break;
      case "died_of_old_age":
        queueNotification(terminalEnabled
          ? buildSpeechBubble(petState.stage, "sleeping", "I lived a full life. Thank you for everything.", petState.name)
          : `[${petState.name}] I lived a full life. Thank you for everything.`);
        break;
      case "evolved_to_baby":
      case "evolved_to_child":
      case "evolved_to_teen":
      case "evolved_to_adult":
      case "evolved_to_senior": {
        const stageName = event.replace("evolved_to_", "");
        queueNotification(terminalEnabled
          ? buildSpeechBubble(petState.stage, petState.mood, `I evolved into a ${stageName}!`, petState.name)
          : `[${petState.name}] I evolved into a ${stageName}!`);
        break;
      }
      case "attention_call_hunger":
        queueNotification(terminalEnabled
          ? buildSpeechBubble(petState.stage, "sad", "I'm so hungry... please feed me!", petState.name)
          : `[${petState.name}] I'm so hungry... please feed me!`);
        break;
      case "attention_call_unhappiness":
        queueNotification(terminalEnabled
          ? buildSpeechBubble(petState.stage, "sad", "Gotchi wants to play", petState.name)
          : `[${petState.name}] Gotchi wants to play`);
        break;
      case "attention_call_sick":
        queueNotification(terminalEnabled
          ? buildSpeechBubble(petState.stage, "sick", "I don't feel well. I need medicine!", petState.name)
          : `[${petState.name}] I don't feel well. I need medicine!`);
        break;
      case "attention_call_critical_health":
        queueNotification(terminalEnabled
          ? buildSpeechBubble(petState.stage, "sick", "My health is critical! Please help me!", petState.name)
          : `[${petState.name}] My health is critical! Please help me!`);
        break;
      case "attention_call_low_energy":
        queueNotification(terminalEnabled
          ? buildSpeechBubble(petState.stage, "sad", "I'm exhausted... let me sleep!", petState.name)
          : `[${petState.name}] I'm exhausted... let me sleep!`);
        break;
      case "became_sick":
        queueNotification(buildToast(petState.stage, `${petState.name} has fallen sick.`));
        break;
      case "pooped":
        queueNotification(buildToast(petState.stage, `${petState.name} made a mess! (use /codotchi clean)`));
        break;
      case "attention_call_poop":
        queueNotification(terminalEnabled
          ? buildSpeechBubble(petState.stage, "sad", "There is a mess here! Can you clean it up?", petState.name)
          : `[${petState.name}] There is a mess here! Can you clean it up?`);
        break;
      case "attention_call_gift":
        queueNotification(terminalEnabled
          ? buildSpeechBubble(petState.stage, "happy", "I brought you a gift! Use /codotchi pat to accept it.", petState.name)
          : `[${petState.name}] I brought you a gift! Use /codotchi pat to accept it.`);
        break;
      case "attention_call_misbehaviour":
        queueNotification(terminalEnabled
          ? buildSpeechBubble(petState.stage, "neutral", "I'm acting up! Use /codotchi pat or /codotchi feed to discipline me.", petState.name)
          : `[${petState.name}] I'm acting up! Use /codotchi pat or /codotchi feed to discipline me.`);
        break;
    }
  }
}

// ---------------------------------------------------------------------------
// Plugin entry point
// ---------------------------------------------------------------------------

export const plugin: Plugin = async (_ctx) => {
  // Load state on startup — queue greeting as a pending notification
  loadState();

  if (petState !== null) {
    const greetMsg = petState.alive
      ? `I'm here! ${
          petState.hunger < 30 ? "I'm hungry... " :
          petState.sick        ? "I'm not feeling well. " :
          petState.energy < 20 ? "I'm sleepy. " :
          "I'm doing well!"
        }`
      : "My codotchi passed away. Start a new game in VS Code or PyCharm.";
    queueNotification(terminalEnabled
      ? buildSpeechBubble(petState.stage, petState.mood, greetMsg, petState.name)
      : `[${petState.name}] ${greetMsg}`);
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
      "Interact with your codotchi virtual pet. Use action='status' to see current stats, " +
      "or one of: feed, pat, sleep, clean, medicine, on, off.",
    args: {
      action: tool.schema
        .enum(["status", "feed", "pat", "sleep", "clean", "medicine", "on", "off", "new_game"])
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
    async execute({ action, name, petType }, context) {
      // Drain any queued tick notifications to prepend to this result
      const notification = drainNotification();
      // Capture every return value so tool.execute.after can write it to output.output
      const ret = (s: string): string => { lastToolOutput = s; return s; };
      // Suppress the text.complete sprite for the LLM response that immediately
      // follows this tool call — the tool output already shows a coloured sprite.
      suppressNextTextArt = true;

      // Set the tool panel title
      const panelTitle = petState
        ? `${petState.name} [${petState.stage}]`
        : "codotchi";
      context.metadata({ title: panelTitle });

      // ---------------------------------------------------------------------------
      // on / off — toggle ASCII art display
      // ---------------------------------------------------------------------------
      if (action === "on") {
        terminalEnabled = true;
        saveTerminalEnabled();
        // artHeader() now returns art immediately since terminalEnabled is true
        const art = artHeader();
        const msg = petState
          ? `ASCII art enabled.`
          : "ASCII art enabled. No pet found yet — start a game in VS Code or PyCharm.";
        return ret(notification + art + msg);
      }

      if (action === "off") {
        terminalEnabled = false;
        saveTerminalEnabled();
        const msg = petState
          ? `ASCII art disabled. Stats will be shown as plain text.`
          : "ASCII art disabled.";
        return ret(notification + msg);
      }

      // ---------------------------------------------------------------------------
      // new_game — does not require an existing pet
      // ---------------------------------------------------------------------------
      if (action === "new_game") {
        const petName  = name    ?? "Codotchi";
        const petKind  = petType ?? "codeling";
        petState = createPet(petName, petKind, "neon");
        mealsThisCycle = 0;
        saveState();
        context.metadata({ title: `${petName} [egg]` });
        const art = artHeader();
        return ret(notification + art + `New game started! Your ${petKind} named "${petName}" has hatched.`);
      }

      // ---------------------------------------------------------------------------
      // All other actions require an existing pet
      // ---------------------------------------------------------------------------
      if (petState === null) {
        return ret(
          notification +
          "No pet found. Start a new game first:\n" +
          "  - In VS Code: open the Gotchi sidebar and choose New Game\n" +
          "  - In PyCharm: open the Gotchi panel and choose New Game"
        );
      }

      if (!petState.alive) {
        return ret(notification + `${petState.name} has passed away. Start a new game to continue.`);
      }

      // Update panel title with current stage
      context.metadata({ title: `${petState.name} [${petState.stage}]` });

      switch (action) {
        case "status": {
          // For status: show stat block (includes sprite) + plain text summary.
          // artHeader() is intentionally omitted here — buildStatusBlock already
          // renders the sprite, so calling artHeader() would draw it twice.
          const statusBlock = terminalEnabled
            ? buildStatusBlock({
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
              })
            : "";
          const textStats = `${petState.name} | Stage: ${petState.stage} | Hunger: ${petState.hunger} | Happiness: ${petState.happiness} | Energy: ${petState.energy} | Health: ${petState.health} | Weight: ${petState.weight}`;
          return ret(notification + (statusBlock ? statusBlock + "\n" : "") + textStats);
        }

        case "feed": {
          if (petState.sleeping) {
            return ret(notification + artHeader() + `${petState.name} is sleeping and can't eat right now.`);
          }
          petState = feedMeal(petState, mealsThisCycle);
          const refused = petState.events.includes("meal_refused");
          if (!refused) { mealsThisCycle += 1; }
          saveState();
          const feedArt = artHeader();
          const feedToast = buildToast(petState.stage, refused
            ? `${petState.name} is too full for another meal.`
            : `${petState.name} enjoyed the meal! (hunger: ${petState.hunger})`);
          const feedResult = refused
            ? `Meal refused — ${petState.name} has already had ${mealsThisCycle} meals this wake cycle.`
            : `Fed ${petState.name}. Hunger: ${petState.hunger}/100, Weight: ${petState.weight}.`;
          return ret(notification + feedArt + feedToast + "\n" + feedResult);
        }

        case "pat": {
          if (petState.sleeping) {
            return ret(notification + artHeader() + `${petState.name} is sleeping.`);
          }
          petState = pat(petState);
          const patRefused = petState.events.includes("pat_refused_no_energy");
          saveState();
          const patArt = artHeader();
          const patToast = buildToast(petState.stage, patRefused
            ? `${petState.name} is too tired even for a pat.`
            : `${petState.name} enjoyed the pat!`);
          const patResult = patRefused
            ? `Pat refused — ${petState.name} is too exhausted.`
            : `Patted ${petState.name}. Happiness: ${petState.happiness}.`;
          return ret(notification + patArt + patToast + "\n" + patResult);
        }

        case "sleep": {
          petState = sleep(petState);
          const alreadySleeping = petState.events.includes("already_sleeping");
          saveState();
          const sleepArt = artHeader();
          return ret(notification + sleepArt + (alreadySleeping
            ? `${petState.name} is already sleeping.`
            : `${petState.name} is now sleeping. Energy will recharge.`));
        }

        case "clean": {
          petState = clean(petState);
          const alreadyClean = petState.events.includes("already_clean");
          saveState();
          const cleanArt = artHeader();
          const cleanToast = buildToast(petState.stage, alreadyClean
            ? `${petState.name}'s area is already clean.`
            : `Cleaned up after ${petState.name}.`);
          const cleanResult = alreadyClean
            ? `Nothing to clean — ${petState.name}'s area is already spotless.`
            : `Cleaned up ${petState.name}'s mess. Poops remaining: 0.`;
          return ret(notification + cleanArt + cleanToast + "\n" + cleanResult);
        }

        case "medicine": {
          if (!petState.sick) {
            return ret(notification + artHeader() + `${petState.name} is not sick — medicine not needed.`);
          }
          petState = giveMedicine(petState);
          const cured = petState.events.includes("cured");
          saveState();
          const medArt = artHeader();
          const medToast = buildToast(petState.stage, cured
            ? `${petState.name} is cured!`
            : `Gave ${petState.name} medicine (${petState.medicineDosesGiven}/3 doses).`);
          const medResult = cured
            ? `${petState.name} has been cured!`
            : `Gave medicine to ${petState.name}. Doses given: ${petState.medicineDosesGiven}/3.`;
          return ret(notification + medArt + medToast + "\n" + medResult);
        }

        default:
          return ret(notification + artHeader() + "Unknown action. Use one of: status, feed, pat, sleep, clean, medicine, on, off.");
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

    // Mirror the tool result to the details panel (output.output is what OpenCode
    // renders in the tool execution details window; execute()'s return value goes
    // only to the LLM, not to the panel).
    async "tool.execute.after"({ tool: toolName }, output) {
      if (toolName === "gotchi") {
        output.output = stripAnsi(lastToolOutput);
      }
    },

    // Append a plain-ASCII speech bubble to every LLM text response when
    // terminal art is enabled. Plain ASCII (no ANSI codes) is used because
    // output.text is rendered as markdown — ANSI codes would appear as raw
    // escape sequences. The suppressNextTextArt flag prevents a double-sprite
    // when the user explicitly called /codotchi (tool output already has art).
    async "experimental.text.complete"(_input, output) {
      if (suppressNextTextArt) {
        suppressNextTextArt = false;
        return;
      }
      if (!terminalEnabled || !petState || !petState.alive) return;

      const msg = buildContextualSpeech({
        hunger:    petState.hunger,
        happiness: petState.happiness,
        energy:    petState.energy,
        health:    petState.health,
        poops:     petState.poops,
        sleeping:  petState.sleeping,
        sick:      petState.sick,
      });
      const bubble = buildSpeechBubble(
        petState.stage, petState.mood, msg, petState.name
      );
      const plain = stripAnsi(bubble);
      output.text = output.text + "\n\n```\n" + plain + "\n```";
    },

    async event({ event }) {
      // file.edited → code activity reward (throttled)
      if (event.type === "file.edited") {
        isIdle = false;
        sessionFilesEdited += 1;
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

      // server.connected → queue greeting notification
      if (event.type === "server.connected") {
        if (petState !== null && petState.alive) {
          const greet = petState.hunger < 30
            ? `I'm starving! Please run /codotchi feed`
            : petState.sick
            ? `I feel terrible... I need medicine (/codotchi medicine)`
            : petState.energy < 20
            ? `I'm exhausted. Let me sleep (/codotchi sleep)`
            : petState.happiness < 30
            ? `Gotchi wants to play (/codotchi pat)`
            : `Hello! I'm ${petState.name}. Ready to code!`;
          queueNotification(terminalEnabled
            ? buildSpeechBubble(petState.stage, petState.mood, greet, petState.name)
            : `[${petState.name}] ${greet}`);
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
