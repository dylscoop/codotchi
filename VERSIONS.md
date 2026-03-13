# Version History

## v0.2.0 — current

### Changes from v0.1.4

| File | What changed |
|------|-------------|
| `vscode/src/gameEngine.ts` | Added `IDLE_DEEP_THRESHOLD_SECONDS = 600` and `IDLE_STAT_FLOOR = 20`; added `wasDeepIdle` to `PetState`; `tick()` gains `isDeepIdle` param; deep-idle stat floor (hunger/happiness capped at 20); aging stops entirely when deep idle; `went_deep_idle` event fires once on transition; `applyOfflineDecay` no longer advances `dayTimer`/`ageDays` (aging stops when IDE closed) |
| `vscode/src/extension.ts` | Imports `IDLE_DEEP_THRESHOLD_SECONDS`; derives `IDLE_DEEP_THRESHOLD_MS`; computes `deepIdle` flag and passes to `tick()` |
| `vscode/media/sidebar.js` | Added `"went_deep_idle"` label to `humaniseEvent()` |
| `pycharm/src/main/kotlin/com/gotchi/engine/Constants.kt` | Added `IDLE_DEEP_THRESHOLD_MS = 600_000L` and `IDLE_STAT_FLOOR = 20` |
| `pycharm/src/main/kotlin/com/gotchi/engine/PetState.kt` | Added `val wasDeepIdle: Boolean` |
| `pycharm/src/main/kotlin/com/gotchi/engine/GameEngine.kt` | `tick()` gains `isDeepIdle` param; deep-idle stat floor; aging stops when deep idle; `went_deep_idle` event; `applyOfflineDecay` preserves `dayTimer`/`ageDays` |
| `pycharm/src/main/kotlin/com/gotchi/GotchiPersistence.kt` | `RawPetState.wasDeepIdle: Boolean?`; `sanitise()` default `false`; `toRaw()` includes field |
| `pycharm/src/main/kotlin/com/gotchi/GotchiPlugin.kt` | Added `isDeepIdle()` helper; `onTick()` passes `isDeepIdle()` to `tick()` |
| `pycharm/src/main/resources/webview/sidebar.js` | Added `"went_deep_idle"` label to `humaniseEvent()` |
| `vscode/package.json` | Version `0.1.4` → `0.2.0` |
| `pycharm/build.gradle.kts` | Version `0.1.4` → `0.2.0` |
| `pycharm/gradle.properties` | `pluginVersion` `0.1.4` → `0.2.0` |
| `pycharm/src/main/resources/META-INF/plugin.xml` | Version `0.1.4` → `0.2.0` |
| `vscode/FEATURES.md` | Section 8.1 updated with deep-idle constants and behaviour |
| `DEV_NOTES.md` | Idle decay section updated: deep idle threshold, stat floor, aging stop, IDE-closed aging stop |
| `README.md` | Version reference and install filenames updated to `0.2.0` |

### New constants (v0.2.0)

```
IDLE_DEEP_THRESHOLD_SECONDS: number = 600   // 10 min (VS Code)
IDLE_DEEP_THRESHOLD_MS: Long = 600_000      // 10 min (PyCharm)
IDLE_STAT_FLOOR: number/Int = 20            // hunger/happiness floor during deep idle
```

### New PetState fields (v0.2.0)

```
wasDeepIdle: boolean   // tracks deep-idle transition; prevents repeated events
```

---

## v0.1.4

### Changes from v0.1.3

| File | What changed |
|------|-------------|
| `vscode/src/gameEngine.ts` | `IDLE_THRESHOLD_SECONDS` 300 → 60 (5 min → 1 min) |
| `pycharm/src/main/kotlin/com/gotchi/engine/Constants.kt` | `IDLE_THRESHOLD_MS` 300_000 → 60_000 (5 min → 1 min) |
| `vscode/FEATURES.md` | Idle threshold note updated to 60 s (1 min) |
| `vscode/package.json` | Version `0.1.3` → `0.1.4` |
| `pycharm/build.gradle.kts` | Version `0.1.3` → `0.1.4` |
| `pycharm/gradle.properties` | `pluginVersion` `0.1.3` → `0.1.4` |
| `pycharm/src/main/resources/META-INF/plugin.xml` | Version `0.1.3` → `0.1.4` |

### Updated constants

