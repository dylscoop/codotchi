# Version History

## v0.5.1 — current (in progress)

### Changes from v0.5.0

| File | What changed |
|------|-------------|
| `vscode/src/gameEngine.ts` | `BABY_DURATION_TICKS` 10 min → 28 min; `CHILD_DURATION_TICKS` 1 hr → 90 min; `TEEN_DURATION_TICKS` 3 hr → 6 hr; added `ADULT_DURATION_TICKS = 16 hr`; `SENIOR_NATURAL_DEATH_AGE_DAYS` 240 → 365; `EVOLUTION_DAY_THRESHOLDS` updated (baby 2.388→5.988, child 14.388→23.988, teen 50.388→95.988) and `adult: 287.988` added; `NEXT_STAGE_MAP` entry `adult: "senior"` added (auto adult→senior promotion) |
| `pycharm/src/main/kotlin/com/gotchi/engine/Constants.kt` | Same threshold, duration, and death-age changes mirrored from TypeScript |
| `vscode/media/sidebar.js` | `GAME_DAYS_PER_YEAR = 365` constant added; `formatAge()` helper added; 4 age display calls updated to use `formatAge()` |
| `pycharm/src/main/resources/webview/sidebar.js` | Same `GAME_DAYS_PER_YEAR`, `formatAge()`, and 4 age display changes mirrored |
| `pycharm/src/main/kotlin/com/gotchi/GotchiToolWindow.kt` | Gear (⚙) button added to tool-window title bar via `setTitleActions`; opens Settings → Tools → Gotchi |
| `pycharm/src/main/resources/META-INF/plugin.xml` | Description updated to mention gear button and settings panel |
| `vscode/tests/unit/gameEngine.test.ts` | Updated `dayTimer` seed values for baby/child/teen/adult progression tests; added adult→senior auto-promotion test; updated `checkOldAgeDeath` age assertions (240→365, 239→364); `SENIOR_NATURAL_DEATH_AGE_DAYS is 365` assertion updated |
| `vscode/package.json` | Version bumped `0.5.0` → `0.5.1` |
| `pycharm/build.gradle.kts` | Version bumped `0.5.0` → `0.5.1` |
| `pycharm/src/main/resources/META-INF/plugin.xml` | Version bumped `0.5.0` → `0.5.1` |
| `vscode/FEATURES.md` | Section 2.1 stage table updated: Duration column changed from real-time to game days; Senior row updated; footnote prose updated |
| `DEV_NOTES.md` | Constants table: `TICKS_PER_GAME_DAY_AWAKE` 600→50, `TICKS_PER_GAME_DAY_SLEEPING` 480→40; `EVOLUTION_DAY_THRESHOLDS` block updated with new values and adult entry; per-stage tables rewritten with game-day milestone column; senior death note updated ≥20→≥365 |
| `README.md` | Install filenames updated to `0.5.1` |
| `vscode/README.md` | Install filenames updated to `0.5.1` |
| `pycharm/README.md` | Install filenames updated to `0.5.1` |

### Updated constants (v0.5.1)

```
BABY_DURATION_TICKS:            28 * TICKS_PER_MINUTE   // was 10 min
CHILD_DURATION_TICKS:           90 * TICKS_PER_MINUTE   // was 1 hr
TEEN_DURATION_TICKS:            6 * TICKS_PER_HOUR       // was 3 hr
ADULT_DURATION_TICKS:           16 * TICKS_PER_HOUR      // new
SENIOR_NATURAL_DEATH_AGE_DAYS:  365                      // was 240
EVOLUTION_DAY_THRESHOLDS.baby:  5.988                    // was 2.388
EVOLUTION_DAY_THRESHOLDS.child: 23.988                   // was 14.388
EVOLUTION_DAY_THRESHOLDS.teen:  95.988                   // was 50.388
EVOLUTION_DAY_THRESHOLDS.adult: 287.988                  // new
GAME_DAYS_PER_YEAR (sidebar.js display): 365             // new
```

