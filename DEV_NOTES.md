# Developer Notes

Internal notes covering design philosophy, the evolution system, character
identities, and sprite descriptions. Not intended as user-facing documentation.

---

## Interaction Philosophy

The core tension in vscode_gotchi is **low friction vs meaningful consequence**.
A developer is in the middle of work — the pet must never demand attention in a
way that interrupts flow, but neglect should have real consequences.

### Principles

1. **Passive first.** The most important interaction is the one the player does
   not have to perform: the pet reacts positively to code being saved. The
   player gets care credit just by working. The pet degrades slowly enough that
   a focused hour of coding more than covers the decay.

2. **No modal interruptions.** No popups, no blocking dialogs. All feedback is
   in the sidebar and the status bar. The player can ignore both indefinitely
   without VS Code breaking.

3. **Punishment is delayed, not instant.** Hunger hits zero → three-tick grace
   period before health starts draining. Droppings accumulate → three before
   sickness. This means a five-minute meeting won't kill a pet.

4. **Recovery is always possible.** Death is rare and requires sustained
   neglect across multiple vectors. Any single bad stat can be rescued.
   BUGFIX-004 makes this explicit: health passively regenerates when the pet
   is not sick, so a pet that was starving but has been fed will eventually
   return to full health without further player action.

5. **Sleep is the reset.** The sleep/wake cycle is the primary rhythm. Putting
   the pet to sleep clears the meal counter, lets energy recover, and (via
   BUGFIX-003) auto-wakes the pet when ready. The player does not need to
   babysit the wake-up.

6. **Discipline is a long-term lever.** Scold and Praise both raise discipline.
   Discipline feeds directly into the care score (20% weight) and therefore
   into which character the pet evolves into. A player who never disciplines
   will consistently get the "low" tier character regardless of how well they
   feed and play.

---

## Evolution System

Evolution is **data-driven**. The logic in `gameEngine.ts` does not know what
any character looks like — it only knows petType × stage × tier → characterName.
Adding a new pet type is purely additive: extend `EVOLUTION_CHARACTERS` and
`PET_TYPE_MODIFIERS`, no logic changes.

### How dayTimer drives aging

`dayTimer` is a floating-point accumulator stored in `PetState`. It advances
every tick by:

```
dayTimer += agingMultiplier / TICKS_PER_GAME_DAY_AWAKE    (awake)
dayTimer += agingMultiplier / TICKS_PER_GAME_DAY_SLEEPING  (sleeping)
```

Key constants:

| Constant | Value | Notes |
|----------|-------|-------|
| `TICK_INTERVAL_SECONDS` | 6 s | Wall-clock time per tick |
| `TICKS_PER_MINUTE` | 10 | |
| `TICKS_PER_GAME_DAY_AWAKE` | 50 ticks | 5 min awake = 1 game day (codeling 1×) |
| `TICKS_PER_GAME_DAY_SLEEPING` | 40 ticks | ~4 min asleep = 1 game day (~25% faster) |

`ageDays` is derived as `Math.floor(dayTimer)` on every tick — it is **not**
manual and does not require sleep/wake events to advance.

Evolution is triggered in `checkStageProgression()` whenever
`dayTimer >= EVOLUTION_DAY_THRESHOLDS[stage]`. The threshold is **cumulative**
from birth, not relative to the start of the current stage.

---

### EVOLUTION_DAY_THRESHOLDS (cumulative from birth)

```ts
egg:   0.396    // hatch         (~2 min awake for codeling 1×)
baby:  5.988    // grow to child (~30 min awake)
child: 23.988   // grow to teen  (~2 hr awake)
teen:  95.988   // grow to adult (~8 hr awake)
adult: 287.988  // grow to senior (~24 hr awake)
```

Adult → Senior promotion is **automatic**: once `dayTimer >= 287.988` the
`checkStageProgression()` function transitions adult to senior via
`NEXT_STAGE_MAP` (same path as all other stage transitions). The legacy
`promoteToSenior()` function still exists as a fallback but is no longer the
primary trigger. Senior dies naturally once `ageDays >= 365` (1 in-game year)
and health reaches 0.

---

### Per-stage durations (awake time only)

