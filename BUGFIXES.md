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

## BUGFIX-019 — Skinny pet has no visual width change

**Status:** Fixed (branch `main`)
**Files:** `vscode/media/sidebar.js`, `pycharm/src/main/resources/webview/sidebar.js`

**Problem:** `weightWidthMultiplier()` returned `1.0` for all weights ≤ 80,
including the "too skinny" state (weight < 17). A skinny pet was visually
indistinguishable from a normal-weight pet despite the weight system tracking
the condition and firing `weight_became_too_skinny` events.

**Fix:** Added a `weight < 17` branch that returns `0.75`, making skinny pets
rendered at 75% of their normal body width. The threshold mirrors
`WEIGHT_HAPPINESS_LOW_THRESHOLD = 17` from the game engine — the same value
that triggers the skinny event — applied symmetrically to the fat side's
existing threshold structure.

## BUGFIX-020 — Poop accumulates while the pet is idle or the IDE is closed

**Status:** Fixed (branch `main`)
**Files:** `vscode/src/gameEngine.ts`, `pycharm/src/main/kotlin/com/gotchi/engine/GameEngine.kt`

**Problem:** Poop accumulation in `tick()` was guarded only by `!sleeping`, so
the poop counter kept incrementing during regular idle and deep idle, and the
sick-from-poop trigger could fire during those states. Additionally,
`applyOfflineDecay()` in the VS Code engine contained a while-loop that
accumulated poops proportional to elapsed closed time, so reopening the IDE
after a long absence could immediately load the pet with poops and sickness.

**Fix:** Added `&& !isIdle` to both the poop-accumulation guard and the
sick-from-poop trigger in `tick()`. Removed the poop while-loop entirely from
`applyOfflineDecay()` (the PyCharm version had no such loop and required no
change).

## BUGFIX-021 — Snack stat effects applied immediately on button click instead of when the pet eats

**Status:** Fixed (branch `main`)
**Files:** `vscode/src/gameEngine.ts`, `vscode/src/sidebarProvider.ts`, `vscode/media/sidebar.js`,
`pycharm/src/main/kotlin/com/gotchi/engine/GameEngine.kt`, `pycharm/src/main/kotlin/com/gotchi/GotchiPlugin.kt`,
`pycharm/src/main/resources/webview/sidebar.js`

**Problem:** `feedSnack()` applied all stat effects (hunger, happiness, weight
boosts and consecutive-snack sickness) as soon as the player clicked the Snack
button, even though the snack floor item hadn't been eaten yet. This made the
animation purely cosmetic rather than mechanically meaningful.

**Fix:** Split `feedSnack` into two functions: `startSnack` (called on button
click — validates the cap, increments counters, emits `snack_placed` to spawn
the floor item) and `consumeSnack` (called when the webview detects the pet
physically reaching the snack — applies hunger/happiness/weight boosts, checks
for consecutive-snack sickness, emits `fed_snack`). The webview sends a new
`snack_consumed` command to the host on collision, which routes to `consumeSnack`.
`snack_placed` is treated as a silent event and suppressed from the event log.

---

## BUGFIX-022 — Gift box clears but praise doesn't trigger gift acceptance in PyCharm

**Status:** Fixed (branch `main`)
**Files:** `pycharm/src/main/kotlin/com/gotchi/engine/GameEngine.kt`,
`pycharm/src/main/kotlin/com/gotchi/GotchiPlugin.kt`

**Problem:** Two separate bugs prevented the gift attention call from being properly accepted via the Praise button in PyCharm.

**Root cause #1 — Kotlin Elvis operator clears nothing:**
Every action function that called `answerAttentionCall` used the pattern:
```kotlin
activeAttentionCall = answered?.activeAttentionCall ?: state.activeAttentionCall
```
When `answered` is non-null but `answered.activeAttentionCall` is `null` (the clear-call intent), the Elvis `?:` falls through to `state.activeAttentionCall` (still `"gift"`), so the field is never cleared. Affected all 9 call sites across `tick`, `startSnack`, `play`, `sleep`, `clean`, `giveMedicine` (×2), `scold`, and `praise`.

