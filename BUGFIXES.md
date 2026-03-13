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

## BUGFIX-011 — Hatching from the menu does nothing when a live pet exists

**Status:** Fixed (branch `bugfix/hatch-and-continue`)
**Files:** `vscode/media/sidebar.js`, `pycharm/src/main/resources/webview/sidebar.js`

**Problem:** When the user clicks "Hatch!" while already on the setup screen
and a live pet exists, the extension responds with a fresh `state` (alive = true).
The UI-refresh suppression guard introduced in v0.1.2 fires:

```js
if (currentScreen === "setup" && state.alive) { ...; return; }
```

Because `currentScreen === "setup"` and the new pet is `alive`, the handler
returns early — `renderState` is never called, the screen never switches to
"game", and the hatch appears to do nothing.

**Fix:** Added a `pendingNewGame` flag (`let pendingNewGame = false`). Set to
`true` in `startBtn`'s click handler before posting the message. The suppression
guard now checks `!pendingNewGame`, allowing `renderState` through when Hatch!
was clicked. The flag is cleared immediately after `renderState` is called.

---

## BUGFIX-012 — Continue button appears and bounces user back to dead screen after pet dies

**Status:** Fixed (branch `bugfix/hatch-and-continue`)
**Files:** `vscode/media/sidebar.js`, `pycharm/src/main/resources/webview/sidebar.js`

**Problem:** After a pet dies:
1. `renderState` calls `showScreen("dead")`.
2. User clicks "New Game" → `showScreen("setup")`.
3. `hasActiveGame` is still `true` (set when the pet was alive) → Continue
   button is visible on the setup screen.
4. User clicks Continue → `showScreen("game")`.
5. Next tick arrives with `state.alive === false` → suppression doesn't apply →
   `renderState` is called → `showScreen("dead")` → user is bounced back to the
   dead screen.

**Fix:** In the message handler, when `state.alive === false` set
`hasActiveGame = false`. This hides the Continue button on the setup screen
after death so it only appears when a live game exists to return to.

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

---

## BUGFIX-014 — Energy decay not throttled during idle

**Status:** Fixed (branch `fix/idle-energy-and-exhaustion`)
**Files:** `vscode/src/gameEngine.ts`, `pycharm/src/main/kotlin/com/gotchi/engine/GameEngine.kt`

**Problem:** When the pet was idle, hunger and happiness decay were correctly
throttled to 1-in-10 ticks via `decayThisTick`. However, `energy` was
decremented outside the `decayThisTick` guard, so energy drained at the full
rate of 1/tick even when the IDE had been idle for hours.

**Fix:** Moved `energy = clampStat(energy - ENERGY_DECAY_PER_TICK)` inside the
`if (decayThisTick)` block in both engines. Energy now decays at exactly the
same throttled rate as hunger and happiness during idle.

---

## BUGFIX-013 — PyCharm webview bounces back to game screen when user navigates to setup

**Status:** Fixed (branch `bugfix/hatch-and-continue`)
**Files:** `pycharm/src/main/kotlin/com/gotchi/GotchiBrowserPanel.kt`,
`pycharm/src/main/kotlin/com/gotchi/GotchiToolWindow.kt`

**Problem:** PyCharm uses JCEF (Java Chromium Embedded Framework) to host the
webview. `GotchiPlugin.setBrowserPanel()` calls `broadcastState()` via
`invokeLater`, which schedules state delivery on the EDT. However, JCEF loads
pages asynchronously; the `invokeLater` callback often fires **before**
`onLoadEnd` — before the JS bridge (`window.__vscodeSendMessage`) is injected
and before the page's `message` event listeners are active. The initial state
push is silently dropped by CEF. The page sits at `showScreen("game")` (the
last line of `sidebar.js`) with no state until the next 6-second tick fires.

Additionally, if IntelliJ triggers a spontaneous JCEF page reload (e.g. on
theme change or tool-window resize), the same race re-occurs: the page resets
to `showScreen("game")` and the next tick bounces the user back to the game
screen — even if they had manually navigated to setup.

**Fix:** Added an `onReady: () -> Unit = {}` callback parameter to
`GotchiBrowserPanel`. The callback is invoked from `onLoadEnd` **after** the
JS bridge script is injected into the page, guaranteeing that the page is
ready to receive messages. `GotchiToolWindow` passes
`onReady = { plugin.broadcastState() }` so that a full state snapshot is
pushed to the webview after every page load (initial load and any spontaneous
reloads), eliminating the race condition.

