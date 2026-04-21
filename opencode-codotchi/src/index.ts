/**
 * index.ts
 *
 * opencode-codotchi — npm-distributable OpenCode plugin.
 * Brings your codotchi into any terminal as a living companion.
 *
 * What this plugin does:
 *   - Loads pet state from both VS Code and PyCharm per-IDE state files on startup.
 *     VS Code : %APPDATA%/gotchi/vscode/state.json  (~/.config/gotchi/vscode/state.json)
 *     PyCharm : %APPDATA%/gotchi/pycharm/state.json (~/.config/gotchi/pycharm/state.json)
 *   - Watches both files for live updates from whichever IDE is active.
 *   - Runs a tick timer every TICK_INTERVAL_SECONDS to advance the game.
 *   - Hooks into file.edited events to reward coding activity.
 *   - Hooks into session.idle to flag idle state.
 *   - Hooks into server.connected to queue a greeting notification.
 *   - Registers the `gotchi` custom tool for slash-command interactions.
 *
 * Both pets are shown simultaneously when active (saved within the last 60 s).
 * If neither IDE is actively ticking, the most recently saved alive pet is shown.
 * Actions (feed, pat, etc.) are applied to all currently active pets.
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
  applyOfflineDecay,
  applyCodeActivity,
  feedMeal,
  pat,
  sleep,
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
  pickRandom,
  TODO_COMPLETE_PHRASES,
  SESSION_DIFF_PHRASES,
} from "./asciiArt.js";

// ---------------------------------------------------------------------------
// Per-IDE state file helpers
// ---------------------------------------------------------------------------

/** How recently (ms) a state file must have been saved to count as "active". */
const ACTIVE_IDE_THRESHOLD_MS = 60_000;

function getIDEBase(): string {
  return process.platform === "win32"
    ? process.env["APPDATA"] ?? path.join(os.homedir(), "AppData", "Roaming")
    : path.join(os.homedir(), ".config");
}

function getVSCodeStatePath(): string {
  return path.join(getIDEBase(), "gotchi", "vscode", "state.json");
}

function getPyCharmStatePath(): string {
  return path.join(getIDEBase(), "gotchi", "pycharm", "state.json");
}

interface IDEStateFile {
  state: Record<string, unknown>;
  savedAt: number;
  terminalEnabled?: boolean;
}

function loadFromIDEFile(filePath: string): { state: PetState; savedAt: number; terminalEnabled: boolean } | null {
  try {
    if (!fs.existsSync(filePath)) { return null; }
    const raw = JSON.parse(fs.readFileSync(filePath, "utf8")) as IDEStateFile;
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

function saveToIDEFile(filePath: string, state: PetState): void {
  try {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) { fs.mkdirSync(dir, { recursive: true }); }
    const payload: IDEStateFile = {
      state: serialiseState(state) as Record<string, unknown>,
      savedAt: Date.now(),
    };
    fs.writeFileSync(filePath, JSON.stringify(payload), "utf8");
  } catch {
    // Best-effort — never crash the plugin if the state file is unavailable.
  }
}

/** Persist only the terminalEnabled flag into the VS Code state file (primary). */
function saveTerminalEnabled(): void {
  try {
    const filePath = getVSCodeStatePath();
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) { fs.mkdirSync(dir, { recursive: true }); }
    let existing: IDEStateFile = { state: {}, savedAt: Date.now(), terminalEnabled };
    if (fs.existsSync(filePath)) {
      try { existing = JSON.parse(fs.readFileSync(filePath, "utf8")) as IDEStateFile; } catch { /* ignore */ }
    }
    existing.terminalEnabled = terminalEnabled;
    fs.writeFileSync(filePath, JSON.stringify(existing), "utf8");
  } catch {
    // Best-effort.
  }
}

// ---------------------------------------------------------------------------
// Meals-per-cycle counters (plugin-local, reset on wake, one per IDE)
// ---------------------------------------------------------------------------

let vscodeMeals  = 0;
let pycharmMeals = 0;

// ---------------------------------------------------------------------------
// Plugin state — dual-pet (VS Code + PyCharm, independent)
// ---------------------------------------------------------------------------