**Root cause #2 — Race condition between tick thread and command handler:**
`GotchiPlugin` uses an `AppExecutorUtil` scheduled thread for `onTick` and a separate JCEF JS-query handler thread for `handleCommand`. Both read `currentState`, compute a new state, and write back without synchronization. If `onTick` fires between `handleCommand`'s read and write — expiring the gift call mid-flight — `praise(state)` receives a snapshot still showing `activeAttentionCall = "gift"`, but then overwrites `currentState` with a result derived from that stale snapshot, losing the tick's changes and making the acceptance appear to work, but only if the race doesn't go the other way (tick fires first, expires the call, `praise` then sees `null` and produces no `attention_call_answered_gift` event or happiness boost).

**Fix #1:** Replaced all 9 Elvis-operator occurrences with explicit null-checks:
```kotlin
activeAttentionCall = if (answered != null) answered.activeAttentionCall else state.activeAttentionCall
```

**Fix #2:** Added a `ReentrantLock` (`stateLock`) to `GotchiPlugin`. The lock guards all reads and writes of `currentState`, `currentHighScore`, and `mealsGivenThisCycle`. `onTick`, `handleCommand`, and `triggerCodeActivity` each acquire the lock while reading and updating state; `broadcastState` takes a consistent snapshot under the lock at entry before performing persistence and UI work outside it.

**VS Code is not affected** — the Node.js event loop is single-threaded so `setInterval` and the webview message handler never interleave. The TypeScript spread pattern (`...(answered ?? {})`) also handles the null-clear correctly.

---

## BUGFIX-023 — Sickness triggered on first snack eaten after rapid 3-click

**Status:** Fixed (branch `fix/snack-sick-on-consume`)
**File:** `vscode/src/gameEngine.ts`, `pycharm/src/main/kotlin/com/gotchi/engine/GameEngine.kt`

**Problem:** `consecutiveSnacks` was incremented inside `startSnack` (button-press phase). If the user clicked the snack button 3 times quickly before the pet walked to and ate any of them, `consecutiveSnacks` reached 3 at click time. When `consumeSnack` was called for the very first snack eaten, the sickness check (`consecutiveSnacks >= 3`) fired immediately — sickness triggered on the 1st snack consumed, not the 3rd.

**Fix:** Moved the `consecutiveSnacks` increment from `startSnack` into `consumeSnack`. The counter now advances only when the pet physically eats a snack, so sickness correctly fires after the 3rd snack is consumed regardless of how quickly the button is clicked.

---

## BUGFIX-024 — Rapid hop stacking on floor bounce

**Status:** Fixed (branch `feat/pet-movement`)
**File:** `vscode/media/sidebar.js`, `pycharm/src/main/resources/webview/sidebar.js`

**Problem:** When the pet bounced off the floor, `onFloor` was set to `true` for one or more frames while `petVy` was still negative (the pet was still moving upward from a previous bounce). The hop-trigger guard `if (onFloor && speed > 0)` fired on those upward-bounce frames, overwriting the small residual upward velocity with the full `HOP_IMPULSE = -60 px/s`. Successive hops accumulated before the pet came to rest, causing rapid visual "hop stacking" — the pet appeared to launch upward multiple times in quick succession.

**Fix:** Added a `petVy >= 0` condition to the hop guard so hops only fire when the pet is genuinely at rest (`petVy = 0`) or falling (`petVy > 0`). Also removed the `lastState.mood === "happy"` restriction that previously limited hops to the happy mood — all moods can now hop, consistent with idle wandering behaviour.

---

## BUGFIX-025 — Sleeping pet drifts to canvas centre on sidebar hide/show

**Status:** Fixed (branch `feat/pet-movement`)
**File:** `vscode/media/sidebar.js`, `pycharm/src/main/resources/webview/sidebar.js`

**Problem:** VS Code destroys and recreates the `WebviewView` each time the sidebar panel is hidden and reshown (`resolveWebviewView` in `sidebarProvider.ts` reassigns `webviewView.webview.html`, resetting all JavaScript state). On the first load after recreation, `lastState === null`, so the first-load reset block in `sidebar.js` always placed the pet at `petX = centreX`. A sleeping pet would always reappear at the horizontal centre of the canvas after toggling the sidebar, regardless of where it had fallen asleep.