---

## v0.4.3 — previous

### Changes from v0.4.2

| File | What changed |
|------|-------------|
| `vscode/src/gameEngine.ts` | BUGFIX-020: poop accumulation and sick-from-poop guards both now require `!isIdle`; removed poop while-loop from `applyOfflineDecay` (no poops when IDE is closed); BUGFIX-021: `feedSnack` split into `startSnack` (button-press phase — increments counters, emits `snack_placed`) and `consumeSnack` (eat phase — applies stat effects, emits `fed_snack`) |
| `vscode/src/sidebarProvider.ts` | Import updated from `feedSnack` → `startSnack, consumeSnack`; `"feed"` snack branch calls `startSnack`; new `"snack_consumed"` command case calls `consumeSnack` |
| `vscode/media/sidebar.js` | Snack floor item spawns on `snack_placed` (was `fed_snack`); pet-reaches-snack collision now also sends `snack_consumed` to host; `"snack_placed": ""` label added to `humaniseEvent`; `appendEvents` skips entries with empty labels |
| `vscode/tests/unit/gameEngine.test.ts` | `feedSnack` import replaced with `startSnack` + `consumeSnack`; `describe("feedSnack")` replaced with `describe("startSnack")` + `describe("consumeSnack")`; integration test updated to two-step snack model |
| `pycharm/src/main/kotlin/com/gotchi/engine/GameEngine.kt` | BUGFIX-020: same two poop/idle guards as TypeScript; BUGFIX-021: `feedSnack` split into `startSnack` + `consumeSnack` (mirroring TS exactly) |
| `pycharm/src/main/kotlin/com/gotchi/GotchiPlugin.kt` | `"feed"` snack branch calls `startSnack`; new `"snack_consumed"` case calls `consumeSnack` |
| `pycharm/src/main/resources/webview/sidebar.js` | Same four changes as VS Code sidebar.js |
| `vscode/package.json` | Version bumped `0.4.2` → `0.4.3` |
| `pycharm/build.gradle.kts` | Version bumped `0.4.2` → `0.4.3` |
| `pycharm/src/main/resources/META-INF/plugin.xml` | Version bumped `0.4.2` → `0.4.3` |
| `BUGFIXES.md` | Added BUGFIX-020 and BUGFIX-021 |
| `README.md` | Install filenames updated to `0.4.3` |
| `vscode/README.md` | Install filenames updated to `0.4.3` |
| `pycharm/README.md` | Install filenames updated to `0.4.3` |
| `pycharm/src/main/kotlin/com/gotchi/engine/GameEngine.kt` | BUGFIX-022 (part 1): replaced 9 Elvis-operator occurrences for `activeAttentionCall` with explicit null-checks so `null` (the clear-call intent) is no longer swallowed by `?:` |
| `pycharm/src/main/kotlin/com/gotchi/GotchiPlugin.kt` | BUGFIX-022 (part 2): added `ReentrantLock` (`stateLock`) guarding all reads/writes of `currentState`/`currentHighScore`/`mealsGivenThisCycle`; `onTick`, `handleCommand`, `triggerCodeActivity` hold the lock while updating state; `broadcastState` snapshots under the lock to eliminate tick/command race |
| `BUGFIXES.md` | Added BUGFIX-022 |

---

## v0.4.2 — previous

### Changes from v0.4.0

