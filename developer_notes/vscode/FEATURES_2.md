# vscode_gotchi — Tamagotchi Parity Gap Features

Features identified by comparing the original Tamagotchi (P1/P2) and Connection-era
gameplay against the current codotchi implementation. Items here do not duplicate
anything already tracked in `FEATURES.md`.

Status legend:

- `[x]` Implemented
- `[~]` Partially implemented
- `[ ]` Not yet implemented
- `[S]` Controlled by a VS Code setting

---

## 1. Core Gameplay Gaps (P1/P2 Parity)

These are features present in the original 1996/1997 Tamagotchi that codotchi
does not yet have.

### 1.1 Potty Training

| Feature | Status | Notes |
|---------|--------|-------|
| Pre-poop warning animation (stink lines / face) | `[ ]` | Pet shows a visual "about to go" state for a short window before the poop is placed on the floor |
| Toilet action during warning window | `[ ]` | If the player presses Clean while the pre-poop animation is playing, the pet uses a toilet instead of making a mess |
| Training counter | `[ ]` | Each successful toilet use increments a hidden counter |
| Auto-potty threshold | `[ ]` | Once the counter reaches a configurable threshold, the pet goes to the toilet automatically without requiring a player action |

**Design notes:**
- Add a `poopWarning` boolean to `PetState`; set it `true` for a fixed window
  (`POOP_WARNING_TICKS`, suggested 3–5 ticks) before the poop event fires.
- The Clean button (or a dedicated Toilet button) must be pressable during this
  window and must cancel the poop and increment `pottyTrainingCount`.
- Add `pottyTrainingCount` and `pottyTrained` (boolean) to `PetState`.
- When `pottyTrained === true`, the engine skips placing a poop on the floor and
  instead fires a `used_toilet` event (no attention call, no mess).
- Original Tamagotchi P1/P2 feature.

---

### 1.2 Care Mistakes Counter

| Feature | Status | Notes |
|---------|--------|-------|
| Discrete `careMistakes` counter in `PetState` | `[x]` | Per-stage counter; resets to 0 on evolution. `lifetimeCareMistakes` never resets. |
| Increment on: attention call expired unresponded | `[x]` | Each expired attention call (hunger, unhappiness, sickness, poop, low energy, critical health) adds 1 to both counters |
| Increment on: fed snack when hungry (not meal) | `[ ]` | Not yet wired — future enhancement |
| Increment on: misbehaviour ignored | `[x]` | Expired `misbehaviour` call adds 1 to `careMistakes` + `lifetimeCareMistakes` |
| Use `careMistakes` as a secondary gate in evolution | `[x]` | 0–3 → best tier; 4–6 → mid tier; ≥ 7 → low tier; each excess mistake above 3 delays evolution by 1 game-day |
| Optionally expose `careMistakes` as a visible stat in the info line | `[ ]` | Hidden internal by default; dev mode or a setting could surface it |

**Design notes:**
- The original Tamagotchi used a discrete mistake count (not a continuous score)
  as the primary evolution gate. The current `careScore` is a floating-point
  average — supplementing it with `careMistakes` brings evolution closer to the
  original feel.
- A reasonable threshold: ≤ 3 mistakes → best tier; 4–6 → mid tier;
  ≥ 7 → low tier (exact values tunable via constants).

---

### 1.3 Secret / Rare Characters

| Feature | Status | Notes |
|---------|--------|-------|
| "Perfect care" secret character per sprite type | `[x]` | `secret_best` tier: `careMistakes === 0` AND `careScore ≥ 0.95`; sprites alias existing `_a` characters as placeholders |
| "Total neglect" secret character per sprite type | `[x]` | `secret_worst` tier: `lifetimeCareMistakes ≥ 10`; sprites alias existing `_c` characters as placeholders |
| Secret character names and sprites | `[ ]` | Dedicated pixel art not yet drawn; currently aliased to existing sprites |
| Secret character does not appear in standard evolution preview | `[ ]` | Discovery mechanic not yet implemented |

**Design notes:**
- Requires the care mistakes counter (§1.2) and/or the continuous `careScore`.
- Add a `secret` tier to the evolution table alongside `best`, `mid`, `low`.
- The perfect-care secret should be visually distinct and "cute/impressive";
  the neglect secret should be visually quirky or unsettling — matching the
  original Tamagotchi tone.

---

### 1.4 Lights Off / Manual Bedtime

Already tracked in `FEATURES.md §6.2` and `§3` — listed here for completeness
in the parity gap set.