**Fix:** The `fell_asleep` event handler now saves `petX` to `localStorage` under the key `gotchi_sleep_x`. The first-load reset block checks whether the restored state has `sleeping === true`; if so, it reads `gotchi_sleep_x` from `localStorage` and uses that value for `petX` instead of `centreX`. The sleeping movement block also now explicitly sets `petVx = 0`, `petVy = 0`, and `petY = floorY` on every frame so the pet cannot drift after being placed.

---

## BUGFIX-026 — Vertical falling speed is unrealistically slow (gravity too light)

**Status:** Fixed (branch `fix/gravity-fall-speed`)
**File:** `vscode/media/sidebar.js`, `pycharm/src/main/resources/webview/sidebar.js`

**Problem:** `GRAVITY` was set to `60 px/s²`, which causes the pet to take approximately 1.79 seconds to fall the full 96 px canvas height. This is far lighter than real-world gravity feels at this canvas scale, making the pet appear to float when it hops or bounces.

**Fix:** Raised `GRAVITY` from `60` to `500 px/s²`. This makes the pet fall the full canvas height in ~0.62 seconds, matching a natural, snappy gravity feel. `HOP_IMPULSE` was scaled proportionally from `−60` to `−175 px/s` so the hop still reaches the same ~30 px peak height (`v₀² / 2g ≈ 30 px`) — the hop is visually unchanged but completes in 0.35 s instead of 1.0 s.

---

## BUGFIX-027 — Minigame overlay covers the pet name, mood label, and stat bars

**Status:** Fixed (branch `fix/minigame-ui-v0.7.1`)
**Files:** `vscode/media/sidebar.html`, `vscode/media/sidebar.css`, `pycharm/src/main/resources/webview/sidebar.html`, `pycharm/src/main/resources/webview/sidebar.css`

**Problem:** `#mg-overlay` was positioned relative to `#game-screen` (via `position: relative` on that element), so it stretched to cover the entire game screen — hiding the pet sprite, pet name, and mood label during minigames.

**Fix:** Wrapped the `.stats` block in a new `#stats-game-area` container and moved `position: relative` from `#game-screen` to `#stats-game-area`. `#mg-overlay` (which is now a child of `#stats-game-area`) is scoped to the stats area only, leaving the pet sprite, name, and mood label always visible.

---

## BUGFIX-028 — Pet sprite invisible during Left/Right minigame

**Status:** Fixed (branch `fix/minigame-ui-v0.7.1`)
**Files:** `vscode/media/sidebar.html`, `vscode/media/sidebar.css`, `vscode/media/sidebar.js`, `pycharm/src/main/resources/webview/sidebar.html`, `pycharm/src/main/resources/webview/sidebar.css`, `pycharm/src/main/resources/webview/sidebar.js`

**Problem:** `#lr-canvas` was placed in `#mg-left-right` (inside the overlay), which meant the doors were drawn over an opaque panel that completely obscured the live pet sprite in `#sprite-container`. The pet was invisible for the entire duration of the Left/Right game.

**Fix:** Moved `#lr-canvas` inside `#sprite-container` and made it `position: absolute; inset: 0; z-index: 5; pointer-events: none`. The doors are now drawn as a transparent canvas layer on top of the pet sprite, making the pet visible through the door area while still showing the door overlay correctly. JS was updated to show the canvas at game start and hide it at game end.

---

## BUGFIX-029 — Minigame result screen dismisses itself immediately

**Status:** Fixed (branch `fix/minigame-ui-v0.7.1`)
**Files:** `vscode/media/sidebar.html`, `vscode/media/sidebar.js`, `pycharm/src/main/resources/webview/sidebar.html`, `pycharm/src/main/resources/webview/sidebar.js`

**Problem:** `sendPlayResult()` called `hideMgOverlay()` immediately after sending the result to the host. The result screen was shown for a fraction of a second before the overlay disappeared — the player had no time to read the outcome.

**Fix:** Removed the `hideMgOverlay()` call from `sendPlayResult()`. An **OK** button (`#btn-mg-ok`) was added to the `#mg-result` panel. The overlay now stays open until the player explicitly taps OK, at which point the `btn-mg-ok` click handler calls `hideMgOverlay()`.

---

## BUGFIX-030 — Minigame panels appear over stat bars instead of action button area

**Status:** Fixed (branch `fix/game-buttons-layout-v0.7.2`)
**Files:** `vscode/media/sidebar.html`, `vscode/media/sidebar.css`, `vscode/media/sidebar.js`, `pycharm/src/main/resources/webview/sidebar.html`, `pycharm/src/main/resources/webview/sidebar.css`, `pycharm/src/main/resources/webview/sidebar.js`

