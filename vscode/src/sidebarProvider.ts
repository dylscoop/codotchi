/**
 * sidebarProvider.ts
 *
 * WebviewViewProvider for the "Your Pet" sidebar panel.
 *
 * Translates webview button messages into game engine calls and pushes full
 * state snapshots back to the webview after each action.
 */

import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import * as os from "os";
import {
  PetState,
  HighScore,
  createPet,
  feedMeal,
  startSnack,
  consumeSnack,
  play,
  applyMinigameResult,
  pat,
  applyTokenCostView,
  sleep,
  wake,
  clean,
  giveMedicine,
  scold,
  praise,
  pause,
  resume,
  resetFloorSnacks,
} from "./gameEngine";

import { getCustomCharacterByPasscode, getCustomCharacterBySpriteType } from "./customCharacters";
import { StatusBarManager } from "./statusBar";
import { getCachedCopilotQuota, type CopilotQuotaOutcome } from "./copilotQuota";

const LEADERBOARD_REPO_OWNER = "dylscoop";
const LEADERBOARD_REPO_NAME  = "codotchi";
const LEADERBOARD_PAGES_URL  = `https://${LEADERBOARD_REPO_OWNER}.github.io/${LEADERBOARD_REPO_NAME}/leaderboard/`;
const LEADERBOARD_GITHUB_SCOPES = ["read:user", "public_repo"];

// Pricing per million tokens (USD) — mirrors state.mjs MODEL_PRICING table.
// Ordered most-specific first — checked with startsWith(), so longer/pricier
// sub-prefixes (e.g. claude-opus-4-8) must precede their shorter generic
// parent (claude-opus-4). Covers both real model-ID orderings: Claude 3.x
// puts the generation digit before the family name (claude-3-opus-...),
// while 4.x+ puts the family name first (claude-opus-4-...).
const MODEL_PRICING: Array<[string, { input: number; output: number; cacheRead: number; cacheWrite: number }]> = [
  ["claude-opus-4-8",   { input: 5,    output: 25,   cacheRead: 0.50,  cacheWrite: 6.25  }],
  ["claude-opus-4-1",   { input: 15,   output: 75,   cacheRead: 1.50,  cacheWrite: 18.75 }],
  ["claude-3-5-sonnet", { input: 3,    output: 15,   cacheRead: 0.30,  cacheWrite: 3.75  }],
  ["claude-3-5-haiku",  { input: 0.80, output: 4,    cacheRead: 0.08,  cacheWrite: 1.00  }],
  ["claude-3-opus",     { input: 15,   output: 75,   cacheRead: 1.50,  cacheWrite: 18.75 }],
  ["claude-3-sonnet",   { input: 3,    output: 15,   cacheRead: 0.30,  cacheWrite: 3.75  }],
  ["claude-3-haiku",    { input: 0.25, output: 1.25, cacheRead: 0.03,  cacheWrite: 0.30  }],
  ["claude-opus-4",     { input: 15,   output: 75,   cacheRead: 1.50,  cacheWrite: 18.75 }],
  ["claude-sonnet-5",   { input: 3,    output: 15,   cacheRead: 0.30,  cacheWrite: 3.75  }],
  ["claude-sonnet-4",   { input: 3,    output: 15,   cacheRead: 0.30,  cacheWrite: 3.75  }],
  ["claude-haiku-4-5",  { input: 1,    output: 5,    cacheRead: 0.10,  cacheWrite: 1.25  }],
  ["claude-fable-5",    { input: 10,   output: 50,   cacheRead: 1.00,  cacheWrite: 12.50 }],
];
const DEFAULT_PRICING = { input: 3, output: 15, cacheRead: 0.30, cacheWrite: 3.75 };

function pricingForModel(model: string = "") {
  for (const [prefix, p] of MODEL_PRICING) {
    if (model.startsWith(prefix)) { return p; }
  }
  return DEFAULT_PRICING;
}

/** Today's usage totals for a single source. */
interface DailyUsage {
  costUsd: number;
  hourlyCostUsd: number;
  tokens: number;
  messageCount: number;
}

/** Scan ~/.claude/projects JSONL files and return today's Claude Code usage totals. */
function scanClaudeCodeDailyUsage(): DailyUsage {
  const projsDir = path.join(os.homedir(), ".claude", "projects");
  const today = new Date().toISOString().slice(0, 10);
  const oneHourAgoMs = Date.now() - 3_600_000;
  const oneHourAgoIso = new Date(oneHourAgoMs).toISOString();
  let costUsd = 0, hourlyCostUsd = 0, tokens = 0, messageCount = 0;

  try {
    for (const proj of fs.readdirSync(projsDir)) {
      const projPath = path.join(projsDir, proj);
      let files: string[];
      try { files = fs.readdirSync(projPath); } catch { continue; }
      for (const f of files) {
        if (!f.endsWith(".jsonl")) { continue; }
        const fp = path.join(projPath, f);
        try {
          const stat = fs.statSync(fp);
          if (stat.mtime.toISOString().slice(0, 10) < today) { continue; }
        } catch { continue; }
        try {
          const lines = fs.readFileSync(fp, "utf8").trim().split("\n");
          for (const line of lines) {
            try {
              const d = JSON.parse(line);
              if (d.type !== "assistant" || !d.message?.usage) { continue; }
              if (d.timestamp && !d.timestamp.startsWith(today)) { continue; }
              const u = d.message.usage;
              const p = pricingForModel(d.message.model ?? "");
              const inp = u.input_tokens ?? 0;
              const out = u.output_tokens ?? 0;
              const cr  = u.cache_read_input_tokens ?? 0;
              const cc  = u.cache_creation_input_tokens ?? 0;
              const entryCost = (inp * p.input + out * p.output + cr * p.cacheRead + cc * p.cacheWrite) / 1_000_000;
              costUsd      += entryCost;
              tokens       += inp + out + cr + cc;
              messageCount += 1;
              if (d.timestamp && d.timestamp >= oneHourAgoIso) { hourlyCostUsd += entryCost; }
            } catch { /* skip malformed lines */ }
          }
        } catch { /* skip unreadable files */ }
      }
    }
  } catch { /* projsDir missing */ }

  return { costUsd, hourlyCostUsd, tokens, messageCount };
}

