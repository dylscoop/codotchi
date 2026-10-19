# codotchi

A virtual Tamagotchi-style pet that lives inside your IDE and reacts to your
coding activity. Available for VS Code, JetBrains IDEs, OpenCode, and Claude
Desktop.

## What is it?

codotchi is a pixel-art virtual pet inspired by the original
[Tamagotchi](https://en.wikipedia.org/wiki/Tamagotchi). Your pet hatches from
an egg, grows through several life stages, and eventually reaches its final
evolved form — but only if you take care of it. Feed it, play with it, put it
to sleep, and keep its environment clean. Neglect it and it gets sick. Leave it
sick long enough and it dies.

Your coding activity matters too: every file you save and commit makes your pet a 
little happier.

## Leaderboard

**[View the public leaderboard →](https://dylscoop.github.io/codotchi/leaderboard/)**

### All-time tab — submit on death

After your pet dies, click **Submit to Leaderboard** on the game over screen. VS Code uses your existing GitHub sign-in (OAuth — no extra setup). You'll be prompted to type your pet's name to confirm before the submission is sent. The submission creates a GitHub issue that the workflow processes automatically.

### Live tab — push while alive

You can also appear on the leaderboard **while your pet is still alive**. Your entry shows your current age with a "live" badge and disappears after 48 hours if you stop pushing.

**VS Code:** Click the **Push live progress** toggle in the Codotchi sidebar. You'll be prompted to sign in to GitHub the first time. Your age is pushed hourly and immediately when you toggle on.

**PyCharm:** Click the same **Push live progress** toggle. On first use a GitHub sign-in page opens in your browser, and a notification shows the code to enter. The token is stored securely in the IDE keychain.

### Fair play

Only scores sent by the Codotchi plugin itself are accepted. Each one is signed, and hand-written GitHub issues are rejected. A pet can't be submitted (or pushed live) if:

- it **ever** ran with dev mode on, even if you turn dev mode off later
- its save file was edited outside Codotchi
- it hatched before this check existed (v2.27.0). Your next pet can be submitted.

The sidebar greys out **Submit to Leaderboard** and **Push live progress** and says why. Scores from before v2.27.0 stay on the board with a *legacy* tag.

**If your GitHub sign-in expires or is revoked**, both IDEs notice the next time they talk to GitHub. The sidebar shows **Sign in to GitHub again**, and a background live push shows a notification with a **Sign in** action. Submitting or deleting an entry asks you to sign in again and retries once.

## Platforms

| IDE | Package | Install |
| --- | ------- | ------- |
| VS Code | `vscode/` | [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=dylscoop.codotchi) (or `.vsix` from [Releases](https://github.com/dylscoop/codotchi/releases)) |
| Cursor / VSCodium / Windsurf | `vscode/` | [Open VSX](https://open-vsx.org/extension/dylscoop/codotchi) (or `.vsix` from [Releases](https://github.com/dylscoop/codotchi/releases)) |
| JetBrains (PyCharm, IntelliJ, etc.) | `pycharm/` | [JetBrains Marketplace](https://plugins.jetbrains.com/plugin/33203-codotchi) (or `.zip` from [Releases](https://github.com/dylscoop/codotchi/releases)) |
| OpenCode | `.opencode/` + `opencode-codotchi/` | In-repo plugin (auto-loaded) or npm package (global install) |
| Claude Desktop | `claude-desktop-codotchi/` | `.mcpb` one-click install (the pet renders as ASCII art inline in chat) |

Both extensions share the same game engine logic and the same webview UI
(`sidebar.html` / `sidebar.css` / `sidebar.js`). The OpenCode plugin uses a
terminal-native ASCII art renderer and shares pet state with VS Code and
PyCharm via a cross-platform JSON file.

## Quick install

### VS Code

Install **[Codotchi from the VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=dylscoop.codotchi)**,
or search for **Codotchi** in the Extensions view (`Ctrl+Shift+X`).

Or from the terminal:

```bash
code --install-extension dylscoop.codotchi
```

#### Manual install (VSIX)

1. Download `codotchi-2.30.0.vsix` from the [Releases page](https://github.com/dylscoop/codotchi/releases).
2. In VS Code: **Extensions** (`Ctrl+Shift+X`) → **⋯** → **Install from VSIX…**
3. Select the file and reload.

### Cursor (and other Open VSX editors)

Codotchi is published on **[Open VSX](https://open-vsx.org/extension/dylscoop/codotchi)**,
so it can be installed directly in Cursor, VSCodium, Windsurf and other VS Code–compatible
editors. Search for **Codotchi** in the Extensions view (`Ctrl+Shift+X`), or from the terminal:

```bash
cursor --install-extension dylscoop.codotchi
```

> The Copilot quota bubble only shows data if you're signed in with a GitHub account that has Copilot.

### JetBrains

Install **[Codotchi from the JetBrains Marketplace](https://plugins.jetbrains.com/plugin/33203-codotchi)**,
or in your IDE go to **Settings → Plugins → Marketplace**, search for
**Codotchi**, and click **Install**.

#### Manual install (ZIP)

1. Download `pycharm-codotchi-2.30.0.zip` from the [Releases page](https://github.com/dylscoop/codotchi/releases).
   Do **not** unzip it.
2. In your IDE: **Settings → Plugins → ⚙ → Install Plugin from Disk…**
3. Select the `.zip` file and restart the IDE.

### OpenCode

Install once, and your pet follows you into **every project** you open in
OpenCode. Pick **one** of the options below.

#### Option 1 — npm (recommended)

Add the plugin to your global OpenCode config,
`~/.config/opencode/opencode.json` (or `$XDG_CONFIG_HOME/opencode/opencode.json`):

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugins": ["opencode-codotchi"]
}
```

On OpenCode 1.x the key is `"plugin"` (singular) instead of `"plugins"`.

Restart OpenCode. It downloads the package on startup, and the plugin
registers both the `codotchi` tool and the `/codotchi` slash command, so
there's nothing else to copy. To pin a version use `"opencode-codotchi@2.30.0"`.

> If you prefer files on disk, `npx opencode-codotchi --install` runs the same
> installer as Option 2 straight from npm.

#### Option 2 — Release zip (no Node package manager needed)

1. Download the latest `opencode-codotchi-<version>.zip` from the
   [Releases page](https://github.com/dylscoop/codotchi/releases/latest).
2. Extract it and run the installer:

   ```bash
   # macOS / Linux
   unzip opencode-codotchi-<version>.zip && cd opencode-codotchi-<version>
   node bin/install.js --install
   ```

   ```powershell
   # Windows (PowerShell)
   Expand-Archive opencode-codotchi-<version>.zip; cd opencode-codotchi-<version>
   node bin/install.js --install
   ```

#### Option 3 — From source

```bash
cd opencode-codotchi
npm install
node bin/install.js --install
```

#### Option 4 — In-repo (this repository only)

The plugin in `.opencode/` loads automatically when you open this repository
in OpenCode. Run `cd .opencode && npm install` once first.

#### What the installer does (options 2 and 3)

| Writes | Purpose |
|---|---|
| `~/.config/opencode/plugins/codotchi/index.js` + `tui.tsx` | OpenCode 2 plugin (server bundle + sidebar/TUI) |
| `~/.config/opencode/plugins/codotchi.js` | OpenCode 1.x single-file plugin (removed automatically on OpenCode 2) |
| `~/.config/opencode/commands/codotchi.md` | The `/codotchi` slash command |
| `~/.config/opencode/package.json` | Adds the `@opencode-ai/plugin` dependency, installed by OpenCode via bun on next start |

`~/.config` is replaced by `$XDG_CONFIG_HOME` when that variable is set. Old
loose `.ts` files from earlier versions are removed automatically.

#### Check it works

Open any project in OpenCode and run `/codotchi`. You should see your pet's
stats. If nothing happens, see Troubleshooting below.

#### Update / uninstall

- **npm:** OpenCode refreshes the package on startup; pin or bump the version
  in `opencode.json`. Remove the entry from `"plugins"` to uninstall.
- **Zip / source:** re-run `node bin/install.js --install` from the new
  version. To uninstall, delete the `plugins/codotchi/` folder (or
  `plugins/codotchi.js` on 1.x) and `commands/codotchi.md` from
  `~/.config/opencode/`.

Don't combine options 1 and 2 — you'd load the plugin twice.

#### Cost sync with VS Code / PyCharm

The OpenCode plugin writes today's spend (cost, tokens, messages) to
`~/.config/opencode/codotchi-daily.json`. The VS Code and PyCharm pets read
this file and show it as an **OpenCode** line next to their own usage, so you
see your OpenCode spend from the IDE too. The file resets each local
calendar day, and the IDEs ignore it if it's from an earlier day.

The `warnthreshold` / `shoutthreshold` cost alerts are OpenCode-only and are
stored in `~/.config/opencode/codotchi-config.json`.

OpenCode's own price table charges $0 for GitHub Copilot cache writes, so the
plugin recomputes each reply's cost from its tokens using
[GitHub's published Copilot rates](https://docs.github.com/en/copilot/reference/copilot-billing/models-and-pricing)
for Claude models (e.g. Opus 5.5: $4 input, $0.20 cached input, $5 cache
write, $20 output per 1M tokens). Other models use OpenCode's figure. To
change a rate or price another model, add a `pricing` entry (USD per 1M
tokens, any field optional) to `codotchi-config.json`:

```json
{ "pricing": { "github-copilot/claude-opus-5.5": { "cacheWrite": 5 } } }
```

Both sides honour `XDG_CONFIG_HOME`, so set it (or leave it unset) the same
way for OpenCode and your IDE.

#### Troubleshooting

- **`/codotchi` does nothing / tool not found:** make sure only one install
  method is active, then restart OpenCode. Check that
  `~/.config/opencode/plugins/` contains only the `codotchi/` folder (or
  `codotchi.js` on 1.x), with no leftover
  `gameEngine.ts`, `asciiArt.ts`, `statePathResolver.ts`); re-running the
  installer cleans these up.
- **"Plugin export is not a function":** the same leftover `.ts` files are the
  cause; re-run the installer.
- **IDE shows $0 for OpenCode:** send at least one message in OpenCode today,
  then confirm `codotchi-daily.json` exists in the folder above and that
  OpenCode and the IDE agree on `XDG_CONFIG_HOME`.

#### Using your pet

- `/codotchi` — show status
- `/codotchi feed` / `snack` / `play` / `pat` — care actions
- `/codotchi sleep` / `wake` — sleep cycle
- `/codotchi clean` / `medicine` — hygiene and health
- `/codotchi show` / `hide` — toggle ASCII art display
- `/codotchi warnthreshold <usd>` / `shoutthreshold <usd>` — daily cost alerts
- `/codotchi new_game name=<name> petType=<type>` — start a fresh pet

Care actions (`feed`, `snack`, `play`, `pat`, `sleep`/`wake`, `clean`,
`medicine`), `rename` and `new_game` act on the OpenCode pet only. They have no
effect on VS Code or PyCharm pets — look after those in the IDE sidebar.

For full usage instructions see the individual READMEs:

- [vscode/README.md](vscode/README.md)
- [pycharm/README.md](pycharm/README.md)

## Repository layout

```text
codotchi/
├── vscode/                  VS Code extension (TypeScript)
│   ├── src/                 Extension host + game engine
│   ├── media/               Webview UI (HTML / CSS / JS)
│   └── README.md
├── pycharm/                 JetBrains plugin (Kotlin + Gradle)
│   ├── src/main/kotlin/     Plugin source
│   ├── src/main/resources/  plugin.xml + shared webview files
│   └── README.md
├── .opencode/               OpenCode terminal plugin (in-repo)
│   ├── plugins/             codotchi.ts, gameEngine.ts, asciiArt.ts
│   └── commands/            /codotchi slash command definition
├── opencode-codotchi/       OpenCode npm package (global install)
│   ├── src/                 index.ts, gameEngine.ts, asciiArt.ts
│   ├── commands/            /codotchi slash command definition
│   └── bin/                 install.js CLI script
├── claude-desktop-codotchi/ Claude Desktop integration (.mcpb bundle, ASCII-art pet)
│   ├── src/                 server.ts, tools.ts, state.ts, gameEngine.ts, asciiArt.ts
│   └── scripts/             build.mjs + bundle-mcpb.mjs
├── leaderboard/             GitHub Pages leaderboard (scores.json + index.html)
├── archive/                 Snapshots of previous versions
└── developer_notes/         Dev-facing docs (changelog, design notes, sprites)
    ├── VERSIONS.md          Changelog
    ├── BUGFIXES.md          Bug fix log
    ├── DEV_NOTES.md         Developer notes
    ├── SPRITES.md           Sprite index
    ├── sprites/             Per-pet-type sprite markdown files
    ├── vscode/              VS Code-specific dev docs (FEATURES, DESIGN, BUILD_LOG)
    └── adr/                 Architecture Decision Records
```

## Building from source

### VS Code extension

Requires Node.js ≥ 18.

```bash
cd vscode
npm install
npx vsce package
# produces codotchi-2.30.0.vsix
```

### JetBrains plugin

Requires JDK 17+.

```bash
cd pycharm

# macOS / Linux
./gradlew buildPlugin

# Windows
gradlew.bat buildPlugin

# produces pycharm/build/distributions/pycharm-codotchi-2.30.0.zip
```

## Version history

See [developer_notes/VERSIONS.md](developer_notes/VERSIONS.md) for the full changelog.

Current release: **v2.30.0** — built by [dylscoop](https://github.com/dylscoop)

> "Grow your best pet by writing your best code."


