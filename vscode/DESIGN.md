# vscode_gotchi - Design Document

## Overview

A VS Code extension that lets you raise a virtual pet (inspired by the original
Tamagotchi) while you code. The pet lives in a sidebar panel, reacts to your
coding activity, and requires care to survive and evolve.

---

## Architecture

```
┌──────────────────────────────────────────┐
│  VS Code Extension (TypeScript)          │
│  ┌────────────────┐  ┌────────────────┐  │
│  │ Sidebar Webview │  │ Status Bar     │  │
│  │ (HTML/CSS/JS)   │  │ (mood + name)  │  │
│  └───────┬────────┘  └───────┬────────┘  │
│          └────────┬──────────┘           │
│          ┌────────▼─────────┐            │
│          │  Extension Host  │            │
│          │  TypeScript      │            │
│          │  - Message broker│            │
│          │  - Event hooks   │            │
│          │  - Persistence   │            │
│          └────────┬─────────┘            │
└───────────────────┼──────────────────────┘
                    │ JSON over stdin/stdout
          ┌─────────▼──────────┐
          │  Python Backend    │
          │  - Pet state machine│
          │  - Stat decay/grow │
          │  - Evolution logic │
          │  - Mini-game logic │
          │  - Death/rebirth   │
          └────────────────────┘
```

### Why TypeScript + Python?