**Problem:** The minigame selection and gameplay panels were rendered inside `#mg-overlay`, an absolutely-positioned element that covered the stat bars. The pet sprite, name, and mood label remained visible (BUGFIX-027), but the health bars were still hidden during minigame play, and the game UI appeared in an unexpected location relative to the action buttons.

**Fix:** Removed `#mg-overlay` entirely. The `.stats` block and `#stats-game-area` are now always fully visible. The four game panels (`#mg-select`, `#mg-left-right`, `#mg-hl`, `#mg-result`) are placed inside a new `#game-panels` div that lives inside a new `#action-area` wrapper alongside `.btn-grid`. `showMgOverlay()` now hides `.btn-grid` and shows `#game-panels`; `hideMgOverlay()` reverses this. A `min-height: 140px` on `#action-area` prevents layout shift when the tallest game panel is displayed.

---

## BUGFIX-031 — Higher/Lower pet slides in the direction of the player's guess (confusing)

**Status:** Fixed (branch `fix/game-buttons-layout-v0.7.2`)
**Files:** `vscode/media/sidebar.css`, `vscode/media/sidebar.js`, `pycharm/src/main/resources/webview/sidebar.css`, `pycharm/src/main/resources/webview/sidebar.js`

**Problem:** When the player guessed Higher or Lower, the pet sprite slid right or left respectively. This animation was semantically confusing — the direction of slide had no clear connection to the guess outcome, and the motion was distracting whether the guess was correct or wrong.

**Fix:** Removed the `slide-left`/`slide-right` keyframes and `anim-slide-*` CSS classes. Added a `jump` keyframe (`translateY` bounce with a small secondary hop). `handleHLChoice()` now only triggers the `anim-jump` animation when the guess is **correct**, giving positive visual feedback without spurious motion on wrong answers.

---

## BUGFIX-032 — Jump animation moves the entire sprite container (including door overlay) instead of just the pet

**Status:** Fixed (branch `fix/pet-jump-animation-v0.7.3`)
**Files:** `vscode/media/sidebar.css`, `vscode/media/sidebar.js`, `pycharm/src/main/resources/webview/sidebar.css`, `pycharm/src/main/resources/webview/sidebar.js`

**Problem:** The `anim-jump` CSS class was applied to `#sprite-container`, the parent div that holds both `#sprite-canvas` (the pet) and `#lr-canvas` (the Left/Right door overlay). This caused the entire container — including the door canvas — to animate, rather than just the pet sprite.

**Fix:** Changed the CSS selector from `#sprite-container.anim-jump` to `#sprite-canvas.anim-jump` so the `jump` keyframe animation targets only the pet sprite canvas. In `handleHLChoice()`, replaced the local `document.getElementById("sprite-container")` re-query with the already-declared top-level `spriteCanvas` const, and updated all four references (`classList.add`, `addEventListener`, `classList.remove`, `removeEventListener`) to use `spriteCanvas` directly.

---

## BUGFIX-033 — Passive weight decay fires at full rate during idle states

**Status:** Fixed (branch `feat/pat-in-play-menu-v0.7.5`)
**Files:** `vscode/src/gameEngine.ts`, `pycharm/src/main/kotlin/com/gotchi/engine/GameEngine.kt`

**Problem:** Weight decayed by 1 every `WEIGHT_DECAY_TICK_INTERVAL` (10) ticks regardless of whether the IDE was idle. Hunger and happiness already use `IDLE_DECAY_TICK_DIVISOR` (10×) to slow decay during idle, but weight decay skipped this throttle, making it decay 10× too fast while idle.

**Fix:** Introduced a local `weightDecayInterval` variable that equals `WEIGHT_DECAY_TICK_INTERVAL * IDLE_DECAY_TICK_DIVISOR` (100 ticks) when `isIdle` is true, and `WEIGHT_DECAY_TICK_INTERVAL` (10 ticks) otherwise. The modulo condition now uses this variable instead of the constant directly, bringing weight decay in line with the throttle already applied to hunger and happiness.

---

## BUGFIX-034 — Pat action and coin flip play do not lose weight; left_right / higher_lower lose too little

