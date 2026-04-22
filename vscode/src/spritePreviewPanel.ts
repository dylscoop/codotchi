/**
 * spritePreviewPanel.ts
 *
 * Opens a VS Code WebviewPanel that renders the sprite preview gallery
 * (vscode/media/sprite_preview.html).  Only available in developer mode.
 *
 * Usage:
 *   SpritePreviewPanel.open(context);   // opens or focuses the panel
 */

import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import * as crypto from "crypto";

export class SpritePreviewPanel {
  private static current: SpritePreviewPanel | undefined;

  private readonly panel: vscode.WebviewPanel;
  private readonly context: vscode.ExtensionContext;

  private constructor(context: vscode.ExtensionContext) {
    this.context = context;

    this.panel = vscode.window.createWebviewPanel(
      "codotchi.spritePreview",
      "Codotchi Sprite Preview",
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        localResourceRoots: [
          vscode.Uri.file(path.join(context.extensionPath, "media")),
        ],
        retainContextWhenHidden: true,
      }
    );

    this.panel.webview.html = this.buildHtml();

    this.panel.onDidDispose(() => {
      SpritePreviewPanel.current = undefined;
    });
  }

  /** Open the panel (or focus it if already open). */
  static open(context: vscode.ExtensionContext): void {
    if (SpritePreviewPanel.current) {
      SpritePreviewPanel.current.panel.reveal(vscode.ViewColumn.One);
      return;
    }
    SpritePreviewPanel.current = new SpritePreviewPanel(context);
  }

  private buildHtml(): string {
    const mediaPath = path.join(this.context.extensionPath, "media");
    const htmlPath  = path.join(mediaPath, "sprite_preview.html");

    if (!fs.existsSync(htmlPath)) {
      return `<html><body><p>sprite_preview.html not found.</p></body></html>`;
    }

    const webview = this.panel.webview;
    const nonce   = crypto.randomBytes(16).toString("base64");

    const spriteConstantsUri = webview.asWebviewUri(
      vscode.Uri.file(path.join(mediaPath, "spriteConstants.js"))
    );
    const spritesUri = webview.asWebviewUri(
      vscode.Uri.file(path.join(mediaPath, "sprites.js"))
    );
    const spritesAdultUri = webview.asWebviewUri(
      vscode.Uri.file(path.join(mediaPath, "sprites_adult.js"))
    );

    const cspTag = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src ${webview.cspSource} 'nonce-${nonce}'; img-src ${webview.cspSource} data:;" />`;

    let html = fs.readFileSync(htmlPath, "utf8");
    // Inject CSP
    html = html.replace("{{csp}}", cspTag);
    // Replace relative script src paths with webview URIs
    html = html.replace(`src="spriteConstants.js"`, `src="${spriteConstantsUri}"`);
    html = html.replace(`src="sprites.js"`,         `src="${spritesUri}"`);
    html = html.replace(`src="sprites_adult.js"`,   `src="${spritesAdultUri}"`);
    // Add nonce to the inline script tag (the one with no src attribute)
    html = html.replace(`<script>\n(function`, `<script nonce="${nonce}">\n(function`);

    return html;
  }
}
