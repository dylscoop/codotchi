---
name: ide-parity
description: Enforces feature parity between the VS Code extension and PyCharm plugin — any functional change to one IDE must be mirrored to the other unless the user explicitly restricts the change to one IDE only.
---

## Rule

Any time a feature or functional change is requested for one IDE, apply the equivalent change to the other IDE as well — unless the user **explicitly** says to change only one (e.g. "VS Code only", "just PyCharm", "don't touch the other plugin").

When in doubt, always do both.

---

## File mapping

| Concern | VS Code | PyCharm |
|---------|---------|---------|
| Game engine (logic) | `packages/core/src/gameEngine.ts` (synced to `vscode/src/` by `scripts/sync-core.mjs`) | `pycharm/src/main/kotlin/com/gotchi/engine/GameEngine.kt` |
| Pet state model | `vscode/src/gameEngine.ts` (`PetState` interface) | `pycharm/src/main/kotlin/com/gotchi/engine/PetState.kt` |
| Constants / tuning | `vscode/src/gameEngine.ts` (top of file) | `pycharm/src/main/kotlin/com/gotchi/engine/Constants.kt` |
| Command handling / message routing | `vscode/src/sidebarProvider.ts` | `pycharm/src/main/kotlin/com/gotchi/GotchiPlugin.kt` |
| Persistence | `vscode/src/persistence.ts` | `pycharm/src/main/kotlin/com/gotchi/GotchiPersistence.kt` |
| Status bar | `vscode/src/statusBar.ts` | `pycharm/src/main/kotlin/com/gotchi/GotchiStatusWidget.kt` |
| Extension entry point | `vscode/src/extension.ts` | `pycharm/src/main/kotlin/com/gotchi/GotchiPlugin.kt` |
| Webview (HTML / CSS / JS, sprites, sprite preview) | `vscode/media/` | same files — copied into `webview/` by `processResources` in `pycharm/build.gradle.kts` |
| Plugin manifest | `vscode/package.json` | `pycharm/src/main/resources/META-INF/plugin.xml` |
| Build config | `vscode/package.json` | `pycharm/build.gradle.kts` |

---

## Architecture differences to account for when porting

### JS → host messaging

- **VS Code**: `vscode.postMessage({ command, ... })` in `sidebar.js`
- **PyCharm**: `window.__vscodeSendMessage(JSON.stringify({ command, ... }))` — same shape, different call

### Host → JS messaging

- **VS Code**: `webview.postMessage(payload)` in `sidebarProvider.ts`
- **PyCharm**: `browser.cefBrowser.executeJavaScript("window.dispatchEvent(new MessageEvent('message',{data:$json}))", ...)` in `GotchiPlugin.kt`

### Settings / configuration

- **VS Code**: `vscode.workspace.getConfiguration('gotchi')` + `contributes.configuration` in `package.json`
- **PyCharm**: `GotchiSettings.kt` (app service) + `GotchiConfigurable.kt` (Settings UI), registered in `plugin.xml`

### Threading

- **VS Code**: single-threaded extension host — no special threading needed
- **PyCharm**: all UI updates must be wrapped in `ApplicationManager.getApplication().invokeLater { ... }`

### CSS variables

- **VS Code**: can use `var(--vscode-*)` tokens freely
- **PyCharm**: VS Code tokens are not available — always provide a fallback value, e.g. `color: var(--vscode-foreground, #cccccc)`

### Health bar rendering

- Both use `width %` (not `scaleX`) on `.bar-fill` elements — keep in sync.

---

## Webview files are shared

`vscode/media/` is the single source for the webview: `sidebar.{js,css,html}`, `customCharacters.js`, `spriteConstants.js`, `sprites.js` and `sprite_preview.html`. PyCharm's build copies them into the plugin's `webview/` resources (`pycharm/src/main/resources/webview/` is gitignored — never recreate it). Edit `vscode/media/` only; host-specific behaviour must branch at runtime (e.g. on `window.__vscodeSendMessage`), not in a separate copy.

---

## After any change

1. If game logic changed: verify `GameEngine.kt` constants and function signatures still match `gameEngine.ts`.
2. If webview changed: edit `vscode/media/` only, then rebuild PyCharm (or run `gradlew processResources`) to pick it up.
3. Run `npx tsc --noEmit` from `vscode/` to type-check the VS Code side.
4. Run `gradlew.bat buildPlugin` from `pycharm/` (with `JAVA_HOME` set) to verify the PyCharm side compiles.
5. Commit both sets of changes together.