Each stage lasts for the *difference* between consecutive thresholds, measured
in game days. The real-world clock time depends on `agingMultiplier`:

**Formula:** `real_minutes = (threshold_end − threshold_start) × 5 / agingMultiplier`
(since 1 game day = 5 min awake for codeling 1×)

#### All types — game-day milestones (identical for every pet type)

| Stage  | dayTimer span          | Duration (game days) | Evolves at age |
|--------|------------------------|----------------------|----------------|
| Egg    | 0 → 0.396              | ~0d                  | ~0d            |
| Baby   | 0.396 → 5.988          | ~6d                  | ~6d            |
| Child  | 5.988 → 23.988         | ~18d                 | ~24d           |
| Teen   | 23.988 → 95.988        | ~72d                 | ~96d           |
| Adult  | 95.988 → 287.988       | ~192d                | ~288d          |
| Senior | 287.988 → ∞            | Indefinite           | Natural death ≥ 365d |

#### Codeling (agingMultiplier = 1.0×)

| Stage  | Awake time (real) |
|--------|------------------|
| Egg    | ~2 min           |
| Baby   | ~28 min          |
| Child  | ~90 min (~1.5 hr) |
| Teen   | ~360 min (6 hr)  |
| Adult  | ~960 min (16 hr) |

#### Bytebug (agingMultiplier = 1.5×, fastest)

| Stage  | Awake time (real) |
|--------|------------------|
| Egg    | ~1.3 min         |
| Baby   | ~18.7 min        |
| Child  | ~60 min (1 hr)   |
| Teen   | ~240 min (4 hr)  |
| Adult  | ~640 min (~10.7 hr) |

#### Pixelpup (agingMultiplier = 1.25×)

| Stage  | Awake time (real) |
|--------|------------------|
| Egg    | ~1.6 min         |
| Baby   | ~22.4 min        |
| Child  | ~72 min (1.2 hr) |
| Teen   | ~288 min (4.8 hr) |
| Adult  | ~768 min (~12.8 hr) |

#### Shellscript (agingMultiplier = 0.75×, slowest)

| Stage  | Awake time (real) |
|--------|------------------|
| Egg    | ~2.7 min         |
| Baby   | ~37.3 min        |
| Child  | ~120 min (2 hr)  |
| Teen   | ~480 min (8 hr)  |
| Adult  | ~1280 min (~21.3 hr) |

---

### agingMultiplier summary

| Type | Multiplier | Effect on all stage durations |
|------|-----------|------------------------------|
| codeling | 1.0 | Baseline |
| bytebug | 1.5 | Reaches adult in ~2/3 the time of codeling |
| pixelpup | 1.25 | Reaches adult in ~80% the time of codeling |
| shellscript | 0.75 | Reaches adult in ~133% the time of codeling |

The multiplier applies equally to offline decay (`applyOfflineDecay`) so a
bytebug that was closed for an hour ages as much offline as it would have awake.

---

### Care Score Tiers

The care score is a rolling weighted average of hunger, happiness, discipline,
cleanliness, and health. It is computed fresh from accumulators on each
`withDerivedFields()` call.

| Tier | Threshold | Character suffix |
|------|-----------|-----------------|
| best | ≥ 0.80    | `_a`            |
| mid  | ≥ 0.55    | `_b`            |
| low  | < 0.55    | `_c`            |

Accumulators (`careScoreHungerSum`, `careScoreHappinessSum`,
`careScoreHealthSum`, `careScoreTicks`) reset at each stage transition so the
score reflects care quality *within* the current stage, not lifetime averages.

---

## Stat Decay Rates

All decay occurs in `tick()`. Rates below assume the pet is **awake**.

### Active decay (normal coding activity within the last 5 minutes)

| Stat      | Per-tick loss | Per-minute | Full bar (100 pts) lasts |
|-----------|--------------|------------|--------------------------|
| Hunger    | 1 pt / tick  | 10 pts/min | ~10 min                  |
| Happiness | 1 pt / tick  | 10 pts/min | ~10 min                  |
| Energy    | 1 pt / tick  | 10 pts/min | ~10 min (then sleeps)    |

Per-type hunger multipliers: bytebug **1.5×** (6.7 min), shellscript **0.8×** (~12.5 min).  
Per-type happiness multipliers: pixelpup **1.5×** (6.7 min).

