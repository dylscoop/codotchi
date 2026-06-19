/**
 * index.ts
 *
 * opencode-codotchi — npm-distributable OpenCode plugin.
 * Brings your codotchi into any terminal as a living companion.
 *
 * What this plugin does:
 *   - Loads pet state from both VS Code and PyCharm per-IDE state files on startup.
 *     VS Code : %APPDATA%/codotchi/vscode/state.json  (~/.config/codotchi/vscode/state.json)
 *     PyCharm : %APPDATA%/codotchi/pycharm/state.json (~/.config/codotchi/pycharm/state.json)
 *   - Watches both files for live updates from whichever IDE is active.
 *   - Runs a tick timer every TICK_INTERVAL_SECONDS to advance the game.
 *   - Hooks into file.edited events to reward coding activity.
 *   - Hooks into session.idle to flag idle state.
 *   - Hooks into server.connected to queue a greeting notification.
   *   - Registers the `codotchi` custom tool for slash-command interactions.
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
import type { Plugin, PluginInput } from "@opencode-ai/plugin";
import { getIDEBase as _getIDEBase, resolveVSCodeStatePath } from "./statePathResolver.js";
import { sumCompletedAssistantUsage, extractTimestampedUsage, TimestampedUsageEntry } from "./usageBackfill.js";

import {
  PetState,
  GameConfig,
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
  createPet,
  DEFAULT_GAME_CONFIG,
  TICK_INTERVAL_SECONDS,
  CODE_ACTIVITY_THROTTLE_SECONDS,
} from "./gameEngine.js";

import {
  buildSpeechBubble,
  buildStatusBlock,
  buildToast,
  buildContextualSpeech,
  formatTokens,
  formatCost,
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

// ---------------------------------------------------------------------------
// OpenCode-local pet config — unkillable from neglect, normal aging speed
// ---------------------------------------------------------------------------

/** GameConfig used for the OpenCode-local pet: health floored at 1 (never dies
 *  from stat decay), but aging runs at the normal 1× rate (not the 10× dev speed). */
const LOCAL_PET_GAME_CONFIG: GameConfig = {
  ...DEFAULT_GAME_CONFIG,
  devMode: true,
  devModeHealthFloor: 1,
  devModeAgingMultiplier: 1,
};

/** Name pool for auto-created OpenCode-local pets. */
const LOCAL_PET_NAMES = ["Copilot"];

function getIDEBase(): string {
  return _getIDEBase();
}

/** Delegates to statePathResolver — scans for most-recently-modified state.json. */
function getVSCodeStatePath(): string {
  return resolveVSCodeStatePath();
}

function getPyCharmStatePath(): string {
  return path.join(getIDEBase(), "codotchi", "pycharm", "state.json");
}

/** Migrate state files from old gotchi/ folder to codotchi/ on first run. */
function migrateStateFolders(): void {
  const base = getIDEBase();
  const migrations: Array<[string, string]> = [
    [path.join(base, "gotchi", "vscode", "state.json"),  path.join(base, "codotchi", "vscode",  "state.json")],
    [path.join(base, "gotchi", "pycharm", "state.json"), path.join(base, "codotchi", "pycharm", "state.json")],
  ];
  for (const [oldPath, newPath] of migrations) {
    try {
      if (fs.existsSync(newPath)) { continue; }
      if (!fs.existsSync(oldPath)) { continue; }
      const newDir = path.dirname(newPath);
      if (!fs.existsSync(newDir)) { fs.mkdirSync(newDir, { recursive: true }); }
      fs.copyFileSync(oldPath, newPath);
    } catch { /* best-effort */ }
  }
}

interface IDEStateFile {
  state: Record<string, unknown>;
  savedAt: number;
  terminalEnabled?: boolean;
}

interface LocalStateFile {
  state: Record<string, unknown>;
  savedAt: number;
  createdDate?: string; // UTC date string "YYYY-MM-DD"
  totalMessages?: number; // Cumulative message count across days
}

