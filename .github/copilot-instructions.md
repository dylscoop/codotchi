# Copilot Instructions

## Purpose

Intended audience: AI agents and developers. Provides context to allow agents to contribute more effectively. This is intended to supplement the [readme](../README.md), not replace it. Where the two conflict, this document takes precedence for agent behaviour.

## Project Overview

vscode_gotchi is a VS Code extension that lets developers raise a virtual pet
while they write code, inspired by the original Tamagotchi. It consists of:

- A **TypeScript extension host** — registers a sidebar webview, status bar
  item, commands, and event hooks via the VS Code extension API
- A **TypeScript game engine** (`src/gameEngine.ts`) — owns all pet state
  logic (stat decay, evolution, sickness, death) and is called directly by the
  extension host with no subprocess or IPC
- A **webview UI** (`media/`) — plain HTML/CSS/JS rendered in a VS Code
  sidebar panel; no front-end framework

The extension is **entirely self-contained** — it has no runtime dependencies
outside of VS Code itself and ships as a standard `.vsix` bundle.

## Architecture Decision

The authoritative design document is
[`docs/adr/2026-03-11-architecture.md`](../docs/adr/2026-03-11-architecture.md).
See amendment A1 for the decision to remove the Python subprocess and move to
an all-TypeScript architecture.

## Validation Workflow

For tooling, validation workflow, and definition of done, see [agents.md](./agents.md).

## Testing

Tests are written in TypeScript and co-located under `tests/`. The framework
is TBD pending the game engine port; `npm test` is the single entry point.

Unit tests cover individual functions in `src/gameEngine.ts` in isolation with
no VS Code API and no filesystem I/O. Integration tests exercise the full
activation and action-dispatch flow.

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