### Idle decay (no IDE activity for ≥ 1 minute)

Hunger, happiness, and **energy** are all skipped on 9 out of every 10 ticks
(`ticksAlive % IDLE_DECAY_TICK_DIVISOR != 0`). Aging is also slowed.
A `"went_idle"` event is pushed once on the tick when the IDE transitions from
active to idle, showing "IDE idle — decay and aging slowed." in the event log.

| Stat      | Effective rate | Full bar lasts |
|-----------|---------------|----------------|
| Hunger    | 1 pt/min      | ~100 min       |
| Happiness | 1 pt/min      | ~100 min       |
| Energy    | 1 pt/min      | ~100 min       |
| Aging     | 1/10 normal   | 10× longer     |

### Deep idle (no IDE activity for ≥ 10 minutes)

When the IDE has been idle for ≥ **10 minutes** (`IDLE_DEEP_THRESHOLD_SECONDS = 600`),
the engine enters deep-idle mode. A `"went_deep_idle"` event fires once on
transition, showing "IDE idle 10 min — stats protected, aging stopped." in the
event log.

In deep-idle mode:
- Hunger and happiness are **floored at `IDLE_STAT_FLOOR = 20`** — they cannot
  decay below 20, so the pet is protected from starvation/misery while you step
  away for an extended period.
- `ageIncrement` is set to **0** — aging stops completely.

### Offline decay (IDE fully closed)

Applied as a single lump sum on the next launch via `applyOfflineDecay()`.
Capped at **`OFFLINE_DECAY_MAX_FRACTION = 0.60`** of the current value —
regardless of how long the IDE was closed, no stat can lose more than 60%.

**Aging does not advance while the IDE is closed.** `applyOfflineDecay()`
preserves `dayTimer` and `ageDays` exactly as saved. Only hunger, happiness,
energy, and health are subject to offline decay.

### Sleep decay

While sleeping, hunger and happiness each lose **1 point every 5th sleeping
tick** (`ticksAlive % SLEEP_DECAY_TICK_INTERVAL === 0`). This prevents the pet
from entering sleep with low stats and exiting with perfectly preserved hunger
and happiness. The decay is intentionally slow (≈ 2 pts/min) so a brief nap
costs very little but an indefinitely sleeping pet will eventually reach
critical stats.

The check is guarded by `sleeping` being `true` at the time it fires — if the
pet auto-wakes on this same tick the check is skipped, preventing a spurious
decay on the wake tick.

### Exhaustion damage

When `energy === 0` and the pet is **not** sleeping, health loses
`EXHAUSTION_HEALTH_DAMAGE_PER_TICK = 2` HP per tick and the
`"exhaustion_damage"` event fires. This is slower than starvation or
unhappiness critical damage (both 5 HP/tick) to give the player a wider
recovery window: putting the pet to sleep stops the drain immediately.

---

## Idle State Transitions

There are two distinct "wake" concepts: exiting **IDE idle** (returning to
active decay) and waking from **sleep** (ending the sleep/energy-regen cycle).

---

### Exiting IDE idle (returning to active)

The idle clock is a wall-clock timestamp (`lastActivityMs` in VS Code,
`lastActivityTime` in PyCharm). Any event that resets that timestamp will
cause the next tick to see `idleMs < IDLE_THRESHOLD_MS` and resume full-rate
decay. There is no named event emitted on exit — the transition is silent.

#### VS Code — what resets the idle clock

All four hooks are registered in `extension.ts:125-130` and call `markActivity()`:

| Trigger | VS Code API hook |
|---------|-----------------|
| Keystroke / cursor movement | `onDidChangeTextEditorSelection` |
| Typing / editing text | `onDidChangeTextDocument` |
| IDE window regains focus | `onDidChangeWindowState` (only when `e.focused === true`) |
| Switching to a different editor tab | `onDidChangeActiveTextEditor` |
| Any sidebar button click or interaction | `SidebarProvider.handleWebviewMessage` (`sidebarProvider.ts:164`) — `markActivity()` is called on every incoming message before dispatch, including the no-op `"user_activity"` command sent by the throttled mouse-move listener in the webview |

