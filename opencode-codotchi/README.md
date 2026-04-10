# opencode-codotchi

A virtual Tamagotchi-style pet that lives inside [OpenCode](https://opencode.ai).
Raises your gotchi in the terminal alongside your coding session.

## Features

- **Tick loop** — pet advances every 6 s via a background timer
- **Event hooks** — reacts to `file.edited` (coding reward), `session.idle` (idle), `server.connected` (greeting)
- **`/codotchi` slash command** — 10 actions: `status`, `feed`, `snack`, `play`, `pat`, `sleep`, `wake`, `clean`, `medicine`, `new_game`
- **ASCII art renderer** — 30 frames (6 stages × 5 moods), ANSI-coloured speech bubbles, status bars, toasts
- **Cross-IDE shared state** — reads from / writes to the same JSON file used by the VS Code and PyCharm extensions:
  - Linux/macOS: `~/.config/gotchi/state.json`
  - Windows: `%APPDATA%\gotchi\state.json`

## Global install

Run the installer once per machine to make your pet available in every OpenCode
project. Choose the path that matches how you have the package:

### Option A — From zip (recommended)

Download `opencode-codotchi-1.4.0.zip` from the
[Releases page](https://github.com/dylscoop/codotchi/releases), extract it,
then run the installer:

```bash
# macOS / Linux
unzip opencode-codotchi-1.4.0.zip
cd opencode-codotchi-1.4.0
node bin/install.js --install
```

```powershell
# Windows (PowerShell)
Expand-Archive opencode-codotchi-1.4.0.zip
cd opencode-codotchi-1.4.0
node bin/install.js --install
```

No npm publish or repository clone required. Node.js is the only prerequisite.

### Option B — From source (local clone)

Use this if you have already cloned the repository.

```bash
cd opencode-codotchi
node bin/install.js --install
```

### Option C — From npm (once published)

> **Note:** `opencode-codotchi` has not yet been published to the npm registry.
> This path will not work until `npm publish` has been run from `opencode-codotchi/`.

```bash
npx opencode-codotchi --install
```

---

### What the installer does

All three paths run the same script. It does three things:

1. **Copies the slash command** — `commands/codotchi.md` →
   `~/.config/opencode/commands/codotchi.md`
   (`XDG_CONFIG_HOME/opencode/commands/codotchi.md` if `XDG_CONFIG_HOME` is set;
   on Windows this is `C:\Users\<you>\.config\opencode\commands\codotchi.md`)

2. **Copies the plugin source files** into the global plugin directory:
   - `src/index.ts` → `~/.config/opencode/plugins/codotchi.ts`
   - `src/gameEngine.ts` → `~/.config/opencode/plugins/gameEngine.ts`
   - `src/asciiArt.ts` → `~/.config/opencode/plugins/asciiArt.ts`

   OpenCode loads all files in `~/.config/opencode/plugins/` automatically on
   every startup — no `"plugin"` config entry needed.

3. **Adds `@opencode-ai/plugin` to `~/.config/opencode/package.json`** (creates
   the file if it does not exist). OpenCode runs `bun install` on startup to
   resolve the dependency automatically.

### Open OpenCode

After running the installer, open any project in OpenCode. On first startup,
OpenCode installs the plugin dependency via bun, then loads the pet — your
codotchi will greet you in a speech bubble.

## Usage

```
/codotchi              — show status
/codotchi feed         — give a meal
/codotchi snack        — give a snack
/codotchi play         — play with your pet
/codotchi pat          — gently pat your pet
/codotchi sleep        — put your pet to sleep
/codotchi wake         — wake your pet up
/codotchi clean        — clean up droppings
/codotchi medicine     — give medicine to cure sickness
/codotchi show         — enable ASCII art display
/codotchi hide         — disable ASCII art display
/codotchi new_game name=<name> petType=<type>  — start a fresh pet
```

Pet types: `codeling` (default), `bytebug`, `pixelpup`, `shellscript`

## Cross-IDE compatibility

The plugin shares pet state with the VS Code extension and PyCharm plugin via a
cross-platform JSON file. Open your pet in any IDE and it will be in the same
state.

## Building from source

To compile the TypeScript source (produces `dist/`):

```bash
cd opencode-codotchi
npm install
npm run build
```

To rebuild the distributable zip:

```bash
cd opencode-codotchi
node scripts/package.js
```

## Part of the codotchi project

This package is part of the [codotchi](https://github.com/dylscoop/codotchi) monorepo.
See the root README for VS Code and PyCharm installation instructions.
