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
import {
  PetState,
  HighScore,
  createPet,
  feedMeal,
  startSnack,
  consumeSnack,
  play,
  applyMinigameResult,
  sleep,
  wake,
  clean,
  giveMedicine,
  scold,
  praise,
} from "./gameEngine";

import { StatusBarManager } from "./statusBar";

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
  color?: string;
}

export class SidebarProvider
  implements vscode.WebviewViewProvider, vscode.Disposable
{
  public static readonly VIEW_ID = "gotchiView";

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
    private readonly markActivity: () => void
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

    // Re-send current state to the freshly-loaded webview so it has the
    // high score even before the next tick fires.
    const bootstrapState = this.getCurrentState();
    const bootstrapHs    = this.getHighScore();
    if (bootstrapState !== null) {
      this.postState(bootstrapState, bootstrapHs);
    } else if (bootstrapHs !== null) {
      // No active pet but we have a high score — push it so the setup screen
      // can display it.
      void webviewView.webview.postMessage({
        type: "stateUpdate",
        state: { needs_new_game: true },
        mealsGivenThisCycle: 0,
        highScore: bootstrapHs,
      });
    }

    const messageListener = webviewView.webview.onDidReceiveMessage(
      (message: WebviewMessage) => {
        this.handleWebviewMessage(message);
      }
    );
    this.disposables.push(messageListener);

    // BUGFIX-001: hot-reload the webview HTML when the font-size setting changes.
    // Also reload when any custom-colour setting changes so the Custom palette
    // updates immediately for any pet already using it.
    const configListener = vscode.workspace.onDidChangeConfiguration((e) => {
      if (
        e.affectsConfiguration("gotchi.fontSize") ||
        e.affectsConfiguration("gotchi.customPrimaryColor") ||
        e.affectsConfiguration("gotchi.customSecondaryColor") ||
        e.affectsConfiguration("gotchi.customBackgroundColor")
      ) {
        webviewView.webview.html = this.buildHtml(webviewView.webview);
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
      vscode.Uri.file(path.join(mediaPath, "sprites"))
    );

    html = html.replace("{{cssUri}}", cssUri.toString());
    html = html.replace("{{jsUri}}", jsUri.toString());
    html = html.replace("{{spritesUri}}", spritesUri.toString());
    html = html.replace(/\{\{cspSource\}\}/g, webview.cspSource);

    const fontSizeSetting = vscode.workspace
      .getConfiguration("gotchi")
      .get<string>("fontSize", "normal");
    const fontSizeClass =
      fontSizeSetting === "large" ? "font-large" :
      fontSizeSetting === "small" ? "font-small" :
      "font-normal";
    html = html.replace("{{fontSizeClass}}", fontSizeClass);

    const cfg = vscode.workspace.getConfiguration("gotchi");
    const customPrimary    = cfg.get<string>("customPrimaryColor",    "#ff8c00");
    const customSecondary  = cfg.get<string>("customSecondaryColor",  "#ffffff");
    const customBackground = cfg.get<string>("customBackgroundColor", "#1a1a2e");
    const customColorsStyle =
      `<style>:root{` +
      `--gotchi-custom-primary:${customPrimary};` +
      `--gotchi-custom-secondary:${customSecondary};` +
      `--gotchi-custom-background:${customBackground};` +
      `}</style>`;
    html = html.replace("{{customColorsStyle}}", customColorsStyle);

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
    if (state === null && message.command !== "new_game") {
      // No pet yet — nothing to do until a new game is started.
      return;
    }

    // BUGFIX-002: block care actions while the pet is sleeping
    const SLEEP_BLOCKED: readonly string[] = ["feed", "play", "clean", "medicine", "scold", "praise"];
    if (state !== null && state.sleeping && SLEEP_BLOCKED.includes(message.command)) {
      return;
    }

    let nextState: PetState | null = null;

    switch (message.command) {
      case "feed":
        if (state === null) {
          return;
        }
        if (message.feedType === "snack") {
          nextState = startSnack(state);
        } else {
          nextState = feedMeal(state, this.mealsGivenThisCycle);
          if (nextState.events.includes("fed_meal")) {
            this.mealsGivenThisCycle += 1;
          }
        }
        break;

      case "snack_consumed":
        if (state === null) {
          return;
        }
        nextState = consumeSnack(state);
        break;

      case "play":
        if (state === null) {
          return;
        }
        nextState = play(state);
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

      case "new_game": {
        const petName = message.name ?? "Gotchi";
        const petType = message.petType ?? "codeling";
        const color = message.color ?? "neon";
        nextState = createPet(petName, petType, color);
        this.mealsGivenThisCycle = 0;
        break;
      }

      case "user_activity":
        // Idle timer already reset above; no state change needed.
        return;

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
   */
  postState(state: PetState, highScore: HighScore | null): void {
    if (this.webviewView) {
      void this.webviewView.webview.postMessage({
        type: "stateUpdate",
        state,
        mealsGivenThisCycle: this.mealsGivenThisCycle,
        highScore,
      });
    }
  }

  dispose(): void {
    for (const d of this.disposables) {
      d.dispose();
    }
  }
}