| Feature | Status | Notes |
|---------|--------|-------|
| Lights Off button in sidebar | `[ ]` | Force the pet to sleep before it would naturally do so |
| `[S]` `gotchi.autoWake` | `[ ]` | Auto-wake when energy hits 100 (already wired in engine; setting not exposed) |
| Sleep schedule (refuse to sleep if recently slept) | `[ ]` | Prevent immediately re-sleeping after waking |
| Visual night-mode on canvas when sleeping | `[ ]` | Darken canvas background |

---

### 1.5 Pause Function

| Feature | Status | Notes |
|---------|--------|-------|
| Explicit pause command / sidebar button | `[ ]` | Suspends all game ticks (hunger/happiness/energy decay, aging, attention calls) |
| `isPaused` flag in `PetState` | `[ ]` | Persisted so pause survives IDE restarts |
| UI indicator while paused | `[ ]` | "PAUSED" banner or icon overlay on the canvas |
| Pause excluded from offline decay | `[ ]` | Time spent paused does not count toward offline decay calculation on next load |

**Design notes:**
- Original Tamagotchi used the clock-set screen as an unofficial pause; later
  models added an official pause button.
- In codotchi, a VS Code command (`gotchi.pauseGame`) + a sidebar button is
  the natural equivalent.
- `aiMode` already suppresses idle resets — pause is a harder stop of all decay.

---

### 1.6 Sound Effects

| Feature | Status | Notes |
|---------|--------|-------|
| 8-bit jingle on hatch | `[ ]` | Plays when egg transitions to baby |
| 8-bit jingle on evolve | `[ ]` | Plays on each stage transition |
| 8-bit jingle on death | `[ ]` | Plays when health reaches 0 |
| Short sound on feed (meal / snack) | `[ ]` | |
| Short sound on play win / lose | `[ ]` | |
| Short sound on sleep / wake | `[ ]` | |
| Short sound on attention call fired | `[ ]` | Alert beep |
| Mute toggle | `[ ]` | VS Code command + sidebar button; persisted in `PetState` or settings |
| `[S]` `gotchi.soundEnabled` (default `true`) | `[ ]` | Master on/off for all sounds |
| Respect OS system mute / `gotchi.reducedMotion` | `[ ]` | When `reducedMotion` is true, sounds are also muted |

**Design notes:**
- Use the Web Audio API (`AudioContext`) inside `sidebar.js` — no external
  audio files needed; all tones generated procedurally.
- Simple square-wave oscillator with short ADSR envelopes matches the 8-bit
  Tamagotchi aesthetic.
- Webview `retainContextWhenHidden` must be `true` for the `AudioContext` to
  persist across sidebar hide/show.

---

### 1.7 Egg-Hatch Animation

Already tracked in `FEATURES.md §2.2` — listed here for parity gap visibility.

| Feature | Status | Notes |
|---------|--------|-------|
| Egg wiggle phase (pre-hatch) | `[ ]` | Egg rocks ±5° for a configurable duration before hatching |
| Crack overlay | `[ ]` | One or two crack lines drawn on the egg after the wiggle |
| Burst / reveal | `[ ]` | Egg shell fragments fly outward; baby sprite fades in |

---

### 1.8 Sickness UX Polish

Already tracked in `FEATURES.md §6.4` — listed here for parity gap visibility.

| Feature | Status | Notes |
|---------|--------|-------|
| Medicine doses remaining shown on button | `[ ]` | Badge counts down from 3 to 0 |
| Disable Feed/Play buttons while sick | `[ ]` | Engine already enforces; sidebar buttons need greying-out |

---

## 2. Connection-Era Gaps

Features from the Tamagotchi Connection (2004+) and later models. Lower priority
than §1 — require design work before implementation.

### 2.1 Matchmaker NPC

| Feature | Status | Notes |
|---------|--------|-------|
| Matchmaker arrives at senior age if unmarried | `[ ]` | After a configurable number of senior days without a marriage event, a Matchmaker character appears |
| Auto-pairs pet with a CPU partner | `[ ]` | No second player required; produces an egg after the standard marriage animation |
| Prevents family line from ending without offspring | `[ ]` | Guards the generation counter against permanent termination |

---

### 2.2 Marriage & Offspring

