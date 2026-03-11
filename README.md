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

## Architecture

The extension is split into two layers:

| Layer | Technology | Responsibility |
|-------|-----------|----------------|
| Extension host | TypeScript | VS Code API, webview bridge, persistence, event hooks |
| Game engine | Python (subprocess) | Pet state machine, stat decay, evolution, mini-game logic |

The TypeScript layer and Python backend communicate via **JSON over stdin/stdout**.
See [DESIGN.md](DESIGN.md) for the full protocol and schema.

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
├── DESIGN.md        # Full technical design document
└── README.md        # This file
```

## Development Roadmap

See [DESIGN.md](DESIGN.md) for the detailed implementation plan. High-level order:

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