**Status:** Fixed (branch `feat/dev-mode-checkbox-v0.8.1`)
**Files:** `vscode/src/gameEngine.ts`, `pycharm/src/main/kotlin/com/gotchi/engine/GameEngine.kt`, `pycharm/src/main/kotlin/com/gotchi/engine/Constants.kt`

**Problem:** The `pat()` action applied no weight loss at all. For minigames, `play()` already deducted 3 weight (`PLAY_WEIGHT_LOSS`), but the design called for `left_right` and `higher_lower` to deduct a further 3 weight after the minigame result, while `coin_flip` should not. This extra deduction was missing, so those two minigames had the same net weight cost as coin flip.

**Fix:** Added `PAT_WEIGHT_LOSS = 3` and `PLAY_WEIGHT_LOSS_BONUS = 3` constants. `pat()` now deducts `PAT_WEIGHT_LOSS` weight (with weight-tier event checks and clamped to `WEIGHT_MIN`). `applyMinigameResult()` deducts `PLAY_WEIGHT_LOSS_BONUS` weight (with weight-tier events and clamping) for `left_right` and `higher_lower` only; `coin_flip` is unchanged.

---

## BUGFIX-035 — Coin flip result panel shows dev-mode notes instead of clean win/lose text

**Status:** Fixed (branch `feat/dev-mode-checkbox-v0.8.1`)
**Files:** `vscode/media/sidebar.js`, `pycharm/src/main/resources/webview/sidebar.js`

**Problem:** The `endCoinFlipGame()` function set the result text to `"You won Coin Flip! (+5 happiness)"` or `"You lost Coin Flip. (no consolation)"` — the parenthetical notes were developer annotations that had leaked into the user-facing UI.

**Fix:** Simplified the result strings to `"You won Coin Flip!"` and `"You lost Coin Flip."` with no parenthetical notes.

---

## BUGFIX-036 — Gotchi dies from sickness/hunger immediately after user returns from lock screen or sleep

**Status:** Fixed (branch `fix/deep-idle-reentry-damage`)
**File:** `vscode/src/extension.ts`

**Problem:** When the OS suspended the VS Code extension host (lock screen, sleep, lid close), the `setInterval` tick timer froze. On wake, the first tick correctly detected deep idle (idle time = hours) and kept stats protected. However, as soon as the user pressed a key or clicked, `markActivity()` reset `lastActivityMs` to now. The very next tick (6 seconds later) saw idle time as ~6 seconds, immediately dropping out of deep idle with no transition buffer. If stats were sitting at the deep-idle floor of 20, the gotchi could starve and then die from combined starvation + sickness damage within roughly 3 minutes of the user returning.

**Fix:** Added a `lastDeepIdleTickMs` timestamp that is refreshed on every tick where deep idle is active. The `deepIdle` flag is now computed as `rawDeepIdle || (Date.now() - lastDeepIdleTickMs < 60_000)`, giving a 60-second grace period after the user returns before full active decay resumes.

---

## BUGFIX-037 — `hungerZeroTicks` persisted across restarts causes immediate starvation damage on reopening VS Code

**Status:** Fixed (branch `fix/deep-idle-reentry-damage`)
**File:** `vscode/src/gameEngine.ts`

**Problem:** `hungerZeroTicks` — the counter of consecutive zero-hunger ticks that triggers starvation damage after 3 — was included in the serialised state. If the pet was saved with `hungerZeroTicks = 2` (one tick away from starvation), the first tick after reopening VS Code dealt starvation damage and forced `sick = true`, even if offline decay left hunger above zero. The continuity of the streak is meaningless across a session boundary.

**Fix:** `applyOfflineDecay` now resets `hungerZeroTicks` to `0` in its return value, breaking the streak on every reload.

---

## BUGFIX-038 — `applyOfflineDecay` does not respect `IDLE_STAT_FLOOR`, allowing offline decay to push stats below 20

**Status:** Fixed (branch `fix/deep-idle-reentry-damage`)
**File:** `vscode/src/gameEngine.ts`

**Problem:** While the extension is running, the deep-idle state floors hunger and happiness at `IDLE_STAT_FLOOR` (20), preventing them from dropping below 20 during long idle periods. However, `applyOfflineDecay` (applied once on activation for the time VS Code was fully closed) had no such floor. A pet with hunger = 25 left closed long enough could wake up with hunger = 10, well below the floor the live engine would have enforced, setting it up for rapid starvation.

