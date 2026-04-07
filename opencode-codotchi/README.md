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

> **Note:** `opencode-codotchi` has not yet been published to the npm registry.
> The steps below will not work until the package is published. To publish, run
> `npm login` (or set `NPM_TOKEN=<token>`) then `npm publish` from this
> directory. See [Building from source](#building-from-source) below.

### 1. Add the plugin to your OpenCode config

Edit `~/.config/opencode/opencode.json` (create it if it doesn't exist):

```json
{
  "plugin": ["opencode-codotchi"]
}
```

OpenCode will automatically download and install the package via Bun on next startup.

### 2. Install the slash command

Run once to copy the `/codotchi` command definition to your global OpenCode commands directory:

```bash
npx opencode-codotchi --install
```

This copies `commands/codotchi.md` to `~/.config/opencode/commands/codotchi.md`.

### 3. Open OpenCode

The pet plugin loads automatically on startup. Your pet will greet you in a speech bubble.

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
/codotchi new_game name=<name> petType=<type>  — start a fresh pet
```

Pet types: `codeling` (default), `bytebug`, `pixelpup`, `shellscript`

## Cross-IDE compatibility

The plugin shares pet state with the VS Code extension and PyCharm plugin via a
cross-platform JSON file. Open your pet in any IDE and it will be in the same
state.

## Building from source

```bash
cd opencode-codotchi
npm install
npm run build
```

This produces `dist/index.js` (the compiled plugin entry point).

## Part of the codotchi project

This package is part of the [codotchi](https://github.com/dylscoop/codotchi) monorepo.
See the root README for VS Code and PyCharm installation instructions.