| File | What changed |
|------|-------------|
| `vscode/src/gameEngine.ts` | BUGFIX-017: `low_energy` expiry penalty changed from `energy −10` to `happiness −10`; BUGFIX-018: `critical_health` expiry now also penalises `happiness −10`; `ATTENTION_CALL_RESPONSE_TICKS` reduced 50 → 20 (5 min → 2 min); `tick()` 4th param `attentionCallsEnabled` added; two-guard structure: Step 0 counters and Steps 1–3 each wrapped in `if (attentionCallsEnabled)`, stat decay outside both guards |
| `vscode/src/extension.ts` | Removed static `IDLE_THRESHOLD_MS`/`IDLE_DEEP_THRESHOLD_MS` module-level constants and `IDLE_THRESHOLD_SECONDS`/`IDLE_DEEP_THRESHOLD_SECONDS` imports; idle thresholds now read dynamically from `gotchi.idleThresholdSeconds` / `gotchi.idleDeepThresholdSeconds` settings on every tick; `enableAttentionCalls` read from settings and passed to `tick()` |
| `vscode/package.json` | Added `gotchi.enableAttentionCalls` (boolean, default `true`), `gotchi.idleThresholdSeconds` (integer, default 60, min 10), `gotchi.idleDeepThresholdSeconds` (integer, default 600, min 30) settings |
| `pycharm/src/main/kotlin/com/gotchi/engine/GameEngine.kt` | BUGFIX-017 and BUGFIX-018 penalties mirrored; `ATTENTION_CALL_RESPONSE_TICKS` 50 → 20; `tick()` `attentionCallsEnabled` param added; same two-guard structure as TypeScript |
| `pycharm/src/main/kotlin/com/gotchi/engine/Constants.kt` | `ATTENTION_CALL_RESPONSE_TICKS` reduced 50 → 20; comment updated to "20 × 6 s = 2 min" |
| `pycharm/src/main/kotlin/com/gotchi/GotchiSettings.kt` | Renamed `enableAttentionNotifications` → `enableAttentionCalls`; added `idleThresholdSeconds: Int = 60` and `idleDeepThresholdSeconds: Int = 600` to `State` and as top-level delegated properties |
| `pycharm/src/main/kotlin/com/gotchi/GotchiPlugin.kt` | `isIdle()` and `isDeepIdle()` now read from `GotchiSettings` instead of hardcoded constants; `onTick()` reads `enableAttentionCalls` and passes to `tick()`; `broadcastState()` attention notification block guarded with `enableAttentionCalls` |
| `pycharm/src/main/kotlin/com/gotchi/GotchiConfigurable.kt` | Added `JCheckBox` for `enableAttentionCalls`; `JSpinner` (min 10, step 10, max 3600) for `idleThresholdSeconds`; `JSpinner` (min 30, step 30, max 7200) for `idleDeepThresholdSeconds`; wired into `isModified()`, `apply()`, `reset()` |
| `vscode/FEATURES.md` | `low_energy` expiry penalty updated; `critical_health` expiry updated; `ATTENTION_CALL_RESPONSE_TICKS` note updated 50 → 20; response window prose updated 5-min → 2-min; settings table updated: `enableAttentionNotifications` replaced by `enableAttentionCalls`; `idleThresholdSeconds` and `idleDeepThresholdSeconds` rows added |
| `BUGFIXES.md` | Added BUGFIX-017 and BUGFIX-018 |
| `README.md` | Install filenames updated to `0.4.1` |
| `vscode/README.md` | Install filenames updated to `0.4.1` |
| `pycharm/README.md` | Install filenames updated to `0.4.1` |

### Updated constants (v0.4.1)

```
ATTENTION_CALL_RESPONSE_TICKS: Int = 20   // was 50 (5 min), now 2 min (20 × 6 s)
```

---

## v0.4.0

### Changes from v0.3.2