> **Note:** The VS Code API exposes no mouse-movement hook outside the editor
> area, so mouse movement inside the webview panel is handled by the webview
> itself posting a `"user_activity"` message (see `vscode/media/sidebar.js`,
> throttled to once per 30 s).

#### PyCharm — what resets the idle clock

A single AWT event listener (`awtActivityListener`, `GotchiPlugin.kt:41-43`)
is registered in `initialize()` at `GotchiPlugin.kt:60-63` and sets
`lastActivityTime = System.currentTimeMillis()` on every matching event:

| Trigger | AWT mask |
|---------|----------|
| Any key press/release | `AWTEvent.KEY_EVENT_MASK` |
| Any mouse click | `AWTEvent.MOUSE_EVENT_MASK` |
| Any mouse movement | `AWTEvent.MOUSE_MOTION_EVENT_MASK` |
| Any sidebar command | `handleCommand()` `GotchiPlugin.kt:114` — `lastActivityTime` reset unconditionally on every incoming webview message |

> **Key difference from VS Code:** PyCharm's AWT listener fires on native
> mouse-movement events at the OS level, so mouse movement anywhere in the IDE
> window resets the idle clock without the webview needing to post a message.
> The webview `"user_activity"` message is still sent (for consistency) but is
> redundant in PyCharm.

---

### Waking from sleep

| Mechanism | Trigger | Event name | Where |
|-----------|---------|-----------|-------|
| Auto-wake | `energy >= STAT_MAX (100)` on any tick | `"auto_woke_up"` | `gameEngine.ts:726-729` / `GameEngine.kt:194-197` |
| Manual wake | User clicks "Wake" button → `"wake"` command | `"woke_up"` | `sidebarProvider.ts:223-228` / `GotchiPlugin.kt:158-161` |

On auto-wake, `snacksGivenThisCycle` is reset to 0. On manual wake it is not.
`mealsGivenThisCycle` is reset when the pet *falls* asleep, not on wake.

---

## Poop Rate System

Each pet type has its own average poop interval and volatility, both encoded
in `PetTypeModifiers` inside `gameEngine.ts` (TypeScript) and `Constants.kt`
(Kotlin).

### How it works

```text
base = POOP_TICKS_INTERVAL × poopIntervalMultiplier   // average ticks
jitter = base × poopIntervalVolatility                 // half-width of spread
next = uniform(base − jitter, base + jitter)           // sampled fresh each time
next = clamp(next, 1, POOP_TICKS_INTERVAL)             // hard cap at 20 min
```

`POOP_TICKS_INTERVAL` is the absolute ceiling (20 min at the default 6s tick
rate). `nextPoopIntervalTicks` is stored in `PetState` so it is:

- Stable between ticks (not re-rolled every 6 s)
- Persisted across restarts (serialised with the rest of `PetState`)
- Resampled fresh each time the pet actually poops

Old save files that lack `nextPoopIntervalTicks` fall back to a fresh sample
at load time (see `deserialiseState`).

### Per-type summary

| Type        | Avg interval | Volatility | Min possible | Max possible |
|-------------|-------------|------------|-------------|-------------|
| codeling    | ~15 min     | ±50%       | ~7.5 min    | 20 min (cap) |
| bytebug     | ~8 min      | ±80%       | ~1.5 min    | ~14.5 min   |
| pixelpup    | ~12 min     | ±70%       | ~3.5 min    | 20 min (cap) |
| shellscript | ~20 min     | ±20%       | ~16 min     | 20 min (cap) |

Bytebug is deliberately unpredictable (highest hunger rate + highest poop
volatility). Shellscript is the opposite: slow, regular, easy to manage.

---

## Pet Types

### Codeling

The default, balanced type. No stat multiplier skews. Base health 100.
Intended as the reference type for balancing other types against.

Design intent: a generic blob-shaped creature that embodies a compiled program.
Shell-like in appearance, changes colour and shape as it evolves. The `_a`
lineage should look more refined and purposeful; the `_c` lineage more chaotic
and glitchy.

Poop rate: **~15 min average**, ±50% volatility (uniform).  
Effective range per cycle: roughly 7.5 – 22.5 min (capped at 20 min).

### Bytebug