---

## BUGFIX-015 — Sidebar interaction does not reset the idle timer

**Status:** Fixed (branch `fix/idle-activity-detection`)
**Files:** `vscode/src/extension.ts`, `vscode/src/sidebarProvider.ts`,
`vscode/media/sidebar.js`, `pycharm/src/main/kotlin/com/gotchi/GotchiPlugin.kt`,
`pycharm/src/main/resources/webview/sidebar.js`

**Problem:** Clicking action buttons (Feed, Play, Sleep, etc.) in the sidebar
or moving the mouse over the sidebar panel did not reset the idle timer. The
idle detection only listened to editor-level VS Code events
(`onDidChangeTextEditorSelection`, `onDidChangeTextDocument`,
`onDidChangeWindowState`, `onDidChangeActiveTextEditor`) and, in PyCharm, to
AWT events on the main IDE window — neither of which fires when the user
interacts exclusively with the webview panel. A developer who spent time caring
for the pet without touching the editor would be counted as idle, causing stat
decay to slow incorrectly.

**Fix — button clicks (both IDEs):**
- **VS Code**: `markActivity` is now defined before `SidebarProvider` is
  instantiated and passed in as a new constructor parameter. At the top of
  `handleWebviewMessage`, `this.markActivity()` is called for every incoming
  message so any button click immediately resets the idle timer.
- **PyCharm**: `lastActivityTime = System.currentTimeMillis()` is now called at
  the very start of `handleCommand`, before the command is dispatched, so any
  button click resets the idle timer.

**Fix — mouse movement (both IDEs):**
- Both `sidebar.js` files now add a throttled `mousemove` listener on
  `document`. The listener fires at most once per 30 seconds and posts
  `{ command: "user_activity" }` to the host.
- **VS Code** `sidebarProvider.ts`: a new `"user_activity"` case in
  `handleWebviewMessage` returns immediately after `markActivity()` is called —
  no state change is made.
- **PyCharm** `GotchiPlugin.kt`: a new `"user_activity"` case in
  `handleCommand` returns immediately — `lastActivityTime` was already updated
  at the top of the function.

## BUGFIX-016 — Sick + sleeping shows only "Zzz…", hides sickness

**Status:** Fixed (branch `feat/weight-system-v0.3.0`)
**Files:** `vscode/media/sidebar.js`, `pycharm/src/main/resources/webview/sidebar.js`

**Problem:** `moodText()` checked `sleeping` first and returned early, so a pet
that was both asleep and sick displayed only "Zzz…" — the sickness status was
silently hidden from the player.

**Fix:** Added a combined check before the two individual checks. When both
`state.sleeping` and `state.sick` are true, `moodText()` now returns
`"Zzz… (feeling sick)"` so the player can see both states simultaneously.

## BUGFIX-017 — `low_energy` expiry penalty was a no-op

**Status:** Fixed (branch `feat/attention-calls`)
**Files:** `vscode/src/gameEngine.ts`, `pycharm/src/main/kotlin/com/gotchi/engine/GameEngine.kt`

**Problem:** When a `low_energy` attention call expired unanswered, the penalty
applied `energy −10`. But `low_energy` only fires when `energy < 20`, meaning
energy was already near zero and the penalty had no practical effect — it
silently clamped to 0 or went unnoticed.

**Fix:** Changed the `low_energy` expiry penalty to `happiness −10` instead,
so ignoring the call has a visible and meaningful consequence for the player.

## BUGFIX-018 — `critical_health` expiry only penalised health

**Status:** Fixed (branch `feat/attention-calls`)
**Files:** `vscode/src/gameEngine.ts`, `pycharm/src/main/kotlin/com/gotchi/engine/GameEngine.kt`

**Problem:** When a `critical_health` attention call expired unanswered, only
`health −10` was applied. Since `critical_health` fires when health is already
below 50, the penalty was partially self-defeating (penalising the very stat
that triggered the call) and carried no additional consequence to other stats.

**Fix:** Added `happiness −10` alongside the existing `health −10` penalty on
expiry, so ignoring the call degrades both health and happiness.
