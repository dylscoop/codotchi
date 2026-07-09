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

// Pricing per million tokens (USD) — mirrors state.mjs MODEL_PRICING table.
const MODEL_PRICING: Record<string, { input: number; output: number; cacheRead: number; cacheWrite: number }> = {
  "claude-opus-4":   { input: 15,   output: 75,   cacheRead: 1.50,  cacheWrite: 18.75 },
  "claude-sonnet-4": { input: 3,    output: 15,   cacheRead: 0.30,  cacheWrite: 3.75  },
  "claude-haiku-4":  { input: 0.80, output: 4,    cacheRead: 0.08,  cacheWrite: 1.00  },
  "claude-opus-3":   { input: 15,   output: 75,   cacheRead: 1.50,  cacheWrite: 18.75 },
  "claude-sonnet-3": { input: 3,    output: 15,   cacheRead: 0.30,  cacheWrite: 3.75  },
  "claude-haiku-3":  { input: 0.25, output: 1.25, cacheRead: 0.03,  cacheWrite: 0.30  },
  "default":         { input: 3,    output: 15,   cacheRead: 0.30,  cacheWrite: 3.75  },
};

function pricingForModel(model: string = "") {
  for (const [prefix, p] of Object.entries(MODEL_PRICING)) {
    if (prefix !== "default" && model.startsWith(prefix)) { return p; }
  }
  return MODEL_PRICING["default"];
}

/** Scan ~/.claude/projects JSONL files and return today's usage totals. */
function scanDailyUsage(): { costUsd: number; hourlyCostUsd: number; tokens: number; messageCount: number } {
  const projsDir = path.join(os.homedir(), ".claude", "projects");
  const today = new Date().toISOString().slice(0, 10);
  const oneHourAgoMs = Date.now() - 3_600_000;
  const oneHourAgoIso = new Date(oneHourAgoMs).toISOString();
  let costUsd = 0, hourlyCostUsd = 0, tokens = 0, messageCount = 0;

  // Track A — Claude Code: read ~/.claude/projects/*.jsonl
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

  // Track B — OpenCode: read ~/.config/opencode/codotchi-daily.json
  try {
    const xdgConfig = process.env["XDG_CONFIG_HOME"] ?? path.join(os.homedir(), ".config");
    const ocDailyPath = path.join(xdgConfig, "opencode", "codotchi-daily.json");
    if (fs.existsSync(ocDailyPath)) {
      const ocData = JSON.parse(fs.readFileSync(ocDailyPath, "utf8"));
      // Only include if the file is for today (UTC)
      if ((ocData.date ?? ocData.createdDate ?? "") === today) {
        costUsd      += ocData.dailyCostUSD ?? 0;
        tokens       += ocData.dailyTokens ?? 0;
        messageCount += ocData.dailyMessages ?? 0;
        // Sum last-1h events if present
        const events: Array<{ completedAt?: number; costUSD?: number }> = ocData.costEvents ?? [];
        for (const ev of events) {
          if ((ev.completedAt ?? 0) >= oneHourAgoMs) {
            hourlyCostUsd += ev.costUSD ?? 0;
          }
        }
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

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly statusBar: StatusBarManager,
    private readonly onStateUpdate: StateUpdateCallback,
    private readonly getState: () => PetState | null,
    private readonly getHighScore: () => HighScore | null,
    private readonly markActivity: () => void,
    private readonly onResetHighScore: () => void,
    private readonly markDeepIdle: () => void
  ) {}

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

      case "token_cost": {
        if (state === null) { return; }
        const usage = scanDailyUsage();
        const avgTok = usage.messageCount > 0
          ? Math.round(usage.tokens / usage.messageCount)
          : usage.tokens;
        const fmt = (n: number) =>
          n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M`
          : n >= 1000    ? `${(n / 1000).toFixed(1)}k`
          : String(n);
        const fmtCost = (u: number) => u < 0.005 ? "<$0.01" : `$${u.toFixed(2)}`;
        const text = `Today: ${fmtCost(usage.costUsd)} | Last 1h: ${fmtCost(usage.hourlyCostUsd)} | Avg: ${fmt(avgTok)} tok/msg (Claude + OpenCode)`;
        // Apply pat mechanics: −20 energy, +10 happiness.
        nextState = pat(state);
        if (this.webviewView) {
          void this.webviewView.webview.postMessage({ type: "showBubble", text });
        }
        break;
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
   * Send a state snapshot to the webview JS.
   *
   * @param state - The pet state to push to the webview.
   * @param highScore - The current best-run record (null if none).
   * @param devMode - Whether developer mode is currently active.
   * @param unlockedCharacter - spriteType of the unlocked custom character, or null.
   */
  postState(state: PetState, highScore: HighScore | null, devMode: boolean, unlockedCharacter: string | null = null, defaultPetName: string = "Codotchi"): void {
    if (this.webviewView) {
      void this.webviewView.webview.postMessage({
        type: "stateUpdate",
        state,
        mealsGivenThisCycle: this.mealsGivenThisCycle,
        highScore,
        devMode,
        unlockedCharacter,
        defaultPetName,
      });
    }
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