| File | What changed |
|------|-------------|
| `vscode/src/gameEngine.ts` | Added `AttentionCallType`, 16 new constants, 7 new `PetState` fields; full attention-call tick logic (Steps 0–3), `logChance()` helper; all 8 actions updated with response detection |
| `vscode/src/extension.ts` | Fires `showWarningMessage` for each `attention_call_*` event; "Open Gotchi" button focuses the sidebar |
| `vscode/media/sidebar.js` | 24 new `humaniseEvent()` entries (8× fired, 8× answered, 8× expired) |
| `pycharm/src/main/kotlin/com/gotchi/engine/Constants.kt` | 16 new attention-call constants added |
| `pycharm/src/main/kotlin/com/gotchi/engine/PetState.kt` | 7 new attention-call fields added after `snacksGivenThisCycle` |
| `pycharm/src/main/kotlin/com/gotchi/engine/GameEngine.kt` | Full attention-call logic mirrored from TypeScript; `logChance()` helper, `AnsweredCall` data class, `answerAttentionCall()` helper, all 8 actions updated |
| `pycharm/src/main/kotlin/com/gotchi/GotchiPlugin.kt` | Fires `Notifications.Bus` balloon for each `attention_call_*` event; "Open Gotchi" action focuses Gotchi tool window |
| `pycharm/src/main/kotlin/com/gotchi/GotchiPersistence.kt` | `RawPetState` extended with 7 new nullable fields; `sanitise()` defaults added; `toRaw()` updated |
| `pycharm/src/main/resources/webview/sidebar.js` | 24 new `humaniseEvent()` entries (mirrored from VS Code) |
| `pycharm/src/main/resources/META-INF/plugin.xml` | `notificationGroup` registered for "Gotchi Attention Calls"; version `0.3.2` → `0.4.0` |
| `vscode/package.json` | Version `0.3.2` → `0.4.0` |
| `pycharm/build.gradle.kts` | Version `0.3.2` → `0.4.0` |
| `vscode/FEATURES.md` | Section 3.1 attention-call rows updated to `[x]`; thresholds and response table added |
| `README.md` | Install filenames updated to `0.4.0` |
| `vscode/README.md` | Install filenames updated to `0.4.0` |
| `pycharm/README.md` | Install filenames updated to `0.4.0` |

### New constants (v0.4.0)

```
ATTENTION_CALL_RESPONSE_TICKS:      number/Int = 50     // 5 active min (50 × 6 s)
ATTENTION_HUNGER_THRESHOLD:         number/Int = 25
ATTENTION_UNHAPPINESS_THRESHOLD:    number/Int = 40
ATTENTION_ENERGY_THRESHOLD:         number/Int = 20
ATTENTION_HEALTH_THRESHOLD:         number/Int = 50
ATTENTION_ANSWER_COOLDOWN_TICKS:    number/Int = 50     // 5 min cooldown after answered
ATTENTION_EXPIRY_COOLDOWN_TICKS:    number/Int = 20     // 2 min cooldown after expired
ATTENTION_EXPIRY_STAT_PENALTY:      number/Int = 10
GIFT_PRAISE_HAPPINESS_BOOST:        number/Int = 15
NEGLECT_DECAY_TICK_INTERVAL:        number/Int = 300    // neglectCount -1 every 30 min
POOP_CALL_BASE_CHANCE:              number/float = 0.03
POOP_CALL_MAX_CHANCE:               number/float = 0.12
MISBEHAVIOUR_BASE_CHANCE:           number/float = 0.005
MISBEHAVIOUR_MAX_CHANCE:            number/float = 0.08
GIFT_BASE_CHANCE:                   number/float = 0.002
GIFT_MAX_CHANCE:                    number/float = 0.05
```

### New PetState fields (v0.4.0)

```
activeAttentionCall:        string | null       // currently firing call type, or null
attentionCallActiveTicks:   number/Int          // active (non-idle) ticks since call fired
attentionCallCooldowns:     Map<string, Int>    // per-type ticks remaining on cooldown
neglectCount:               number/Int          // cumulative unanswered calls
ticksWithUncleanedPoop:     number/Int          // ticks poop has sat uncleaned
ticksSinceLastMisbehaviour: number/Int          // ticks since last misbehaviour call
ticksSinceLastGift:         number/Int          // ticks since last gift call
```

---

## v0.3.2

### Changes from v0.3.1

