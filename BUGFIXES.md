# Bug Tracker

All known bugs and their resolution status for the vscode_gotchi project.

---

## BUGFIX-001 — Font size setting does not hot-reload

**Status:** Fixed (commit `db47873`)
**File:** `vscode/src/sidebarProvider.ts`

**Problem:** `buildHtml()` is called once at webview creation. Changing
`gotchi.fontSize` while the webview is open has no effect until the panel is
fully destroyed and re-created.

**Fix:** Added a `vscode.workspace.onDidChangeConfiguration` listener inside
`resolveWebviewView`. When `gotchi.fontSize` changes the listener reassigns
`webviewView.webview.html` from a fresh `buildHtml()` call, which instantly
applies the new body class (`font-small` / `font-normal` / `font-large`).

---

## BUGFIX-002 — Care actions work while pet is sleeping

**Status:** Fixed (commit `ef4d710`)
**Files:** `vscode/src/sidebarProvider.ts`, `vscode/media/sidebar.js`,
`vscode/media/sidebar.css`

**Problem:** Clicking Feed, Play, Clean, Medicine, Scold, or Praise while the
pet is sleeping dispatched the command to the game engine, producing stat
changes at a time when the pet should be unreachable.

**Fix (host):** Added a guard in `handleWebviewMessage` that returns early for
the six blocked commands whenever `state.sleeping === true`.

**Fix (webview):** `renderState()` now sets `btn.disabled = state.sleeping` on
all six action buttons after each state update.

**Fix (CSS):** Added `.action-btn:disabled { opacity: 0.35; cursor: not-allowed; }`
so disabled buttons are visually dimmed.

---

## BUGFIX-003 — Pet never auto-wakes when energy is full

**Status:** Fixed (commit `f8d55e6`)
**File:** `vscode/src/gameEngine.ts`

**Problem:** The `tick()` function regenerated energy while the pet slept but
never checked whether energy had reached 100. The pet would remain sleeping
indefinitely unless the user manually clicked "Wake".

**Fix:** After the energy-regen branch in `tick()`, if `sleeping && energy >=
STAT_MAX` the pet is automatically woken: `sleeping` is set to `false`,
`ageDays` is incremented by 1, and the event `"auto_woke_up"` is pushed.

---

## BUGFIX-004 — Health has no recovery path when pet is not sick

**Status:** Fixed (commit `b4f02a0`)
**File:** `vscode/src/gameEngine.ts`

**Problem:** Health could be drained by three sources (starvation, happiness
critical, sickness) but the only recovery source was `giveMedicine()`, which
requires `sick === true`. A pet whose health was low but was not sick had no
way to recover.

**Fix:** Added a passive health regeneration of **+1 HP per tick** when the
pet is not sick and health is below the maximum. This is applied after all
damage sources but before the death check, so damage still wins when multiple
conditions fire in the same tick.

---

## BUGFIX-005 — Status bar click does not focus the sidebar panel

**Status:** Fixed (branch `bugfix/small_fixes`)
**File:** `vscode/src/extension.ts`

**Problem:** The status bar item was wired to
`workbench.view.extension.gotchi-sidebar`, which opens the side-bar
container but does not focus the gotchi webview panel inside it.

**Fix:** Changed the command to `gotchiView.focus`, which directly focuses
the registered `WebviewView`.

---

## BUGFIX-006 — TypeScript picks up `@types/katex` from root `node_modules`

**Status:** Fixed (branch `bugfix/small_fixes`)
**File:** `vscode/tsconfig.json`

**Problem:** After adding a root-level `package.json` (for markdownlint-cli2),
TypeScript's type resolution walked up to the repo root `node_modules` and
found `@types/katex` (a transitive dependency of markdownlint-cli2), causing
compile errors in `vscode/src/`.

**Fix:** Added `"typeRoots": ["./node_modules/@types"]` to `vscode/tsconfig.json`
to pin type resolution to `vscode/node_modules` only.

---

## BUGFIX-007 — Starvation sickness cannot be cured with medicine

**Status:** Fixed (branch `bugfix/small_fixes`)
**File:** `vscode/src/gameEngine.ts`