function loadFromIDEFile(filePath: string): { state: PetState; savedAt: number; terminalEnabled: boolean } | null {
  try {
    if (!fs.existsSync(filePath)) { return null; }
    const raw = JSON.parse(fs.readFileSync(filePath, "utf8")) as IDEStateFile;
    if (!raw.state || typeof raw.savedAt !== "number") { return null; }
    return {
      state: deserialiseState(raw.state),
      savedAt: raw.savedAt,
      terminalEnabled: raw.terminalEnabled ?? true,
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
// Daily usage sidecar helpers
// ---------------------------------------------------------------------------

function getDailyUsagePath(): string {
  return path.join(os.homedir(), ".config", "opencode", "codotchi-daily.json");
}

function todayUTC(): string {
  return new Date().toISOString().slice(0, 10);
}

function loadDailyUsage(): void {
  try {
    const filePath = getDailyUsagePath();
    if (!fs.existsSync(filePath)) { return; }
    const raw = JSON.parse(fs.readFileSync(filePath, "utf8")) as { date?: string; costUSD?: number; tokens?: number };
    const today = todayUTC();
    if (raw.date === today) {
      dailyCostUSD = typeof raw.costUSD === "number" ? raw.costUSD : 0;
      dailyTokens  = typeof raw.tokens  === "number" ? raw.tokens  : 0;
      dailyDate    = today;
    }
    // If stored date differs it's a new day — keep zeroed defaults
  } catch { /* best-effort */ }
}

function saveDailyUsage(): void {
  try {
    const filePath = getDailyUsagePath();
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) { fs.mkdirSync(dir, { recursive: true }); }
    fs.writeFileSync(filePath, JSON.stringify({ date: dailyDate, costUSD: dailyCostUSD, tokens: dailyTokens }), "utf8");
  } catch { /* best-effort */ }
}

function checkDayRollover(): void {
  const today = todayUTC();
  if (dailyDate !== today) {
    dailyCostUSD = 0;
    dailyTokens  = 0;
    dailyDate    = today;
    // Daily reset for OpenCode-local pet — respawn with same name and message count
    if (localPetState !== null && localPetState.alive) {
      createLocalPet();
      advanceLocalPetStageIfNeeded();
    }
  }
}

// ---------------------------------------------------------------------------
// Backfill daily usage from historical sessions on startup
// ---------------------------------------------------------------------------

/**
 * On startup, the module-level dailyCostUSD / dailyTokens accumulators are
 * seeded from the sidecar file (which only records what was observed during
 * previous plugin runs). This async helper queries the OpenCode API for all
 * sessions that were active today and sums the cost + tokens across every
 * completed AssistantMessage, then replaces the sidecar values if the API
 * total is larger (to avoid double-counting live events already received).
 *
 * It is called fire-and-forget from the plugin entry point so startup is
 * never delayed or blocked by API latency.
 */
async function backfillDailyUsage(client: PluginInput["client"]): Promise<void> {
  try {
    const today = todayUTC();
    const todayStartMs = new Date(today + "T00:00:00.000Z").getTime();

    const listResult = await client.session.list();
    const sessions = listResult.data ?? [];

    // Only fetch messages for sessions that were active today
    const todaySessions = sessions.filter(
      (s) => s.time.updated >= todayStartMs
    );

    let backfilledCost   = 0;
    let backfilledTokens = 0;
    const oneHourAgo = Date.now() - 3_600_000;
    const backfilledEvents: TimestampedUsageEntry[] = [];

    for (const s of todaySessions) {
      try {
        const msgResult = await client.session.messages({ path: { id: s.id } });
        const messages = msgResult.data ?? [];
        const totals = sumCompletedAssistantUsage(messages);
        backfilledCost   += totals.costUSD;
        backfilledTokens += totals.tokens;
        // Collect last-1h events from historical messages
        const timestamped = extractTimestampedUsage(messages);
        for (const e of timestamped) {
          if (e.completedAt >= oneHourAgo) {
            backfilledEvents.push(e);
          }
        }
      } catch { /* skip individual session errors — best-effort */ }
    }

    // Only overwrite if the API total exceeds what we already have from
    // the sidecar + live events so far (prevents double-counting).
    checkDayRollover();
    if (backfilledCost > dailyCostUSD) {
      dailyCostUSD = backfilledCost;
    }
    if (backfilledTokens > dailyTokens) {
      dailyTokens = backfilledTokens;
    }
    if (backfilledCost > 0 || backfilledTokens > 0) {
      dailyDate = today;
      saveDailyUsage();
    }
    // Merge backfilled last-1h events — replace buffer with backfill result
    // (backfill is the authoritative source; live events will append from here on)
    if (backfilledEvents.length > 0) {
      costEvents = backfilledEvents;
    }
  } catch { /* best-effort — never block startup */ }
}

// ---------------------------------------------------------------------------
// Plugin config sidecar helpers (cost speech thresholds)
// ---------------------------------------------------------------------------

function getPluginConfigPath(): string {
  return path.join(os.homedir(), ".config", "opencode", "codotchi-config.json");
}

function loadPluginConfig(): void {
  try {
    const filePath = getPluginConfigPath();
    if (!fs.existsSync(filePath)) { return; }
    const raw = JSON.parse(fs.readFileSync(filePath, "utf8")) as { costWarnThreshold?: number; costShoutThreshold?: number };
    if (typeof raw.costWarnThreshold  === "number" && raw.costWarnThreshold  > 0) { costWarnThreshold  = raw.costWarnThreshold; }
    if (typeof raw.costShoutThreshold === "number" && raw.costShoutThreshold > 0) { costShoutThreshold = raw.costShoutThreshold; }
  } catch { /* best-effort */ }
}

function savePluginConfig(): void {
  try {
    const filePath = getPluginConfigPath();
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) { fs.mkdirSync(dir, { recursive: true }); }
    fs.writeFileSync(filePath, JSON.stringify({ costWarnThreshold, costShoutThreshold }), "utf8");
  } catch { /* best-effort */ }
}

// ---------------------------------------------------------------------------
// OpenCode-local pet sidecar helpers
// ---------------------------------------------------------------------------

function getLocalStatePath(): string {
  return path.join(os.homedir(), ".config", "opencode", "codotchi-local.json");
}

/** Total messages (persisted across daily resets) for message-based aging. */
let localPetTotalMessages = 0;

/** Message thresholds for stage progression. 100 messages per stage, doubling interval. */
function stageForMessages(n: number): string {
  if (n < 100) return "baby";
  if (n < 300) return "child";
  if (n < 700) return "teen";
  if (n < 1500) return "adult";
  return "senior";
}

/** Pin companion stats to healthy values (no hunger, no decay). */
function pinnedCompanionStats(state: PetState): PetState {
  return {
    ...state,
    hunger: 100,
    happiness: 100,
    energy: 100,
    health: 100,
    sick: false,
    poops: 0,
  };
}

/** Advance local pet to the correct stage based on total message count. */
function advanceLocalPetStageIfNeeded(): void {
  if (localPetState === null || !localPetState.alive) { return; }
  const targetStage = stageForMessages(localPetTotalMessages);
  if (targetStage === localPetState.stage) { return; }
  
  // Advance stage using type assertion
  const updated: any = {
    ...localPetState,
    stage: targetStage,
  };
  localPetState = pinnedCompanionStats(updated);
  
  // Queue evolution notification
  const ideLabel = "[OpenCode]";
  const stageName = targetStage;
  queueNotification(terminalEnabled && localPetState
    ? buildSpeechBubble(localPetState.stage, localPetState.mood, pickRandom([`I evolved into a ${stageName}!`, `I'm a ${stageName} now!`, `Growing up — now a ${stageName}.`]), localPetState.name, localPetState.spriteType, ideLabel)
    : `${ideLabel} ${localPetState.name}: ${pickRandom([`I evolved into a ${stageName}!`, `I'm a ${stageName} now!`, `Growing up — now a ${stageName}.`])}`);
  
  saveLocalState();
}

function loadLocalState(): void {
  try {
    const filePath = getLocalStatePath();
    if (!fs.existsSync(filePath)) {
      createLocalPet();
      return;
    }
    const raw = JSON.parse(fs.readFileSync(filePath, "utf8")) as LocalStateFile;
    if (!raw.state || typeof raw.savedAt !== "number") {
      createLocalPet();
      return;
    }
    
    // Load persistent message count before checking date
    localPetTotalMessages = typeof raw.totalMessages === "number" ? raw.totalMessages : 0;
    
    // Check if the pet was created on a different day — if so, respawn
    const createdDate = raw.createdDate ?? null;
    const today = todayUTC();
    if (createdDate !== today) {
      // New day — respawn the pet and set its stage based on message count
      createLocalPet();
      advanceLocalPetStageIfNeeded();
      return;
    }
    
    const elapsed = (Date.now() - raw.savedAt) / 1_000;
    localPetState    = pinnedCompanionStats(applyOfflineDecay(deserialiseState(raw.state), elapsed));
    localLastSavedAt = raw.savedAt;
    localMeals = 0;
    // If the pet is dead (old age), immediately respawn
    if (!localPetState.alive) {
      createLocalPet();
      advanceLocalPetStageIfNeeded();
    }
  } catch {
    createLocalPet();
  }
}

function saveLocalState(): void {
  try {
    if (localPetState === null) { return; }
    const filePath = getLocalStatePath();
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) { fs.mkdirSync(dir, { recursive: true }); }
    const payload: LocalStateFile = {
      state: serialiseState(localPetState) as Record<string, unknown>,
      savedAt: Date.now(),
      createdDate: todayUTC(),
      totalMessages: localPetTotalMessages,
    };
    fs.writeFileSync(filePath, JSON.stringify(payload), "utf8");
    localLastSavedAt = payload.savedAt;
  } catch { /* best-effort */ }
}

function createLocalPet(): void {
  const name = pickRandom(LOCAL_PET_NAMES);
  localPetState = pinnedCompanionStats(createPet(name, "codeling"));
  // Set the stage based on current message count
  (localPetState as any).stage = stageForMessages(localPetTotalMessages);
  localMeals = 0;
  saveLocalState();
  queueNotification(terminalEnabled && localPetState
    ? buildSpeechBubble(localPetState.stage, localPetState.mood,
        `Hi! I'm ${name}. I live in OpenCode — no IDE needed.`,
        name, localPetState.spriteType, "[OpenCode]")
    : `[OpenCode] ${name}: Hi! I'm ${name}. I live in OpenCode — no IDE needed.`);
}

// ---------------------------------------------------------------------------
// Meals-per-cycle counters (plugin-local, reset on wake, one per source)
// ---------------------------------------------------------------------------

let vscodeMeals  = 0;
let pycharmMeals = 0;
let localMeals   = 0;

// ---------------------------------------------------------------------------
// Plugin state — dual-pet (VS Code + PyCharm, independent)
// ---------------------------------------------------------------------------

/** VS Code pet state, or null if no VS Code state file exists. */
let vscodePetState:    PetState | null = null;
let vscodeLastSavedAt: number = 0;

/** PyCharm pet state, or null if no PyCharm state file exists. */
let pycharmPetState:    PetState | null = null;
let pycharmLastSavedAt: number = 0;

/** OpenCode-local pet — always exists, unkillable from neglect. */
let localPetState:    PetState | null = null;
let localLastSavedAt: number = 0;

let tickTimer: ReturnType<typeof setInterval> | undefined;
let isIdle = false;
let lastCodeActivityMs = 0;

// ---------------------------------------------------------------------------
// Display toggle (default on)
// ---------------------------------------------------------------------------

let terminalEnabled = true;

// ---------------------------------------------------------------------------
// Session coding activity stats (for contextual speech bubble commentary)
// ---------------------------------------------------------------------------

let sessionFilesEdited = 0;
let sessionStartMs = Date.now();
/** Unix ms of the last file.edited event; used to detect long idle stretches. */
let lastFileEditMs = 0;
/** Number of user messages sent this session; used for prompting-a-lot commentary. */
let sessionUserMessages = 0;
/** True once the "can I help?" offer has been shown this session — fires only once. */
let hasOfferedHelp = false;

// ---------------------------------------------------------------------------
// Daily usage tracking (persisted to codotchi-daily.json sidecar)
// Accumulates cost + token spend across all OpenCode sessions today (UTC).
// ---------------------------------------------------------------------------

/** Session-level cost accumulator (reset on session.created). */
let sessionCostUSD = 0;
/** Session-level token accumulator (reset on session.created). */
let sessionTokens  = 0;
/** How many assistant messages this session (drives local-pet evolution). */
let localPetSessionMessages = 0;

/** Running daily USD cost (loaded from sidecar, reset at UTC midnight). */
let dailyCostUSD = 0;
/** Running daily token count (loaded from sidecar, reset at UTC midnight). */
let dailyTokens  = 0;
/** UTC date string "YYYY-MM-DD" for the currently stored daily totals. */
let dailyDate    = "";

// ---------------------------------------------------------------------------
// Rolling last-1h cost buffer (in-memory only, backfilled on startup)
// ---------------------------------------------------------------------------

/** Each entry represents one completed assistant message with its timestamp. */
let costEvents: TimestampedUsageEntry[] = [];

/** Sum cost and tokens for all events completed within the last 60 minutes. */
function lastHourUsage(): { costUSD: number; tokens: number } {
  const cutoff = Date.now() - 3_600_000;
  let costUSD = 0;
  let tokens  = 0;
  for (const e of costEvents) {
    if (e.completedAt >= cutoff) {
      costUSD += e.costUSD;
      tokens  += e.tokens;
    }
  }
  return { costUSD, tokens };
}

// ---------------------------------------------------------------------------
// Configurable cost speech thresholds (persisted to codotchi-config.json)
// ---------------------------------------------------------------------------

/** Daily cost (USD) at which the pet switches to a warning tone. */
let costWarnThreshold  = 30;
/** Daily cost (USD) at which the pet switches to ALL CAPS shouting. */
let costShoutThreshold = 50;

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
/** True when the current branch is main, master, release/x, or prod — triggers cautious diff commentary. */
let isOnProdBranch = false;

// ---------------------------------------------------------------------------
// Suppress text.complete art for one cycle after a codotchi tool call.
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

/** Prepend msg to the front of the pending notification queue (so it appears before any already-queued messages). */
function prependNotification(msg: string): void {
  pendingNotification = pendingNotification ? msg + "\n" + pendingNotification : msg;
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
      const _1h0 = lastHourUsage();
      const { message: speech, bubbleColor } = buildContextualSpeech(p.state, sessionFilesEdited, Date.now() - sessionStartMs, lastFileEditMs > 0 ? Date.now() - lastFileEditMs : 0, sessionUserMessages, isOnProdBranch, dailyCostUSD, dailyTokens, costWarnThreshold, costShoutThreshold, _1h0.costUSD, _1h0.tokens);
      const ideLabel = p.ide === "vscode" ? "[VS Code]" : p.ide === "pycharm" ? "[PyCharm]" : "[OpenCode]";
      return buildSpeechBubble(p.state.stage, p.state.mood, speech, p.state.name, p.state.spriteType, ideLabel, bubbleColor);
    })
    .join("\n") + "\n";
}