```
IDLE_THRESHOLD_SECONDS: number = 60   // was 300 (5 min → 1 min)
IDLE_THRESHOLD_MS: Long = 60_000      // was 300_000
```

---

## v0.1.3

### Changes from v0.1.2

| File | What changed |
|------|-------------|
| `vscode/src/gameEngine.ts` | `TICK_INTERVAL_SECONDS` 5 → 6; added `IDLE_THRESHOLD_SECONDS = 300`, `IDLE_DECAY_TICK_DIVISOR = 10`; `tick()` gains `isIdle` param — skips hunger/happiness decay on 9 out of 10 ticks when idle; JSDoc comment corrected (÷ 6 s/tick = 600 ticks/day); `EVOLUTION_DAY_THRESHOLDS` tick-count comments updated for 6s ticks (24→20, 144→120, 864→720, 3024→2520) |
| `vscode/src/extension.ts` | Added `lastActivityMs`, `markActivity()`, four IDE activity listeners (`onDidChangeTextEditorSelection`, `onDidChangeTextDocument`, `onDidChangeWindowState`, `onDidChangeActiveTextEditor`); `tick()` call passes `isIdle` flag |
| `vscode/media/sidebar.js` | Fixed new-game screen refresh bug: dead-state tick guard prevents screen switching; `hasActiveGame` now true for dead state, false only on `needs_new_game`; Continue button routes to `"dead"` screen when pet is dead |
| `pycharm/src/main/kotlin/com/gotchi/engine/Constants.kt` | `TICK_INTERVAL_SECONDS` 5 → 6; added `IDLE_THRESHOLD_MS = 300_000L`, `IDLE_DECAY_TICK_DIVISOR = 10`; `EVOLUTION_DAY_THRESHOLDS` tick-count comments updated (same corrections as TypeScript) |
| `pycharm/src/main/kotlin/com/gotchi/engine/GameEngine.kt` | `tick()` gains `isIdle` param — same idle decay logic as TypeScript |
| `pycharm/src/main/kotlin/com/gotchi/GotchiPlugin.kt` | Added AWT event listener for idle tracking (`lastActivityTime`, `awtActivityListener`); `isIdle()` helper; `onTick()` passes idle flag; listener removed in `dispose()` |
| `pycharm/src/main/resources/webview/sidebar.js` | Mirrored all sidebar.js fixes |
| `vscode/tests/unit/gameEngine.test.ts` | `TICK_INTERVAL_SECONDS` assertion 5→6; poop boundary `239→199`, interval comment `240→200`; offline decay comment `≈ 20 ticks → ≈ 16 ticks` |
| `vscode/tests/unit/gameEngine.test.js` | Mirrored all test.ts changes |
| `DEV_NOTES.md` | Constants table updated (6s, 10 ticks/min, 600/480 ticks/day); poop prose updated; new **Stat Decay Rates** section added; evolution tick-count comments corrected; "ageDays is manual" simplification bullet replaced with accurate description |
| `BUGFIXES.md` | "5-second tick" → "6-second tick" |
| `vscode/FEATURES.md` | `tickIntervalSeconds` default 5→6; section 2.1 stage durations table updated with per-type `agingMultiplier` note; new section 8.1 **Idle Detection** added |
| `pycharm/src/main/resources/META-INF/plugin.xml` | Version bump; meal cap corrected 4→3; snack cap corrected 2→3 |
| `vscode/package.json` | Version `0.1.2` → `0.1.3` |
| `pycharm/build.gradle.kts` | Version `0.1.2` → `0.1.3` |
| `pycharm/gradle.properties` | `pluginVersion` corrected and bumped to `0.1.3` |
| `README.md` | Version reference updated to `v0.1.3`; install filenames updated to `0.1.3` |

---

## v0.1.2

### Changes from v0.1.1