/** VS Code pet state, or null if no VS Code state file exists. */
let vscodePetState:    PetState | null = null;
let vscodeLastSavedAt: number = 0;

/** PyCharm pet state, or null if no PyCharm state file exists. */
let pycharmPetState:    PetState | null = null;
let pycharmLastSavedAt: number = 0;

let tickTimer: ReturnType<typeof setInterval> | undefined;
let isIdle = false;
let lastCodeActivityMs = 0;

// ---------------------------------------------------------------------------
// Display toggle (default off â€” art shown in tool details panel when on)
// ---------------------------------------------------------------------------

let terminalEnabled = false;

// ---------------------------------------------------------------------------
// Session coding activity stats (for contextual speech bubble commentary)
// ---------------------------------------------------------------------------

let sessionFilesEdited = 0;
let sessionStartMs = Date.now();

// ---------------------------------------------------------------------------
// Todo tracking â€” detect status transitions for celebratory notifications
// ---------------------------------------------------------------------------

/** Map of todo id â†’ last known status, used to detect transitions. */
let prevTodos: Map<string, string> = new Map();

// ---------------------------------------------------------------------------
// Diff tracking â€” flag when AI has shipped changes since last idle
// ---------------------------------------------------------------------------

/** True when at least one session.diff with non-empty diff arrived since the
 *  last session.idle. The notification fires on the NEXT session.idle so we
 *  don't interrupt mid-burst. */
let pendingDiffSinceIdle = false;

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
 * Returns the contextual art header (speech bubble) for all active pets when
 * terminalEnabled is true. Pets are stacked vertically, separated by a blank line.
 * Always call this AFTER any state-mutating operation so the art reflects updated stats.
 */
function artHeader(): string {
  if (!terminalEnabled) { return ""; }
  const active = getActivePets();
  if (active.length === 0) { return ""; }
  return active
    .filter(p => p.state.alive)
    .map(p => {
      const speech = buildContextualSpeech(p.state, sessionFilesEdited, Date.now() - sessionStartMs);
      return buildSpeechBubble(p.state.stage, p.state.mood, speech, p.state.name, p.state.spriteType);
    })
    .join("\n") + "\n";
}

// ---------------------------------------------------------------------------
// Active-pet helpers
// ---------------------------------------------------------------------------

interface ActivePet {
  ide:   "vscode" | "pycharm";
  state: PetState;
  /** Whether this IDE is currently ticking (savedAt within ACTIVE_IDE_THRESHOLD_MS). */
  live:  boolean;
}

/**
 * Returns pets to show in the current interaction:
 *   - All IDEs whose state file was saved within ACTIVE_IDE_THRESHOLD_MS → "live"
 *   - If no IDE is live, returns the most recently saved alive pet as a fallback.
 *   - At least one pet is always returned if any alive pet exists.
 */
function getActivePets(): ActivePet[] {
  const now = Date.now();
  const results: ActivePet[] = [];

  if (vscodePetState !== null && vscodePetState.alive) {
    const live = (now - vscodeLastSavedAt) <= ACTIVE_IDE_THRESHOLD_MS;
    results.push({ ide: "vscode",  state: vscodePetState,  live });
  }
  if (pycharmPetState !== null && pycharmPetState.alive) {
    const live = (now - pycharmLastSavedAt) <= ACTIVE_IDE_THRESHOLD_MS;
    results.push({ ide: "pycharm", state: pycharmPetState, live });
  }

  const liveResults = results.filter(p => p.live);
  if (liveResults.length > 0) { return liveResults; }

  // Fallback: no live IDE — return the most recently saved alive pet
  if (results.length > 0) {
    const newest = results.reduce((a, b) =>
      (a.ide === "vscode" ? vscodeLastSavedAt : pycharmLastSavedAt) >=
      (b.ide === "vscode" ? vscodeLastSavedAt : pycharmLastSavedAt) ? a : b
    );
    return [newest];
  }

  // No alive pet at all — include dead pets for the "died" message
  const dead: ActivePet[] = [];
  if (vscodePetState !== null)  { dead.push({ ide: "vscode",  state: vscodePetState,  live: false }); }
  if (pycharmPetState !== null) { dead.push({ ide: "pycharm", state: pycharmPetState, live: false }); }
  if (dead.length > 0) {
    const newest = dead.reduce((a, b) =>
      (a.ide === "vscode" ? vscodeLastSavedAt : pycharmLastSavedAt) >=
      (b.ide === "vscode" ? vscodeLastSavedAt : pycharmLastSavedAt) ? a : b
    );
    return [newest];
  }
  return [];
}

