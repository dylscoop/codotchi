---
name: integration-testing
description: Whenever a new feature is added, always write integration tests covering it before committing.
license: MIT
compatibility: opencode
---

## Rule

Any time a new feature is added or an existing feature is materially changed,
write integration tests for it in `vscode/tests/unit/gameEngine.test.ts`
**before** committing. Tests must pass (`npm test` from `vscode/`) with 0
failures before any commit that introduces or changes a feature.

---

## Where tests live

All engine tests live in a single file:

```
vscode/tests/unit/gameEngine.test.ts
```

Uses Node's built-in test runner (`node:test` + `node:assert/strict`). No
extra packages required.

---

## Test structure

Every describe block follows this pattern:

```ts
describe("<feature name>", () => {
  it("<what it should do>", () => {
    // arrange
    const pet = makePet({ /* relevant overrides */ });
    // act
    const next = <functionUnderTest>(pet, ...);
    // assert
    assert.equal(next.<stat>, <expected>);
  });
});
```

Use the `makePet(overrides?)` helper (already defined at the top of the file)
to create a base codeling pet with controlled stat values.

---

## What "integration test" means here

An integration test exercises **two or more engine functions in sequence**,
verifying that the combined effect on `PetState` is correct. Contrast with a
unit test that calls a single function in isolation.

Good integration test scenarios:
- `play()` → `applyMinigameResult()` — verify energy cost from play and
  happiness delta from the game result compound correctly.
- `tick()` → `feedMeal()` → `tick()` — verify decay then refill.
- `startSnack()` → `consumeSnack()` × 3 → `giveMedicine()` × 3 — full
  snack-sick-cure cycle.
- `play()` refused when energy is below threshold — verify the gate that
  prevents the minigame overlay from opening.

Place new integration tests in the bottom section of the file:

```
// ---------------------------------------------------------------------------
// Integration: <feature area>
// ---------------------------------------------------------------------------
describe("integration — <feature area>", () => { ... });
```

---

## Minimum test coverage for new features

For every new game engine function or action, write **at minimum**:

| Scenario | What to assert |
|----------|----------------|
| Happy path (normal input) | Correct stat delta(s) on the returned state |
| Boundary / clamp | Stat does not exceed 0 or 100 |
| Refusal / no-op guard | Refused action emits the right event; stat unchanged |
| Integration with `play()` | Combined energy cost + happiness delta from game win and lose |

For **minigames** specifically, also write:
- A test that the **win** delta is within the documented range (e.g. `>= 15 && <= 25`).
- A test that the **lose** delta is the correct consolation value (never negative).
- An integration test: `play()` → `applyMinigameResult(state, "<game>", "win")`.
- An integration test: `play()` → `applyMinigameResult(state, "<game>", "lose")`.
- A clamping test: happiness does not exceed 100 after win.
- A guard test: happiness never decreases on a lose (consolation is always positive).

---

## Running the tests

```
cd vscode
npm test
```

Expected output: all suites pass, 0 failures. Fix any failures before
committing — do not commit a broken test suite.

---

## Checklist before every feature commit

1. [ ] New `describe` block (or extended existing block) covers the new feature.
2. [ ] Integration test(s) cover at least one multi-step sequence.
3. [ ] `npm test` passes with 0 failures.
4. [ ] Test file changes are staged alongside the source code changes.