**Problem:** When `hungerZeroTicks >= HUNGER_ZERO_TICKS_BEFORE_RISK`, the
`tick()` function dealt direct health damage but never set `sick = true`. As a
result `giveMedicine()` returned `medicine_not_needed` for a starving pet, leaving
no way to stop the health drain short of feeding the pet back above 0.

**Fix:** In the starvation damage block, if the pet is not already sick, set
`sick = true` and push `"became_sick"`. This unifies starvation-induced illness
under the same `sick` flag used by all other sickness sources, so medicine works
identically.

---

## BUGFIX-008 — Snacks have no per-cycle limit

**Status:** Fixed (branch `bugfix/small_fixes`)
**Files:** `vscode/src/gameEngine.ts`, `pycharm/src/main/kotlin/com/gotchi/engine/GameEngine.kt`,
`pycharm/src/main/kotlin/com/gotchi/engine/Constants.kt`

**Problem:** Meals were capped at `MEALS_MAX_PER_CYCLE = 3` per wake cycle, but
snacks had no equivalent cap. A player could feed unlimited snacks per cycle,
bypassing the intended pacing of the hunger/happiness economy.

**Fix:** Added `SNACK_MAX_PER_CYCLE = 2` constant and `snacksGivenThisCycle`
counter to `PetState`. `feedSnack()` returns `"snack_refused"` when the cap is
reached. The counter resets to `0` in `wake()` and `createPet()`, mirroring the
existing meal-cycle pattern.

---

## BUGFIX-010 — Play allowed when energy is insufficient

**Status:** Fixed (branch `bugfix/small_fixes`)
**Files:** `vscode/src/gameEngine.ts`, `vscode/media/sidebar.js`,
`pycharm/src/main/kotlin/com/gotchi/engine/GameEngine.kt`,
`pycharm/src/main/resources/webview/sidebar.js`

**Problem:** The `play()` guard checked `energy <= 0`, so a pet with 1–24
energy could still start a play session. With `PLAY_ENERGY_COST = 25` this
would clamp energy to 0 rather than being refused, and the Play button was
never visually disabled in the sidebar.

**Fix (engine):** Changed the guard condition from `energy <= 0` to
`energy < PLAY_ENERGY_COST` in both VS Code (`gameEngine.ts`) and PyCharm
(`GameEngine.kt`), so `play()` returns `"too_tired"` whenever energy would
be insufficient to cover the full cost.

**Fix (webview):** `renderState()` now disables the Play button when
`state.energy < PLAY_ENERGY_COST` (hardcoded `25`, matching the engine
constant), applied after the sleeping-disable block so both checks stack
correctly. Mirrored in both VS Code and PyCharm webviews.

---

## BUGFIX-009 — Death screen shows no useful post-mortem information

**Status:** Fixed (branch `bugfix/small_fixes`)
**Files:** `vscode/media/sidebar.html`, `vscode/media/sidebar.js`, `vscode/media/sidebar.css`,
`vscode/src/gameEngine.ts`, `pycharm/src/main/resources/webview/sidebar.html`,
`pycharm/src/main/resources/webview/sidebar.js`, `pycharm/src/main/resources/webview/sidebar.css`,
`pycharm/src/main/kotlin/com/gotchi/engine/PetState.kt`,
`pycharm/src/main/kotlin/com/gotchi/engine/GameEngine.kt`,
`pycharm/src/main/kotlin/com/gotchi/GotchiPersistence.kt`

**Problem:** The death screen only displayed the pet's name, stage, and age in
days. There was no indication of how long the pet lived in real-world time, and
no record of what events led up to its death.

**Fix:**
- Added `spawnedAt` (Unix ms) to `PetState`, set on `createPet()`, persisted and
  back-compat-fallback in deserialise/sanitise.
- Added `recentEventLog` (rolling last-20 events) to `PetState`, appended in
  `withDerivedFields()` from every state-producing function.
- The death screen now renders: real-life elapsed time since spawn (days / hours /
  minutes, computed from `Date.now() - state.spawnedAt`) and the last 20 events
  in most-recent-first order.
