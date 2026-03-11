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

### Prerequisites

| Tool | Minimum version |
|------|----------------|
| [VS Code](https://code.visualstudio.com/) | 1.85 |
| [Node.js](https://nodejs.org/) | 18 |
| [Python](https://www.python.org/) | 3.14 |

### Steps

```bash
# 1. Clone the repository
git clone <repo-url>
cd vscode_gotchi

# 2. Install Node dependencies
npm install

# 3. Create the Python virtual environment
# Windows
py -3.14 -m venv .venv
.venv\Scripts\pip install -r requirements.txt

# macOS / Linux
python3.14 -m venv .venv
.venv/bin/pip install -r requirements.txt

# 4. Compile the TypeScript extension
npm run compile
```

## Packaging and permanent installation

The extension can be packaged into a `.vsix` file and installed permanently
into any VS Code instance — no F5 or development host needed.

### 1. Install the packaging tool

```bash
npm install
```

(`@vscode/vsce` is already listed as a dev dependency.)

### 2. Build the `.vsix`

```bash
npx vsce package --no-dependencies
```

This compiles the TypeScript (via the `vscode:prepublish` hook), bundles all
required files, and writes `vscode-gotchi-0.0.1.vsix` to the repository root.

### 3. Install the `.vsix`

**From the terminal:**

```bash
code --install-extension vscode-gotchi-0.0.1.vsix
```

**From the VS Code UI:**

1. Open the Extensions view (`Ctrl+Shift+X` / `Cmd+Shift+X`).
2. Click the **`···`** menu (top-right of the Extensions panel).
3. Choose **Install from VSIX…**
4. Select `vscode-gotchi-0.0.1.vsix`.

Restart VS Code when prompted. The extension activates automatically on
startup and the pet icon appears in the activity bar.

> **Python required on the target machine.**  
> The bundled game engine (`python/game_engine.py`) is a pure-stdlib Python
> script. Python 3.9 or newer must be available on the machine where the
> `.vsix` is installed. If VS Code cannot find it, set `gotchi.pythonPath`
> in settings to the full path of the interpreter.

## Launching the extension

### Development (F5)

1. Open the repository folder in VS Code.
2. Press **F5** (or **Run → Start Debugging**) to launch the
   **Extension Development Host** — a second VS Code window opens with
   the extension loaded.
3. In the new window, open the sidebar by clicking the dragon-head icon
   in the activity bar, or run **Gotchi: Open Panel** from the command
   palette (`Ctrl+Shift+P` / `Cmd+Shift+P`).
4. The Python game engine starts automatically in the background.
   Use **Gotchi: Output** in the Output panel to see engine logs.

### Custom Python path

If VS Code cannot find your Python 3.14 interpreter, set the path
explicitly in your settings:

```jsonc
// .vscode/settings.json  (or User Settings)
{
  "gotchi.pythonPath": "/path/to/python3.14"
  // Windows example: "C:\\Python314\\python.exe"
}
```

### First launch

On first launch the sidebar shows the **New Gotchi** setup screen:

1. Enter a name (up to 16 characters).
2. Choose a **pet type** — each has different stat decay rates.
3. Choose a **colour palette** — affects the sprite's colour scheme.
4. Click **Hatch!** to start the game.

Your pet's state is saved automatically whenever it changes and restored
the next time you open VS Code. Stat decay while VS Code is closed is
applied on restart, capped at 60 % of each maximum to prevent instant
death after a long break.

## Architecture

The extension is split into two layers:

| Layer | Technology | Responsibility |
|-------|-----------|----------------|
| Extension host | TypeScript | VS Code API, webview bridge, persistence, event hooks |
| Game engine | Python (subprocess) | Pet state machine, stat decay, evolution, mini-game logic |

The TypeScript layer and Python backend communicate via **JSON over stdin/stdout**.
See [docs/adr/2026-03-11-architecture.md](docs/adr/2026-03-11-architecture.md)
for the full protocol and schema.

## Pet Types

| Type        | Tendency                                   |
|-------------|--------------------------------------------|
| Codeling    | Balanced across all stats                  |
| Bytebug     | High energy, hunger decays faster          |
| Pixelpup    | High happiness, but happiness decays faster|
| Shellscript | Slow evolver, high base health             |

Each pet type has its own sprite set and evolves into different adult characters
depending on care quality.

## Project Structure

```
vscode_gotchi/
├── src/             # TypeScript extension host
├── media/           # Webview HTML, CSS, JS, and sprite assets
├── python/          # Python game engine
├── tests/           # pytest unit and integration tests
├── docs/adr/        # Architecture Decision Records
└── README.md        # This file
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