**Fix:** After computing the decayed hunger and happiness values in `applyOfflineDecay`, both are now clamped with `Math.max(value, IDLE_STAT_FLOOR)`, matching the protection the live deep-idle logic provides.

---

## BUGFIX-039 — State not saved on window focus loss causes offline decay to be calculated as slightly longer than actual

**Status:** Fixed (branch `fix/deep-idle-reentry-damage`)
**File:** `vscode/src/extension.ts`

**Problem:** State was saved once per tick (every 6 seconds). If the user locked their screen or closed VS Code between ticks, `elapsedSecondsSinceLastSave` over-counted by up to ~6 seconds on the next activation. This made offline decay slightly more aggressive than intended and also meant the last few seconds of pre-lock state could be lost.

**Fix:** Added a `saveState(context, currentState)` call in the `!e.focused` branch of the `onDidChangeWindowState` handler, so state is saved immediately whenever VS Code loses focus.

---

## BUGFIX-040 — Sick pet loses health during deep idle (lock screen / OS sleep), can die while user is away

**Status:** Fixed (branch `fix/deep-idle-reentry-damage`)
**File:** `vscode/src/gameEngine.ts`

**Problem:** The sickness health drain block in `tick()` (`if (sick) { health -= 5; }`) had no idle guard of any kind. If the pet was already sick when the user locked their screen or the computer went to sleep, the extension kept applying 5 HP of damage every 6 seconds for the entire deep-idle period. A sick pet could die overnight with no way for the user to intervene. This was inconsistent with `applyOfflineDecay` (the "VS Code closed" path), which deliberately skips health changes entirely.

**Fix:** Changed the condition to `if (sick && !isDeepIdle)`. Sickness damage is suppressed whenever the IDE is in deep idle (≥ 10 minutes of inactivity, which covers lock screen and OS sleep). A sick pet retains its current health while the user is away and still requires medicine when they return. Damage continues to fire during regular idle (< 10 min) so brief absences still carry consequences.

---

## BUGFIX-041 — `experimental.text.complete` hook caused double sprite and ANSI codes in markdown

**Status:** Fixed (branch `feat/show-art-on-every-response`)
**File:** `.opencode/plugins/gotchi.ts`, `opencode-codotchi/src/index.ts`

**Problem:** The `experimental.text.complete` hook prepended ANSI art to every LLM markdown text response. This caused three issues: (1) the sprite appeared twice — once in the tool output and once prepended to the text response; (2) raw ANSI escape codes were embedded in markdown, breaking rendering in chat; (3) the sprite could show a different state than the tool output if the pet ticked between responses, causing visible sprite drift on scroll.

**Fix:** Removed the `experimental.text.complete` hook entirely. The sprite is now shown only in tool output (via `buildStatusBlock`), which renders correctly as a code block in the OpenCode chat UI.

---

## BUGFIX-042 — `/codotchi status` showed two sprites (artHeader + buildStatusBlock)

**Status:** Fixed (branch `feat/show-art-on-every-response`)
**File:** `.opencode/plugins/gotchi.ts`, `opencode-codotchi/src/index.ts`

**Problem:** The `status` case called both `artHeader()` (which renders a speech bubble + sprite) and `buildStatusBlock()` (which renders a separate sprite + stat bars). This produced two sprites in the status output, with the speech bubble art appearing above the stat block art.

**Fix:** Removed the `artHeader()` call from the `status` case. `buildStatusBlock` already includes the sprite; `artHeader` is only needed for actions that do not produce a stat block.

---

## BUGFIX-043 — `/codotchi status` plain-text line was missing `Weight`

**Status:** Fixed (branch `feat/show-art-on-every-response`)
**File:** `.opencode/plugins/gotchi.ts`, `opencode-codotchi/src/index.ts`

**Problem:** The plain-text stats summary returned by the `status` action listed `Hunger | Happiness | Energy | Health` but omitted `Weight`, which is a core stat visible in the stat block.

**Fix:** Appended `| Weight: ${petState.weight}` to the plain-text stats string.

---

## BUGFIX-044 — "Play with me?" phrases exposed internal phrasing in tool output