/** Read ~/.config/opencode/codotchi-daily.json and return today's OpenCode usage totals. */
function scanOpenCodeDailyUsage(): DailyUsage {
  const today = new Date().toISOString().slice(0, 10);
  let costUsd = 0, hourlyCostUsd = 0, tokens = 0, messageCount = 0;

  try {
    const xdgConfig = process.env["XDG_CONFIG_HOME"] ?? path.join(os.homedir(), ".config");
    const ocDailyPath = path.join(xdgConfig, "opencode", "codotchi-daily.json");
    if (fs.existsSync(ocDailyPath)) {
      const ocData = JSON.parse(fs.readFileSync(ocDailyPath, "utf8"));
      // Only include if the file is for today (UTC)
      if ((ocData.date ?? ocData.createdDate ?? "") === today) {
        costUsd      = ocData.costUSD ?? 0;
        tokens       = ocData.tokens ?? 0;
        messageCount = ocData.messages ?? 0;
        // OpenCode only persists daily totals — last-1h is in-memory in the plugin, not in this file
      }
    }
  } catch { /* opencode daily file missing or malformed */ }

  return { costUsd, hourlyCostUsd, tokens, messageCount };
}

/** Callback invoked whenever the pet state changes. */
export type StateUpdateCallback = (state: PetState) => void;

/** Messages the webview JS can post to the extension host. */
interface WebviewMessage {
  command: string;
  feedType?: "meal" | "snack";
  game?: string;
  result?: string;
  name?: string;
  petType?: string;
  color?: string;  // deprecated — ignored, kept for message back-compat only
}