| File | What changed |
|------|-------------|
| `vscode/media/sidebar.html` | Removed Weight `stat-row` from stats panel |
| `pycharm/src/main/resources/webview/sidebar.html` | Mirrored: removed Weight `stat-row` |
| `vscode/media/sidebar.css` | Removed `.bar-fill.weight` rule |
| `pycharm/src/main/resources/webview/sidebar.css` | Mirrored: removed weight bar colour rule |
| `vscode/media/sidebar.js` | Removed `barWeight` ref and `setBar(barWeight, ...)` call |
| `pycharm/src/main/resources/webview/sidebar.js` | Mirrored: removed `barWeight` ref and `setBar` call |
| `vscode/src/statusBar.ts` | Added `Weight: N` to status bar tooltip (visible on hover) |
| `pycharm/src/main/kotlin/com/gotchi/GotchiStatusWidget.kt` | Mirrored: added `weight: N` to tooltip string |
| `vscode/package.json` | Version `0.3.1` → `0.3.2` |
| `pycharm/build.gradle.kts` | Version `0.3.1` → `0.3.2` |
| `pycharm/src/main/resources/META-INF/plugin.xml` | Version `0.3.1` → `0.3.2` |
| `README.md` | Install filenames updated to `0.3.2` |
| `vscode/README.md` | Install filenames updated to `0.3.2` |
| `pycharm/README.md` | Install filenames updated to `0.3.2` |

---

## v0.3.1

### Changes from v0.3.0

| File | What changed |
|------|-------------|
| `vscode/media/sidebar.js` | Removed `Wt: N` from info line — weight is now a hidden mechanic; `moodText()` now shows `Zzz… (feeling sick)` when both sleeping and sick simultaneously; added Weight stat bar (purple) to stats panel; `barWeight` ref wired up |
| `pycharm/src/main/resources/webview/sidebar.js` | Mirrored: removed `Wt: N`; combined sleeping+sick mood label; added Weight stat bar |
| `vscode/media/sidebar.html` | Added Weight `stat-row` after Health |
| `pycharm/src/main/resources/webview/sidebar.html` | Mirrored: added Weight `stat-row` |
| `vscode/media/sidebar.css` | Added `.bar-fill.weight { background: #a78bfa }` |
| `pycharm/src/main/resources/webview/sidebar.css` | Mirrored: added weight bar colour |
| `vscode/src/gameEngine.ts` | Initial weight `5` → `40`; `FEED_MEAL_WEIGHT_GAIN` `1` → `2`; `FEED_SNACK_WEIGHT_GAIN` `2` → `5`; added `POOP_WEIGHT_LOSS=5`; poop event now calls `clampWeight(weight - POOP_WEIGHT_LOSS)` and `checkWeightTierEvents` |
| `pycharm/src/main/kotlin/com/gotchi/engine/GameEngine.kt` | Mirrored: initial weight `5` → `40`; poop weight loss logic |
| `pycharm/src/main/kotlin/com/gotchi/engine/Constants.kt` | `FEED_MEAL_WEIGHT_GAIN` `1` → `2`; `FEED_SNACK_WEIGHT_GAIN` `2` → `5`; added `POOP_WEIGHT_LOSS=5` |
| `vscode/package.json` | Version `0.3.0` → `0.3.1` |
| `pycharm/build.gradle.kts` | Version `0.3.0` → `0.3.1` |
| `pycharm/src/main/resources/META-INF/plugin.xml` | Version `0.3.0` → `0.3.1` |
| `README.md` | Install filenames updated to `0.3.1` |
| `vscode/README.md` | Install filenames updated to `0.3.1` |
| `pycharm/README.md` | Install filenames updated to `0.3.1` |

---

## v0.3.0

### Changes from v0.2.2