| File | What changed |
|------|-------------|
| `vscode/src/sidebarProvider.ts` | Play bug fix: guard `applyMinigameResult` — only called when `play_refused_no_energy` is NOT in events, preventing happiness gain when play is refused |
| `pycharm/.../GotchiPlugin.kt` | Mirrored play bug fix: same `play_refused_no_energy` guard in `"play"` branch |
| `vscode/media/sidebar.js` | UI refresh fix: added `currentScreen` and `hasActiveGame` tracking; `showScreen()` sets `currentScreen`; message handler suppresses `renderState` while on setup screen with a live pet; initial screen changed from `"setup"` → `"game"`; Continue button wired to return to game screen |
| `vscode/media/sidebar.html` | Navigation redesign: added `<button id="btn-continue">` to setup screen (hidden until active game exists); `btn-new-game` label changed from "Start new game…" to "Menu" |
| `pycharm/.../sidebar.js` | Mirrored all sidebar.js changes |
| `pycharm/.../sidebar.html` | Mirrored all sidebar.html changes |
| `vscode/FEATURES.md` | Updated to reflect v0.1.0 and v0.1.1 actuals: meal cap (3), snack cap (3, resets on auto-wake), play energy feedback via event log; added sections 7.1 (Screen Navigation) and 7.2 (Humanised Event Log); fixed section 8/9 health drain rows; renumbered sections 7–14 |
| `vscode/package.json` | Version `0.1.1` → `0.1.2` |
| `pycharm/build.gradle.kts` | Version `0.1.1` → `0.1.2` |
| `pycharm/src/main/resources/META-INF/plugin.xml` | Version `0.1.1` → `0.1.2` |
| `README.md` | Version reference `v0.1.1` → `v0.1.2` |
| `vscode/media/sidebar.js` | BUGFIX-011: added `pendingNewGame` flag — Hatch! now always transitions to game screen; BUGFIX-012: `hasActiveGame` cleared to `false` on death so Continue is hidden after pet dies |
| `vscode/media/sidebar.html` | Continue button moved above "New Gotchi" heading |
| `pycharm/.../sidebar.js` | Mirrored BUGFIX-011 and BUGFIX-012 sidebar.js changes |
| `pycharm/.../sidebar.html` | Continue button moved above "New Gotchi" heading |
| `pycharm/.../GotchiBrowserPanel.kt` | BUGFIX-013: added `onReady: () -> Unit = {}` constructor parameter; `onReady()` called from `onLoadEnd` after JS bridge injection so callers can push state once the page is guaranteed ready |
| `pycharm/.../GotchiToolWindow.kt` | BUGFIX-013: passes `onReady = { plugin.broadcastState() }` to `GotchiBrowserPanel` to eliminate JCEF page-load race condition |

---

## v0.1.1

### Changes from v0.1.0

| File | What changed |
|------|-------------|
| `vscode/src/gameEngine.ts` | `sickness_damage` event pushed each tick the sick health drain fires; snacks reset to 0 on `auto_woke_up` in `tick()` |
| `vscode/media/sidebar.js` | Added `humaniseEvent()` — all event log entries now show human-readable text using the pet's name; removed client-side play-button energy disable (engine `play_refused_no_energy` event handles it instead, showing e.g. "Buddy doesn't have enough energy to play!") |
| `pycharm/.../GameEngine.kt` | Mirrored `sickness_damage` event and snack reset on auto-wake |
| `pycharm/.../sidebar.js` | Mirrored all sidebar.js changes |

---

## v0.1.0

### Changes from v0.1.0

| File | What changed |
|------|-------------|
| `vscode/src/gameEngine.ts` | Added `agingMultiplier` to `PetTypeModifiers`; replaced `STAGE_DURATION_MAP` with `EVOLUTION_DAY_THRESHOLDS`; `checkStageProgression()` now gates on `dayTimer` instead of `ticksAlive`; `tick()` increments `dayTimer` by `agingMultiplier / TICKS_PER_DAY`; `applyOfflineDecay()` uses `agingMultiplier` for `dayTimer` advance; `SNACK_MAX_PER_CYCLE` raised `2 → 3`; `FEED_SNACK_HAPPINESS_BOOST` halved `10 → 5` |
| `vscode/media/sidebar.js` | Info-line now shows pet type: `Age: Xd \| stage \| Type \| N poops` |
| `vscode/tests/unit/gameEngine.test.ts` | Updated stage-progression tests to seed `dayTimer`; added 2 new dayTimer multiplier tests (bytebug faster, shellscript slower); updated `feedSnack` happiness assertion `50 → 45` |
| `pycharm/src/main/kotlin/com/gotchi/engine/Constants.kt` | Mirrored all engine constant changes: `agingMultiplier` per type, `EVOLUTION_DAY_THRESHOLDS`, `SNACK_MAX_PER_CYCLE = 3`, `FEED_SNACK_HAPPINESS_BOOST = 5` |
| `pycharm/src/main/kotlin/com/gotchi/engine/GameEngine.kt` | Mirrored `checkStageProgression()`, `tick()` dayTimer line, `applyOfflineDecay()` |
| `pycharm/src/main/resources/webview/sidebar.js` | Info-line mirrored from VS Code: shows pet type |
| `vscode/package.json` | Version `1.0.0` → `0.1.0` |
| `pycharm/build.gradle.kts` | Version `1.0.0` → `0.1.0` |
| `pycharm/src/main/resources/META-INF/plugin.xml` | Version `1.0.0` → `0.1.0` |