// ---------------------------------------------------------------------------
// Active-pet helpers
// ---------------------------------------------------------------------------

interface ActivePet {
  ide:   "vscode" | "pycharm" | "opencode";
  state: PetState;
  /** Whether this IDE is currently ticking (savedAt within ACTIVE_IDE_THRESHOLD_MS). */
  live:  boolean;
}

/**
 * Returns pets to show in the current interaction:
 *   - All IDEs whose state file was saved within ACTIVE_IDE_THRESHOLD_MS → "live"
 *   - The OpenCode-local pet is shown when no IDE pet is live.
 *   - At least one pet is always returned if any alive pet exists.
 */
function getActivePets(): ActivePet[] {
  const now = Date.now();
  const idePets: ActivePet[] = [];

  if (vscodePetState !== null && vscodePetState.alive) {
    const live = (now - vscodeLastSavedAt) <= ACTIVE_IDE_THRESHOLD_MS;
    idePets.push({ ide: "vscode",  state: vscodePetState,  live });
  }
  if (pycharmPetState !== null && pycharmPetState.alive) {
    const live = (now - pycharmLastSavedAt) <= ACTIVE_IDE_THRESHOLD_MS;
    idePets.push({ ide: "pycharm", state: pycharmPetState, live });
  }

  const liveIDEPets = idePets.filter(p => p.live);

  // If any IDE pet is live, return only those — local pet steps aside
  if (liveIDEPets.length > 0) { return liveIDEPets; }

  // No live IDE pet — show the local pet (always "live" in-process)
  if (localPetState !== null && localPetState.alive) {
    return [{ ide: "opencode", state: localPetState, live: true }];
  }

  // Fallback: IDE pets exist but none live — return most recently saved alive IDE pet
  if (idePets.length > 0) {
    const newest = idePets.reduce((a, b) =>
      (a.ide === "vscode" ? vscodeLastSavedAt : pycharmLastSavedAt) >=
      (b.ide === "vscode" ? vscodeLastSavedAt : pycharmLastSavedAt) ? a : b
    );
    return [newest];
  }

  // No alive pet at all — include dead IDE pets for the "died" message
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
  // Last resort: return local pet even if dead
  if (localPetState !== null) {
    return [{ ide: "opencode", state: localPetState, live: false }];
  }
  return [];
}