| File | What changed |
|------|-------------|
| `vscode/src/gameEngine.ts` | Added weight system: `PLAY_WEIGHT_LOSS=3`, `WEIGHT_DECAY_TICK_INTERVAL`, `WEIGHT_HAPPINESS_HIGH_THRESHOLD=66`, `WEIGHT_HAPPINESS_LOW_THRESHOLD=17`, `WEIGHT_HAPPINESS_DEBUFF_MULTIPLIER=1.5`, `WEIGHT_SLIGHTLY_FAT_THRESHOLD=50`, `WEIGHT_OVERWEIGHT_THRESHOLD=80`; `weightTierOf()` and `checkWeightTierEvents()` helpers; `tick()` applies weight-based happiness multiplier and passive weight decay; `feedMeal()`, `feedSnack()`, `play()` call `checkWeightTierEvents`; play now loses 3 weight (was 1) |
| `vscode/media/sidebar.js` | Info line now shows `Wt: N`; added `STAGE_BODY_HEIGHT_MULTS` lookup table; added `weightWidthMultiplier()` helper; `animationLoop()` and `resizeCanvas()` use weight-scaled `bWidth` for `maxX`; `drawSprite()` rewritten with per-stage shapes (egg=ellipse, baby=oversized eyes, child=normal, teen/adult/senior=head+torso+shoulder bumps); added 5 weight event strings to `humaniseEvent()` |
| `pycharm/src/main/kotlin/com/gotchi/engine/Constants.kt` | Mirrored all weight system constants from `gameEngine.ts` |
| `pycharm/src/main/kotlin/com/gotchi/engine/GameEngine.kt` | Mirrored all weight system logic from `gameEngine.ts` |
| `pycharm/src/main/resources/webview/sidebar.js` | Mirrored all `sidebar.js` changes: info line weight, `STAGE_BODY_HEIGHT_MULTS`, `weightWidthMultiplier()`, `animationLoop`/`resizeCanvas` `maxX` fix, `drawSprite()` rewrite, 5 weight event strings in `humaniseEvent()` |
| `vscode/package.json` | Version `0.2.2` → `0.3.0` |
| `pycharm/build.gradle.kts` | Version `0.2.2` → `0.3.0` |
| `pycharm/src/main/resources/META-INF/plugin.xml` | Version `0.2.2` → `0.3.0` |
| `vscode/FEATURES.md` | Section 6.1 weight rows updated to `[x]`; play weight-loss note updated to −3 |
| `DEV_NOTES.md` | Sprite Rendering Notes updated for weight system and per-stage shapes; weight event strings documented |
| `README.md` | Version reference and install filenames updated to `0.3.0` |
| `vscode/README.md` | Install filenames updated to `0.3.0` |
| `pycharm/README.md` | Install filenames updated to `0.3.0` |

### New constants (v0.3.0)

```
PLAY_WEIGHT_LOSS:                    number/Int = 3      // weight lost per play (was 1)
WEIGHT_DECAY_TICK_INTERVAL:          number/Int = 10     // passive -1 weight every 10 ticks (1/min)
WEIGHT_HAPPINESS_HIGH_THRESHOLD:     number/Int = 66     // >66 weight → happiness decays 1.5× faster
WEIGHT_HAPPINESS_LOW_THRESHOLD:      number/Int = 17     // <17 weight → happiness decays 1.5× faster
WEIGHT_HAPPINESS_DEBUFF_MULTIPLIER:  number/float = 1.5  // multiplier applied to happiness decay rate
WEIGHT_SLIGHTLY_FAT_THRESHOLD:       number/Int = 50     // >50 → sprite 1.25× wider
WEIGHT_OVERWEIGHT_THRESHOLD:         number/Int = 80     // >80 → sprite 1.5× wider; event fires
```

---

## v0.2.2

### Changes from v0.2.1

