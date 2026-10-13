# opencode-codotchi

A virtual Tamagotchi-style pet that lives inside [OpenCode](https://opencode.ai).
Raises your codotchi in the terminal alongside your coding session.

## Features

- **Tick loop** — pet advances every 6 s via a background timer
- **Event hooks** — reacts to `file.edited` (coding reward), `session.idle` (idle), `server.connected` (greeting)
- **`/codotchi` slash command** — 10 actions: `status`, `feed`, `snack`, `play`, `pat`, `sleep`, `wake`, `clean`, `medicine`, `new_game`
- **ASCII art renderer** — 30 frames (6 stages × 5 moods), ANSI-coloured speech bubbles, status bars, toasts
- **Cross-IDE shared state** — auto-detects and links to the correct VS Code state file, including per-workspace state (`codotchi.perWorkspacePet`). Picks whichever `state.json` under `…/codotchi/vscode/` was written most recently at startup.

## Install

Pick **one** option. Full guide (update, uninstall, troubleshooting, IDE cost
sync): [main README](https://github.com/dylscoop/codotchi#opencode).

### Option A — npm (recommended)

Add the package to `~/.config/opencode/opencode.json`
(`$XDG_CONFIG_HOME/opencode/opencode.json` if set):

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["opencode-codotchi"]
}
```

Restart OpenCode. The plugin registers the `codotchi` tool and the
`/codotchi` slash command itself, so no files need copying.

### Option B — Release zip

Download the latest `opencode-codotchi-<version>.zip` from the
[Releases page](https://github.com/dylscoop/codotchi/releases/latest), extract
it, then run `node bin/install.js --install` inside the extracted folder.
(`npx opencode-codotchi --install` does the same straight from npm.)

### Option C — From source

```bash
cd opencode-codotchi
npm install
node bin/install.js --install
```

### What the installer does (options B and C)

1. Copies `commands/codotchi.md` → `~/.config/opencode/commands/codotchi.md`.
2. Copies the single bundled plugin `dist-plugin/codotchi.js` →
   `~/.config/opencode/plugins/codotchi.js`, and removes leftover `.ts` files
   from older versions.
3. Adds `@opencode-ai/plugin` to `~/.config/opencode/package.json`; OpenCode
   installs it via bun on next startup.

`~/.config` means `$XDG_CONFIG_HOME` when that variable is set. Don't combine
option A with B/C, or the plugin loads twice.

### Open OpenCode

Open any project in OpenCode and run `/codotchi` — your pet's stats appear.

## Usage

```text
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

---

## Support

**GitHub:** [github.com/dylscoop/codotchi](https://github.com/dylscoop/codotchi)

### Codotchi Sprites

Want to see a new sprite in the game? Send a drawn sprite or request one to be added — a passcode will be given every time one gets implemented.

[Open a sprite request on GitHub Issues](https://github.com/dylscoop/codotchi/issues)
