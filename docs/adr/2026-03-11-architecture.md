# ADR 2026-03-11 — vscode_gotchi Architecture

**Date:** 2026-03-11
**Status:** Accepted
**Supersedes:** DESIGN.md (initial planning document, now retired)

---

## Context

vscode_gotchi is a VS Code extension that lets a developer raise a virtual pet
inspired by the original [Tamagotchi](https://en.wikipedia.org/wiki/Tamagotchi)
while they write code. The pet lives in a sidebar panel, reacts to coding
activity (file saves), and must be cared for to survive and evolve.

Key constraints that shaped every decision below:

- VS Code extensions **must** use TypeScript/JavaScript as the extension host
  layer — this is a hard platform requirement.
- Game logic should be independently testable, separate from VS Code APIs.
- The Python runtime is Python **3.14** via a local `.venv`.
- All Python tooling runs through `.venv\Scripts\` (Windows) / `.venv/bin/`
  (macOS/Linux) — never a system-level Python.
- Build rule: at most **3 files per commit**, at most **500 lines per commit**.

---

## Decision 1 — Split: TypeScript extension host + Python game engine

### Decision

The extension is split into two distinct layers:

| Layer | Language | Responsibility |
|---|---|---|
| Extension host | TypeScript | VS Code API, webview bridge, event hooks, persistence |
| Game engine | Python 3.14 | Pet state machine, stat decay, evolution, mini-game logic |

The TypeScript layer spawns Python as a **child subprocess** and communicates
via **newline-delimited JSON over stdin/stdout**.

### Rationale

- TypeScript is mandatory for the VS Code extension host API.
- Python keeps all game logic pure and fully testable without VS Code installed.
- stdin/stdout JSON requires zero network stack, no port management, and works
  identically on Windows, macOS, and Linux.
- Separating concerns means the game engine can be unit-tested with plain
  `pytest` and the TypeScript layer can be integration-tested independently.

### Consequences

- Users need Python 3.14 installed. The extension detects the executable via a
  configurable `gotchi.pythonPath` setting, defaulting to `python` on Windows
  and `python3` elsewhere.
- The Python process is spawned once at extension activation and kept alive;
  all messages are serialised as single-line JSON terminated by `\n`.

---

## Decision 2 — Project structure

```
vscode_gotchi/
├── .github/
│   ├── agents.md                   # Agent build rules (this ADR's source)
│   ├── copilot-instructions.md     # Design pattern guidance
│   └── instructions/
│       └── python-instructions.md  # Python coding conventions
├── docs/
│   └── adr/
│       └── 2026-03-11-architecture.md   # This file
├── python/
│   ├── config.py        # All tunable constants (decay rates, thresholds)
│   ├── models.py        # Pet type definitions, evolution trees, palettes
│   ├── pet.py           # Pet dataclass: stats, tick, evolution, serialise
│   ├── actions.py       # Pure action functions: feed, play, sleep, etc.
│   ├── evolution.py     # Senior transition and old-age death helpers
│   ├── minigames.py     # Mini-game result → stat delta processing
│   └── game_engine.py   # Main loop: JSON stdin → dispatch → JSON stdout
├── src/
│   ├── extension.ts         # Activation entry point
│   ├── pythonBridge.ts      # Spawn Python, JSON read/write protocol
│   ├── sidebarProvider.ts   # WebviewViewProvider for the sidebar panel
│   ├── statusBar.ts         # Status bar item (mood emoji + pet name)
│   ├── persistence.ts       # Save/load via context.globalState
│   └── events.ts            # onDidSave → code_activity reward
├── media/
│   ├── icon.svg         # Activity bar icon
│   ├── sidebar.html     # Webview HTML shell
│   ├── sidebar.css      # Retro pixel-art styling, CSS animations
│   ├── sidebar.js       # Client-side JS: buttons, render, mini-games
│   └── sprites/         # PNG sprites named <stage>_<mood>.png
├── tests/
│   ├── unit_tests/
│   │   ├── test_pet.py       # Pet class: tick, decay, evolution, death
│   │   ├── test_actions.py   # Pure action functions
│   │   ├── test_evolution.py # Senior transition and old-age logic
│   │   └── test_minigames.py # Mini-game result processing
│   └── integration_tests/
│       └── test_game_engine.py  # Full JSON stdin/stdout round-trips
├── .venv/               # Python 3.14 venv (git-ignored)
├── .vscodeignore        # Files excluded from .vsix package
├── package.json         # Extension manifest
├── tsconfig.json        # TypeScript compiler config
├── requirements.txt     # Pinned dev tooling: ruff, mypy, pytest
└── BUILD_LOG.md         # Running build narrative and install guide
```

---

## Decision 3 — Python game engine design

### Core stats

All stats are integers in the range 0–100 unless noted.

| Stat | Description |
|---|---|
| `hunger` | Decays every tick; 0 for 3+ ticks risks death |
| `happiness` | Decays every tick; 0 drains health |
| `discipline` | Increases via scold/praise; affects care quality |
| `energy` | Depleted by play; restored while sleeping |
| `health` | Drops when sick; 0 = death |
| `weight` | Integer; increases with food, decreases with play |
| `age_days` | Increments once per real-world day after waking |

### Pet life cycle

```
Egg (2 min) → Baby (10 min) → Child (1 h) → Teen (3 h) → Adult → Senior
```

Each stage transition evaluates a **care quality score** (0.0–1.0) to
determine which character the pet evolves into:

```
care_score = (
    0.30 × avg_hunger   +
    0.25 × avg_happiness +
    0.20 × discipline    +
    0.15 × cleanliness   +
    0.10 × avg_health
)
```

- `≥ 0.80` → best-tier character
- `≥ 0.55` → mid-tier character
- `< 0.55`  → low-tier character

### Four pet types

| Type | Tendency |
|---|---|
| `codeling` | Balanced |
| `bytebug` | High energy; hunger decays faster |
| `pixelpup` | High happiness; happiness decays faster |
| `shellscript` | Slow evolver; high base health |

### Action summary

| Action | Key effect |
|---|---|
| `feed meal` | hunger +20, weight +1 (max 4/cycle) |
| `feed snack` | happiness +10, weight +2 (≥3 in a row → sick) |
| `play` | happiness +15, energy −10, weight −1 |
| `sleep` | energy regenerates per tick |
| `clean` | removes droppings (≥3 uncleaned → sick) |
| `medicine` | health +20; 3 doses to cure |
| `scold` | discipline +10 |
| `praise` | discipline +10 |
| `code_activity` | happiness +5, discipline +2 (throttled 30 s) |

### Communication protocol

Every message is a single-line JSON object terminated by `\n`.

**TypeScript → Python (commands)**

```jsonc
{ "action": "new_game", "name": "Pixel", "pet_type": "codeling", "color": "neon" }
{ "action": "init",     "state": { ...pet_state } | null, "elapsed_seconds": 120 }
{ "action": "tick" }
{ "action": "feed",     "feed_type": "meal" | "snack" }
{ "action": "play",     "game": "guess" | "memory", "result": "win" | "lose" }
{ "action": "sleep" }
{ "action": "wake" }
{ "action": "clean" }
{ "action": "medicine" }
{ "action": "scold" }
{ "action": "praise" }
{ "action": "code_activity" }
{ "action": "get_state" }
```

**Python → TypeScript (full state snapshot on every response)**

```jsonc
{
  "hunger": 75, "happiness": 60, "discipline": 40,
  "energy": 80, "health": 100, "weight": 5, "age_days": 3,
  "stage": "child", "character": "codeling_child_a",
  "alive": true, "sick": false, "sleeping": false, "poops": 1,
  "mood": "happy", "name": "Pixel", "pet_type": "codeling",
  "color": "neon", "sprite": "child_happy",
  "care_score": 0.82, "events": ["evolved_to_child"]
}
```

---

## Decision 4 — Python tooling and code standards

### Tooling

All commands run through the local `.venv`:

| Tool | Purpose | Command |
|---|---|---|
| `ruff format` | Auto-format (PEP 8) | `.venv\Scripts\ruff format python/ tests/` |
| `ruff check` | Lint | `.venv\Scripts\ruff check python/ tests/` |
| `mypy` | Static type checking | `.venv\Scripts\mypy python/ tests/` |
| `pytest` | Test runner | `.venv\Scripts\pytest tests/` |

### Code conventions (from `python-instructions.md`)

- All functions have **type hints** and **PEP 257 docstrings**.
- Use built-in generic types: `list[str]`, `dict[str, int]` — not `typing.List`.
- Max **79 characters** per line.
- **Descriptive variable names** — no abbreviations (e.g. `hunger_decay_per_tick`,
  not `h_decay`).
- **Pure functions** wherever possible; side effects isolated to `game_engine.py`.
- **Dependency injection** — pass config and state explicitly, never rely on
  global mutation inside action functions.

### Definition of done

A commit is only made after the following all pass:

1. `ruff format --check python/ tests/`
2. `ruff check python/ tests/`
3. `mypy python/ tests/`
4. `.venv\Scripts\pytest tests/unit_tests`
5. `.venv\Scripts\pytest tests/integration_tests`

---

## Decision 5 — TypeScript layer design

- **`pythonBridge.ts`** — spawns the Python subprocess once at activation;
  queues a single pending promise per message (request/response is serial).
- **`sidebarProvider.ts`** — implements `WebviewViewProvider`; translates
  webview button messages to bridge calls and posts state snapshots back.
- **`persistence.ts`** — serialises full `PetState` to `context.globalState`
  on every action and every 60 s; on load passes saved state + `elapsed_seconds`
  to Python so it can apply capped offline decay (max 60 % stat loss).
- **`statusBar.ts`** — right-aligned item showing stage emoji + name + mood;
  updates on every tick and every action.
- **`events.ts`** — `workspace.onDidSaveTextDocument` fires `code_activity`;
  throttled to once per 30 s with a streak-bonus tier.

---

## Decision 6 — Webview UI

- Pure HTML/CSS/JS — no front-end framework, keeping the bundle minimal.
- Retro pixel-art aesthetic using a dark palette with accent colours.
- Sprite images are named `<stage>_<mood>.png` and loaded by the webview JS
  from the `media/sprites/` directory via VS Code webview URIs.
- Content Security Policy enforces `nonce`-gated scripts and
  `webview.cspSource`-gated styles — no `unsafe-inline`.
- Two mini-games run entirely in the webview JS:
  - **Left/Right Guess** — 50 % win chance; win: happiness +15, lose: +5.
  - **Pattern Memory** — sequence repeat; win: happiness +20, lose: +5.

---

## Decision 7 — Testing strategy

### Unit tests (`tests/unit_tests/`)

- Test every Python module in isolation.
- No VS Code API, no subprocess — pure function input/output.
- Mirror source structure: `python/pet.py` → `tests/unit_tests/test_pet.py`.

### Integration tests (`tests/integration_tests/`)

- Spin up `game_engine.main()` in a thread with piped stdin/stdout.
- Send real JSON command sequences and assert full state snapshots.
- Cover: new game → feed → tick → evolution → death → new game flow.

---

## Alternatives considered

| Alternative | Why rejected |
|---|---|
| All TypeScript (no Python) | Game logic harder to unit-test without VS Code mock; loses clean separation |
| Python HTTP server (Flask/FastAPI) | Port management complexity, startup latency, firewall issues on corporate networks |
| SQLite state storage | Overkill for a single pet; `context.globalState` is sufficient and zero-dependency |
| React/Vue webview | Bundle overhead not justified; plain JS is adequate for this UI surface |

---

## Build order

| Commit | Files | Purpose |
|---|---|---|
| 1 | `package.json`, `tsconfig.json` | ✅ Extension scaffold |
| 2 | `requirements.txt` | ✅ Python dev tooling |
| 3 | `.vscodeignore`, `media/icon.svg` | Packaging config + activity bar icon |
| 4 | `python/config.py`, `python/models.py`, `python/pet.py` | Core game data and Pet class |
| 5 | `python/actions.py`, `python/evolution.py`, `python/game_engine.py` | Action handlers and main loop |
| 6 | `python/minigames.py`, `tests/unit_tests/test_pet.py`, `tests/unit_tests/test_actions.py` | Mini-game logic + first unit tests |
| 7 | `tests/unit_tests/test_evolution.py`, `tests/unit_tests/test_minigames.py`, `tests/integration_tests/test_game_engine.py` | Full test suite |
| 8 | `src/pythonBridge.ts`, `src/persistence.ts`, `src/statusBar.ts` | TypeScript bridge and VS Code integration |
| 9 | `src/events.ts`, `src/extension.ts`, `src/sidebarProvider.ts` | Extension wiring |
| 10 | `media/sidebar.html`, `media/sidebar.css`, `media/sidebar.js` | Webview UI |
| 11 | `BUILD_LOG.md` | Install guide and build narrative |