| File | What changed |
|------|-------------|
| `vscode/src/extension.ts` | BUGFIX-015: moved `markActivity` definition above `SidebarProvider` construction; passed as 6th constructor argument |
| `vscode/src/sidebarProvider.ts` | BUGFIX-015: added `markActivity: () => void` constructor param; called at top of `handleWebviewMessage`; added `"user_activity"` case that resets idle and returns without state change |
| `vscode/media/sidebar.js` | BUGFIX-015: added throttled `mousemove` listener (at most once per 30 s) posting `{ command: "user_activity" }` to host |
| `pycharm/src/main/kotlin/com/gotchi/GotchiPlugin.kt` | BUGFIX-015: `lastActivityTime` reset at top of `handleCommand`; added `"user_activity"` case that returns without state change |
| `pycharm/src/main/resources/webview/sidebar.js` | BUGFIX-015: same throttled `mousemove` listener as VS Code, using `window.__vscodeSendMessage` |
| `vscode/package.json` | Version `0.2.1` → `0.2.2` |
| `pycharm/build.gradle.kts` | Version `0.2.1` → `0.2.2` |
| `pycharm/gradle.properties` | `pluginVersion` `0.2.1` → `0.2.2` |
| `pycharm/src/main/resources/META-INF/plugin.xml` | Version `0.2.1` → `0.2.2` |
| `vscode/FEATURES.md` | Section 8.1 updated: sidebar interactions now listed as idle-reset sources |
| `DEV_NOTES.md` | Message Protocol table: added `user_activity` command row; added "Idle State Transitions" section documenting what resets the idle clock in each IDE and what triggers wake from sleep |
| `BUGFIXES.md` | Added BUGFIX-015 |
| `README.md` | Version reference and install filenames updated to `0.2.2` |
| `vscode/README.md` | Install filenames updated to `0.2.2` |
| `pycharm/README.md` | Install filenames updated to `0.2.2` |

---

## v0.2.1

### Changes from v0.2.0

| File | What changed |
|------|-------------|
| `vscode/src/gameEngine.ts` | BUGFIX-014: moved `energy` decay inside `decayThisTick` guard so energy is throttled during idle like hunger/happiness; added `EXHAUSTION_HEALTH_DAMAGE_PER_TICK = 2`; added `SLEEP_DECAY_TICK_INTERVAL = 5`; exhaustion damage block: when `energy === 0 && !sleeping` health loses 2/tick and `"exhaustion_damage"` event fires; sleep decay block: on every 5th sleeping tick hunger and happiness each lose 1 |
| `pycharm/src/main/kotlin/com/gotchi/engine/GameEngine.kt` | Mirrored all three changes from `gameEngine.ts` above |
| `pycharm/src/main/kotlin/com/gotchi/engine/Constants.kt` | Added `EXHAUSTION_HEALTH_DAMAGE_PER_TICK = 2` and `SLEEP_DECAY_TICK_INTERVAL = 5` |
| `vscode/media/sidebar.js` | Added `"exhaustion_damage"` label to `humaniseEvent()` |
| `pycharm/src/main/resources/webview/sidebar.js` | Added `"exhaustion_damage"` label to `humaniseEvent()` |
| `vscode/tests/unit/gameEngine.test.ts` | Renamed sleeping decay test to "not a 5th-tick" variant; added "every 5th sleeping tick" test; added "tick — energy exhaustion health damage" suite (3 tests); added 2 idle energy throttle tests |
| `vscode/package.json` | Version `0.2.0` → `0.2.1` |
| `pycharm/build.gradle.kts` | Version `0.2.0` → `0.2.1` |
| `pycharm/gradle.properties` | `pluginVersion` `0.2.0` → `0.2.1` |
| `pycharm/src/main/resources/META-INF/plugin.xml` | Version `0.2.0` → `0.2.1` |
| `vscode/FEATURES.md` | Section 8.1 updated: energy throttle noted; section 9 updated: exhaustion damage and sleep decay rows added |
| `DEV_NOTES.md` | Stat Decay Rates: idle decay note updated for energy; sleep decay and exhaustion damage subsections added |
| `BUGFIXES.md` | Added BUGFIX-014: energy decay not throttled during idle |
| `README.md` | Version reference and install filenames updated to `0.2.1` |

### New constants (v0.2.1)

```
EXHAUSTION_HEALTH_DAMAGE_PER_TICK: number/Int = 2   // health lost per tick when energy is 0 and awake
SLEEP_DECAY_TICK_INTERVAL: number/Int = 5            // every Nth sleeping tick hunger/happiness decay by 1
```

---

## v0.2.0

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