**Status:** Fixed (branch `feat/show-art-on-every-response`)
**File:** `.opencode/plugins/gotchi.ts`, `opencode-codotchi/src/index.ts`, `.opencode/plugins/asciiArt.ts`, `opencode-codotchi/src/asciiArt.ts`

**Problem:** Three notification phrases — `"I'm feeling really sad. Play with me?"`, `"I've been so lonely. Play with me? (/codotchi pat)"`, and `"I'm feeling really lonely. Play with me?"` — used first-person phrasing that read as the AI speaking, which was confusing in the OpenCode chat context where the pet's messages appear alongside LLM responses.

**Fix:** All three phrases replaced with third-person variants: `"Gotchi wants to play"` and `"Gotchi wants to play (/codotchi pat)"`.

---

## BUGFIX-046 — `bubbleLines.join` called on a string, crashing the `experimental.text.complete` hook in OpenCode 1.4.0

**Status:** Fixed (branch `fix/bubble-lines-join`)
**Files:** `.opencode/plugins/gotchi.ts`, `opencode-codotchi/src/index.ts`

**Problem:** The `experimental.text.complete` hook stored the return value of
`buildSpeechBubble()` in a variable named `bubbleLines` and then called
`.join("\n")` on it. `buildSpeechBubble` returns a `string` (lines are already
joined internally). In OpenCode 1.4.0, strings no longer have a `.join` method
exposed in the plugin runtime, so calling `.join` threw a `TypeError` on every
LLM text response, crashing the entire hook and breaking all text output.

**Fix:** Renamed `bubbleLines` → `bubble` and removed the `.join("\n")` call,
passing the string return value directly to `stripAnsi()`.

---

## BUGFIX-045 — ANSI colour bleed from art blocks into subsequent chat text

**Status:** Fixed (branch `feat/show-art-on-every-response`)
**File:** `.opencode/plugins/asciiArt.ts`, `opencode-codotchi/src/asciiArt.ts`

**Problem:** `buildSpeechBubble` and `buildStatusBlock` both emitted ANSI colour codes without a leading reset. If the previous terminal output left an active colour or style, it would bleed into the art block's first line. Similarly the block's own colours could bleed into the text that followed it.

**Fix:** Both functions now prepend a `RESET` sentinel as the first element of their output array, ensuring ANSI state is clean before the art block begins.

---

## BUGFIX-047 — Raw ANSI escape codes visible in tool details panel output

**Status:** Fixed (branch `fix/ansi-escape-codes-in-status`)
**Files:** `.opencode/plugins/gotchi.ts`, `opencode-codotchi/src/index.ts`

**Problem:** The `tool.execute.after` hook assigned the raw `lastToolOutput` string (which contains ANSI escape sequences) directly to `output.output`. OpenCode's tool details panel renders this field as plain text, not a terminal emulator, so the `\x1b` byte was silently dropped and the bracket sequences (e.g. `[33m`, `[0m`) appeared literally in the output.

**Fix:** Applied `stripAnsi(lastToolOutput)` before assigning to `output.output`, consistent with how `output.text` was already handled in the `experimental.text.complete` hook. `stripAnsi` was already imported in both files.

---

## BUGFIX-048 — Multiple VS Code windows show stale / diverged pet state

**Status:** Fixed (branch `fix/cross-window-sync`)
**Files:** `vscode/src/extension.ts`, `vscode/src/persistence.ts`, `vscode/src/sidebarProvider.ts`

**Problem:** When two or more VS Code windows were open, only the focused window ticked and wrote state. The unfocused window's sidebar and status bar remained frozen at the snapshot taken when it lost focus. Switching windows updated the stale window via `reloadAndRefreshUI()` on the focus event, but any user action in the background window before that focus event would overwrite the newer state from the active window with a stale in-memory snapshot. Additionally, `mealsGivenThisCycle` was never synchronised between windows, allowing the per-cycle meal cap to be bypassed by switching windows between feeds.

**Fix:**
1. **File watcher (Bug D):** `extension.ts` now registers an `fs.watch` listener on `state.json` at activation. When the file changes and this window is not the active ticker (`tickTimer === undefined`), `reloadAndRefreshUI()` is called after a 150 ms debounce. This makes every write by any window or IDE (PyCharm, OpenCode) immediately visible in all other open windows without waiting for a focus cycle.
2. **`mealsGivenThisCycle` reset (Bug C):** `SidebarProvider.resetMealCycle()` was added and is called inside `reloadAndRefreshUI()` so that the meal counter is cleared whenever state is reloaded from disk. This prevents a window with a stale counter from blocking or bypassing the meal cap after a cross-window sync.
3. **`getSharedStatePath()` exported from `persistence.ts`** so `extension.ts` can locate the file to watch without duplicating the path logic.