function getMeals(ide: "vscode" | "pycharm" | "opencode"): number {
  if (ide === "vscode") { return vscodeMeals; }
  if (ide === "pycharm") { return pycharmMeals; }
  return localMeals;
}
function setMeals(ide: "vscode" | "pycharm" | "opencode", n: number): void {
  if (ide === "vscode") { vscodeMeals = n; }
  else if (ide === "pycharm") { pycharmMeals = n; }
  else { localMeals = n; }
}
function getSavedAt(ide: "vscode" | "pycharm" | "opencode"): number {
  if (ide === "vscode") { return vscodeLastSavedAt; }
  if (ide === "pycharm") { return pycharmLastSavedAt; }
  return localLastSavedAt;
}
function setSavedAt(ide: "vscode" | "pycharm" | "opencode", t: number): void {
  if (ide === "vscode") { vscodeLastSavedAt = t; }
  else if (ide === "pycharm") { pycharmLastSavedAt = t; }
  else { localLastSavedAt = t; }
}
function setPetState(ide: "vscode" | "pycharm" | "opencode", s: PetState): void {
  if (ide === "vscode") { vscodePetState = s; }
  else if (ide === "pycharm") { pycharmPetState = s; }
  else { localPetState = s; }
}
function getStatePath(ide: "vscode" | "pycharm"): string {
  return ide === "vscode" ? getVSCodeStatePath() : getPyCharmStatePath();
}

// ---------------------------------------------------------------------------
// Load / save / tick
// ---------------------------------------------------------------------------

/** Load all IDE state files + local pet on startup. */
function loadAllStates(): void {
  const vscodeFile  = loadFromIDEFile(getVSCodeStatePath());
  if (vscodeFile !== null) {
    const elapsed = (Date.now() - vscodeFile.savedAt) / 1_000;
    vscodePetState    = applyOfflineDecay(vscodeFile.state, elapsed);
    vscodeLastSavedAt = vscodeFile.savedAt;
    vscodeMeals = 0;
    // Restore terminalEnabled from the VS Code state file (respects explicit off)
    terminalEnabled = vscodeFile.terminalEnabled;
  }
  const pycharmFile = loadFromIDEFile(getPyCharmStatePath());
  if (pycharmFile !== null) {
    const elapsed = (Date.now() - pycharmFile.savedAt) / 1_000;
    pycharmPetState    = applyOfflineDecay(pycharmFile.state, elapsed);
    pycharmLastSavedAt = pycharmFile.savedAt;
    pycharmMeals = 0;
  }
  // Always load (or create) the OpenCode-local pet
  loadLocalState();
}