### `agingMultiplier` values (v0.1.0)

| Type | Multiplier | Effect |
|------|-----------|--------|
| codeling | 1.0 | baseline |
| bytebug | 1.5 | ages 1.5× faster |
| pixelpup | 1.25 | ages 1.25× faster |
| shellscript | 0.75 | ages 0.75× slower |

### `EVOLUTION_DAY_THRESHOLDS` (v0.1.0, replaces `STAGE_DURATION_MAP`)

```ts
const EVOLUTION_DAY_THRESHOLDS: Record<string, number> = {
  egg:   0.033,  // ≈ tick 24 for codeling 1× (~2 min awake)
  baby:  0.199,  // ≈ tick 144 cumulative for codeling 1× (~12 min)
  child: 1.199,  // ≈ tick 864 cumulative for codeling 1× (~72 min)
  teen:  4.199,  // ≈ tick 3024 cumulative for codeling 1× (~252 min)
};
```

### Updated constants (v0.1.0)

```ts
SNACK_MAX_PER_CYCLE:         number = 3   // raised from 2; max snacks per wake cycle
FEED_SNACK_HAPPINESS_BOOST:  number = 5   // halved from 10; happiness gained per snack
FEED_MEAL_MAX_PER_CYCLE:     number = 3   // lowered from 4; max meals per wake cycle
```

| File | What changed |
|------|-------------|
| `vscode/src/gameEngine.ts` | `FEED_MEAL_MAX_PER_CYCLE` lowered `4 → 3` |
| `vscode/media/sidebar.js` | `var MEAL_MAX` lowered `4 → 3` (UI badge + button-disable) |
| `vscode/tests/unit/gameEngine.test.ts` | Updated meal cap tests to reflect cap of 3 |
| `pycharm/src/main/kotlin/com/gotchi/engine/Constants.kt` | `FEED_MEAL_MAX_PER_CYCLE` lowered `4 → 3` |
| `pycharm/src/main/resources/webview/sidebar.js` | `var MEAL_MAX` lowered `4 → 3` (UI badge + button-disable) |

### High score on setup screen (v0.1.0)

| File | What changed |
|------|-------------|
| `vscode/media/sidebar.html` | Added `<div id="setup-high-score">` + `<p id="setup-hs-stats">` inside `#setup-screen` |
| `vscode/media/sidebar.css` | Added `.setup-high-score` border/padding style |
| `vscode/media/sidebar.js` | Added `setupHighScore`/`setupHsStats` element refs; `latestHighScore` module-level variable; `renderSetupHighScore(hs)` function; `showScreen()` calls it when switching to setup; message handler caches `latestHighScore` and passes it to `renderState` |
| `pycharm/src/main/resources/webview/sidebar.html` | Mirrored VS Code HTML changes |
| `pycharm/src/main/resources/webview/sidebar.css` | Mirrored VS Code CSS changes |
| `pycharm/src/main/resources/webview/sidebar.js` | Mirrored all VS Code JS changes |

### BUGFIX: high score not shown on setup screen after VS Code restart (v0.1.0)

Root cause: `postState` was called during activation before the webview panel was
visible — `webviewView` was `undefined` so the message was silently dropped.
On reopening the panel, no follow-up message was ever sent (tick skips when
`currentState === null`), so `latestHighScore` in the webview stayed `null`.

| File | What changed |
|------|-------------|
| `vscode/src/sidebarProvider.ts` | Added `getHighScore: () => HighScore \| null` to constructor; `resolveWebviewView` now bootstraps the freshly-loaded webview: if a state exists it calls `postState(state, hs)`; if no state but a high score exists it posts a synthetic `{ needs_new_game: true }` message with `highScore` so `latestHighScore` is cached before the setup screen is shown |
| `vscode/src/extension.ts` | Passes `() => currentHighScore` as 5th argument to `new SidebarProvider(...)` |

