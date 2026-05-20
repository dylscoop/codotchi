# codotchi

A virtual Tamagotchi-style pet that lives inside your IDE and reacts to your
coding activity. Available for both VS Code and JetBrains IDEs.

## What is it?

codotchi is a pixel-art virtual pet inspired by the original
[Tamagotchi](https://en.wikipedia.org/wiki/Tamagotchi). Your pet hatches from
an egg, grows through several life stages, and eventually reaches its final
evolved form â€” but only if you take care of it. Feed it, play with it, put it
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

1. Download `codotchi-2.2.0.vsix` from the Releases page.
2. In VS Code: **Extensions** (`Ctrl+Shift+X`) â†’ **â‹¯** â†’ **Install from VSIXâ€¦**
3. Select the file and reload.

Or from the terminal:

```bash
code --install-extension codotchi-2.2.0.vsix
```

### JetBrains

1. Download `pycharm-codotchi-2.2.0.zip` from the Releases page.
   Do **not** unzip it.
2. In your IDE: **Settings â†’ Plugins â†’ âš™ â†’ Install Plugin from Diskâ€¦**
3. Select the `.zip` file and restart the IDE.

### OpenCode

**Option A â€” In-repo (this repository only)**

The plugin lives in `.opencode/plugins/codotchi.ts` and is loaded automatically
by OpenCode when you open this repository.

1. Make sure `@opencode-ai/plugin` is installed:
   ```bash
   cd .opencode && npm install
   ```
2. Open the repo in OpenCode â€” the pet plugin loads on startup.

**Option B â€” Global install (`opencode-codotchi`)**

Make your pet available in **every project** you open in OpenCode by installing
it once per machine. The easiest path is downloading the zip from the Releases
page â€” no repository clone required:

**From zip (recommended):**

1. Download `opencode-codotchi-2.2.0.zip` from the
   [Releases page](https://github.com/dylscoop/codotchi/releases).
2. Extract it and run the installer:
   ```bash
   # macOS / Linux
   unzip opencode-codotchi-2.2.0.zip && cd opencode-codotchi-2.2.0
   node bin/install.js --install
   ```
   ```powershell
   # Windows (PowerShell)
   Expand-Archive opencode-codotchi-2.2.0.zip; cd opencode-codotchi-2.2.0
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

After running the installer, open any project in OpenCode â€” on first startup
the plugin dependency is installed via bun and the pet loads automatically.

Either way, use `/codotchi` to interact with your pet:
- `/codotchi` â€” show status
- `/codotchi feed` / `snack` / `play` / `pat` â€” care actions
- `/codotchi sleep` / `wake` â€” sleep cycle
- `/codotchi clean` / `medicine` â€” hygiene and health
- `/codotchi show` / `hide` â€” toggle ASCII art display
- `/codotchi new_game name=<name> petType=<type>` â€” start a fresh pet

For full usage instructions see the individual READMEs:

- [vscode/README.md](vscode/README.md)
- [pycharm/README.md](pycharm/README.md)

## Repository layout

```text
codotchi/
â”œâ”€â”€ vscode/                  VS Code extension (TypeScript)
â”‚   â”œâ”€â”€ src/                 Extension host + game engine
â”‚   â”œâ”€â”€ media/               Webview UI (HTML / CSS / JS)
â”‚   â””â”€â”€ README.md
â”œâ”€â”€ pycharm/                 JetBrains plugin (Kotlin + Gradle)
â”‚   â”œâ”€â”€ src/main/kotlin/     Plugin source
â”‚   â”œâ”€â”€ src/main/resources/  plugin.xml + shared webview files
â”‚   â””â”€â”€ README.md
â”œâ”€â”€ .opencode/               OpenCode terminal plugin (in-repo)
â”‚   â”œâ”€â”€ plugins/             codotchi.ts, gameEngine.ts, asciiArt.ts
â”‚   â””â”€â”€ commands/            /codotchi slash command definition
â”œâ”€â”€ opencode-codotchi/       OpenCode npm package (global install)
â”‚   â”œâ”€â”€ src/                 index.ts, gameEngine.ts, asciiArt.ts
â”‚   â”œâ”€â”€ commands/            /codotchi slash command definition
â”‚   â””â”€â”€ bin/                 install.js CLI script
â”œâ”€â”€ archive/                 Snapshots of previous versions
â””â”€â”€ developer_notes/         Dev-facing docs (changelog, design notes, sprites)
    â”œâ”€â”€ VERSIONS.md          Changelog
    â”œâ”€â”€ BUGFIXES.md          Bug fix log
    â”œâ”€â”€ DEV_NOTES.md         Developer notes
    â”œâ”€â”€ SPRITES.md           Sprite index
    â”œâ”€â”€ sprites/             Per-pet-type sprite markdown files
    â”œâ”€â”€ vscode/              VS Code-specific dev docs (FEATURES, DESIGN, BUILD_LOG)
    â””â”€â”€ adr/                 Architecture Decision Records
```

## Building from source

### VS Code extension

Requires Node.js â‰¥ 18.

```bash
cd vscode
npm install
npx vsce package
# produces codotchi-2.2.0.vsix
```

### JetBrains plugin

Requires JDK 17+.

```bash
cd pycharm

# macOS / Linux
./gradlew buildPlugin

# Windows
gradlew.bat buildPlugin

# produces pycharm/build/distributions/pycharm-codotchi-2.2.0.zip
```

## Version history

See [developer_notes/VERSIONS.md](developer_notes/VERSIONS.md) for the full changelog.

Current release: **v2.2.0** â€” built by [dylscoop](https://github.com/dylscoop)

---

> "Grow your best pet by writing your best code."
