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

1. Download `vscode-gotchi-1.3.0.vsix` from the Releases page.
2. In VS Code: **Extensions** (`Ctrl+Shift+X`) → **⋯** → **Install from VSIX…**
3. Select the file and reload.

Or from the terminal:

```bash
code --install-extension vscode-gotchi-1.3.0.vsix
```

### JetBrains

1. Download `pycharm-gotchi-1.3.0.zip` from the Releases page.
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

**Option B — Global install (`opencode-codotchi`)**

Make your pet available in **every project** you open in OpenCode by installing
it once per machine. The easiest path is downloading the zip from the Releases
page — no repository clone required:

**From zip (recommended):**

1. Download `opencode-codotchi-1.3.0.zip` from the
   [Releases page](https://github.com/dylscoop/codotchi/releases).
2. Extract it and run the installer:
   ```bash
   # macOS / Linux
   unzip opencode-codotchi-1.3.0.zip && cd opencode-codotchi-1.3.0
   node bin/install.js --install
   ```
   ```powershell
   # Windows (PowerShell)
   Expand-Archive opencode-codotchi-1.3.0.zip; cd opencode-codotchi-1.3.0
   node bin/install.js --install
   ```

**From source (local clone):**

```bash
cd opencode-codotchi
node bin/install.js --install
```

**From npm (once published):**

> **Note:** `opencode-codotchi` has not yet been published to the npm registry.

```bash
npx opencode-codotchi --install
```

The installer copies the `/codotchi` slash command and the plugin TypeScript
source files into `~/.config/opencode/commands/` and
`~/.config/opencode/plugins/` respectively, and adds the `@opencode-ai/plugin`
dependency to `~/.config/opencode/package.json`. OpenCode loads all files in
the plugins directory automatically on startup.

After running the installer, open any project in OpenCode — on first startup
the plugin dependency is installed via bun and the pet loads automatically.

Either way, use `/codotchi` to interact with your pet:
- `/codotchi` — show status
- `/codotchi feed` / `snack` / `play` / `pat` — care actions
- `/codotchi sleep` / `wake` — sleep cycle
- `/codotchi clean` / `medicine` — hygiene and health
- `/codotchi show` / `hide` — toggle ASCII art display
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
# produces vscode-gotchi-1.3.0.vsix
```

### JetBrains plugin

Requires JDK 17+.

```bash
cd pycharm

# macOS / Linux
./gradlew buildPlugin

# Windows
gradlew.bat buildPlugin

# produces pycharm/build/distributions/pycharm-gotchi-1.3.0.zip
```

## Version history

See [VERSIONS.md](VERSIONS.md) for the full changelog.

Current release: **v1.3.0** — built by [dylscoop](https://github.com/dylscoop)

---

> "Grow your best pet by writing your best code."