function saveIDEState(ide: "vscode" | "pycharm" | "opencode"): void {
  if (ide === "opencode") {
    saveLocalState();
    return;
  }
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

  const ideLabel = ide === "vscode" ? "[VS Code]" : "[PyCharm]";

  for (const event of next.events) {
    switch (event) {
      case "auto_woke_up":
        setMeals(ide, 0);
        queueNotification(terminalEnabled
          ? buildSpeechBubble(next.stage, next.mood, pickRandom(["I feel rested! Time to code!", "Recharged. Ready to go.", "Back and ready."]), next.name, next.spriteType, ideLabel)
          : `${ideLabel} ${next.name}: ${pickRandom(["I feel rested! Time to code!", "Recharged. Ready to go.", "Back and ready."])}`);
        break;
      case "died":
        queueNotification(terminalEnabled
          ? buildSpeechBubble(next.stage, "sad", pickRandom(["Goodbye... take care of the next one.", "It was good while it lasted. See you next time.", "Farewell. Start fresh when you're ready."]), next.name, next.spriteType, ideLabel)
          : `${ideLabel} ${next.name}: ${pickRandom(["Goodbye... take care of the next one.", "It was good while it lasted. See you next time.", "Farewell. Start fresh when you're ready."])}`);
        break;
      case "died_of_old_age":
        queueNotification(terminalEnabled
          ? buildSpeechBubble(next.stage, "sleeping", pickRandom(["I lived a full life. Thank you for everything.", "What a journey. Thank you.", "A full life, well lived."]), next.name, next.spriteType, ideLabel)
          : `${ideLabel} ${next.name}: ${pickRandom(["I lived a full life. Thank you for everything.", "What a journey. Thank you.", "A full life, well lived."])}`);
        break;
      case "evolved_to_baby":
      case "evolved_to_child":
      case "evolved_to_teen":
      case "evolved_to_adult":
      case "evolved_to_senior": {
        const stageName = event.replace("evolved_to_", "");
        queueNotification(terminalEnabled
          ? buildSpeechBubble(next.stage, next.mood, pickRandom([`I evolved into a ${stageName}!`, `I'm a ${stageName} now!`, `Growing up — now a ${stageName}.`]), next.name, next.spriteType, ideLabel)
          : `${ideLabel} ${next.name}: ${pickRandom([`I evolved into a ${stageName}!`, `I'm a ${stageName} now!`, `Growing up — now a ${stageName}.`])}`);
        break;
      }
      case "attention_call_hunger":
        queueNotification(terminalEnabled
          ? buildSpeechBubble(next.stage, "sad", pickRandom(["I'm so hungry... please feed me!", "Running on empty. Feed me soon!", "Really need food right now."]), next.name, next.spriteType, ideLabel)
          : `${ideLabel} ${next.name}: ${pickRandom(["I'm so hungry... please feed me!", "Running on empty. Feed me soon!", "Really need food right now."])}`);
        break;
      case "attention_call_unhappiness":
        queueNotification(terminalEnabled
          ? buildSpeechBubble(next.stage, "sad", pickRandom(["I want to play", "Getting lonely over here.", "Need some attention."]), next.name, next.spriteType, ideLabel)
          : `${ideLabel} ${next.name}: ${pickRandom(["I want to play", "Getting lonely over here.", "Need some attention."])}`);
        break;
      case "attention_call_sick":
        queueNotification(terminalEnabled
          ? buildSpeechBubble(next.stage, "sick", pickRandom(["I don't feel well. I need medicine!", "Feeling sick... please give me medicine.", "Medicine please!"]), next.name, next.spriteType, ideLabel)
          : `${ideLabel} ${next.name}: ${pickRandom(["I don't feel well. I need medicine!", "Feeling sick... please give me medicine.", "Medicine please!"])}`);
        break;
      case "attention_call_critical_health":
        queueNotification(terminalEnabled
          ? buildSpeechBubble(next.stage, "sick", pickRandom(["My health is critical! Please help me!", "I'm in rough shape. Need help!", "Critical health — please help."]), next.name, next.spriteType, ideLabel)
          : `${ideLabel} ${next.name}: ${pickRandom(["My health is critical! Please help me!", "I'm in rough shape. Need help!", "Critical health — please help."])}`);
        break;
      case "attention_call_low_energy":
        queueNotification(terminalEnabled
          ? buildSpeechBubble(next.stage, "sad", pickRandom(["I'm exhausted... let me sleep!", "Nearly out of energy. Need to rest.", "So tired... let me sleep."]), next.name, next.spriteType, ideLabel)
          : `${ideLabel} ${next.name}: ${pickRandom(["I'm exhausted... let me sleep!", "Nearly out of energy. Need to rest.", "So tired... let me sleep."])}`);
        break;
      case "became_sick":
        queueNotification(buildToast(next.stage, `${ideLabel} ${next.name} has fallen sick.`));
        break;
      case "pooped":
        queueNotification(buildToast(next.stage, `${ideLabel} ${next.name} made a mess! (use /codotchi clean)`));
        break;
      case "attention_call_poop":
        queueNotification(terminalEnabled
          ? buildSpeechBubble(next.stage, "sad", pickRandom(["There is a mess here! Can you clean it up?", "It's getting messy. Please clean!", "Could use a clean-up in here."]), next.name, next.spriteType, ideLabel)
          : `${ideLabel} ${next.name}: ${pickRandom(["There is a mess here! Can you clean it up?", "It's getting messy. Please clean!", "Could use a clean-up in here."])}`);
        break;
      case "attention_call_gift":
        queueNotification(terminalEnabled
          ? buildSpeechBubble(next.stage, "happy", pickRandom(["I brought you a gift! Use /codotchi pat to accept it.", "I have a surprise for you! (/codotchi pat)", "Got something for you — /codotchi pat to collect."]), next.name, next.spriteType, ideLabel)
          : `${ideLabel} ${next.name}: ${pickRandom(["I brought you a gift! Use /codotchi pat to accept it.", "I have a surprise for you! (/codotchi pat)", "Got something for you — /codotchi pat to collect."])}`);
        break;
      case "attention_call_misbehaviour":
        queueNotification(terminalEnabled
          ? buildSpeechBubble(next.stage, "neutral", pickRandom(["I'm acting up! Use /codotchi pat or /codotchi feed to discipline me.", "I need some discipline. (/codotchi pat)", "Being difficult. (/codotchi pat or /codotchi feed)"]), next.name, next.spriteType, ideLabel)
          : `${ideLabel} ${next.name}: ${pickRandom(["I'm acting up! Use /codotchi pat or /codotchi feed to discipline me.", "I need some discipline. (/codotchi pat)", "Being difficult. (/codotchi pat or /codotchi feed)"])}`);
        break;
    }
  }
}

function applyTick(): void {
  applyTickForPet("vscode");
  applyTickForPet("pycharm");
  applyTickForLocal();
}

// ---------------------------------------------------------------------------
// OpenCode-local pet tick
// ---------------------------------------------------------------------------

function applyTickForLocal(): void {
  if (localPetState === null || !localPetState.alive) { return; }
  const next = tick(localPetState, isIdle, false, LOCAL_PET_GAME_CONFIG);
  // Pin stats to healthy values for companion-only mode
  localPetState = pinnedCompanionStats(next);
  saveLocalState();

  const ideLabel = "[OpenCode]";

  // Only handle evolution events; ignore all stat-based events (hunger, happiness, etc.)
  for (const event of next.events) {
    switch (event) {
      case "evolved_to_baby":
      case "evolved_to_child":
      case "evolved_to_teen":
      case "evolved_to_adult":
      case "evolved_to_senior": {
        const stageName = event.replace("evolved_to_", "");
        queueNotification(terminalEnabled && localPetState
          ? buildSpeechBubble(localPetState.stage, localPetState.mood, pickRandom([`I evolved into a ${stageName}!`, `I'm a ${stageName} now!`, `Growing up — now a ${stageName}.`]), localPetState.name, localPetState.spriteType, ideLabel)
          : `${ideLabel} ${localPetState.name}: ${pickRandom([`I evolved into a ${stageName}!`, `I'm a ${stageName} now!`, `Growing up — now a ${stageName}.`])}`);
        break;
      }
      // All other events (hunger, happiness, energy, sickness, poop, gift,
      // misbehaviour, etc.) are intentionally ignored for the OpenCode-local pet —
      // its stats are pinned to healthy values and do not require user attention.
    }
  }
}

// ---------------------------------------------------------------------------
// Plugin entry point
// ---------------------------------------------------------------------------

export const plugin: Plugin = async (ctx) => {
  // Migrate state files from old gotchi/ folder to codotchi/ on first run.
  migrateStateFolders();
  // Load daily usage + plugin config sidecars
  loadDailyUsage();
  loadPluginConfig();
  // Backfill daily usage from historical sessions (fire-and-forget)
  backfillDailyUsage(ctx.client).catch(() => { /* best-effort */ });
  // Load all IDE state files + local pet on startup — queue greetings as pending notifications
  loadAllStates();

  for (const p of getActivePets().filter(p => p.state.alive)) {
    const s = p.state;
    const ideLabel = p.ide === "vscode" ? "[VS Code]" : p.ide === "pycharm" ? "[PyCharm]" : "[OpenCode]";
    const greetMsg = p.ide === "opencode"
      ? `I'm here. I live in OpenCode — no IDE needed.`
      : `I'm here. ${
          s.hunger < 30 ? "Pretty hungry though." :
          s.sick        ? "Not feeling great."    :
          s.energy < 20 ? "A bit tired."          :
          pickRandom(["Let's get to work.", "Let's build something."])
        }`;
    queueNotification(terminalEnabled
      ? buildSpeechBubble(s.stage, s.mood, greetMsg, s.name, s.spriteType, ideLabel)
      : `${ideLabel} ${s.name}: ${greetMsg}`);
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
      const prevState = ide === "vscode" ? vscodePetState : pycharmPetState;
      const wasDeadOrAbsent = prevState === null || !prevState.alive;
      const nowAlive = loaded.state.alive;
      // New pet spawned: flush stale queued notifications from the dead pet
      if (wasDeadOrAbsent && nowAlive) { pendingNotification = null; }
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
  const codotchiTool = tool({
    description:
      "Interact with your codotchi virtual pet. Use action='status' to see current stats, " +
      "or one of: feed, pat, sleep, clean, medicine, on, off. " +
      "Use warnthreshold <value> or shoutthreshold <value> to set the daily USD cost thresholds " +
      "at which the pet's speech changes tone (defaults: warn=$30, shout=$50). " +
      "Use rename <new-name> to rename the built-in OpenCode pet only (does not affect VS Code or PyCharm pets). " +
      "Actions apply to all currently active pets (VS Code, PyCharm, or the built-in OpenCode pet). " +
      "This tool reads state from VS Code, PyCharm, and the local OpenCode pet — do NOT use any other codotchi tool.",
    args: {
      action: tool.schema
        .enum(["status", "feed", "pat", "sleep", "clean", "medicine", "on", "off", "warnthreshold", "shoutthreshold", "rename"])
        .describe("The action to perform"),
      value: tool.schema
        .number()
        .optional()
        .describe("Numeric USD value for warnthreshold or shoutthreshold actions"),
      name: tool.schema
        .string()
        .optional()
        .describe("New name for the OpenCode pet — used with the rename action only"),
    },
    async execute({ action, value, name }, context) {
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
        if (terminalEnabled) {
          return ret(notification + "ASCII art is already enabled.");
        }
        terminalEnabled = true;
        saveTerminalEnabled();
        const art = artHeader();
        return ret(notification + art + "ASCII art enabled.");
      }

      if (action === "off") {
        terminalEnabled = false;
        saveTerminalEnabled();
        return ret(notification + "ASCII art disabled. Stats will be shown as plain text.");
      }

      // ---------------------------------------------------------------------------
      // warnthreshold / shoutthreshold — configure cost speech tiers
      // ---------------------------------------------------------------------------
      if (action === "warnthreshold" || action === "shoutthreshold") {
        if (typeof value !== "number" || value <= 0) {
          return ret(notification + `Please provide a positive number, e.g. /codotchi ${action} 40`);
        }
        if (action === "warnthreshold") {
          if (value >= costShoutThreshold) {
            return ret(notification + `Warning threshold ($${value}) must be less than the shout threshold ($${costShoutThreshold}). Adjust the shout threshold first if needed.`);
          }
          costWarnThreshold = value;
          savePluginConfig();
          return ret(notification + `Cost warning threshold set to $${value}. The pet will switch to a warning tone when daily spend reaches this amount.`);
        } else {
          if (value <= costWarnThreshold) {
            return ret(notification + `Shout threshold ($${value}) must be greater than the warning threshold ($${costWarnThreshold}). Adjust the warn threshold first if needed.`);
          }
          costShoutThreshold = value;
          savePluginConfig();
          return ret(notification + `Cost shouting threshold set to $${value}. The pet will shout in ALL CAPS when daily spend reaches this amount.`);
        }
      }
      // ---------------------------------------------------------------------------
      // rename — change the OpenCode-local pet's display name
      // ---------------------------------------------------------------------------
      if (action === "rename") {
        const newName = (name ?? "").trim();
        if (!newName) {
          return ret(notification + "Please provide a name, e.g. /codotchi rename Pixel");
        }
        if (!localPetState) {
          return ret(notification + "No local OpenCode pet to rename.");
        }
        const oldName = localPetState.name;
        localPetState = { ...localPetState, name: newName } as PetState;
        saveLocalState();
        const bubble = terminalEnabled && localPetState
          ? buildSpeechBubble(localPetState.stage, localPetState.mood,
              `${oldName} is now ${newName}. Got it.`,
              newName, localPetState.spriteType, "[OpenCode]")
          : `[OpenCode] ${newName}: ${oldName} is now ${newName}. Got it.`;
        return ret(notification + bubble);
      }

      // ---------------------------------------------------------------------------
      // All other actions — at least one pet is always available (local pet fallback)
      // ---------------------------------------------------------------------------
      const allDead = active.every(p => !p.state.alive);
      if (allDead) {
        const names = active.map(p => p.state.name).join(" and ");
        return ret(notification + `${names} has passed away. Start a new game in VS Code or PyCharm to continue, or wait — the OpenCode pet will respawn automatically.`);
      }

      // Only operate on alive pets
      const alivePets = active.filter(p => p.state.alive);

      switch (action) {
        case "status": {
          // Show stacked status block (art + stats) for each active alive pet.
          const blocks = alivePets.map(p => {
            const s = p.state;
            const ideLabel = p.ide === "vscode" ? "[VS Code]" : p.ide === "pycharm" ? "[PyCharm]" : "[OpenCode]";
            
            // OpenCode-local pet: show ASCII art with cost, no stat bars
            if (p.ide === "opencode") {
              const _1h1 = lastHourUsage();
              const { message: costMsg } = buildContextualSpeech(s, sessionFilesEdited, Date.now() - sessionStartMs, lastFileEditMs > 0 ? Date.now() - lastFileEditMs : 0, sessionUserMessages, isOnProdBranch, dailyCostUSD, dailyTokens, costWarnThreshold, costShoutThreshold, _1h1.costUSD, _1h1.tokens);
              const artBlock = terminalEnabled
                ? buildSpeechBubble(s.stage, s.mood, costMsg, s.name, s.spriteType, ideLabel)
                : "";
              const textStats = `${ideLabel} ${s.name} | Stage: ${s.stage} | Daily cost: ${formatCost(dailyCostUSD)}`;
              return (artBlock ? artBlock + "\n" : "") + textStats;
            }
            
            // IDE pets: show full stat blocks
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
             // Skip OpenCode-local pet
             if (p.ide === "opencode") {
               feedLines.push(`[OpenCode] I'm just a companion — I don't need feeding.`);
               continue;
             }
             const s = p.state;
             const meals = getMeals(p.ide);
             const pLabel = p.ide === "vscode" ? "VS Code" : "PyCharm";
             if (s.sleeping) {
               feedLines.push(`[${pLabel}] ${s.name} is sleeping and can't eat right now.`);
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
               ? `[${pLabel}] Meal refused — ${next.name} has already had ${getMeals(p.ide)} meals this wake cycle.`
               : `[${pLabel}] Fed ${next.name}. Hunger: ${next.hunger}/100, Weight: ${next.weight}.`));
           }
           return ret(notification + feedLines.join("\n\n"));
         }

         case "pat": {
           const patLines: string[] = [];
           for (const p of alivePets) {
             // Skip OpenCode-local pet
             if (p.ide === "opencode") {
               patLines.push(`[OpenCode] I'm just a companion — I don't need pats.`);
               continue;
             }
             const s = p.state;
             const pLabel = p.ide === "vscode" ? "VS Code" : "PyCharm";
             if (s.sleeping) {
               patLines.push(`[${pLabel}] ${s.name} is sleeping.`);
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
               ? `[${pLabel}] Pat refused — ${next.name} is too exhausted.`
               : `[${pLabel}] Patted ${next.name}. Happiness: ${next.happiness}.`));
           }
           return ret(notification + patLines.join("\n\n"));
         }

         case "sleep": {
           const sleepLines: string[] = [];
           for (const p of alivePets) {
             // Skip OpenCode-local pet
             if (p.ide === "opencode") {
               sleepLines.push(`[OpenCode] I'm just a companion — I don't sleep.`);
               continue;
             }
             const pLabel = p.ide === "vscode" ? "VS Code" : "PyCharm";
             const next = sleep(p.state);
             const already = next.events.includes("already_sleeping");
             setPetState(p.ide, next);
             saveIDEState(p.ide);
             sleepLines.push((terminalEnabled
               ? buildSpeechBubble(next.stage, next.mood, already ? "Already snoozing. Zzzz..." : "Goodnight!", next.name, next.spriteType) + "\n"
               : "") + (already
               ? `[${pLabel}] ${next.name} is already sleeping.`
               : `[${pLabel}] ${next.name} is now sleeping. Energy will recharge.`));
           }
           return ret(notification + sleepLines.join("\n\n"));
         }

         case "clean": {
           const cleanLines: string[] = [];
           for (const p of alivePets) {
             // Skip OpenCode-local pet
             if (p.ide === "opencode") {
               cleanLines.push(`[OpenCode] I'm just a companion — I don't need cleaning.`);
               continue;
             }
             const pLabel = p.ide === "vscode" ? "VS Code" : "PyCharm";
             const next = clean(p.state);
             const already = next.events.includes("already_clean");
             setPetState(p.ide, next);
             saveIDEState(p.ide);
             const toast = buildToast(next.stage, already
               ? `${next.name}'s area is already clean.`
               : `Cleaned up after ${next.name}.`);
             cleanLines.push((terminalEnabled
               ? buildSpeechBubble(next.stage, next.mood, already ? "Already spotless!" : "Thanks for cleaning!", next.name, next.spriteType) + "\n"
               : "") + toast + "\n" + (already
               ? `[${pLabel}] Nothing to clean — ${next.name}'s area is already spotless.`
               : `[${pLabel}] Cleaned up ${next.name}'s mess.`));
           }
           return ret(notification + cleanLines.join("\n\n"));
         }

         case "medicine": {
           const medLines: string[] = [];
           for (const p of alivePets) {
             // Skip OpenCode-local pet
             if (p.ide === "opencode") {
               medLines.push(`[OpenCode] I'm just a companion — I don't need medicine.`);
               continue;
             }
             const s = p.state;
             const pLabel = p.ide === "vscode" ? "VS Code" : "PyCharm";
             if (!s.sick) {
               medLines.push(`[${pLabel}] ${s.name} is not sick — medicine not needed.`);
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
               ? `[${pLabel}] ${next.name} has been cured!`
               : `[${pLabel}] Gave medicine to ${next.name}. Doses given: ${next.medicineDosesGiven}/3.`));
           }
           return ret(notification + medLines.join("\n\n"));
         }

        default:
          return ret(notification + artHeader() + "Unknown action. Use one of: status, feed, pat, sleep, clean, medicine, on, off, warnthreshold, shoutthreshold.");
      }
    },
  });

  // ---------------------------------------------------------------------------
  // Event hooks
  // ---------------------------------------------------------------------------
  return {
    tool: {
      codotchi: codotchiTool,
    },

    async "tool.execute.after"({ tool: toolName }, output) {
      if (toolName === "codotchi") {
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
        const _1h2 = lastHourUsage();
        const { message: msg, bubbleColor, tierEmoji } = buildContextualSpeech(s, sessionFilesEdited, Date.now() - sessionStartMs, lastFileEditMs > 0 ? Date.now() - lastFileEditMs : 0, sessionUserMessages, isOnProdBranch, dailyCostUSD, dailyTokens, costWarnThreshold, costShoutThreshold, _1h2.costUSD, _1h2.tokens);
        const ideLabel = p.ide === "vscode" ? "[VS Code]" : p.ide === "pycharm" ? "[PyCharm]" : "[OpenCode]";
        return buildSpeechBubble(s.stage, s.mood, msg, s.name, s.spriteType, ideLabel, bubbleColor, tierEmoji);
      });
      output.text = output.text + "\n\n```\n" + bubbles.map(stripAnsi).join("\n\n") + "\n```";
    },

    async event({ event }) {
      // file.edited → code activity reward (throttled), applied to all alive pets
      if (event.type === "file.edited") {
        isIdle = false;
        sessionFilesEdited += 1;
        lastFileEditMs = Date.now();
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
           // Also boost the local pet on file edits
           if (localPetState !== null && localPetState.alive && !localPetState.sleeping) {
             localPetState = pinnedCompanionStats(applyCodeActivity(localPetState));
             saveLocalState();
           }
        }
        return;
      }

      // session.idle → flag idle; fire diff notification if pending; offer help if prompting a lot
      if (event.type === "session.idle") {
        isIdle = true;
        saveIDEState("vscode");
        saveIDEState("pycharm");
        saveIDEState("opencode");
        if (pendingDiffSinceIdle) {
          pendingDiffSinceIdle = false;
          const livePets = getActivePets().filter(p => p.state.alive);
          for (const p of livePets) {
            const phrase = pickRandom(SESSION_DIFF_PHRASES);
            const ideLabel = p.ide === "vscode" ? "[VS Code]" : p.ide === "pycharm" ? "[PyCharm]" : "[OpenCode]";
            // Prepend so the diff phrase appears before any todo messages already queued
            prependNotification(terminalEnabled
              ? buildSpeechBubble(p.state.stage, p.state.mood, phrase, p.state.name, p.state.spriteType, ideLabel)
              : `${ideLabel} ${p.state.name}: ${phrase}`);
          }
        }
        if (sessionUserMessages >= 10 && !hasOfferedHelp) {
          hasOfferedHelp = true;
          const livePets = getActivePets().filter(p => p.state.alive);
          const rep = livePets[0];
          const phrase = "You've sent a lot of messages. Want me to take a bigger task off your hands?";
          if (rep) {
            const ideLabel = rep.ide === "vscode" ? "[VS Code]" : rep.ide === "pycharm" ? "[PyCharm]" : "[OpenCode]";
            queueNotification(terminalEnabled
              ? buildSpeechBubble(rep.state.stage, rep.state.mood, phrase, rep.state.name, rep.state.spriteType, ideLabel)
              : `${ideLabel} ${rep.state.name}: ${phrase}`);
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
               const updated = applyCodeActivity(p.state);
               // Pin stats for local pet
               const final = p.ide === "opencode" ? pinnedCompanionStats(updated) : updated;
               setPetState(p.ide, final);
               saveIDEState(p.ide);
             }
            const phrase = pickRandom(TODO_COMPLETE_PHRASES)(todo.content);
            const rep = livePets[0];
            const ideLabel = rep ? (rep.ide === "vscode" ? "[VS Code]" : rep.ide === "pycharm" ? "[PyCharm]" : "[OpenCode]") : "";
            queueNotification(terminalEnabled && rep
              ? buildSpeechBubble(rep.state.stage, "happy", phrase, rep.state.name, rep.state.spriteType, ideLabel)
              : rep ? `${ideLabel} ${rep.state.name}: ${phrase}` : phrase);
          } else if (oldStatus !== "in_progress" && todo.status === "in_progress") {
            const phrase = `On it: ${todo.content}.`;
            const rep = livePets[0];
            const ideLabel = rep ? (rep.ide === "vscode" ? "[VS Code]" : rep.ide === "pycharm" ? "[PyCharm]" : "[OpenCode]") : "";
            queueNotification(terminalEnabled && rep
              ? buildSpeechBubble(rep.state.stage, rep.state.mood, phrase, rep.state.name, rep.state.spriteType, ideLabel)
              : rep ? `${ideLabel} ${rep.state.name}: ${phrase}` : phrase);
          } else if (oldStatus !== "cancelled" && todo.status === "cancelled") {
            const phrase = `Fair enough — ${todo.content} dropped.`;
            const rep = livePets[0];
            const ideLabel = rep ? (rep.ide === "vscode" ? "[VS Code]" : rep.ide === "pycharm" ? "[PyCharm]" : "[OpenCode]") : "";
            queueNotification(terminalEnabled && rep
              ? buildSpeechBubble(rep.state.stage, rep.state.mood, phrase, rep.state.name, rep.state.spriteType, ideLabel)
              : rep ? `${ideLabel} ${rep.state.name}: ${phrase}` : phrase);
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

      // vcs.branch.updated → comment on branch switches + track prod branch
      if (event.type === "vcs.branch.updated") {
        const branch = event.properties.branch;
        if (branch) {
          isOnProdBranch = /^(main|master|prod.*)$/.test(branch) || /^release\//.test(branch);
          const phrase = isOnProdBranch
            ? `On ${branch}. Be careful — this is production.`
            : `Switched to ${branch}. New mission?`;
          const rep = getActivePets().filter(p => p.state.alive)[0];
          const ideLabel = rep ? (rep.ide === "vscode" ? "[VS Code]" : rep.ide === "pycharm" ? "[PyCharm]" : "[OpenCode]") : "";
          queueNotification(terminalEnabled && rep
            ? buildSpeechBubble(rep.state.stage, rep.state.mood, phrase, rep.state.name, rep.state.spriteType, ideLabel)
            : rep ? `${ideLabel} ${rep.state.name}: ${phrase}` : phrase);
        }
        return;
      }

      // server.connected → queue greeting
      if (event.type === "server.connected") {
        for (const p of getActivePets().filter(p => p.state.alive)) {
          const s = p.state;
          const ideLabel = p.ide === "vscode" ? "[VS Code]" : p.ide === "pycharm" ? "[PyCharm]" : "[OpenCode]";
          const greet = p.ide === "opencode"
            ? `I'm here. I live in OpenCode — no IDE needed.`
            : s.hunger < 30
            ? `Really hungry. Feed me when you get a chance (/codotchi feed)`
            : s.sick
            ? `Not feeling well. Need medicine (/codotchi medicine)`
            : s.energy < 20
            ? `Running on empty. Let me rest (/codotchi sleep)`
            : s.happiness < 30
            ? `Been a while. Pat me? (/codotchi pat)`
            : `Hey. Let's see what we build today.`;
          queueNotification(terminalEnabled
            ? buildSpeechBubble(s.stage, s.mood, greet, s.name, s.spriteType, ideLabel)
            : `${ideLabel} ${s.name}: ${greet}`);
        }
        return;
      }

      // session.status → resume from idle
      if (event.type === "session.status") {
        isIdle = false;
        return;
      }

      // session.created → reset all per-session counters
      if (event.type === "session.created") {
        sessionFilesEdited = 0;
        sessionStartMs = Date.now();
        lastFileEditMs = 0;
        sessionUserMessages = 0;
        sessionCostUSD = 0;
        sessionTokens  = 0;
        localPetSessionMessages = 0;
        hasOfferedHelp = false;
        return;
      }

       // message.updated → count user messages; accumulate assistant cost + tokens
       if (event.type === "message.updated") {
         const info = event.properties?.info;
         if (info?.role === "user") {
           sessionUserMessages += 1;
           return;
         }
         if (info?.role === "assistant" && typeof info.cost === "number") {
            const t = (info.tokens?.input ?? 0) + (info.tokens?.output ?? 0)
                    + (info.tokens?.reasoning ?? 0)
                    + (info.tokens?.cache?.read ?? 0) + (info.tokens?.cache?.write ?? 0);
            sessionCostUSD += info.cost;
            sessionTokens  += t;
            checkDayRollover();
            dailyCostUSD   += info.cost;
            dailyTokens    += t;
            dailyDate = todayUTC();
            saveDailyUsage();
            // Push to rolling last-1h buffer
            const completedAt = (typeof info.time?.completed === "number" && info.time.completed > 0)
              ? info.time.completed
              : Date.now();
            costEvents.push({ completedAt, costUSD: info.cost, tokens: t });
            // Message-based aging: increment total message count and advance stage if needed
            localPetTotalMessages += 1;
            advanceLocalPetStageIfNeeded();
          }
         return;
       }
    },
  };
};

export default plugin;
