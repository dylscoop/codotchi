# Copilot Instructions

## Purpose

Intended audience: AI agents and developers. Provides context to allow agents to contribute more effectively. This is intended to supplement the [readme](../README.md), not replace it. Where the two conflict, this document takes precedence for agent behaviour.

## Project Overview

vscode_gotchi is a VS Code extension that lets developers raise a virtual pet
while they write code, inspired by the original Tamagotchi. It consists of:

- A **TypeScript extension host** — registers a sidebar webview, status bar
  item, commands, and event hooks via the VS Code extension API
- A **Python 3.14 game engine** (`python/`) — a subprocess that owns all pet
  state logic (stat decay, evolution, sickness, death) and communicates with
  the TypeScript layer via newline-delimited JSON over stdin/stdout
- A **webview UI** (`media/`) — plain HTML/CSS/JS rendered in a VS Code
  sidebar panel; no front-end framework

The Python game engine has **no runtime dependencies** — it uses the standard
library only. Dev tooling (ruff, mypy, pytest) is installed into a local
`.venv` using Python 3.14.

## Validation Workflow

For tooling, validation workflow, and definition of done, see [Copilot Agent Instructions](./agents.md).

## Testing

### Unit Tests

Location: `tests/unit_tests`

Unit tests cover individual Python functions and classes in isolation with no
VS Code API, no subprocess, and no filesystem I/O:

- `test_pet.py` — Pet class: tick decay, evolution transitions, death conditions, serialisation
- `test_actions.py` — Pure action functions: feed, play, sleep, clean, medicine, scold, praise
- `test_evolution.py` — Senior transition probability and old-age death logic
- `test_minigames.py` — Mini-game result processing (win/lose → stat deltas)

### Integration Tests

Location: `tests/integration_tests`

Integration tests exercise the full `game_engine.py` loop end-to-end by
writing JSON commands to stdin and reading state snapshots from stdout via
a subprocess. They cover complete game flows: new game → care actions →
tick-driven stat decay → evolution → sickness → death → new game.

## Design Patterns: Encourage and Discourage

### Patterns to Encourage

- Pure Functions: Favour pure, stateless functions for core logic. This improves testability, predictability, and ease of refactoring.
- Separation of Concerns: Keep data loading, business logic, and output generation in separate modules/functions.
- Configuration-Driven Design: Use configuration and schemas to control behaviour rather than hardcoding logic.
- Dependency Injection: Pass dependencies (e.g. data sources, config) explicitly to functions/classes to improve modularity and testability.
- Clear Interfaces: Define and document clear interfaces for modules and functions, especially those expected to be extended.
- Fail Fast: Validate inputs early and fail with clear, actionable error messages.

### Patterns to Discourage

- Tight Coupling: Avoid code that tightly couples modules or relies on global state, as this makes testing and extension difficult.
- Hidden Side Effects: Avoid functions that modify global state or have side effects not obvious from their signature.
- Hardcoding: Do not hardcode business rules, file paths, or logic — use configuration and schemas instead.
- Over-Mocking in Tests: Avoid excessive mocking in unit tests; prefer refactoring code to make it more testable.
- Monolithic Functions: Break up large, monolithic functions into smaller, focused units.