---

## BUGFIX-049 — OpenCode plugin never syncs stats from VS Code while running

**Status:** Fixed (branch `fix/cross-ide-sync`)
**Files:** `.opencode/plugins/gotchi.ts`, `opencode-codotchi/src/index.ts`

**Problem:** The OpenCode plugin loaded the shared `state.json` file exactly once at startup, then held an in-memory copy for the rest of the session. Any writes to `state.json` by VS Code (every 6 seconds on each tick) were never picked up. The two IDEs would diverge immediately, and whichever saved last would clobber the other's state on the next restart.

**Fix:** Added an `fs.watch` listener on `state.json` inside the plugin entry point, matching the pattern already used in the VS Code extension. When the file changes, a 150 ms debounce fires `reloadFromSharedFile()`, which:
- Reads the shared file.
- Guards against replaying our own writes with `if (shared.savedAt <= lastSavedAt) { return; }` — `lastSavedAt` is updated by `saveState()` on every OpenCode write, so OpenCode-originated saves are ignored.
- Applies a minimal `applyOfflineDecay()` correction for the brief delta since VS Code saved.
- Does **not** reset `terminalEnabled` — that flag is OpenCode-local and must not be clobbered by VS Code saves.
- Resets `mealsThisCycle = 0` on every external reload (conservative; prevents meal-cap bypass).

A `watchBootstrap` `setInterval` (10 s) retries `startWatcher()` if the file did not exist at plugin startup.

---

## BUGFIX-050 — VS Code multi-window sync breaks after first reload due to timestamp drift

**Status:** Fixed (branch `fix/cross-ide-sync`)
**File:** `vscode/src/extension.ts`

**Problem:** `reloadAndRefreshUI()` (called when an unfocused VS Code window receives an `fs.watch` notification) called `saveState(context, state)` at the end. This updated the unfocused window's `TIMESTAMP_KEY` in `globalState` to `Date.now()`. On the next `fs.watch` event (≈ 6 seconds later when the focused window ticked again), `loadState()` compared `shared.savedAt` (the focused window's last save, ~6 seconds ago) against `localTimestamp` (just set to now by the previous reload). `shared.savedAt < localTimestamp` — so `loadState()` fell back to the unfocused window's stale `globalState` copy instead of the fresh shared file. The unfocused window would display correct stats once, then silently stop syncing.

**Fix:** Removed the `saveState(context, state)` call from `reloadAndRefreshUI()`. The unfocused window now reads and displays state only — the focused window (active ticker) is the sole writer. This preserves the `localTimestamp` at its last-written value, ensuring `shared.savedAt > localTimestamp` remains true on every subsequent `fs.watch` event.

**AI mode:** Unaffected. In AI mode `stopTicker()` is skipped on focus-loss, so the window always has `tickTimer !== undefined` and the `fs.watch` guard (`if (tickTimer !== undefined) { return; }`) prevents any reload attempt. `reloadAndRefreshUI()` is also not called in AI mode on focus-gain (guarded by `if (!c.get<boolean>("aiMode", false))`).

---

## BUGFIX-051 — `/codotchi show` output appeared twice in chat

**Status:** Fixed (branch `fix/codotchi-command-rename`)
**File:** `.opencode/commands/codotchi.md`, `opencode-codotchi/commands/codotchi.md`

**Problem:** After calling `/codotchi show` (previously `/codotchi on`), the ASCII art sprite appeared twice in the chat — once in the tool output panel and once echoed into the LLM's text response. The command prompt said "return tool output verbatim" which caused the LLM to wrap the art in a fenced code block and re-emit it, doubling the display.

**Fix:** Rewrote the slash command prompt to explicitly instruct the LLM to output the tool result as plain text with no code fences and no extra commentary. The `$ARGUMENTS`-to-`action` mapping was also restructured as a table for clarity, renaming `on` → `show` and `off` → `hide` as user-facing subcommand words.