function getMeals(ide: "vscode" | "pycharm"): number {
  return ide === "vscode" ? vscodeMeals : pycharmMeals;
}
function setMeals(ide: "vscode" | "pycharm", n: number): void {
  if (ide === "vscode") { vscodeMeals = n; } else { pycharmMeals = n; }
}
function getSavedAt(ide: "vscode" | "pycharm"): number {
  return ide === "vscode" ? vscodeLastSavedAt : pycharmLastSavedAt;
}
function setSavedAt(ide: "vscode" | "pycharm", t: number): void {
  if (ide === "vscode") { vscodeLastSavedAt = t; } else { pycharmLastSavedAt = t; }
}
function setPetState(ide: "vscode" | "pycharm", s: PetState): void {
  if (ide === "vscode") { vscodePetState = s; } else { pycharmPetState = s; }
}
function getStatePath(ide: "vscode" | "pycharm"): string {
  return ide === "vscode" ? getVSCodeStatePath() : getPyCharmStatePath();
}

// ---------------------------------------------------------------------------
// Load / save / tick
// ---------------------------------------------------------------------------

/** Load both IDE state files on startup. */
function loadBothStates(): void {
  const vscodeFile  = loadFromIDEFile(getVSCodeStatePath());
  if (vscodeFile !== null) {
    const elapsed = (Date.now() - vscodeFile.savedAt) / 1_000;
    vscodePetState    = applyOfflineDecay(vscodeFile.state, elapsed);
    vscodeLastSavedAt = vscodeFile.savedAt;
    vscodeMeals = 0;
    // Restore terminalEnabled from whichever file has it set
    if (vscodeFile.terminalEnabled) { terminalEnabled = true; }
  }
  const pycharmFile = loadFromIDEFile(getPyCharmStatePath());
  if (pycharmFile !== null) {
    const elapsed = (Date.now() - pycharmFile.savedAt) / 1_000;
    pycharmPetState    = applyOfflineDecay(pycharmFile.state, elapsed);
    pycharmLastSavedAt = pycharmFile.savedAt;
    pycharmMeals = 0;
  }
}

function saveIDEState(ide: "vscode" | "pycharm"): void {
  const state = ide === "vscode" ? vscodePetState : pycharmPetState;
  if (state !== null) {
    saveToIDEFile(getStatePath(ide), state);
    setSavedAt(ide, Date.now());
  }
}

