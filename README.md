# gotchi

A virtual Tamagotchi-style pet that lives inside your IDE and reacts to your
coding activity. Available for both VS Code and JetBrains IDEs.

## What is it?

gotchi is a pixel-art virtual pet inspired by the original
[Tamagotchi](https://en.wikipedia.org/wiki/Tamagotchi). Your pet hatches from
an egg, grows through several life stages, and eventually reaches its final
evolved form — but only if you take care of it. Feed it, play with it, put it
to sleep, and keep its environment clean. Neglect it and it gets sick. Leave it
sick long enough and it dies.

Your coding activity matters too: every file you save makes your pet a little
happier.

## Platforms

| IDE | Package | Install |
| --- | ------- | ------- |
| VS Code | `vscode/` | `.vsix` from [Releases](https://github.com/dylscoop/vscode_gotchi/releases) |
| JetBrains (PyCharm, IntelliJ, etc.) | `pycharm/` | `.zip` from [Releases](https://github.com/dylscoop/vscode_gotchi/releases) |
| OpenCode | `.opencode/` + `opencode-codotchi/` | In-repo plugin (auto-loaded) or npm package (global install) |

Both extensions share the same game engine logic and the same webview UI
(`sidebar.html` / `sidebar.css` / `sidebar.js`). The OpenCode plugin uses a
terminal-native ASCII art renderer and shares pet state with VS Code and
PyCharm via a cross-platform JSON file.

## Quick install

### VS Code

1. Download `vscode-gotchi-0.10.1.vsix` from the Releases page.
2. In VS Code: **Extensions** (`Ctrl+Shift+X`) → **⋯** → **Install from VSIX…**
3. Select the file and reload.

Or from the terminal:

```bash
code --install-extension vscode-gotchi-0.10.1.vsix
```

### JetBrains

1. Download `pycharm-gotchi-0.10.1.zip` from the Releases page.
   Do **not** unzip it.
2. In your IDE: **Settings → Plugins → ⚙ → Install Plugin from Disk…**
3. Select the `.zip` file and restart the IDE.

### OpenCode

**Option A — In-repo (this repository only)**

The plugin lives in `.opencode/plugins/gotchi.ts` and is loaded automatically
by OpenCode when you open this repository.

1. Make sure `@opencode-ai/plugin` is installed:
   ```bash
   cd .opencode && npm install
   ```
2. Open the repo in OpenCode — the pet plugin loads on startup.

**Option B — Global install via npm (`opencode-codotchi`)**

Install the `opencode-codotchi` package to make your pet available in **every
project** you open in OpenCode:

1. Add to `~/.config/opencode/opencode.json`:
   ```json
   { "plugin": ["opencode-codotchi"] }
   ```
2. Run once to install the slash command globally:
   ```bash
   npx opencode-codotchi --install
   ```
3. Open any project in OpenCode — the pet loads automatically.

Either way, use `/codotchi` to interact with your pet:
- `/codotchi` — show status
- `/codotchi feed` / `snack` / `play` / `pat` — care actions
- `/codotchi sleep` / `wake` — sleep cycle
- `/codotchi clean` / `medicine` — hygiene and health
- `/codotchi new_game name=<name> petType=<type>` — start a fresh pet

For full usage instructions see the individual READMEs:

- [vscode/README.md](vscode/README.md)
- [pycharm/README.md](pycharm/README.md)

## Repository layout

```text
gotchi/
├── vscode/                  VS Code extension (TypeScript)
│   ├── src/                 Extension host + game engine
│   ├── media/               Webview UI (HTML / CSS / JS)
│   └── README.md
├── pycharm/                 JetBrains plugin (Kotlin + Gradle)
│   ├── src/main/kotlin/     Plugin source
│   ├── src/main/resources/  plugin.xml + shared webview files
│   └── README.md
├── .opencode/               OpenCode terminal plugin (in-repo)
│   ├── plugins/             gotchi.ts, gameEngine.ts, asciiArt.ts
│   └── commands/            /codotchi slash command definition
├── opencode-codotchi/       OpenCode npm package (global install)
│   ├── src/                 index.ts, gameEngine.ts, asciiArt.ts
│   ├── commands/            /codotchi slash command definition
│   └── bin/                 install.js CLI script
├── archive/                 Snapshots of previous versions
├── VERSIONS.md              Changelog
└── BUGFIXES.md              Bug fix log
```

## Building from source

### VS Code extension

Requires Node.js ≥ 18.

```bash
cd vscode
npm install
npx vsce package
# produces vscode-gotchi-0.10.1.vsix
```

### JetBrains plugin

Requires JDK 17+.

```bash
cd pycharm

# macOS / Linux
./gradlew buildPlugin

# Windows
gradlew.bat buildPlugin

# produces pycharm/build/distributions/pycharm-gotchi-0.10.1.zip
```

## Version history

See [VERSIONS.md](VERSIONS.md) for the full changelog.

Current release: **v0.10.1** — built by [dylscoop](https://github.com/dylscoop)

---

> "Grow your best pet by writing your best code."
