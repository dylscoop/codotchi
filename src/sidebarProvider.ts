/**
 * sidebarProvider.ts
 *
 * WebviewViewProvider for the "Your Pet" sidebar panel.
 *
 * Translates webview button messages into Python bridge calls,
 * and pushes full state snapshots back to the webview after each action.
 */

import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import { PythonBridge, PetState, EngineResponse } from "./pythonBridge";
import { saveState } from "./persistence";
import { StatusBarManager } from "./statusBar";

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

  constructor(
    private readonly bridge: PythonBridge,
    private readonly context: vscode.ExtensionContext,
    private readonly statusBar: StatusBarManager,
    private readonly onStateUpdate: StateUpdateCallback
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

    const messageListener = webviewView.webview.onDidReceiveMessage(
      (message: WebviewMessage) => {
        this.handleWebviewMessage(message);
      }
    );
    this.disposables.push(messageListener);
  }

  /** Build the HTML content for the webview. */
  private buildHtml(webview: vscode.Webview): string {
    const mediaPath = path.join(this.context.extensionPath, "media");
    const htmlPath = path.join(mediaPath, "sidebar.html");

    if (!fs.existsSync(htmlPath)) {
      return `<html><body><p>Loading...</p></body></html>`;
    }

    let html = fs.readFileSync(htmlPath, "utf8");

    // Replace resource URIs so the webview can load CSS / JS / sprites.
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
    html = html.replace("{{cspSource}}", webview.cspSource);

    return html;
  }

  /** Dispatch webview button presses to the appropriate bridge command. */
  private handleWebviewMessage(message: WebviewMessage): void {
    let commandPromise: Promise<EngineResponse>;

    switch (message.command) {
      case "feed":
        commandPromise = this.bridge.send({
          action: "feed",
          feed_type: message.feedType ?? "meal",
        });
        break;
      case "play":
        commandPromise = this.bridge.send({
          action: "play",
          game: message.game ?? "guess",
          result: message.result ?? "win",
        });
        break;
      case "sleep":
        commandPromise = this.bridge.send({ action: "sleep" });
        break;
      case "wake":
        commandPromise = this.bridge.send({ action: "wake" });
        break;
      case "clean":
        commandPromise = this.bridge.send({ action: "clean" });
        break;
      case "medicine":
        commandPromise = this.bridge.send({ action: "medicine" });
        break;
      case "scold":
        commandPromise = this.bridge.send({ action: "scold" });
        break;
      case "praise":
        commandPromise = this.bridge.send({ action: "praise" });
        break;
      case "new_game":
        commandPromise = this.bridge.send({
          action: "new_game",
          name: message.name ?? "Gotchi",
          pet_type: message.petType ?? "codeling",
          color: message.color ?? "neon",
        });
        break;
      default:
        return;
    }

    commandPromise
      .then((response) => {
        if ("hunger" in response) {
          const state = response as PetState;
          saveState(this.context, state);
          this.onStateUpdate(state);
          this.postState(state);
          this.statusBar.update(state);
        }
      })
      .catch((err: Error) => {
        vscode.window.showErrorMessage(`Gotchi error: ${err.message}`);
      });
  }

  /** Send a state snapshot to the webview JS. */
  postState(state: PetState): void {
    if (this.webviewView) {
      void this.webviewView.webview.postMessage({
        type: "stateUpdate",
        state,
      });
    }
  }

  dispose(): void {
    for (const d of this.disposables) {
      d.dispose();
    }
  }
}