function applyTickForPet(ide: "vscode" | "pycharm"): void {
  const state = ide === "vscode" ? vscodePetState : pycharmPetState;
  if (state === null || !state.alive) { return; }
  const next = tick(state, isIdle, false, DEFAULT_GAME_CONFIG);
  setPetState(ide, next);
  saveIDEState(ide);

  for (const event of next.events) {
    switch (event) {
      case "auto_woke_up":
        setMeals(ide, 0);
        queueNotification(terminalEnabled
          ? buildSpeechBubble(next.stage, next.mood, "I feel rested! Time to code!", next.name, next.spriteType)
          : `[${next.name}] I feel rested! Time to code!`);
        break;
      case "died":
        queueNotification(terminalEnabled
          ? buildSpeechBubble(next.stage, "sad", "Goodbye... take care of the next one.", next.name, next.spriteType)
          : `[${next.name}] Goodbye... take care of the next one.`);
        break;
      case "died_of_old_age":
        queueNotification(terminalEnabled
          ? buildSpeechBubble(next.stage, "sleeping", "I lived a full life. Thank you for everything.", next.name, next.spriteType)
          : `[${next.name}] I lived a full life. Thank you for everything.`);
        break;
      case "evolved_to_baby":
      case "evolved_to_child":
      case "evolved_to_teen":
      case "evolved_to_adult":
      case "evolved_to_senior": {
        const stageName = event.replace("evolved_to_", "");
        queueNotification(terminalEnabled
          ? buildSpeechBubble(next.stage, next.mood, `I evolved into a ${stageName}!`, next.name, next.spriteType)
          : `[${next.name}] I evolved into a ${stageName}!`);
        break;
      }
      case "attention_call_hunger":
        queueNotification(terminalEnabled
          ? buildSpeechBubble(next.stage, "sad", "I'm so hungry... please feed me!", next.name, next.spriteType)
          : `[${next.name}] I'm so hungry... please feed me!`);
        break;
      case "attention_call_unhappiness":
        queueNotification(terminalEnabled
          ? buildSpeechBubble(next.stage, "sad", "Gotchi wants to play", next.name, next.spriteType)
          : `[${next.name}] Gotchi wants to play`);
        break;
      case "attention_call_sick":
        queueNotification(terminalEnabled
          ? buildSpeechBubble(next.stage, "sick", "I don't feel well. I need medicine!", next.name, next.spriteType)
          : `[${next.name}] I don't feel well. I need medicine!`);
        break;
      case "attention_call_critical_health":
        queueNotification(terminalEnabled
          ? buildSpeechBubble(next.stage, "sick", "My health is critical! Please help me!", next.name, next.spriteType)
          : `[${next.name}] My health is critical! Please help me!`);
        break;
      case "attention_call_low_energy":
        queueNotification(terminalEnabled
          ? buildSpeechBubble(next.stage, "sad", "I'm exhausted... let me sleep!", next.name, next.spriteType)
          : `[${next.name}] I'm exhausted... let me sleep!`);
        break;
      case "became_sick":
        queueNotification(buildToast(next.stage, `${next.name} has fallen sick.`));
        break;
      case "pooped":
        queueNotification(buildToast(next.stage, `${next.name} made a mess! (use /codotchi clean)`));
        break;
      case "attention_call_poop":
        queueNotification(terminalEnabled
          ? buildSpeechBubble(next.stage, "sad", "There is a mess here! Can you clean it up?", next.name, next.spriteType)
          : `[${next.name}] There is a mess here! Can you clean it up?`);
        break;
      case "attention_call_gift":
        queueNotification(terminalEnabled
          ? buildSpeechBubble(next.stage, "happy", "I brought you a gift! Use /codotchi pat to accept it.", next.name, next.spriteType)
          : `[${next.name}] I brought you a gift! Use /codotchi pat to accept it.`);
        break;
      case "attention_call_misbehaviour":
        queueNotification(terminalEnabled
          ? buildSpeechBubble(next.stage, "neutral", "I'm acting up! Use /codotchi pat or /codotchi feed to discipline me.", next.name, next.spriteType)
          : `[${next.name}] I'm acting up! Use /codotchi pat or /codotchi feed to discipline me.`);
        break;
    }
  }
}

function applyTick(): void {
  applyTickForPet("vscode");
  applyTickForPet("pycharm");
}

// ---------------------------------------------------------------------------
// Plugin entry point
// ---------------------------------------------------------------------------