Hunger decays 1.5× faster, energy regens 1.2× faster. Base health 100.
Requires more frequent feeding but recovers from sleep faster.

Design intent: an insect-like creature. Small and quick. The `_a` lineage
becomes sleek and iridescent; the `_c` lineage stays grub-like and dull.

Poop rate: **~8 min average**, ±80% volatility — the most unpredictable type.  
Effective range per cycle: roughly 1.5 – 14.5 min. Can surprise you almost
immediately after cleaning.

### Pixelpup

Happiness decays 1.5× faster. Base health 100.
Needs more play/praise to stay content but is otherwise average.

Design intent: a quadruped pixel dog. Very expressive face. The `_a` lineage
grows tall and proud; the `_c` lineage stays scruffy and small.

Poop rate: **~12 min average**, ±70% volatility.  
Effective range per cycle: roughly 3.5 – 20 min.

### Shellscript

Hunger decays 0.8× (slower). Base health 120.
A tanky slow-paced type. Hardest to kill, but the high base health means
Medicine heals a smaller fraction per dose.

Design intent: a tortoise/snail hybrid. Deliberately slow movement speed in
the canvas animation (speed multiplier in `getPetSpeed` is effectively lower
because the body is bigger and more majestic). The `_a` lineage has an
elaborate shell; the `_c` lineage has a cracked one.

Poop rate: **~20 min average**, ±20% volatility — nearly clockwork.  
Effective range per cycle: 16 – 20 min (capped).

---

## Character Designs

Characters are identified by `petType_stage_tier` (e.g. `codeling_child_a`).
No sprite image files exist yet — the canvas renderer draws a generic
pixel-art body shape scaled by stage. These descriptions are targets for future
sprite artwork.

### Egg stage (all types share one visual)

A plain oval. Slight wobble animation. No mouth. Eyes are two dots.
Hatches by cracking at the top before `evolved_to_baby` fires.

### Baby stage

All types: small, pudgy, large head relative to body. No legs visible, just a
waddling blob. Very large eyes. Expressive but simple.

| Type        | Baby distinctive feature                     |
|-------------|----------------------------------------------|
| codeling    | Smooth rounded body, two antenna bumps       |
| bytebug     | Tiny wing nubs, segmented abdomen hint       |
| pixelpup    | Floppy ear pixel on each side                |
| shellscript | Small dome on back (proto-shell)             |

### Child stage

Legs appear. Body elongates slightly. More defined eyes with pupils.

### Teen stage

Noticeably taller. Limbs are proportional. `_a` teens show early signs of
their final form. `_c` teens look underfed or over-caffeinated.

### Adult stage

Full size (stageScale 0.85). Most visual variety between tiers.

### Senior stage

Slightly larger than adult (stageScale 0.90). `_a` seniors look wise and
serene. `_b` seniors look tired but content. `_c` seniors look worn out.

---

## Sprite Rendering Notes (canvas-based)

The current renderer in `sidebar.js` draws everything programmatically on a
`<canvas>` element. No image files are loaded.

### Key constants

| Variable     | Value source                         | Purpose                          |
|--------------|--------------------------------------|----------------------------------|
| STAGE_SCALES | static map in sidebar.js             | Body size relative to 24px base  |
| STAGE_BODY_HEIGHT_MULTS | static map in sidebar.js  | Height multiplier per stage (e.g. adult=1.5×) |
| COLOR_PALETTES | static map in sidebar.js           | primary / secondary / background |
| weightWidthMultiplier | function in sidebar.js      | >80→1.5×, >50→1.25×, else 1.0× width |
| getPetSpeed  | mood-based lookup                    | px/frame horizontal movement     |
| bobOffset    | 0 or 1 px alternating per 10 frames  | Walking animation                |
| legFrame     | 0 or 1                               | Leg height alternation           |

### Per-stage sprite shapes

Each stage has a distinct visual shape drawn procedurally in `drawSprite()`:

| Stage | Shape | Distinctive features |
|-------|-------|---------------------|
| Egg | Ellipse (`ctx.ellipse`) | Oval body, dot eyes (10% bodySize), no legs, no mouth |
| Baby | Square body | Oversized eyes (30% bodySize), tiny legs (12% bodySize), expressive mouth |
| Child | Square body | Normal eyes (18% bodySize), normal legs (22% bodySize) |
| Teen | Head + narrower torso (82% width) | Normal eyes in head region, longer legs (30% bodySize) |
| Adult | Head + full-width torso | Shoulder bumps (2px×4px on each side of torso top), longer legs (30%) |
| Senior | Head + wide torso (90% width) | Slightly shorter legs than adult (25%), larger head fraction (42%) |

### Weight-based sprite width

`weightWidthMultiplier(weight)` returns a multiplier applied to `bodyWidth`:

- weight > 80 → 1.5× (overweight tier)
- weight > 50 → 1.25× (slightly fat tier)
- else → 1.0× (normal)

`bodyHeight` is always `bodySize * STAGE_BODY_HEIGHT_MULTS[stage]` — weight
only affects width, not height. The `maxX` clamp in `animationLoop()` and
`resizeCanvas()` use `bWidth = Math.round(bodySize * wwm)` so the pet never
walks off the right edge when wide.

### Weight event strings

| Event code | Human-readable message |
|-----------|------------------------|
| `weight_became_too_skinny` | `<Name> is getting too skinny!` |
| `weight_became_slightly_fat` | `<Name> is looking a little chubby.` |
| `weight_became_overweight` | `<Name> is overweight!` |
| `weight_no_longer_overweight` | `<Name> has slimmed down.` |
| `weight_no_longer_too_skinny` | `<Name> is looking healthier now.` |

### Sprite anatomy (pixel positions relative to body rect at x, bodyY)

```text
[legs]      legX1 = x + 20% bodyWidth, legX2 = x + 60% bodyWidth
[body]      bodyWidth × bodyHeight rect (or ellipse for egg)
[eyes]      leftEyeX = x + 20%, rightEyeX = x + 62%, eyeY = bodyY + 25% (child/teen/adult/senior)
[mouth]     mouthY = bodyY + 65%, mouthX = x + 30%, mouthW = 40%
[indicator] z (sleeping) or + (sick) above body centre
```

Eye colour:

- Sick → `#ff0000`
- Sleeping → `#888888`
- Awake → `palette.secondary`

Mouth shape:

- `happy` → smile (two corner dots, then arc downward)
- `sad` / `sick` → frown (two corner dots, then arc upward)
- Otherwise → flat line

### Horizontal flip

The sprite is drawn facing right by default. When `petFacingLeft === true`,
the canvas context is translated and `scale(-1, 1)` is applied around the
body's horizontal centre (using `bodyWidth` not `bodySize` for correct centering
when weight-scaled). Status indicators (Zzz, +) are drawn *after*
`spriteCtx.restore()` so they always read left-to-right.

---

## Message Protocol (host ↔ webview)

| Direction   | Shape                                                              |
|-------------|--------------------------------------------------------------------|
| Host → JS   | `{ type: "stateUpdate", state: PetState, mealsGivenThisCycle: number }` |
| JS → Host   | `{ command: "feed", feedType?: "meal" \| "snack" }`                |
| JS → Host   | `{ command: "play", game?: string, result?: string }`              |
| JS → Host   | `{ command: "sleep" \| "wake" \| "clean" \| "medicine" \| "scold" \| "praise" }` |
| JS → Host   | `{ command: "new_game", name: string, petType: string, color: string }` |
| JS → Host   | `{ command: "user_activity" }` — no-op on host; resets idle timer only (BUGFIX-015) |

`mealsGivenThisCycle` is held in `SidebarProvider` (not in `PetState`) because
`PetState` is immutable and the counter must survive across tick boundaries
without being serialised into the save state.

---

## PyCharm Plugin Architecture

The PyCharm port uses the same webview files with a JCEF bridge shim.

| VS Code concept           | PyCharm equivalent                          |
|---------------------------|---------------------------------------------|
| Extension host TypeScript | Kotlin `ApplicationService` (GotchiPlugin)  |
| `context.globalState`     | `PersistentStateComponent` (GotchiPersistence) |
| `WebviewView`             | JCEF `JBCefBrowser` (GotchiBrowserPanel)    |
| `setInterval` tick        | `AppExecutorUtil.scheduleWithFixedDelay`     |
| `onDidSaveTextDocument`   | `FileDocumentManagerListener`               |
| Status bar item           | `StatusBarWidgetFactory` + `StatusBarWidget` |
| `vsce package`            | `./gradlew buildPlugin` → `.zip`            |