export class SidebarProvider
  implements vscode.WebviewViewProvider, vscode.Disposable
{
  public static readonly VIEW_ID = "codotchiView";

  private webviewView: vscode.WebviewView | undefined;
  private readonly disposables: vscode.Disposable[] = [];

  /**
   * Tracks meals given in the current wake cycle (resets on sleep).
   * This must be held here because PetState is immutable.
   */
  private mealsGivenThisCycle: number = 0;

  /**
   * Whether the "no GitHub session" hint has already been shown once this
   * session. Reset on extension reload — matches the in-memory,
   * process-lifetime nature of the quota cache in copilotQuota.ts.
   */
  private copilotNoSessionHintShown = false;

  // Live rank cache — refreshed at most every 5 minutes.
  private static readonly RANK_CACHE_TTL_MS = 5 * 60 * 1000;
  private rankCache: { rank: number; total: number; at: number } | null = null;
  // Cached GitHub username for the leaderboard — resolved on sign-in or subscribe.
  // Persisted to globalState so restart doesn't break the self-exclusion rank filter.
  private leaderboardGithubUsername: string | null = null;
  private setLeaderboardUsername(username: string | null): void {
    this.leaderboardGithubUsername = username;
    void this.context.globalState.update("leaderboardGithubUsername", username ?? undefined);
  }
  // Approx ms per game day (awake rate: 5 real min = 1 game day) for live rank extrapolation.
  private static readonly MS_PER_GAME_DAY_APPROX = 5 * 60 * 1000;
  // URLs for fetching rank data from the leaderboard branch.
  private static readonly SCORES_JSON_URL =
    `https://raw.githubusercontent.com/${LEADERBOARD_REPO_OWNER}/${LEADERBOARD_REPO_NAME}/leaderboard/leaderboard/scores.json`;
  private static readonly LIVE_JSON_URL =
    `https://raw.githubusercontent.com/${LEADERBOARD_REPO_OWNER}/${LEADERBOARD_REPO_NAME}/leaderboard/leaderboard/live.json`;

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly statusBar: StatusBarManager,
    private readonly onStateUpdate: StateUpdateCallback,
    private readonly getState: () => PetState | null,
    private readonly getHighScore: () => HighScore | null,
    private readonly markActivity: () => void,
    private readonly onResetHighScore: () => void,
    private readonly markDeepIdle: () => void,
    private readonly getLastRunDiedAt: () => number | null = () => null
  ) {
    this.leaderboardGithubUsername = context.globalState.get<string>("leaderboardGithubUsername") ?? null;
  }

  /** Called by VS Code when the webview becomes visible. */
  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _resolveContext: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void {
    this.webviewView = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.file(path.join(this.context.extensionPath, "media")),
      ],
    };

    webviewView.webview.html = this.buildHtml(webviewView.webview);

    // The webview starts with an empty snackItems[] — zero out the engine's
    // floor counter so it stays in sync (BUGFIX-NNN).
    const staleState = this.getCurrentState();
    if (staleState !== null) {
      this.onStateUpdate(resetFloorSnacks(staleState));
    }

    // Re-send current state to the freshly-loaded webview so it has the
    // high score even before the next tick fires.
    const bootstrapState = this.getCurrentState();
    const bootstrapHs    = this.getHighScore();
    const bootstrapCfg   = vscode.workspace.getConfiguration("codotchi");
    const bootstrapDevMode =
      bootstrapCfg.get<boolean>("devModeEnabled", false) &&
      bootstrapCfg.get<string>("developerPasscode", "") === "1234";
    const bootstrapPasscode = bootstrapCfg.get<string>("characterPasscode", "");
    const bootstrapUnlockedChar = getCustomCharacterByPasscode(bootstrapPasscode)?.spriteType ?? null;
    const bootstrapCustomChar = getCustomCharacterByPasscode(bootstrapPasscode);
    const bootstrapDefaultPetName = bootstrapCustomChar?.defaultName ?? "Codotchi";
    if (bootstrapState !== null) {
      this.postState(bootstrapState, bootstrapHs, bootstrapDevMode, bootstrapUnlockedChar, bootstrapDefaultPetName);
    } else if (bootstrapHs !== null) {
      // No active pet but we have a high score — push it so the setup screen
      // can display it.
      void webviewView.webview.postMessage({
        type: "stateUpdate",
        state: { needs_new_game: true },
        mealsGivenThisCycle: 0,
        highScore: bootstrapHs,
        devMode: false,
        unlockedCharacter: bootstrapUnlockedChar,
        defaultPetName: bootstrapDefaultPetName,
      });
    } else {
      // No pet and no high score — still push defaultPetName so setup screen
      // can pre-fill the name input correctly.
      void webviewView.webview.postMessage({
        type: "stateUpdate",
        state: { needs_new_game: true },
        mealsGivenThisCycle: 0,
        highScore: null,
        devMode: false,
        unlockedCharacter: bootstrapUnlockedChar,
        defaultPetName: bootstrapDefaultPetName,
      });
    }

    const messageListener = webviewView.webview.onDidReceiveMessage(
      (message: WebviewMessage) => {
        this.handleWebviewMessage(message);
      }
    );
    this.disposables.push(messageListener);

    // When the sidebar panel is hidden (collapsed, tab switched away, etc.)
    // immediately force deep idle so the pet enters the protected low-decay
    // state without waiting 10 minutes of inactivity.  When the panel is
    // re-opened, reset activity so the pet exits deep idle right away.
    const visibilityListener = webviewView.onDidChangeVisibility(() => {
      if (webviewView.visible) {
        this.markActivity();
      } else {
        this.markDeepIdle();
      }
    });
    this.disposables.push(visibilityListener);

    // BUGFIX-001: hot-reload the webview HTML when the font-size setting changes.
    // Also reload on petStageHeight or reducedMotion changes.
    const configListener = vscode.workspace.onDidChangeConfiguration((e) => {
      if (
        e.affectsConfiguration("codotchi.fontSize") ||
        e.affectsConfiguration("codotchi.background") ||
        e.affectsConfiguration("codotchi.petSize") ||
        e.affectsConfiguration("codotchi.reducedMotion") ||
        e.affectsConfiguration("codotchi.idleResetOnMouseMovement")
      ) {
        webviewView.webview.html = this.buildHtml(webviewView.webview);
        // Webview reloaded — snackItems[] reset to empty (BUGFIX-NNN).
        const s = this.getCurrentState();
        if (s !== null) { this.onStateUpdate(resetFloorSnacks(s)); }
      }
    });
    this.disposables.push(configListener);
  }

  /** Build the HTML content for the webview. */
  private buildHtml(webview: vscode.Webview): string {
    const mediaPath = path.join(this.context.extensionPath, "media");
    const htmlPath = path.join(mediaPath, "sidebar.html");

    if (!fs.existsSync(htmlPath)) {
      return `<html><body><p>Loading...</p></body></html>`;
    }

    let html = fs.readFileSync(htmlPath, "utf8");

    const cssUri = webview.asWebviewUri(
      vscode.Uri.file(path.join(mediaPath, "sidebar.css"))
    );
    const jsUri = webview.asWebviewUri(
      vscode.Uri.file(path.join(mediaPath, "sidebar.js"))
    );
    const spritesUri = webview.asWebviewUri(
      vscode.Uri.file(path.join(mediaPath, "sprites.js"))
    );
    const spriteConstantsUri = webview.asWebviewUri(
      vscode.Uri.file(path.join(mediaPath, "spriteConstants.js"))
    );
    const customCharactersUri = webview.asWebviewUri(
      vscode.Uri.file(path.join(mediaPath, "customCharacters.js"))
    );

    html = html.replace("{{cssUri}}", cssUri.toString());
    html = html.replace("{{spritesUri}}", spritesUri.toString());
    html = html.replace("{{spriteConstantsUri}}", spriteConstantsUri.toString());
    html = html.replace("{{customCharactersUri}}", customCharactersUri.toString());
    html = html.replace("{{jsUri}}", jsUri.toString());
    html = html.replace(/\{\{cspSource\}\}/g, webview.cspSource);

    const fontSizeSetting = vscode.workspace
      .getConfiguration("codotchi")
      .get<string>("fontSize", "normal");
    const fontSizeClass =
      fontSizeSetting === "large" ? "font-large" :
      fontSizeSetting === "small" ? "font-small" :
      "font-normal";
    html = html.replace("{{fontSizeClass}}", fontSizeClass);

    const cfg = vscode.workspace.getConfiguration("codotchi");

    // Stage height is fixed at 240 px — no longer a user setting.
    // The canvas CSS height is driven by the height attribute (height: auto in CSS)
    // so the pixel buffer and display size always match.
    const petStageHeight = 240;
    html = html.replace(/\{\{stageHeight\}\}/g, String(petStageHeight));

    const petSize = cfg.get<string>("petSize", "medium");
    html = html.replace("{{petSize}}", petSize);

    const reducedMotion = cfg.get<boolean>("reducedMotion", false);
    html = html.replace("{{reducedMotion}}", reducedMotion ? "true" : "false");

    const background = cfg.get<string>("background", "ordered");
    html = html.replace("{{background}}", background);

    const idleResetOnMouseMovement = cfg.get<boolean>("idleResetOnMouseMovement", true);
    html = html.replace("{{idleResetOnMouseMovement}}", idleResetOnMouseMovement ? "true" : "false");

    return html;
  }

  /**
   * Dispatch a webview button press to the appropriate game engine function.
   *
   * @param message - The message posted by the webview JS.
   */
  private handleWebviewMessage(message: WebviewMessage): void {
    // Any incoming message means the user is actively using the sidebar —
    // reset the idle timer immediately (BUGFIX-015).
    this.markActivity();

    // Extension host does not hold the current state directly; the canonical
    // copy lives in extension.ts via currentState.  We retrieve it via the
    // onStateUpdate callback pattern: if we need to read state we must ask
    // extension.ts to give it to us.  For simplicity, the sidebar re-requests
    // the state through the extension's exported getter (injected via context).
    const state = this.getCurrentState();

    // reset_high_score is handled independently of pet state
    if (message.command === "reset_high_score") {
      this.onResetHighScore();
      return;
    }

    if (state === null && message.command !== "new_game") {
      // No pet yet — nothing to do until a new game is started.
      return;
    }

  // BUGFIX-002: block care actions while the pet is sleeping
  const SLEEP_BLOCKED: readonly string[] = ["feed", "play", "pat", "clean", "medicine", "scold", "praise", "token_cost"];
    if (state !== null && state.sleeping && SLEEP_BLOCKED.includes(message.command)) {
      return;
    }

    // Block all actions while paused, except the pause toggle itself and new_game
    const PAUSE_BLOCKED: readonly string[] = ["feed", "snack_consumed", "play", "pat", "sleep", "wake", "clean", "medicine", "scold", "praise", "reset_high_score", "token_cost"];
    if (state !== null && state.paused && PAUSE_BLOCKED.includes(message.command)) {
      return;
    }

    let nextState: PetState | null = null;

    switch (message.command) {
      case "feed":
        if (state === null) {
          return;
        }
        if (message.feedType === "snack") {
          const _cc = getCustomCharacterBySpriteType(state.spriteType);
          nextState = startSnack(state, { maxPerCycle: _cc?.feedSnackMaxPerCycle });
        } else {
          const _cc = getCustomCharacterBySpriteType(state.spriteType);
          nextState = feedMeal(state, this.mealsGivenThisCycle, {
            maxPerCycle: _cc?.feedMealMaxPerCycle,
            hungerMult:  _cc?.feedHungerMult,
            weightGain:  _cc?.feedMealWeightGain,
          });
          if (nextState.events.includes("fed_meal")) {
            this.mealsGivenThisCycle += 1;
          }
        }
        break;

      case "snack_consumed":
        if (state === null) {
          return;
        }
        nextState = consumeSnack(state, {
          hungerMult:    getCustomCharacterBySpriteType(state.spriteType)?.feedHungerMult,
          sickThreshold: getCustomCharacterBySpriteType(state.spriteType)?.snackSickThreshold,
          weightGain:    getCustomCharacterBySpriteType(state.spriteType)?.feedSnackWeightGain,
        });
        break;

      case "play":
        if (state === null) {
          return;
        }
        nextState = play(state, {
          weightLoss: getCustomCharacterBySpriteType(state.spriteType)?.playWeightLoss,
        });
        if (message.game !== undefined && message.result !== undefined) {
          // Only apply minigame happiness delta if play wasn't refused
          if (!nextState.events.includes("play_refused_no_energy")) {
            nextState = applyMinigameResult(nextState, message.game, message.result);
          }
        }
        break;

      case "sleep":
        if (state === null) {
          return;
        }
        nextState = sleep(state);
        if (nextState.events.includes("fell_asleep")) {
          this.mealsGivenThisCycle = 0;
        }
        break;

      case "wake":
        if (state === null) {
          return;
        }
        nextState = wake(state);
        break;

      case "clean":
        if (state === null) {
          return;
        }
        nextState = clean(state);
        break;

      case "medicine":
        if (state === null) {
          return;
        }
        nextState = giveMedicine(state);
        break;

      case "scold":
        if (state === null) {
          return;
        }
        nextState = scold(state);
        break;

      case "praise":
        if (state === null) {
          return;
        }
        nextState = praise(state);
        break;

      case "pat":
        if (state === null) {
          return;
        }
        nextState = pat(state);
        break;

      case "pause":
        if (state === null) {
          return;
        }
        nextState = state.paused ? resume(state) : pause(state);
        break;

      case "new_game": {
        const cfg = vscode.workspace.getConfiguration("codotchi");
        const passcode = cfg.get<string>("characterPasscode", "");
        const customChar = getCustomCharacterByPasscode(passcode);
        const defaultName = customChar?.defaultName ?? "Codotchi";
        const isTimChar   = customChar?.spriteType === "tim";
        const userTyped   = message.name?.trim() ?? "";
        const petName     = (isTimChar && userTyped.toLowerCase() === "codotchi")
                            ? defaultName
                            : (userTyped || defaultName);
        const petType = message.petType ?? "codeling";
        const unlockedCharacter = customChar?.spriteType ?? null;
        nextState = createPet(petName, petType, unlockedCharacter);
        this.mealsGivenThisCycle = 0;
        break;
      }

      case "user_activity":
        // Idle timer already reset above; no state change needed.
        return;

      case "submit_leaderboard":
        void this.handleLeaderboardSubmit();
        return;

      case "delete_leaderboard_entry":
        void this.handleLeaderboardDelete();
        return;

      case "open_leaderboard_url":
        void vscode.env.openExternal(vscode.Uri.parse(LEADERBOARD_PAGES_URL));
        return;

      case "sign_in_leaderboard":
        void this.handleSignInLeaderboard();
        return;

      case "toggle_live_subscribe": {
        const subscribed = this.context.globalState.get<boolean>("leaderboardLiveSubscribed", false);
        const nowSubscribed = !subscribed;
        void this.context.globalState.update("leaderboardLiveSubscribed", nowSubscribed);
        const s = this.getCurrentState();
        // Instant push when subscribing so the user sees immediate feedback.
        // promptAuth=true so VS Code shows the GitHub OAuth popup if not yet authenticated.
        if (nowSubscribed && s !== null && s.alive) {
          void this.pushLiveScore(s, true);
        }
        if (s !== null) {
          this.onStateUpdate(s);
        }
        return;
      }

      case "token_cost": {
        if (state === null) { return; }
        // Apply and broadcast the energy/happiness cost first, then show the
        // cost bubble on top, so the stat bars land before the bubble appears.
        this.onStateUpdate(applyTokenCostView(state));
        void this.handleTokenCostBubble();
        return;
      }

      default:
        return;
    }

    if (nextState !== null) {
      this.onStateUpdate(nextState);
    }
  }

  /**
   * Retrieve the current pet state from the extension host via the injected
   * getter function.
   */
  private getCurrentState(): PetState | null {
    return this.getState();
  }

  /**
   * Build and show the "Today's Token Cost" speech bubble. Split out from
   * the "token_cost" case so the (potentially network-bound) Copilot quota
   * fetch doesn't force the whole `handleWebviewMessage` switch to become
   * async. Claude Code/OpenCode figures must always show even if the
   * Copilot fetch fails or the user has no GitHub session — this never
   * throws out to the caller.
   */
  private async handleTokenCostBubble(): Promise<void> {
    const config = vscode.workspace.getConfiguration("codotchi");
    const selectedSources = config.get<string[]>("tokenCostSources", ["claudeCode", "openCode"]);
    const includeClaudeCode = selectedSources.includes("claudeCode");
    const includeOpenCode = selectedSources.includes("openCode");
    const includeCopilot = selectedSources.includes("copilot");

    const fmt = (n: number) =>
      n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M`
      : n >= 1000    ? `${(n / 1000).toFixed(1)}k`
      : String(n);
    const fmtCost = (u: number) => u < 0.005 ? "<$0.01" : `$${u.toFixed(2)}`;

    const segments: string[] = [];

    // Each source reports its own totals — never merged, so a source with a
    // different message-count/token shape (e.g. OpenCode) can't drag another
    // source's "avg tok/msg" figure away from what it shows on its own (this
    // is what caused the VS Code bubble to disagree with the claude-codotchi
    // statusline, which only ever reports Claude Code's own figure).
    const usageSegment = (label: string, usage: DailyUsage, showHourly: boolean): string => {
      const avgTok = usage.messageCount > 0
        ? Math.round(usage.tokens / usage.messageCount)
        : usage.tokens;
      const hourlyPart = showHourly ? ` | Last 1h: ${fmtCost(usage.hourlyCostUsd)}` : "";
      return `${label}: ${fmtCost(usage.costUsd)}${hourlyPart}, Avg ${fmt(avgTok)} tok/msg`;
    };

    if (includeClaudeCode) {
      segments.push(usageSegment("Claude", scanClaudeCodeDailyUsage(), true));
    }
    if (includeOpenCode) {
      // OpenCode's daily file only persists a running total — no last-1h
      // breakdown is available (see scanOpenCodeDailyUsage), so omit it
      // rather than show a misleading $0.00.
      segments.push(usageSegment("OpenCode", scanOpenCodeDailyUsage(), false));
    }

    if (includeCopilot) {
      try {
        const outcome: CopilotQuotaOutcome = await getCachedCopilotQuota(
          (createIfNone) => vscode.authentication.getSession("github", ["read:user"], { createIfNone }) as Promise<{ accessToken: string } | undefined>,
          fetch,
          true
        );
        if (outcome.ok) {
          segments.push(
            outcome.unlimited
              ? "Copilot: unlimited premium requests"
              : `Copilot: ${outcome.percentRemaining}% premium quota remaining`
          );
        } else if (outcome.reason === "no_session" && !this.copilotNoSessionHintShown) {
          this.copilotNoSessionHintShown = true;
          segments.push("Copilot: sign in to GitHub when prompted to include quota");
        }
        // network_error / unauthorized / parse_error -> silently omit; never break the base bubble
      } catch {
        /* swallow — never break the base bubble */
      }
    }

    const text = segments.length > 0 ? segments.join(" | ") : "Today's Token Cost: no sources selected";
    if (this.webviewView) {
      void this.webviewView.webview.postMessage({ type: "showBubble", text });
    }
  }

  /**
   * Send a state snapshot to the webview JS.
   *
   * @param state - The pet state to push to the webview.
   * @param highScore - The current best-run record (null if none).
   * @param devMode - Whether developer mode is currently active.
   * @param unlockedCharacter - spriteType of the unlocked custom character, or null.
   */
  postState(state: PetState, highScore: HighScore | null, devMode: boolean, unlockedCharacter: string | null = null, defaultPetName: string = "Codotchi"): void {
    if (!this.webviewView) { return; }

    const liveSubscribed = this.context.globalState.get<boolean>("leaderboardLiveSubscribed", false);
    const liveLastPushedAt = this.context.globalState.get<number>("leaderboardLastPushedAt", 0);

    // Fetch rank whenever subscribed and alive (showing rank = opt-in via subscribe button).
    if (liveSubscribed && state.alive) { void this.fetchLiveRank(state.ageDays, this.leaderboardGithubUsername); }

    const cached = this.rankCache;

    void this.webviewView.webview.postMessage({
      type: "stateUpdate",
      state,
      mealsGivenThisCycle: this.mealsGivenThisCycle,
      highScore,
      devMode,
      unlockedCharacter,
      defaultPetName,
      leaderboardAvailable: true,
      liveRank: (liveSubscribed && state.alive && cached) ? cached.rank : null,
      liveTotalScores: (liveSubscribed && state.alive && cached) ? cached.total : null,
      liveSubscribed,
      liveLastPushedAt,
      leaderboardGithubUsername: this.leaderboardGithubUsername,
    });
  }

  /**
   * Reset the per-cycle meal counter.
   *
   * Called whenever state is reloaded from the shared file (cross-window or
   * cross-IDE sync) so that the meal cap is not carried over from a stale
   * in-memory snapshot.  Resetting to 0 is conservative: the reloaded state
   * may already reflect meals given by another window, so we cannot know the
   * correct counter value — 0 allows the full cycle quota from this window.
   */
  resetMealCycle(): void {
    this.mealsGivenThisCycle = 0;
  }

  /**
   * Push a no-active-game stateUpdate to the webview (used to clear the
   * high score display when no pet is alive after a high score reset).
   *
   * @param highScore - The high score value to show (null to clear it).
   */
  postNoGame(highScore: HighScore | null): void {
    if (this.webviewView) {
      void this.webviewView.webview.postMessage({
        type: "stateUpdate",
        state: { needs_new_game: true },
        mealsGivenThisCycle: 0,
        highScore,
        devMode: false,
      });
    }
  }

  /** Submit the current dead pet's score to the public GitHub leaderboard. */
  private async handleLeaderboardSubmit(): Promise<void> {
    const postResult = (status: string, message?: string): void => {
      if (this.webviewView) {
        void this.webviewView.webview.postMessage({ type: "leaderboard_submit_result", status, message });
      }
    };

    try {
      const state = this.getCurrentState();
      if (state === null || state.alive) {
        postResult("error", "No dead pet state available.");
        return;
      }

      const session = await vscode.authentication.getSession(
        "github", LEADERBOARD_GITHUB_SCOPES, { createIfNone: true }
      );

      if (!session) {
        postResult("cancelled");
        return;
      }

      // Fetch GitHub username
      let username: string;
      try {
        const userRes = await fetch("https://api.github.com/user", {
          headers: {
            "Authorization": `token ${session.accessToken}`,
            "Accept": "application/json",
            "User-Agent": "Codotchi-VSCode",
          },
        });
        if (!userRes.ok) {
          postResult("error", `GitHub API error: ${userRes.status}`);
          return;
        }
        const userBody = await userRes.json() as Record<string, unknown>;
        username = String(userBody.login ?? "");
        if (!username) {
          postResult("error", "Could not read GitHub username.");
          return;
        }
        this.setLeaderboardUsername(username);
      } catch {
        postResult("error", "Network error fetching GitHub username.");
        return;
      }

      const diedAt = this.getLastRunDiedAt() ?? Date.now();
      const scoreData = {
        schemaVersion: 1,
        githubUsername: username,
        petName:        state.name,
        ageDays:        state.ageDays,
        stage:          state.stage,
        petType:        state.petType,
        spawnedAt:      state.spawnedAt,
        diedAt,
      };
      const issueBody =
        `Leaderboard submission.\n\n\`\`\`json\n${JSON.stringify(scoreData, null, 2)}\n\`\`\``;
      const issueTitle =
        `[Leaderboard] ${state.name} (${state.petType}) lived ${state.ageDays}d — @${username}`;

      try {
        const issueRes = await fetch(
          `https://api.github.com/repos/${LEADERBOARD_REPO_OWNER}/${LEADERBOARD_REPO_NAME}/issues`,
          {
            method: "POST",
            headers: {
              "Authorization": `token ${session.accessToken}`,
              "Accept": "application/vnd.github+json",
              "Content-Type": "application/json",
              "User-Agent": "Codotchi-VSCode",
            },
            body: JSON.stringify({ title: issueTitle, body: issueBody, labels: ["leaderboard-submission"] }),
          }
        );
        if (issueRes.status === 201) {
          postResult("success");
        } else {
          const errBody = await issueRes.text().catch(() => "");
          postResult("error", `Failed to create issue (HTTP ${issueRes.status}): ${errBody.slice(0, 120)}`);
        }
      } catch {
        postResult("error", "Network error creating GitHub issue.");
      }
    } catch {
      postResult("error", "Unexpected error during submission.");
    }
  }

  /** Silently submit the dead pet to the leaderboard using the existing GitHub session.
   *  Called automatically on first death tick when the user is subscribed to the live board.
   *  Uses createIfNone:false so no auth popup is shown. */
  async autoSubmitLeaderboard(): Promise<void> {
    try {
      const state = this.getCurrentState();
      if (state === null || state.alive) { return; }

      const session = await Promise.resolve(
        vscode.authentication.getSession("github", LEADERBOARD_GITHUB_SCOPES, { createIfNone: false })
      ).catch(() => null);
      if (!session) { return; }

      const userRes = await fetch("https://api.github.com/user", {
        headers: { "Authorization": `token ${session.accessToken}`, "Accept": "application/json", "User-Agent": "Codotchi-VSCode" },
      });
      if (!userRes.ok) { return; }
      const userBody = await userRes.json() as Record<string, unknown>;
      const username = String(userBody.login ?? "");
      if (!username) { return; }
      this.setLeaderboardUsername(username);

      const diedAt = this.getLastRunDiedAt() ?? Date.now();
      const scoreData = {
        schemaVersion: 1,
        githubUsername: username,
        petName:        state.name,
        ageDays:        state.ageDays,
        stage:          state.stage,
        petType:        state.petType,
        spawnedAt:      state.spawnedAt,
        diedAt,
      };
      const issueBody  = `Leaderboard submission.\n\n\`\`\`json\n${JSON.stringify(scoreData, null, 2)}\n\`\`\``;
      const issueTitle = `[Leaderboard] ${state.name} (${state.petType}) lived ${state.ageDays}d — @${username}`;

      await fetch(
        `https://api.github.com/repos/${LEADERBOARD_REPO_OWNER}/${LEADERBOARD_REPO_NAME}/issues`,
        {
          method: "POST",
          headers: {
            "Authorization": `token ${session.accessToken}`,
            "Accept": "application/vnd.github+json",
            "Content-Type": "application/json",
            "User-Agent": "Codotchi-VSCode",
          },
          body: JSON.stringify({ title: issueTitle, body: issueBody, labels: ["leaderboard-submission"] }),
        }
      );
    } catch {
      // Auto-submit is best-effort; never surface errors to the user
    }
  }

  /** Fetch scores.json and compute current rank; result is cached for 5 minutes.
   *  Pass username so the user's own live entry is excluded from the pool —
   *  the unconditional +1 at the end already accounts for the current user. */
  async fetchLiveRank(ageDays: number, username: string | null = null): Promise<void> {
    const now = Date.now();
    if (this.rankCache && (now - this.rankCache.at) < SidebarProvider.RANK_CACHE_TTL_MS) {
      return; // still fresh
    }
    try {
      const headers = { "Accept": "application/json", "User-Agent": "Codotchi-VSCode" };
      const [scoresRes, liveRes] = await Promise.all([
        fetch(SidebarProvider.SCORES_JSON_URL, { headers }),
        fetch(SidebarProvider.LIVE_JSON_URL, { headers }).catch(() => null),
      ]);
      if (!scoresRes.ok) { return; }
      const scoresJson = await scoresRes.json() as { scores?: Array<{ ageDays: number }> } | Array<{ ageDays: number }>;
      const scores: Array<{ ageDays: number }> = Array.isArray(scoresJson) ? scoresJson : (scoresJson.scores ?? []);
      const liveJson: Array<{ ageDays?: number; updatedAt?: number; username?: string }> = liveRes?.ok
        ? await liveRes.json().catch(() => []) as Array<{ ageDays?: number; updatedAt?: number; username?: string }> : [];
      const staleMs = 48 * 60 * 60 * 1000;
      const userLower = username?.toLowerCase() ?? null;
      // Extrapolate current ageDays from storedAgeDays + elapsed time since last push.
      // Exclude the current user's own entry — the +1 below already represents them.
      const freshLive = liveJson
        .filter(e => e.updatedAt && (now - e.updatedAt) < staleMs)
        .filter(e => !userLower || (e.username?.toLowerCase() ?? "") !== userLower)
        .map(e => ({
          ageDays: (e.ageDays ?? 0) + (e.updatedAt ? (now - e.updatedAt) / SidebarProvider.MS_PER_GAME_DAY_APPROX : 0),
        }));
      const combined = (scores as Array<{ ageDays: number }>).concat(freshLive);
      const rank = combined.filter(s => (s.ageDays ?? 0) > ageDays).length + 1;
      this.rankCache = { rank, total: combined.length + 1, at: now };
    } catch {
      // Network failure — keep stale cache if available
    }
  }

  /** Sign in to GitHub for the leaderboard and cache the resolved username. */
  async handleSignInLeaderboard(): Promise<void> {
    try {
      const session = await vscode.authentication.getSession(
        "github", LEADERBOARD_GITHUB_SCOPES, { createIfNone: true }
      );
      if (!session) {
        this.setLeaderboardUsername(null);
        if (this.webviewView) {
          void this.webviewView.webview.postMessage({ type: "leaderboard_sign_in_result", username: null });
        }
        return;
      }
      const userRes = await fetch("https://api.github.com/user", {
        headers: { "Authorization": `token ${session.accessToken}`, "Accept": "application/json", "User-Agent": "Codotchi-VSCode" },
      });
      const username = userRes.ok ? String((await userRes.json() as Record<string, unknown>).login ?? "") : "";
      this.setLeaderboardUsername(username || null);
      if (this.webviewView) {
        void this.webviewView.webview.postMessage({ type: "leaderboard_sign_in_result", username: this.leaderboardGithubUsername });
      }
    } catch {
      // silent — sign-in is best-effort
    }
  }

  /** Push current pet state to the live leaderboard via a GitHub issue.
   *  The process-leaderboard-live workflow reads the issue, upserts the entry
   *  in live.json on the leaderboard branch, then closes the issue.
   *  Pass promptAuth=true when triggered by a user action (subscribe click) so
   *  VS Code shows the GitHub OAuth popup. Keep false for background hourly pushes. */
  async pushLiveScore(state: PetState, promptAuth = false): Promise<void> {
    if (!state.alive) { return; }
    try {
      const session = await vscode.authentication.getSession(
        "github", LEADERBOARD_GITHUB_SCOPES, { createIfNone: promptAuth }
      );
      if (!session) { return; }

      const authHeaders = {
        "Authorization": `token ${session.accessToken}`,
        "Accept": "application/vnd.github+json",
        "Content-Type": "application/json",
        "User-Agent": "Codotchi-VSCode",
      };

      // Resolve GitHub username.
      const userRes = await fetch("https://api.github.com/user", {
        headers: { ...authHeaders, "Accept": "application/json" },
      });
      if (!userRes.ok) { return; }
      const userBody = await userRes.json() as Record<string, unknown>;
      const username = String(userBody.login ?? "");
      if (!username) { return; }
      this.setLeaderboardUsername(username);

      const entry = {
        username,
        petName:   state.name,
        petRunId:  vscode.env.machineId,
        spawnedAt: state.spawnedAt,
        ageDays:   state.ageDays,
        stage:     state.stage,
        petType:   state.petType,
        updatedAt: Date.now(),
      };

      const issueRes = await fetch(
        `https://api.github.com/repos/${LEADERBOARD_REPO_OWNER}/${LEADERBOARD_REPO_NAME}/issues`,
        {
          method: "POST",
          headers: authHeaders,
          body: JSON.stringify({
            title: `[Live] ${username} — ${state.name} (${state.ageDays}d ${state.stage})`,
            body:  JSON.stringify(entry),
            labels: ["leaderboard-live"],
          }),
        }
      );

      if (issueRes.status === 201) {
        await this.context.globalState.update("leaderboardLastPushedAt", Date.now());
        // Refresh sidebar so "last synced" timestamp updates immediately.
        const current = this.getCurrentState();
        if (current !== null) { this.onStateUpdate(current); }
      }
    } catch {
      // Live push is best-effort; never surface errors to the user
    }
  }

  /** Request deletion of the user's leaderboard entry via a GitHub issue. */
  private async handleLeaderboardDelete(): Promise<void> {
    const postResult = (status: string, message?: string): void => {
      if (this.webviewView) {
        void this.webviewView.webview.postMessage({ type: "leaderboard_delete_result", status, message });
      }
    };

    try {
      const state = this.getCurrentState();
      if (state === null || state.alive) {
        postResult("error", "No finished run state available.");
        return;
      }

      const session = await vscode.authentication.getSession(
        "github", LEADERBOARD_GITHUB_SCOPES, { createIfNone: true }
      );
      if (!session) { postResult("cancelled"); return; }

      const userRes = await fetch("https://api.github.com/user", {
        headers: {
          "Authorization": `token ${session.accessToken}`,
          "Accept": "application/json",
          "User-Agent": "Codotchi-VSCode",
        },
      });
      if (!userRes.ok) { postResult("error", `GitHub API error: ${userRes.status}`); return; }
      const userBody = await userRes.json() as Record<string, unknown>;
      const username = String(userBody.login ?? "");
      if (!username) { postResult("error", "Could not read GitHub username."); return; }

      const deleteData = {
        schemaVersion: 1,
        githubUsername: username,
        petRunId: state.spawnedAt,
        petName: state.name,
      };
      const issueBody =
        `Leaderboard deletion request.\n\n\`\`\`json\n${JSON.stringify(deleteData, null, 2)}\n\`\`\``;
      const issueTitle = `[Leaderboard Delete] ${state.name} — @${username}`;

      const issueRes = await fetch(
        `https://api.github.com/repos/${LEADERBOARD_REPO_OWNER}/${LEADERBOARD_REPO_NAME}/issues`,
        {
          method: "POST",
          headers: {
            "Authorization": `token ${session.accessToken}`,
            "Accept": "application/vnd.github+json",
            "Content-Type": "application/json",
            "User-Agent": "Codotchi-VSCode",
          },
          body: JSON.stringify({ title: issueTitle, body: issueBody, labels: ["leaderboard-delete"] }),
        }
      );
      if (issueRes.status === 201) {
        postResult("success");
      } else {
        const errBody = await issueRes.text().catch(() => "");
        postResult("error", `Failed to create issue (HTTP ${issueRes.status}): ${errBody.slice(0, 120)}`);
      }
    } catch {
      postResult("error", "Unexpected error during deletion request.");
    }
  }

  dispose(): void {
    for (const d of this.disposables) {
      d.dispose();
    }
  }

  /** Called by the toolbar pause/resume commands to toggle pause state externally. */
  handleExternalPauseToggle(): void {
    const state = this.getCurrentState();
    if (state === null) { return; }
    const nextState = state.paused ? resume(state) : pause(state);
    this.onStateUpdate(nextState);
  }
}