| Feature | Status | Notes |
|---------|--------|-------|
| Shared session code (VS Code Live Share or similar) | `[ ]` | Two users generate a code to pair their pets |
| Friendship meter (0–100) gates marriage eligibility | `[ ]` | See §2.3 |
| Kiss animation on marriage | `[ ]` | Short canvas animation |
| Female produces two eggs; keeps one, leaves one with male | `[ ]` | |
| Parent departs after 24 h or offspring evolves to child | `[ ]` | |
| Generation counter increments | `[ ]` | Requires `generation` stat from `FEATURES.md §1` |

---

### 2.3 Friendship Meter

| Feature | Status | Notes |
|---------|--------|-------|
| `friendship` stat (0–100) in `PetState` | `[ ]` | Tracks closeness to a connected pet |
| Six friendship levels | `[ ]` | Acquaintance → Buddy → Friend → Good Friend → Best Friend → Partner |
| Partner level gates marriage | `[ ]` | See §2.2 |
| Friendship increases via connected play / gift exchange | `[ ]` | |

---

### 2.4 Gift Exchange

| Feature | Status | Notes |
|---------|--------|-------|
| Connected pets can send item gifts | `[ ]` | Complement to the friendship and marriage system |
| Gift item types (food, toy, accessory) | `[ ]` | |
| Receiving a gift fires a `gift_received` attention call | `[ ]` | |

---

### 2.5 Gotchi Points Currency & In-Game Shop

| Feature | Status | Notes |
|---------|--------|-------|
| `gotchiPoints` stat in `PetState` | `[ ]` | Earned from minigame wins; persisted |
| Points awarded per minigame result | `[ ]` | Win > Partial > Lose; amounts TBD |
| In-game shop panel | `[ ]` | Accessible from sidebar; lists purchasable items |
| Purchasable item categories | `[ ]` | Extra food types, accessories, background skins, colour palettes |
| Purchased items applied to pet / canvas | `[ ]` | |

---

## 3. Cosmetic & Polish Gaps

### 3.1 Sprite Animation Frames

Already tracked in `FEATURES.md §14` — listed here for parity gap visibility.

| Feature | Status | Notes |
|---------|--------|-------|
| Idle walk cycle (2–4 frames) | `[ ]` | Flip-book animation using existing `renderSpriteGrid` pipeline |
| Mood-specific frames (happy, sad, sleeping, eating) | `[ ]` | |

---

### 3.2 Day / Night Cycle

| Feature | Status | Notes |
|---------|--------|-------|
| Canvas background shifts with system clock hour | `[ ]` | Gradual colour transition across the day |
| Night hours (e.g. 22:00–06:00) use darker palette | `[ ]` | Complements the sleep night-mode in §1.4 |
| Optionally affects stat decay rates at night | `[ ]` | Hunger decays slightly slower at night, matching real sleep patterns |

---

### 3.3 Generation Counter Display

Already tracked in `FEATURES.md §1` and `§14` — listed here for parity gap visibility.

| Feature | Status | Notes |
|---------|--------|-------|
| `generation` int in `PetState` | `[ ]` | Increments when offspring hatches |
| Displayed in the info line | `[ ]` | e.g. `Gen 3 · Adult · codeling` |

---

## 4. Suggested Implementation Order (parity gaps only)

The ordering below prioritises features that are close to original P1/P2 parity
and have minimal dependencies on unbuilt systems.

1. **Sickness UX polish** — medicine dose badge + disable Feed/Play while sick (§1.8) — low effort, high fidelity gain
2. **Lights Off button** (§1.4) — one sidebar button + engine flag
3. **Care mistakes counter** (§1.2) — adds `careMistakes` to `PetState`; wires existing attention-call expiry events
4. **Egg-hatch animation** (§1.7) — pure canvas animation; no state changes
5. **Potty training** (§1.1) — new `poopWarning` state + Clean window + training counter
6. **Secret / rare characters** (§1.3) — depends on care mistakes counter (step 3)
7. **Pause function** (§1.5) — `isPaused` flag + VS Code command + UI indicator
8. **Sound effects** (§1.6) — Web Audio API; mute toggle; `gotchi.soundEnabled` setting
9. **Day / night cycle** (§3.2) — canvas cosmetic; no state dependency
10. **Generation counter display** (§3.3) — display-only; depends on `generation` stat
11. **Matchmaker NPC** (§2.1) — senior-stage logic; no connectivity required
12. **Friendship meter** (§2.3) — new stat; prerequisite for marriage
13. **Gotchi Points + shop** (§2.5) — economy layer
14. **Marriage & offspring** (§2.2) — depends on friendship meter + connectivity
15. **Gift exchange** (§2.4) — depends on connectivity + shop item types