### JCEF bridge pattern

JS → Kotlin: `JBCefJSQuery.create(browser)` injected as `window.__vscodeSendMessage`  
Kotlin → JS: `browser.cefBrowser.executeJavaScript("window.__gotchiMsg($json)")`

The `sidebar.js` shim replaces `acquireVsCodeApi()` with a JCEF-compatible
object so the webview code itself is unchanged beyond the shim injection.

HTML is built as an inline string in `GotchiBrowserPanel.buildHtml()` — CSS
and JS are embedded, no `file://` URL is needed and the CSP meta tag is
removed for JCEF compatibility.

---

## Attention-Call Probability Formula

Probabilistic attention calls (poop, misbehaviour, gift) use a **logarithmic
probability function** — not a flat random chance — so that the longer the
event has not fired, the higher the chance it fires on the next tick.

### Formula

```
logChance(ticksSinceLast, base, max) = min(max, base × ln(ticksSinceLast + e))
```

- `ticksSinceLast` — ticks since the event last fired (or since the counter was
  last reset).  For poop calls this is `ticksWithUncleanedPoop`; for misbehaviour
  it is `ticksSinceLastMisbehaviour`; for gifts it is `ticksSinceLastGift`.
- `base` — scaling factor (slope of the log curve).
- `max` — hard cap on the probability.
- Returns a probability in `[0, max]`.  Each tick a `Math.random()` / `Random.nextDouble()`
  roll is compared against this value.

### Tuning constants

| Call type     | base constant              | value  | max constant              | value  |
|---------------|----------------------------|--------|---------------------------|--------|
| Poop          | `POOP_CALL_BASE_CHANCE`    | 0.03   | `POOP_CALL_MAX_CHANCE`    | 0.12   |
| Misbehaviour  | `MISBEHAVIOUR_BASE_CHANCE` | 0.005  | `MISBEHAVIOUR_MAX_CHANCE` | 0.08   |
| Gift          | `GIFT_BASE_CHANCE`         | 0.002  | `GIFT_MAX_CHANCE`         | 0.05   |

Constants are defined in:
- TypeScript: `vscode/src/gameEngine.ts` lines 183–189
- Kotlin: `pycharm/src/main/kotlin/com/gotchi/engine/Constants.kt` lines 256–262

### How the curve behaves (poop example, base=0.03, max=0.12)

At tick 0 the probability is `min(0.12, 0.03 × ln(1 + e)) ≈ 0.055` (5.5%).  
At tick 10 it reaches `min(0.12, 0.03 × ln(11 + e)) ≈ 0.085` (8.5%).  
It saturates at the max of **12%** once `ticksSinceLast` is large enough.  
Misbehaviour and gift start much lower (0.5% / 0.2% respectively) so they are
rare events that gradually become more likely the longer nothing has happened.

### Where it fires

- `gameEngine.ts:1029` / `GameEngine.kt:418` — poop call gate
- `gameEngine.ts:1050` / `GameEngine.kt:439` — misbehaviour call gate
- `gameEngine.ts:1063` / `GameEngine.kt:452` — gift call gate

All three call sites are inside **Steps 1–3** of the attention-call section
of `tick()`, wrapped (from v0.4.0 onwards) by the `attentionCallsEnabled` guard.

---

## Known Intentional Simplifications

- **Mini-games are client-side only.** The win/lose result is computed by
  `sidebar.js` using `Math.random()`. The host never validates it. A determined
  cheater could always win, but this is a single-player toy.

- **ageDays is derived from dayTimer.** `ageDays` is computed as
  `Math.floor(dayTimer)` on every tick in `withDerivedFields()`. It advances
  continuously as `dayTimer` accumulates — it does not require the pet to
  sleep or wake to increment.

- **No network.** All state is local. No telemetry, no sync, no leaderboard
  (the leaderboard idea in DESIGN.md is a future aspiration).

---

## Release Notes

v0.5.1 was built and packaged by [dylscoop](https://github.com/dylscoop).