---



| File | What changed |
|------|-------------|
| `vscode/src/gameEngine.ts` | Added `HighScore` interface (exported); fixed `play()` guard from `energy <= 0` to `energy < PLAY_ENERGY_COST` (BUGFIX-010); added `SNACK_MAX_PER_CYCLE = 2` and `RECENT_EVENT_LOG_MAX = 20` constants; added `recentEventLog`, `spawnedAt`, `snacksGivenThisCycle` to `PetState`; `withDerivedFields()` appends current events to `recentEventLog` (rolling last 20); `createPet()` initialises all new fields; `feedSnack()` enforces snack cap per wake cycle; `wake()` resets `snacksGivenThisCycle`; serialise/deserialise updated with back-compat fallbacks |
| `vscode/src/persistence.ts` | Added `HIGH_SCORE_KEY`, `loadHighScore()`, `saveHighScore()` |
| `vscode/src/extension.ts` | Added `currentHighScore`; loads high score on activation; updates high score in `handleStateUpdate` when pet dies; passes `currentHighScore` to `sidebar?.postState` |
| `vscode/src/sidebarProvider.ts` | Updated `postState(state, highScore)` signature; includes `highScore` in webview message payload |
| `vscode/media/sidebar.html` | Snack button badge; dead screen gains `<p id="dead-time">`, `<ul id="dead-event-log">`, and `<div id="high-score-section">` with `<p id="high-score-stats">` |
| `vscode/media/sidebar.js` | `renderState()` populates `mealsLeftEl` and `snacksLeftEl` badges; disables Snack button when at cap; disables Play button when `energy < 25` (BUGFIX-010); added `highScoreSection`/`highScoreStats` element refs; `renderDeadScreen(state, highScore)` shows high score panel when a record exists; message handler passes `message.highScore` |
| `vscode/media/sidebar.css` | Added `.meals-left` badge style; `.dead-time` and `.dead-event-log` styles; `.high-score-section`, `.high-score-title`, `.high-score-stats` styles |
| `pycharm/src/main/kotlin/com/gotchi/engine/GameEngine.kt` | Fixed `play()` guard to `energy < PLAY_ENERGY_COST` (BUGFIX-010); mirrored all v0.1.0 logic |
| `pycharm/src/main/kotlin/com/gotchi/engine/PetState.kt` | Added `recentEventLog: List<String>`, `spawnedAt: Long`, `snacksGivenThisCycle: Int` |
| `pycharm/src/main/kotlin/com/gotchi/engine/Constants.kt` | Added `SNACK_MAX_PER_CYCLE = 2`, `RECENT_EVENT_LOG_MAX = 20` |
| `pycharm/src/main/kotlin/com/gotchi/GotchiPersistence.kt` | Added `highScoreJson` field; `loadHighScore()` and `saveHighScore()` helpers; `HighScore` data class; `RawPetState`/`sanitise()`/`toRaw()` updated for all new fields |
| `pycharm/src/main/kotlin/com/gotchi/GotchiPlugin.kt` | Added `currentHighScore`; loads high score in `initialize()`; updates high score in `broadcastState()` when pet dies; passes `highScore` to `browserPanel?.postState` |
| `pycharm/src/main/kotlin/com/gotchi/GotchiBrowserPanel.kt` | Updated `postState(state, mealsGivenThisCycle, highScore: HighScore?)` signature; serialises `highScore` into JSON payload |
| `pycharm/src/main/resources/webview/sidebar.html` | Mirrored VS Code changes: Snack badge, dead screen elements, high score section |
| `pycharm/src/main/resources/webview/sidebar.js` | Mirrored VS Code JS changes: Play disable (BUGFIX-010), `renderDeadScreen` high score panel, message handler `highScore` pass-through |
| `pycharm/src/main/resources/webview/sidebar.css` | Mirrored VS Code CSS changes including high score styles |
| `pycharm/src/main/resources/META-INF/gotchi_icon.svg` | New: pixel-art gotchi face icon for light theme (tool window tab + plugin manager) |
| `pycharm/src/main/resources/META-INF/gotchi_icon_dark.svg` | New: same icon inverted for dark theme (auto-loaded by IntelliJ when dark theme is active) |
| `pycharm/src/main/kotlin/com/gotchi/GotchiStatusWidget.kt` | Implemented `getClickConsumer()` — clicking the status bar widget now activates the Gotchi tool window via `ToolWindowManager` |