- VS Code extensions **must** use TypeScript/JavaScript as the extension host
  language (hard requirement from VS Code's API).
- Python handles all game logic as a subprocess, communicating via JSON over
  stdin/stdout. This keeps game logic clean, testable, and independent of the
  VS Code API.
- The webview (sidebar) runs plain HTML/CSS/JS inside a sandboxed iframe.

---

## Project Structure

```
vscode_gotchi/
├── package.json                 # Extension manifest, commands, views, activation
├── tsconfig.json                # TypeScript compiler config
├── README.md                    # Project summary
├── DESIGN.md                    # This file
├── src/
│   ├── extension.ts             # Entry point: activation, register all providers
│   ├── sidebarProvider.ts       # WebviewViewProvider for the sidebar panel
│   ├── statusBar.ts             # Status bar item (mood emoji + pet name)
│   ├── pythonBridge.ts          # Spawn Python process, JSON protocol handler
│   ├── persistence.ts           # Save/load full pet state via context.globalState
│   └── events.ts                # VS Code event listeners (onDidSave, etc.)
├── media/
│   ├── sidebar.html             # Webview HTML shell
│   ├── sidebar.css              # Retro pixel art styling, CSS animations
│   ├── sidebar.js               # Client-side JS: button handlers, render loop
│   └── sprites/                 # Pixel art PNG sprites (named by stage + mood)
│       ├── egg.png
│       ├── baby_happy.png
│       ├── baby_sad.png
│       ├── baby_hungry.png
│       ├── baby_sleeping.png
│       ├── child_happy.png
│       ├── child_sad.png
│       ├── teen_happy.png
│       ├── teen_sad.png
│       ├── adult_happy.png
│       ├── adult_sad.png
│       ├── adult_sleeping.png
│       ├── sick.png
│       ├── poop.png
│       └── dead.png
├── python/
│   ├── game_engine.py           # Main loop: reads JSON stdin, writes JSON stdout
│   ├── pet.py                   # Pet class: all stats, stage, evolution tracking
│   ├── actions.py               # Feed, play, sleep, clean, medicine, scold, praise
│   ├── evolution.py             # Stage transition rules, character outcome logic
│   ├── minigames.py             # Mini-game result processing (win/lose -> stat delta)
│   ├── config.py                # All tunable constants (decay rates, thresholds)
│   └── models.py                # Pet type definitions and color palette data
└── .vscodeignore
```

---

## Core Stats

Faithful to the original Tamagotchi, with `energy` added to model sleep/wake cycles.

| Stat       | Range    | Description                                                       |
|------------|----------|-------------------------------------------------------------------|
| hunger     | 0-100    | Decays over time. 0 = starving (sickness risk)                    |
| happiness  | 0-100    | Decays over time. 0 = depressed (health risk)                     |
| discipline | 0-100    | Increases via scold/praise. Affects care quality score            |
| energy     | 0-100    | Depleted by play, restored by sleep                               |
| health     | 0-100    | Drops when sick. Reach 0 = death                                  |
| weight     | int      | Increases with snacks/meals, decreases with play                  |
| age        | int days | Increments once per real-world day after waking from sleep        |

---

## Actions

| Action       | Effect                                                                 | Constraint                        |
|--------------|------------------------------------------------------------------------|-----------------------------------|
| Feed Meal    | hunger +20, weight +1                                                  | Max 4 meals per meal cycle        |
| Feed Snack   | happiness +10, weight +2                                               | Overfeeding (>3 in a row) risks sickness |
| Play         | happiness +15, energy -10, weight -1                                   | Requires energy > 10              |
| Sleep        | energy regenerates over time, pet shows sleeping sprite                | Cannot act while sleeping         |
| Wake         | Manually wake pet (or auto-wake based on in-game clock)                |                                   |
| Clean        | Remove droppings from screen                                           | Droppings appear ~every 30 min    |
| Medicine     | health +20, cures sick status                                          | May need 2-3 doses for full cure  |
| Scold        | discipline +10                                                         | Only valid when pet misbehaves    |
| Praise       | discipline +10                                                         | Only valid when pet sulks/does good deed |
| Code Activity| happiness +5, discipline +2 (automatic, triggered by file save)       | Throttled to max once per 30 sec  |

---

## Life Cycle & Evolution

### Stages

| Stage  | Approx Duration | Notes                                              |
|--------|-----------------|-----------------------------------------------------|
| Egg    | ~2 minutes      | Auto-hatches; wiggles before hatching               |
| Baby   | ~10 minutes     | Parent AI handles care automatically                |
| Child  | ~1 hour         | First stage requiring player care                   |
| Teen   | ~3 hours        | 2 possible characters (per pet type)                |
| Adult  | Indefinite      | 4+ characters depending on cumulative care quality  |
| Senior | After ~24h adult| Random daily chance of transitioning                |
| Dead   | Terminal        | Ghost/angel sprite; shows age at death              |

### Care Quality Score

Calculated continuously by the Python backend as a weighted average:

```
care_score = (
    0.30 * hunger_avg +
    0.25 * happiness_avg +
    0.20 * discipline +
    0.15 * cleanliness +   # inverse of droppings left uncleaned
    0.10 * health_avg
) / 100
```

- `care_score >= 0.80` → best character for current stage
- `care_score >= 0.55` → mid-tier character
- `care_score < 0.55`  → low-tier character

### Evolution Rules (in `evolution.py`)

The evolution system is designed as a **data-driven rule engine**. Each pet type
defines a tree of characters:

```python
EVOLUTION_TREES = {
    "codeling": {
        "child": {
            "high": "codeling_child_a",
            "mid":  "codeling_child_b",
            "low":  "codeling_child_c",
        },
        "teen": { ... },
        "adult": { ... },
    },
    ...
}
```

New stages, characters, or pet types can be added by extending `EVOLUTION_TREES`
and adding the corresponding sprites — no logic changes required.

---

## Pet Customization

Shown on first launch (or new game):

1. **Name** — free text input (max 12 characters)
2. **Pet Type** — choose from 4 base types, each with different sprite sets and
   minor stat tendencies:

   | Type        | Tendency                                  |
   |-------------|-------------------------------------------|
   | Codeling    | Balanced across all stats                 |
   | Bytebug     | High energy, hunger decays faster         |
   | Pixelpup    | High happiness but happiness decays faster|
   | Shellscript | Slow evolver, high base health            |

3. **Color Palette** — 6 choices applied via CSS filter on sprites:
   Classic, Neon, Pastel, Monochrome, Sunset, Ocean

---

## Sickness & Death

### Sickness Triggers
- Overfeeding snacks: >3 snacks in a 5-minute window
- Leaving droppings uncleaned for >5 minutes
- Hunger reaching 0 while happiness is also below 20
- Happiness reaching 0 while hunger is also below 20

### Sick State
- Skull icon displayed next to pet
- Pet refuses to play or eat meals
- Health decreases by 5 per tick while sick and untreated
- Cure with Medicine action (2-3 doses)

### Death
- Health reaches 0, OR
- Hunger stays at 0 for 3+ consecutive ticks
- Shows dead sprite + age at death
- "Start New Game" button resets all state

---

## Coding Activity Rewards

Listening via `workspace.onDidSaveTextDocument`:

| Event                       | Reward                             |
|-----------------------------|------------------------------------|
| File save                   | happiness +5, discipline +2        |
| 5 saves within 30 minutes   | happiness +10 bonus (streak)       |
| 10 saves within 1 hour      | happiness +15 bonus, weight -1     |

- Throttled: a save reward fires at most once every 30 seconds
- These are sent as `code_activity` actions to the Python backend

---

## Status Bar

Format: `[sprite_emoji] [petName] [mood_label]`

Examples:
- `🥚 Pixel  Hatching...`
- `🐣 Pixel  Happy`
- `😰 Pixel  Hungry!`
- `💤 Pixel  Sleeping`
- `🤒 Pixel  Sick!`
- `💀 Pixel  Dead`

- Clicking opens/focuses the sidebar
- Updates every 30 seconds (on each tick)

---

## Communication Protocol

### TypeScript → Python (stdin)

Each message is a single-line JSON object followed by `\n`.

```jsonc
// Initialise with saved state (or null for new game)
{ "action": "init", "state": { ...pet_state }, "elapsed_seconds": 42 }

// New game setup
{ "action": "new_game", "name": "Pixel", "pet_type": "codeling", "color": "neon" }

// Player actions
{ "action": "feed",     "type": "meal" }
{ "action": "feed",     "type": "snack" }
{ "action": "play",     "game": "guess", "result": "win" }
{ "action": "sleep" }
{ "action": "wake" }
{ "action": "clean" }
{ "action": "medicine" }
{ "action": "scold" }
{ "action": "praise" }

// Automatic events
{ "action": "tick" }
{ "action": "code_activity" }
{ "action": "get_state" }
```

### Python → TypeScript (stdout)

Every command returns a full state snapshot:

```jsonc
{
  "hunger":      75,
  "happiness":   60,
  "discipline":  40,
  "energy":      80,
  "health":      100,
  "weight":      5,
  "age":         3,
  "stage":       "child",
  "character":   "codeling_child_a",
  "alive":       true,
  "sick":        false,
  "sleeping":    false,
  "poops":       1,
  "mood":        "happy",
  "name":        "Pixel",
  "pet_type":    "codeling",
  "color":       "neon",
  "sprite":      "child_happy",
  "care_score":  0.82,
  "events":      ["evolved", "poop_appeared"]   // optional event flags
}
```

### Error Response

```jsonc
{ "error": "invalid_action", "message": "Cannot feed while sleeping" }
```

---

## Persistence

- Full pet state is serialized to `context.globalState` on every action and
  every 60 seconds as a background interval.
- On activation, the saved state is loaded and passed to Python via `init`.
- **Offline decay**: elapsed time since last save is passed as `elapsed_seconds`.
  Python applies proportional stat decay, capped at 60% total loss so the pet
  is in rough shape but not instantly dead from a weekend away.

---

## Mini-games

Both games run entirely in the webview JS and report only `win`/`lose` to Python.

### 1. Left/Right Guess
- Pet hides behind one of two doors.
- Player clicks Left or Right.
- 50% win chance. Win: happiness +15. Lose: happiness +5 (consolation).

### 2. Pattern Memory (Simon)
- A sequence of 3-5 buttons lights up.
- Player repeats the sequence.
- Win: happiness +20, energy -15. Lose: happiness +5.

---

## Implementation Order

1. Scaffold extension (package.json, tsconfig, src/extension.ts skeleton)
2. Python `pet.py` + `config.py` + basic tick in `game_engine.py`
3. Python `actions.py` (feed, sleep, clean, medicine, scold, praise)
4. TypeScript `pythonBridge.ts` (spawn process, JSON read/write loop)
5. Sidebar webview (sidebar.html/css/js) with placeholder UI
6. Wire up actions: buttons in webview → bridge → Python → state update
7. Stat bars + sprite rendering in webview
8. Pet customization setup screen
9. Python `evolution.py` + stage transitions
10. Sickness triggers and death screen
11. Status bar (`statusBar.ts`)
12. Coding activity rewards (`events.ts`)
13. Mini-games (webview JS + `minigames.py` result handler)
14. Persistence (`persistence.ts`) + offline decay
15. Polish: CSS animations, edge cases, error handling

---

## Future Feature Ideas

- Gotchi Points currency earned from mini-games, spent in an in-game shop
- Multiple simultaneous pets
- "Discipline" mini-game (scolding game)
- Seasonal/holiday characters
- Leaderboard via VS Code settings sync (share your pet's age record)
- Marriage mechanic between two users' pets
- New pet types via extension pack contributions
- Sound effects (optional, respects VS Code mute settings)
