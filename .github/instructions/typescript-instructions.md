---
description: "TypeScript coding conventions and guidelines"
applyTo: "**/*.ts"
---

# TypeScript Coding Conventions

## TypeScript Instructions

- Write clear and concise JSDoc comments for every exported function, class,
  and interface.
- All functions must have explicit parameter types and return types — avoid
  implicit `any`.
- Prefer `interface` for object shapes that may be extended; use `type` for
  unions and aliases.
- Use built-in generic syntax: `Array<T>` or `T[]`, `Record<K, V>`,
  `Map<K, V>` — do not import equivalents from third-party utility libraries.
- Break down complex functions into smaller, focused functions with a single
  responsibility.

## General Instructions

- Always prioritise readability and clarity over brevity.
- For algorithm-related code, include a comment explaining the approach.
- Handle edge cases explicitly and throw errors with clear, actionable messages.
- Prefer `const` over `let`; never use `var`.
- Use `async`/`await` rather than raw `.then()`/`.catch()` chains.

## Code Style and Formatting

- Follow the project's `tsconfig.json` settings (`strict: true` implied).
- Use 2-space indentation.
- Lines must not exceed 100 characters.
- Place JSDoc comments immediately before the `function`, `class`, or
  `interface` keyword they document.
- Use blank lines to separate logical sections within a function.
- Use descriptive variable names — no abbreviations (e.g.
  `hungerDecayPerTick` not `hDecay`).
- When naming variables that hold domain quantities, include the unit where it
  aids clarity (e.g. `elapsedSeconds` not `elapsed`).

## Pure Functions and Side Effects

- Prefer pure functions for all game-logic code in `src/gameEngine.ts`.
- Side effects (VS Code API calls, `context.globalState`, timers) belong
  only in `src/extension.ts`, `src/sidebarProvider.ts`,
  `src/persistence.ts`, and `src/events.ts`.
- Pass configuration and state explicitly — never rely on module-level
  mutable globals inside game-logic functions.

## Testing

- Test file structure mirrors source: `src/gameEngine.ts` →
  `tests/unit/gameEngine.test.ts`.
- Unit tests must not import VS Code API modules — game-logic functions
  are pure and can be tested with a plain Node runner.
- Include a JSDoc comment on each `it`/`test` block explaining what is
  being asserted and why.

## Example of Proper Documentation

```typescript
/**
 * Advance the pet's state by one tick.
 *
 * Applies hunger and happiness decay, increments age when a full day has
 * elapsed, and checks death conditions. Returns a new {@link PetState}
 * without mutating the input.
 *
 * @param state  - Current pet state snapshot.
 * @param config - Tunable game constants.
 * @returns Updated pet state after one tick.
 */
export function tickPet(state: PetState, config: GameConfig): PetState {
  // implementation
}
```
