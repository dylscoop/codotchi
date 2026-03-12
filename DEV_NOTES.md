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
| `TICK_INTERVAL_SECONDS` | 5 s | Wall-clock time per tick |
| `TICKS_PER_MINUTE` | 12 | |
| `TICKS_PER_GAME_DAY_AWAKE` | 720 ticks | 1 real hour awake = 1 game day (codeling 1×) |
| `TICKS_PER_GAME_DAY_SLEEPING` | 576 ticks | ~48 min asleep = 1 game day (~25% faster) |

`ageDays` is derived as `Math.floor(dayTimer)` on every tick — it is **not**
manual and does not require sleep/wake events to advance.

Evolution is triggered in `checkStageProgression()` whenever
`dayTimer >= EVOLUTION_DAY_THRESHOLDS[stage]`. The threshold is **cumulative**
from birth, not relative to the start of the current stage.

---

### EVOLUTION_DAY_THRESHOLDS (cumulative from birth)

```ts
egg:   0.033   // hatch
baby:  0.199   // grow to child
child: 1.199   // grow to teen
teen:  4.199   // grow to adult
```

Adult → Senior is not automatic: `promoteToSenior()` must be called explicitly
(the extension calls it once at the start of each 24-hour IRL check — not yet
wired as a scheduled call). Senior dies naturally once `ageDays >= 20` and
health reaches 0.

---

### Per-stage durations (awake time only)

Each stage lasts for the *difference* between consecutive thresholds, divided
by the type's `agingMultiplier`.  Sleeping is ~25% faster so actual wall-clock
can be shorter if the pet sleeps a lot.

**Formula:**  `real_minutes = (threshold_end − threshold_start) × 60 / agingMultiplier`

#### Codeling (agingMultiplier = 1.0×)

| Stage | dayTimer span | Awake time |
|-------|--------------|-----------|
| Egg   | 0 → 0.033   | ~2 min    |
| Baby  | 0.033 → 0.199 | ~10 min |
| Child | 0.199 → 1.199 | ~60 min (1 hr) |
| Teen  | 1.199 → 4.199 | ~180 min (3 hr) |
| Adult | 4.199 → ∞   | Indefinite (manual → senior) |
| Senior | ageDays ≥ 4 | Natural death at ageDays ≥ 20 |

#### Bytebug (agingMultiplier = 1.5×, fastest)

| Stage | Awake time |
|-------|-----------|
| Egg   | ~1.3 min  |
| Baby  | ~6.7 min  |
| Child | ~40 min   |
| Teen  | ~120 min (2 hr) |

#### Pixelpup (agingMultiplier = 1.25×)

| Stage | Awake time |
|-------|-----------|
| Egg   | ~1.6 min  |
| Baby  | ~8 min    |
| Child | ~48 min   |
| Teen  | ~144 min (2.4 hr) |

#### Shellscript (agingMultiplier = 0.75×, slowest)

| Stage | Awake time |
|-------|-----------|
| Egg   | ~2.7 min  |
| Baby  | ~13 min   |
| Child | ~80 min (1.3 hr) |
| Teen  | ~240 min (4 hr) |

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

`POOP_TICKS_INTERVAL` is the absolute ceiling (20 min at the default 5s tick
rate). `nextPoopIntervalTicks` is stored in `PetState` so it is:

- Stable between ticks (not re-rolled every 5 s)
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
| COLOR_PALETTES | static map in sidebar.js           | primary / secondary / background |
| getPetSpeed  | mood-based lookup                    | px/frame horizontal movement     |
| bobOffset    | 0 or 1 px alternating per 10 frames  | Walking animation                |
| legFrame     | 0 or 1                               | Leg height alternation           |

### Sprite anatomy (pixel positions relative to body rect at x, bodyY)

```text
[legs]      legX1 = x + 20% bodySize, legX2 = x + 60% bodySize
[body]      full bodySize × bodySize square
[eyes]      leftEyeX = x + 20%, rightEyeX = x + 62%, eyeY = bodyY + 25%
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
body's horizontal centre. Status indicators (Zzz, +) are drawn *after*
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

## Known Intentional Simplifications

- **Mini-games are client-side only.** The win/lose result is computed by
  `sidebar.js` using `Math.random()`. The host never validates it. A determined
  cheater could always win, but this is a single-player toy.

- **ageDays is manual.** `ageDays` only increments when the pet wakes (via
  `wake()`, `auto_woke_up`, or BUGFIX-003 auto-wake). It does not track
  real-world calendar days. A pet that never sleeps never ages.

- **No network.** All state is local. No telemetry, no sync, no leaderboard
  (the leaderboard idea in DESIGN.md is a future aspiration).