### New types (v0.1.0)

```ts
// VS Code (gameEngine.ts) / PyCharm (GotchiPersistence.kt)
HighScore {
  ageDays:   number   // game-days the record holder lived
  name:      string   // pet name
  stage:     string   // life stage at death
  petType:   string
  color:     string
  spawnedAt: number   // Unix ms
  diedAt:    number   // Unix ms
}
```

### New PetState fields (v0.1.0)

```ts
recentEventLog:       readonly string[]  // rolling last-20 event log (persistent across ticks)
spawnedAt:            number             // Unix ms timestamp of pet creation
snacksGivenThisCycle: number             // snacks given since last wake; resets on wake()
```

### New constants (v0.1.0)

```ts
SNACK_MAX_PER_CYCLE:    number = 2   // max snacks allowed per wake cycle
RECENT_EVENT_LOG_MAX:   number = 20  // max entries kept in recentEventLog
```

---

## v0.1.0 — (branch `bugfix/small_fixes`)

### Changes from v0.1.0

| File | What changed |
|------|-------------|
| `vscode/src/gameEngine.ts` | `FEED_SNACK_HUNGER_BOOST = 5` added — snacks now also raise hunger by 5; `MEDICINE_HEALTH_BOOST` removed — `giveMedicine()` no longer modifies health (still cures after 3 doses); `PLAY_ENERGY_COST` raised from `10` → `25`; `ENERGY_DECAY_PER_TICK = 1` added — energy drains 1/tick while awake; `HEALTH_REGEN_AWAKE_TICK_INTERVAL = 5` added — health regens 1 HP/tick while sleeping but only 1 HP every 5 ticks while awake |
| `vscode/src/extension.ts` | Status bar click command changed from `workbench.view.extension.gotchi-sidebar` to `gotchiView.focus` so clicking it reliably focuses the panel (BUGFIX-005) |
| `vscode/media/sidebar.js` | Persistent pixel-art poo sprites drawn on canvas floor in `drawSprite()` — up to 3 brown 12×14 px poos spread across the canvas base; disappear when `state.poops` returns to 0 |
| `vscode/tsconfig.json` | Added `"typeRoots": ["./node_modules/@types"]` to prevent root `node_modules/@types/katex` bleed (BUGFIX-006) |
| `vscode/tests/unit/gameEngine.test.ts` | Updated 5 tests to match new engine behaviour: play energy cost (10 → 25), medicine no longer boosts health, sleeping-while-full-energy auto-wake interaction |
| `vscode/src/gameEngine.ts` | Starvation damage now also sets `sick = true` so medicine can cure it (BUGFIX-007) |
| `vscode/package.json` | Version bumped `0.0.3` → `0.0.4` |
| `pycharm/src/main/kotlin/com/gotchi/engine/Constants.kt` | Ported all v0.1.0 constant changes: `FEED_SNACK_HUNGER_BOOST = 5` added; `PLAY_ENERGY_COST` updated `10` → `25`; `MEDICINE_HEALTH_BOOST` removed; `ENERGY_DECAY_PER_TICK = 1` added; `HEALTH_REGEN_AWAKE_TICK_INTERVAL = 5` added |
| `pycharm/src/main/kotlin/com/gotchi/engine/GameEngine.kt` | Ported all v0.1.0 logic changes: energy decay while awake; starvation sets `sick = true` (BUGFIX-007); health regen uses `HEALTH_REGEN_AWAKE_TICK_INTERVAL` interval while awake; `giveMedicine()` no longer adds `MEDICINE_HEALTH_BOOST`; `feedSnack()` now also adds `FEED_SNACK_HUNGER_BOOST` |
| `pycharm/src/main/resources/webview/sidebar.js` | Persistent pixel-art poo sprites ported into `drawSprite()` — mirrors VS Code v0.1.0 change |

### New constants (v0.1.0)

```ts
FEED_SNACK_HUNGER_BOOST: number = 5       // hunger gained per snack
PLAY_ENERGY_COST: number        = 25       // was 10
ENERGY_DECAY_PER_TICK: number   = 1        // passive energy drain while awake
HEALTH_REGEN_AWAKE_TICK_INTERVAL: number = 5  // ticks between awake regen pulses
```

