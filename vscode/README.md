# vscode_gotchi

Grow and raise your personal virtual pet as a VS Code extension while you code.

## Overview

vscode_gotchi is a VS Code extension that lets you raise a digital pet inspired
by the original [Tamagotchi](https://en.wikipedia.org/wiki/Tamagotchi). Your pet
lives in a sidebar panel, reacts to your coding activity, and needs regular care
to survive and evolve into its final form.

## Features

- **Sidebar pet panel** — pixel art pet with animated sprites, stat bars, and
  action buttons, all rendered in a dedicated sidebar webview
- **Classic Tamagotchi mechanics** — hunger, happiness, discipline, energy,
  health, weight, and age stats, all decaying in real time
- **Full care system** — feed meals and snacks, play mini-games, put pet to
  sleep, clean droppings, give medicine, scold and praise
- **Life cycle & evolution** — egg → baby → child → teen → adult → senior, with
  the final character determined by how well you cared for your pet
- **Pet customization** — name your pet, choose a pet type, and pick a color
  palette on first launch
- **Sickness & death** — neglect your pet and it gets sick; leave it untreated
  and it dies
- **Coding activity rewards** — every file save makes your pet a little happier;
  coding streaks give bonus boosts
- **Status bar integration** — pet name and mood always visible in the VS Code
  status bar; click to open the sidebar
- **Persistent state** — pet survives VS Code restarts; offline time is
  accounted for with capped stat decay

## Installation

### Quick install (pre-built `.vsix`)

1. **Download `vscode-gotchi-0.6.2.vsix`** from the
   [Releases page](https://github.com/dylscoop/vscode_gotchi/releases).

2. **Install the `.vsix`:**

   **From the terminal:**

   ```bash
   code --install-extension vscode-gotchi-0.6.2.vsix
```

   **From the VS Code UI:**
   - Open the Extensions view (`Ctrl+Shift+X` / `Cmd+Shift+X`)
   - Click the **`···`** menu → **Install from VSIX…**
   - Select the downloaded file

3. **Reload VS Code.** The dragon-head icon appears in the activity bar.

The extension is fully self-contained — no Python or any other external
runtime is required.

### Build from source

You need Node.js ≥ 18 and npm.

```bash
git clone https://github.com/dylscoop/vscode_gotchi.git
cd vscode_gotchi/vscode

# Install Node dependencies (includes vsce)
npm install

# Compile TypeScript
npm run compile

# Package → produces vscode-gotchi-0.6.2.vsix
npx vsce package --no-dependencies

# Install it
code --install-extension vscode-gotchi-0.6.2.vsix
```

## Using the extension

Once installed and VS Code has reloaded:

1. Click the **dragon-head icon** in the activity bar (left sidebar) to open
   the **Your Pet** panel. Alternatively, run **Gotchi: Open Pet Panel** from
   the command palette (`Ctrl+Shift+P` / `Cmd+Shift+P`).

2. On first launch the **New Gotchi** setup screen appears:
   - Enter a name (up to 16 characters).
   - Choose a **pet type** — each has different stat decay rates.
   - Choose a **colour palette** — affects the sprite's colour scheme.
   - Click **Hatch!**

3. Your pet now lives in the sidebar. Care for it using the action buttons:
   **Feed**, **Snack**, **Play**, **Sleep**, **Clean**, **Medicine**,
   **Praise**, and **Scold**.

4. Every file you save gives your pet a happiness boost — keep coding to
   keep it happy.

5. Your pet's state is saved automatically and restored the next time VS Code
   opens. Stat decay while VS Code is closed is capped at 60 % of each
   maximum so a long break won't instantly kill your pet.

6. Your pet's name and current mood are always visible in the **status bar**
   at the bottom of VS Code.

## Actions

| Action | What it does |
| ------ | ----------- |
| **Feed** | Gives your pet a full meal. Restores a large chunk of hunger. Limited to 3 meals per wake cycle — overfeeding past that has no effect. |
| **Snack** | Gives a small treat. Boosts happiness instead of hunger, but adds more weight. More than 3 snacks in a row will make your pet sick. |
| **Play** | Starts a mini-game. Winning boosts happiness significantly; even losing gives a small consolation boost. Costs energy — your pet can't play if it's exhausted. |
| **Sleep** | Puts your pet to sleep. Energy slowly regenerates while it sleeps and your pet cannot take any other actions. Wake it manually or wait for full energy. |
| **Clean** | Clears all droppings from the screen. Pets produce droppings roughly every 20 minutes. Leaving 3 or more uncleaned will make your pet sick. |
| **Medicine** | Treats sickness. Requires 3 doses to fully cure. Restores a small amount of health per dose. Use it as soon as your pet falls ill to prevent health loss. |
| **Praise** | Rewards good behaviour. Raises the discipline stat, which contributes to a better care score and a higher-tier evolution. |
| **Scold** | Corrects bad behaviour. Also raises discipline. Use it when your pet misbehaves rather than at random, as it has no direct stat benefit beyond discipline. |

> **Tip:** keep all four stat bars (Hunger, Happy, Energy, Health) out of the
> red to maximise your care score, which determines which character your pet
> evolves into at each life stage.

## Development setup (contributors)

```bash
git clone https://github.com/dylscoop/vscode_gotchi.git
cd vscode_gotchi/vscode
npm install
npm run compile

# Press F5 in VS Code to launch the Extension Development Host
```

Validation commands (must all pass before committing):

```bash
# Run from vscode_gotchi/vscode/
npm run compile
npm test
```

## Architecture

The extension is a single self-contained TypeScript process:

| Layer | Technology | Responsibility |
|-------|-----------|----------------|
| Extension host + game engine | TypeScript | VS Code API, pet state machine, stat decay, evolution, persistence, event hooks |
| Webview UI | HTML / CSS / JS | Sidebar rendering, action buttons, sprite canvas |

See [docs/adr/2026-03-11-architecture.md](docs/adr/2026-03-11-architecture.md)
for the full design rationale, including amendment A1 which records the
decision to remove the original Python subprocess.

## Pet Types

| Type        | Tendency                                   |
| ----------- | ------------------------------------------ |
| Codeling    | Balanced across all stats                  |
| Bytebug     | High energy, hunger decays faster          |
| Pixelpup    | High happiness, but happiness decays faster|
| Shellscript | Slow evolver, high base health             |

Each pet type has its own sprite set and evolves into different adult characters
depending on care quality.

## Project Structure

```text
vscode_gotchi/          ← repo root
├── vscode/             ← VS Code extension (this package)
│   ├── src/            # TypeScript extension host and game engine
│   ├── media/          # Webview HTML, CSS, JS, and sprite assets
│   ├── tests/          # Unit tests for the game engine
│   ├── docs/adr/       # Architecture Decision Records
│   └── README.md       # This file
└── pycharm/            ← JetBrains plugin (Kotlin + Gradle)
```

## Development Roadmap

See [docs/adr/2026-03-11-architecture.md](docs/adr/2026-03-11-architecture.md)
for the detailed implementation plan. High-level order:

1. Extension scaffold + Python game engine core
2. TypeScript-Python bridge
3. Sidebar webview UI and action wiring
4. Evolution system
5. Sickness, death, and rebirth
6. Status bar + coding activity rewards
7. Mini-games
8. Persistence and offline decay
9. Polish and future features

## Future Ideas

- Gotchi Points currency + in-game shop
- Multiple simultaneous pets
- Seasonal/holiday characters
- Pet marriage between two users
- New pet types via extension pack contributions

---

> "Grow your best pet by writing your best code."