export const plugin: Plugin = async (_ctx) => {
  // Load both IDE state files on startup — queue greetings as pending notifications
  loadBothStates();

  for (const p of getActivePets().filter(p => p.state.alive)) {
    const s = p.state;
    const greetMsg = `I'm here. ${
      s.hunger < 30 ? "Pretty hungry though." :
      s.sick        ? "Not feeling great."    :
      s.energy < 20 ? "A bit tired."          :
      "Let's get to work."
    }`;
    queueNotification(terminalEnabled
      ? buildSpeechBubble(s.stage, s.mood, greetMsg, s.name, s.spriteType)
      : `[${s.name}] ${greetMsg}`);
  }

  // Tick timer
  tickTimer = setInterval(() => {
    applyTick();
  }, TICK_INTERVAL_SECONDS * 1_000);

  // ---------------------------------------------------------------------------
  // Live sync — watch both IDE state files for external writes.
  // A 150 ms debounce absorbs rapid successive fs events from atomic writes.
  // The savedAt <= lastSavedAt guard prevents us from overwriting a state we
  // just saved ourselves (e.g. after /codotchi feed).
  // ---------------------------------------------------------------------------
  function makeIDEWatcher(ide: "vscode" | "pycharm"): void {
    const filePath = getStatePath(ide);
    let syncDebounce: ReturnType<typeof setTimeout> | undefined;
    let fsWatcher: ReturnType<typeof fs.watch> | undefined;

    const reload = (): void => {
      const loaded = loadFromIDEFile(filePath);
      if (loaded === null) { return; }
      if (loaded.savedAt <= getSavedAt(ide)) { return; }
      const elapsed = (Date.now() - loaded.savedAt) / 1_000;
      setPetState(ide, applyOfflineDecay(loaded.state, elapsed));
      setSavedAt(ide, loaded.savedAt);
      setMeals(ide, 0);
    };

    const onChange = (): void => {
      if (syncDebounce !== undefined) { clearTimeout(syncDebounce); }
      syncDebounce = setTimeout(() => { syncDebounce = undefined; reload(); }, 150);
    };

    const startWatcher = (): void => {
      if (fsWatcher !== undefined) { return; }
      try {
        fsWatcher = fs.watch(filePath, { persistent: false }, onChange);
        fsWatcher.on("error", () => { fsWatcher?.close(); fsWatcher = undefined; });
      } catch { /* file may not exist yet — watchBootstrap will retry */ }
    };

    startWatcher();
    const watchBootstrap = setInterval(() => {
      if (fsWatcher !== undefined) { clearInterval(watchBootstrap); return; }
      startWatcher();
      if (fsWatcher !== undefined) { clearInterval(watchBootstrap); }
    }, 10_000);
  }

  makeIDEWatcher("vscode");
  makeIDEWatcher("pycharm");

  // ---------------------------------------------------------------------------
  // Tool definition
  // ---------------------------------------------------------------------------
  const gotchiTool = tool({
    description:
      "Interact with your codotchi virtual pet. Use action='status' to see current stats, " +
      "or one of: feed, pat, sleep, clean, medicine, on, off. " +
      "Actions apply to all currently active IDE pets (VS Code and/or PyCharm).",
    args: {
      action: tool.schema
        .enum(["status", "feed", "pat", "sleep", "clean", "medicine", "on", "off"])
        .describe("The action to perform"),
    },
    async execute({ action }, context) {
      // Drain any queued tick notifications to prepend to this result
      const notification = drainNotification();
      const ret = (s: string): string => { lastToolOutput = s; return s; };
      suppressNextTextArt = true;

      const active = getActivePets();

      // Build panel title from active pets
      const titleParts = active.map(p => `${p.state.name} [${p.state.stage}]`);
      context.metadata({ title: titleParts.join(" / ") || "codotchi" });

      // ---------------------------------------------------------------------------
      // on / off — toggle ASCII art display
      // ---------------------------------------------------------------------------
      if (action === "on") {
        terminalEnabled = true;
        saveTerminalEnabled();
        const art = artHeader();
        const msg = active.length > 0
          ? `ASCII art enabled.`
          : "ASCII art enabled. No pet found yet — start a game in VS Code or PyCharm.";
        return ret(notification + art + msg);
      }

      if (action === "off") {
        terminalEnabled = false;
        saveTerminalEnabled();
        const msg = active.length > 0
          ? `ASCII art disabled. Stats will be shown as plain text.`
          : "ASCII art disabled.";
        return ret(notification + msg);
      }

      // ---------------------------------------------------------------------------
      // All other actions require at least one active pet
      // ---------------------------------------------------------------------------
      if (active.length === 0) {
        return ret(
          notification +
          "No pet found. Start a new game first:\n" +
          "  - In VS Code: open the Gotchi sidebar and choose New Game\n" +
          "  - In PyCharm: open the Gotchi panel and choose New Game"
        );
      }

      const allDead = active.every(p => !p.state.alive);
      if (allDead) {
        const names = active.map(p => p.state.name).join(" and ");
        return ret(notification + `${names} has passed away. Start a new game to continue.`);
      }

      // Only operate on alive pets
      const alivePets = active.filter(p => p.state.alive);

      switch (action) {
        case "status": {
          // Show stacked status block (art + stats) for each active alive pet.
          const blocks = alivePets.map(p => {
            const s = p.state;
            const ideLabel = p.ide === "vscode" ? "[VS Code]" : "[PyCharm]";
            const statusBlock = terminalEnabled
              ? buildStatusBlock({
                  name: s.name, stage: s.stage, mood: s.mood,
                  hunger: s.hunger, happiness: s.happiness, energy: s.energy,
                  health: s.health, discipline: s.discipline, weight: s.weight,
                  ageDays: s.ageDays, alive: s.alive, sick: s.sick,
                  sleeping: s.sleeping, poops: s.poops, spriteType: s.spriteType,
                })
              : "";
            const textStats = `${ideLabel} ${s.name} | Stage: ${s.stage} | Hunger: ${s.hunger} | Happiness: ${s.happiness} | Energy: ${s.energy} | Health: ${s.health} | Weight: ${s.weight}`;
            return (statusBlock ? statusBlock + "\n" : "") + textStats;
          });
          return ret(notification + blocks.join("\n\n──────────────────────\n\n"));
        }

        case "feed": {
          const feedLines: string[] = [];
          for (const p of alivePets) {
            const s = p.state;
            const meals = getMeals(p.ide);
            if (s.sleeping) {
              feedLines.push(`[${p.ide === "vscode" ? "VS Code" : "PyCharm"}] ${s.name} is sleeping and can't eat right now.`);
              continue;
            }
            const next = feedMeal(s, meals);
            const refused = next.events.includes("meal_refused");
            if (!refused) { setMeals(p.ide, meals + 1); }
            setPetState(p.ide, next);
            saveIDEState(p.ide);
            const toast = buildToast(next.stage, refused
              ? `${next.name} is too full for another meal.`
              : `${next.name} enjoyed the meal! (hunger: ${next.hunger})`);
            feedLines.push((terminalEnabled
              ? buildSpeechBubble(next.stage, next.mood, refused ? "I'm too full!" : "Yum!", next.name, next.spriteType) + "\n"
              : "") + toast + "\n" + (refused
              ? `[${p.ide === "vscode" ? "VS Code" : "PyCharm"}] Meal refused — ${next.name} has already had ${getMeals(p.ide)} meals this wake cycle.`
              : `[${p.ide === "vscode" ? "VS Code" : "PyCharm"}] Fed ${next.name}. Hunger: ${next.hunger}/100, Weight: ${next.weight}.`));
          }
          return ret(notification + feedLines.join("\n\n"));
        }

        case "pat": {
          const patLines: string[] = [];
          for (const p of alivePets) {
            const s = p.state;
            if (s.sleeping) {
              patLines.push(`[${p.ide === "vscode" ? "VS Code" : "PyCharm"}] ${s.name} is sleeping.`);
              continue;
            }
            const next = pat(s);
            const refused = next.events.includes("pat_refused_no_energy");
            setPetState(p.ide, next);
            saveIDEState(p.ide);
            const toast = buildToast(next.stage, refused
              ? `${next.name} is too tired even for a pat.`
              : `${next.name} enjoyed the pat!`);
            patLines.push((terminalEnabled
              ? buildSpeechBubble(next.stage, next.mood, refused ? "Too tired..." : "Yay!", next.name, next.spriteType) + "\n"
              : "") + toast + "\n" + (refused
              ? `[${p.ide === "vscode" ? "VS Code" : "PyCharm"}] Pat refused — ${next.name} is too exhausted.`
              : `[${p.ide === "vscode" ? "VS Code" : "PyCharm"}] Patted ${next.name}. Happiness: ${next.happiness}.`));
          }
          return ret(notification + patLines.join("\n\n"));
        }

        case "sleep": {
          const sleepLines: string[] = [];
          for (const p of alivePets) {
            const next = sleep(p.state);
            const already = next.events.includes("already_sleeping");
            setPetState(p.ide, next);
            saveIDEState(p.ide);
            sleepLines.push((terminalEnabled
              ? buildSpeechBubble(next.stage, next.mood, already ? "Already asleep..." : "Goodnight!", next.name, next.spriteType) + "\n"
              : "") + (already
              ? `[${p.ide === "vscode" ? "VS Code" : "PyCharm"}] ${next.name} is already sleeping.`
              : `[${p.ide === "vscode" ? "VS Code" : "PyCharm"}] ${next.name} is now sleeping. Energy will recharge.`));
          }
          return ret(notification + sleepLines.join("\n\n"));
        }

        case "clean": {
          const cleanLines: string[] = [];
          for (const p of alivePets) {
            const next = clean(p.state);
            const already = next.events.includes("already_clean");
            setPetState(p.ide, next);
            saveIDEState(p.ide);
            const toast = buildToast(next.stage, already
              ? `${next.name}'s area is already clean.`
              : `Cleaned up after ${next.name}.`);
            cleanLines.push((terminalEnabled
              ? buildSpeechBubble(next.stage, next.mood, already ? "All clean!" : "Thanks for cleaning!", next.name, next.spriteType) + "\n"
              : "") + toast + "\n" + (already
              ? `[${p.ide === "vscode" ? "VS Code" : "PyCharm"}] Nothing to clean — ${next.name}'s area is already spotless.`
              : `[${p.ide === "vscode" ? "VS Code" : "PyCharm"}] Cleaned up ${next.name}'s mess.`));
          }
          return ret(notification + cleanLines.join("\n\n"));
        }

        case "medicine": {
          const medLines: string[] = [];
          for (const p of alivePets) {
            const s = p.state;
            if (!s.sick) {
              medLines.push(`[${p.ide === "vscode" ? "VS Code" : "PyCharm"}] ${s.name} is not sick — medicine not needed.`);
              continue;
            }
            const next = giveMedicine(s);
            const cured = next.events.includes("cured");
            setPetState(p.ide, next);
            saveIDEState(p.ide);
            const toast = buildToast(next.stage, cured
              ? `${next.name} is cured!`
              : `Gave ${next.name} medicine (${next.medicineDosesGiven}/3 doses).`);
            medLines.push((terminalEnabled
              ? buildSpeechBubble(next.stage, next.mood, cured ? "I feel better!" : "Medicine time...", next.name, next.spriteType) + "\n"
              : "") + toast + "\n" + (cured
              ? `[${p.ide === "vscode" ? "VS Code" : "PyCharm"}] ${next.name} has been cured!`
              : `[${p.ide === "vscode" ? "VS Code" : "PyCharm"}] Gave medicine to ${next.name}. Doses given: ${next.medicineDosesGiven}/3.`));
          }
          return ret(notification + medLines.join("\n\n"));
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

    async "tool.execute.after"({ tool: toolName }, output) {
      if (toolName === "gotchi") {
        output.output = stripAnsi(lastToolOutput);
      }
    },

    async "experimental.text.complete"(_input, output) {
      if (suppressNextTextArt) {
        suppressNextTextArt = false;
        return;
      }
      if (!terminalEnabled) return;
      const livePets = getActivePets().filter(p => p.state.alive);
      if (livePets.length === 0) return;

      const bubbles = livePets.map(p => {
        const s = p.state;
        const msg = buildContextualSpeech(s, sessionFilesEdited, Date.now() - sessionStartMs);
        return stripAnsi(buildSpeechBubble(s.stage, s.mood, msg, s.name, s.spriteType));
      });
      output.text = output.text + "\n\n```\n" + bubbles.join("\n\n") + "\n```";
    },

    async event({ event }) {
      // file.edited → code activity reward (throttled), applied to all alive pets
      if (event.type === "file.edited") {
        isIdle = false;
        sessionFilesEdited += 1;
        const nowMs = Date.now();
        if (nowMs - lastCodeActivityMs >= CODE_ACTIVITY_THROTTLE_SECONDS * 1_000) {
          lastCodeActivityMs = nowMs;
          for (const ide of ["vscode", "pycharm"] as const) {
            const s = ide === "vscode" ? vscodePetState : pycharmPetState;
            if (s !== null && s.alive && !s.sleeping) {
              setPetState(ide, applyCodeActivity(s));
              saveIDEState(ide);
            }
          }
        }
        return;
      }

      // session.idle → flag idle; fire diff notification if pending
      if (event.type === "session.idle") {
        isIdle = true;
        saveIDEState("vscode");
        saveIDEState("pycharm");
        if (pendingDiffSinceIdle) {
          pendingDiffSinceIdle = false;
          const livePets = getActivePets().filter(p => p.state.alive);
          for (const p of livePets) {
            const phrase = pickRandom(SESSION_DIFF_PHRASES);
            queueNotification(terminalEnabled
              ? buildSpeechBubble(p.state.stage, p.state.mood, phrase, p.state.name, p.state.spriteType)
              : `[${p.state.name}] ${phrase}`);
          }
        }
        return;
      }

      // todo.updated → celebrate completions
      if (event.type === "todo.updated") {
        const newTodos = new Map<string, string>(
          event.properties.todos.map((t: { id: string; status: string }) => [t.id, t.status])
        );
        for (const todo of event.properties.todos) {
          const oldStatus = prevTodos.get(todo.id) ?? null;
          const livePets = getActivePets().filter(p => p.state.alive && !p.state.sleeping);
          if (oldStatus !== "completed" && todo.status === "completed") {
            for (const p of livePets) {
              setPetState(p.ide, applyCodeActivity(p.state));
              saveIDEState(p.ide);
            }
            const phrase = pickRandom(TODO_COMPLETE_PHRASES)(todo.content);
            const rep = livePets[0];
            queueNotification(terminalEnabled && rep
              ? buildSpeechBubble(rep.state.stage, "happy", phrase, rep.state.name, rep.state.spriteType)
              : rep ? `[${rep.state.name}] ${phrase}` : phrase);
          } else if (oldStatus !== "in_progress" && todo.status === "in_progress") {
            const phrase = `On it: ${todo.content}.`;
            const rep = livePets[0];
            queueNotification(terminalEnabled && rep
              ? buildSpeechBubble(rep.state.stage, rep.state.mood, phrase, rep.state.name, rep.state.spriteType)
              : rep ? `[${rep.state.name}] ${phrase}` : phrase);
          } else if (oldStatus !== "cancelled" && todo.status === "cancelled") {
            const phrase = `Fair enough — ${todo.content} dropped.`;
            const rep = livePets[0];
            queueNotification(terminalEnabled && rep
              ? buildSpeechBubble(rep.state.stage, rep.state.mood, phrase, rep.state.name, rep.state.spriteType)
              : rep ? `[${rep.state.name}] ${phrase}` : phrase);
          }
        }
        prevTodos = newTodos;
        return;
      }

      // session.diff → mark changes arrived
      if (event.type === "session.diff") {
        if (event.properties.diff && event.properties.diff.length > 0) {
          pendingDiffSinceIdle = true;
        }
        return;
      }

      // vcs.branch.updated → comment on branch switches
      if (event.type === "vcs.branch.updated") {
        const branch = event.properties.branch;
        if (branch) {
          const phrase = `Switched to ${branch}. New mission?`;
          const rep = getActivePets().filter(p => p.state.alive)[0];
          queueNotification(terminalEnabled && rep
            ? buildSpeechBubble(rep.state.stage, rep.state.mood, phrase, rep.state.name, rep.state.spriteType)
            : rep ? `[${rep.state.name}] ${phrase}` : phrase);
        }
        return;
      }

      // server.connected → queue greeting
      if (event.type === "server.connected") {
        for (const p of getActivePets().filter(p => p.state.alive)) {
          const s = p.state;
          const greet = s.hunger < 30
            ? `Really hungry. Feed me when you get a chance (/codotchi feed)`
            : s.sick
            ? `Not feeling well. Need medicine (/codotchi medicine)`
            : s.energy < 20
            ? `Running on empty. Let me rest (/codotchi sleep)`
            : s.happiness < 30
            ? `Been a while. Pat me? (/codotchi pat)`
            : `Hey. Ready when you are.`;
          queueNotification(terminalEnabled
            ? buildSpeechBubble(s.stage, s.mood, greet, s.name, s.spriteType)
            : `[${s.name}] ${greet}`);
        }
        return;
      }

      // session.status → resume from idle
      if (event.type === "session.status") {
        isIdle = false;
        return;
      }
    },
  };
};

export default plugin;