### Removed constants (v0.1.0)

```ts
MEDICINE_HEALTH_BOOST  // medicine no longer changes health directly
```

---

## v0.1.0

### Changes from v0.1.0

| File | What changed |
|------|-------------|
| `vscode/media/sidebar.css` | Health bar uses `width %` instead of `scaleX`; distinct colours `#ff9800` (mid) / `#e53935` (low); `color: var(--vscode-foreground, #cccccc)` fallback for dark mode; `.sprite-container { position: relative }` for poo overlay; `.poo-anim` + `@keyframes poo-float` animation |
| `vscode/media/sidebar.js` | `spawnPooAnim()` — pixel-art turd canvas (6×7 px art, scale ×3, `#6B3A2A` / `#A0522D`); triggered when `"pooped"` in `state.events` |
| `vscode/src/gameEngine.ts` | Fix: advance poop counter during offline decay (`applyOfflineDecay`) |
| `pycharm/` | **New**: full PyCharm/IntelliJ JCEF plugin (Kotlin). Mirrors all VS Code game logic and webview. Includes `GotchiPlugin`, `GotchiBrowserPanel`, `GotchiPersistence`, `GotchiToolWindow`, `GotchiStatusWidget`, `GotchiEventsManager`, `GotchiAppLifecycleListener`, `GameEngine`, `PetState`, `Constants` |
| `pycharm/src/main/kotlin/.../GotchiSettings.kt` | **New**: app service — persists `fontSize` and `textColor` to `gotchi_settings.xml` |
| `pycharm/src/main/kotlin/.../GotchiConfigurable.kt` | **New**: `Settings > Tools > Gotchi` — `JComboBox` (Small/Normal/Large) + `ColorPanel`; calls `reloadWebview()` on Apply |
| `pycharm/src/main/resources/webview/sidebar.css` | Port of all VS Code CSS fixes above + PyCharm-specific dark mode + poo animation |
| `pycharm/src/main/resources/webview/sidebar.js` | Port of all VS Code JS fixes above including `spawnPooAnim()` |

---

## v0.1.0 — (commit `7ee39a6`)

### Changes from v0.1.0

| File | What changed |
|------|-------------|
| `vscode/src/gameEngine.ts` | BUGFIX-003 (auto-wake when energy reaches 100); BUGFIX-004 (passive +1 health regen per tick when not sick); per-pet-type stochastic poop rate (`nextPoopIntervalTicks`, `poopIntervalMultiplier`, `poopIntervalVolatility`, `sampleNextPoopInterval`) |
| `vscode/src/sidebarProvider.ts` | BUGFIX-001 (hot-reload webview HTML on `fontSize` setting change via `onDidChangeConfiguration`); BUGFIX-002 (server-side sleep-blocking guard in `handleWebviewMessage`) |
| `vscode/media/sidebar.js` | BUGFIX-002 (disable care buttons while pet is sleeping); `setHealthBar()` helper for colour-coded health bar |
| `vscode/media/sidebar.css` | BUGFIX-002 (`.action-btn:disabled` style); health bar colour classes (`.health-mid`, `.health-low`) |

### New `PetState` fields (v0.1.0 only)

```ts
nextPoopIntervalTicks: number   // ticks until next dropping (stochastically sampled)
```

### New `PetTypeModifiers` fields (v0.1.0 only)

```ts
poopIntervalMultiplier: number  // scales base poop interval per pet type
poopIntervalVolatility: number  // ± fraction of variance around the mean interval
```

---

## v0.1.0 — baseline (commit `e25ac0e`)

Initial TypeScript rewrite. All game logic ported from the retired Python
subprocess architecture into `gameEngine.ts` as pure functions. VS Code
extension wired up via `extension.ts`, `sidebarProvider.ts`, `statusBar.ts`,
`persistence.ts`, and `events.ts`.

Archive of the four files that changed in v0.1.0 is preserved at:

```text
archive/v0.1.0/vscode/src/gameEngine.ts
archive/v0.1.0/vscode/src/sidebarProvider.ts
archive/v0.1.0/vscode/media/sidebar.js
archive/v0.1.0/vscode/media/sidebar.css
```
