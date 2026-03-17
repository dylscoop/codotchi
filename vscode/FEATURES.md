# vscode_gotchi — Feature Specification

Status legend:

- `[x]` Implemented
- `[~]` Partially implemented
- `[ ]` Not yet implemented
- `[S]` Controlled by a VS Code setting (toggle on/off)

---

## 1. Core Stats

| Stat         | Range  | Status | Notes |
|--------------|--------|--------|-------|
| Hunger       | 0–100  | `[x]`  | Decays over time; 0 triggers health loss |
| Happiness    | 0–100  | `[x]`  | Decays over time; 0 triggers health loss |
| Energy       | 0–100  | `[x]`  | Decays 1/tick while awake; depleted by play; restored during sleep | 0 triggers health loss
| Health       | 0–100  | `[x]`  | Drops from starvation, unhappiness, sickness |
| Discipline   | 0–100  | `[x]`  | Affected by praise/scold; feeds into care score |
| Weight       | 1–99   | `[x]`  | Shown in info line; passive -1/min decay; overweight/skinny thresholds affect happiness rate and sprite width |
| Age (days)   | int    | `[x]`  | Displayed in info line |
| Care Score   | 0.0–1.0| `[~]`  | Computed continuously; drives evolution tier |

---

## 2. Life Cycle

### 2.1 Stages

| Stage  | Duration (game days) | Status | Notes |
|--------|----------------------|--------|-------|
| Egg    | ~1d                  | `[x]`  | Auto-hatches after timer |
| Baby   | ~6d                  | `[x]`  | Requires minimal care |
| Child  | ~18d                 | `[x]`  | First stage of active care |
| Teen   | ~72d                 | `[x]`  | 2 possible evolution variants per type |
| Adult  | ~192d                | `[x]`  | Up to 3 variants per type based on care score; auto-evolves to Senior at ~288d |
| Senior | Indefinite           | `[x]`  | Natural death eligible at ≥ 365d (1 in-game year); peaceful death |
| Dead   | Terminal             | `[x]`  | Shows age at death; prompts new game |

Stage durations scale with `agingMultiplier` per pet type: bytebug 1.5× faster,
pixelpup 1.25× faster, shellscript 0.75× (slower). Game-day milestones are the
same for all types; only the real-world clock time differs. For example, a
bytebug reaches adult in ~2.8 hr real time vs ~4.2 hr for codeling and ~5.6 hr
for shellscript.
See `DEV_NOTES.md` for the full per-type breakdown.

### 2.2 Evolution

| Feature | Status | Notes |
|---------|--------|-------|
| Care-score-based evolution tiers (best / mid / low) | `[x]` | |
| Distinct character names per type × stage × tier | `[x]` | Sprites not yet drawn |
| Visual difference between character variants | `[ ]` | Requires sprite assets |
| Evolution notification in event log | `[~]` | Event flag exists; no fanfare animation |
| Egg-hatch animation | `[ ]` | Wiggle before first evolution |

### 2.3 Pet Types

| Type        | Tendency                                | Status |
|-------------|-----------------------------------------|--------|
| Codeling     | Balanced                               | `[x]`  |
| Bytebug      | Faster hunger decay, faster energy regen| `[x]` |
| Pixelpup     | Faster happiness decay                  | `[x]`  |
| Shellscript  | Slower hunger decay, higher base health | `[x]`  |

---

## 3. Care Actions

| Action      | Effect                                           | Constraint                               | Status |
|-------------|--------------------------------------------------|------------------------------------------|--------|
| Feed Meal   | Hunger +20, Weight +2                            | Max 3 meals per wake cycle               | `[x]`  |
| Feed Snack  | Happiness +10, Hunger +5, Weight +5              | Max 3 snacks per cycle; resets on auto-wake | `[x]`  |
| Play        | Happiness +15, Energy −25, Weight −3             | Requires Energy ≥ 25; refused via event log | `[x]`  |
| Pat         | Happiness +10, Energy −20                        | Requires Energy ≥ 20; accessed via Play menu — direct boost (no minigame) | `[x]`  |
| Sleep       | Energy regenerates; cannot act while sleeping    | —                                        | `[x]`  |
| Wake        | Manually end sleep                               | —                                        | `[x]`  |
| Clean       | Removes all droppings; prevents sickness         | —                                        | `[x]`  |
| Medicine    | Cures sickness after 3 doses (no health boost)   | —                                        | `[x]`  |
| Praise      | Discipline +10                                   | —                                        | `[x]`  |
| Scold       | Discipline +10                                   | —                                        | `[x]`  |
| Light off   | Force sleep early (manual bedtime)               | —                                        | `[ ]`  |

### 3.1 Attention Calls

The pet fires IDE notifications demanding care, with a **2-minute active
(non-idle) response window**. Idle time does NOT count toward the timer.

| Trigger                                            | Attention Type    | Correct Response        | Expiry penalty                         | Status |
|----------------------------------------------------|-------------------|-------------------------|----------------------------------------|--------|
| Hunger < 25                                        | `hunger`          | Feed meal or snack      | Hunger −10                             | `[x]`  |
| Happiness < 40                                     | `unhappiness`     | Play or praise          | Happiness −10                          | `[x]`  |
| Poop present (log-chance, rises with uncleaned ticks)| `poop`          | Clean                   | Becomes sick                           | `[x]`  |
| Sick                                               | `sick`            | Medicine                | Health −10                             | `[x]`  |
| Energy < 20                                        | `low_energy`      | Sleep                   | Happiness −10                          | `[x]`  |
| Health < 50                                        | `critical_health` | Feed meal or snack      | Health −10, Happiness −10              | `[x]`  |
| Random misbehaviour (log-chance, child+)           | `misbehaviour`    | Scold                   | Health −10 + neglectCount +1           | `[x]`  |
| Random gift (log-chance)                           | `gift`            | Praise (+happiness +15) | Happiness −5 + neglectCount +1         | `[x]`  |

Notes:
- Response window: `ATTENTION_CALL_RESPONSE_TICKS = 20` active ticks (2 min)
- Post-answer cooldown: `ATTENTION_ANSWER_COOLDOWN_TICKS = 50` ticks (5 min)
- Post-expiry cooldown: `ATTENTION_EXPIRY_COOLDOWN_TICKS = 20` ticks (2 min)
- Only one call active at a time; `poop` call can fire while sleeping
- IDE notifications fire via `showWarningMessage` (VS Code) / `Notifications.Bus` (PyCharm)
- "Open Gotchi" button on notification focuses the sidebar/tool window

---

## 4. Minigames

Three interactive minigames are implemented: **Left / Right**, **Higher or
Lower**, and **Coin Flip**. All are launched via a game-select overlay that appears when the
player presses the Play button. The **Pat** action is also accessible from this
same overlay.

Each game runs in a temporary **game overlay** rendered inside the
sidebar (a `<div>` that covers the game screen for the duration of the game,
then disappears). Results are sent to the engine as `win` / `lose` with
the `game` identifier.

The `Play` button opens a **game select screen** so the player can choose
which minigame to play (or cancel).

### 4.1 Left / Right (Classic Tamagotchi)

*The closest port of the original Tamagotchi direction game.*

- Two doors are drawn on the canvas (or as styled `<div>` blocks).
- The pet hides behind one. A "ready" animation plays for 0.5 s.
- A 3-second countdown is shown.
- Player clicks **Left** or **Right** before time runs out.
- The door opens to reveal the pet (correct door) or nothing (wrong door).
 - **Win**: Happiness +15–25 (random), Energy −10.
 - **Lose / timeout**: Happiness +10 (consolation).
- Rounds: 3 per session; best-of-3 determines overall win/lose sent to engine.
- `[S]` Setting `gotchi.leftRightTimeoutMs` (default 3000 ms) — adjustable for
  accessibility.

Status: `[x]`

*Tests attention and short-term memory.*

- Four coloured buttons (matching the pet's colour palette) are arranged in a 2×2 grid.
- A sequence of 2–6 button flashes plays (length increases with each successful round).
- Player repeats the sequence by clicking the buttons.
- Feedback: correct button flashes green; wrong button flashes red and ends round.
- **Win** (complete full sequence): Happiness +20, Energy −15.
- **Partial** (3+ correct of 6): Happiness +10, Energy −10.
- **Lose** (< 3 correct): Happiness +5.
- Maximum 3 rounds per play session. Overall result (win/partial/lose) sent to
  engine.
- `[S]` Setting `gotchi.simonFlashDurationMs` (default 600 ms).

Status: `[ ]`

### 4.3 Catch the Bug

*An original coding-themed minigame.*

- 8–12 pixel-art "bug" sprites fall from the top of the canvas over 15 seconds.
- Bugs fall at varying speeds; faster bugs are worth more points.
- Player clicks/taps a bug to catch it before it reaches the bottom.
- Missed bugs accumulate; catching one clears it with a small "squish" flash.
- **Win** (≥ 60% caught): Happiness +20, Energy −15.
- **Partial** (40–59% caught): Happiness +10, Energy −10.
- **Lose** (< 40% caught): Happiness +5.
- `[S]` Setting `gotchi.catchTheBugDifficulty` — `easy` (slow, few bugs) /
  `normal` / `hard` (fast, many bugs).

Status: `[ ]`

### 4.4 Higher or Lower

*A simple number-guessing game faithful to classic Tamagotchi.*

- A number between 1 and 100 is displayed.
- Player clicks **Higher** or **Lower** to predict whether the next number is
  greater or smaller.
- 5 rounds per session.
 - **Win** (≥ 4 correct): Happiness +10–20 (random).
 - **Lose** (≤ 3 correct): Happiness +10.

Status: `[x]`

### 4.5 Type Sprint

*A VS Code–flavoured minigame using the keyboard.*

- A short word or code token (3–8 characters, drawn from a built-in word list)
  appears on screen.
- An input box is auto-focused.
- Player types the word exactly within 5 seconds.
- Case-sensitive; backspace is allowed.
- **Win**: Happiness +15, Energy −10.
- **Lose / timeout**: Happiness +5.
- Word list is themed: `null`, `loop`, `push`, `async`, `yield`, etc.
- `[S]` Setting `gotchi.typeSprintWordLength` — `short` (3–5) / `normal` (3–8).
- `[S]` Setting `gotchi.typeSprintTimeoutMs` (default 5000 ms).

Status: `[ ]`

### 4.6 Coin Flip

*A pure luck game — no skill, just a 50/50 chance.*

- Player picks **Heads** or **Tails**.
- Result is determined by a 50/50 coin flip (`Math.random() < 0.5`).
- **Win**: Happiness +5 (`MINIGAME_COIN_FLIP_WIN = 5`).
- **Lose**: Happiness +0 (no consolation — pure gamble).
- Single round per play session.

Status: `[x]`

### Minigame Architecture Notes

- All game logic (timers, scoring, animations) runs entirely in `sidebar.js`.
- Game results are sent to the extension host as:

  ```js
  vscode.postMessage({ command: "play", game: "<id>", result: "win"|"partial"|"lose" })
  ```

- `gameEngine.ts` `applyMinigameResult()` maps game id + result → stat deltas.
- Add new games by: (1) adding an overlay render function in `sidebar.js`,
  (2) wiring up its result message, (3) adding a case in `applyMinigameResult`.

### Minigame Reward Reference

| Game | Result | Happiness delta | Constant(s) |
|------|--------|-----------------|-------------|
| Left / Right | Win | +15–25 (random) | `MINIGAME_LR_WIN_MIN = 15`, `MINIGAME_LR_WIN_MAX = 25` |
| Left / Right | Lose | +10 (consolation) | `MINIGAME_LR_LOSE_CONSOLATION = 10` |
| Higher or Lower | Win | +10–20 (random) | `MINIGAME_HL_WIN_MIN = 10`, `MINIGAME_HL_WIN_MAX = 20` |
| Higher or Lower | Lose | +10 (consolation) | `MINIGAME_HL_LOSE_CONSOLATION = 10` |
| Coin Flip | Win | +5 (flat) | `MINIGAME_COIN_FLIP_WIN = 5` |
| Coin Flip | Lose | +0 (no consolation) | — |

---

## 5. Pet Movement & Animation

All movement is **purely visual and client-side**. No position or animation
state is ever sent to the extension host or persisted. The last received
`PetState` snapshot is kept in a `sidebar.js` variable so the animation loop
can read mood, stage, sick, sleeping, and the events array.

### 5.1 Stage Area Resize

The current canvas is 64×64 — too small to wander in. The stage needs a larger
footprint to make movement readable.

| Change | Detail | Status |
|--------|--------|--------|
| Expand canvas to full sidebar width | Read `canvas.parentElement.clientWidth` on load and on window resize; set `canvas.width` dynamically | `[x]` |
| Fixed stage height | Default 96 px; configurable via `gotchi.petStageHeight` | `[x]` |
| Sprite size unchanged | The drawn body size is still driven by stage scale; the extra space is used for movement | `[x]` |

### 5.2 Animation Loop

Replace the current one-shot `drawSprite(state)` call (triggered only on
`stateUpdate` messages) with a continuous `requestAnimationFrame` loop.

- Loop runs at the display frame rate (~60 fps) and manages its own delta-time.
- On each frame: update position → update reaction queue → clear canvas → draw sprite at (x, y).
- `stateUpdate` messages from the extension host update the stored state snapshot
  and push new reaction animations onto the queue; they do not themselves draw.
- When `gotchi.reducedMotion` is `true` (or the OS `prefers-reduced-motion`
  media query is set), the rAF loop is not started and `drawSprite` is called
  once per `stateUpdate` at a fixed centre position, preserving the current
  behaviour exactly.

Status: `[x]`

### 5.3 Idle Wandering

The pet drifts around the stage when no reaction animation is playing.

| Property | Behaviour |
|----------|-----------|
| Velocity | Small random (vx, vy) vector; magnitude scales with mood speed (see 5.4) |
|----------|-----------|
| Boundary bounce | When the sprite edge hits the canvas edge, the relevant velocity component is negated |
| Random pause | Every 3–8 seconds (random) the pet stops, holds for 0.5–2 s, then picks a new direction |
| Sprite flip | Sprite is drawn mirrored when `vx < 0` using `ctx.scale(-1, 1)` before drawing |

Status: `[x]`

### 5.4 Mood & State Locomotion

| State | Movement behaviour |
|-------|--------------------|
| Happy | 1.5× base speed; small upward hop every ~4 s (brief vy impulse upward then gravity pull back); hops fire on all moods during idle wandering |
| Neutral | 1× base speed; steady, calm wandering |
| Sad | 0.4× base speed; gravitates toward the bottom of the stage; pauses more often |
| Sleeping | Fully stationary; subtle slow vertical breathing bob (±2 px, ~1 cycle per 3 s) |
| Sick | Slow tremor: rapid small random offset on each frame (±1–2 px); rarely translates |
| Hungry (hunger < 20) | Slightly erratic — direction changes more frequently |

Status: `[x]`

### 5.5 Stage-Based Speed

| Stage | Base speed (px/s) | Notes |
|-------|-------------------|-------|
| Egg | 0 | Rocks left–right in place (rotation ±5°); no translation |
| Baby | 22 | Very small, slow wobble |
| Child | 35 | First real wandering |
| Teen | 30 | Confident movement |
| Adult | 28 | Slightly more settled than teen |
| Senior | 15 | Slower; pauses longer |

Status: `[x]`

### 5.6 Reaction Animations

Short-lived one-shot animations triggered when specific event strings arrive in
`PetState.events`. Each animation overrides wandering for its duration, then
hands control back.

| Event string | Animation | Duration |
|--------------|-----------|----------|
| `fed_meal` / `fed_snack` | Quick hop: vy impulse upward, lands with a small squash | 500 ms |
| `played` | Jump with 360° spin (canvas rotate transform) | 700 ms |
| `fell_asleep` | Slow drift downward to bottom-centre, then stop | 600 ms |
| `woke_up` | Stretch scale from 0.8→1.0 upward | 400 ms |
| `scolded` | Recoil: dart left or right ~10 px, then return | 500 ms |
| `praised` | Jump + brief yellow flash behind sprite | 600 ms |
| `evolved` | Scale up from 1.0→1.3→1.0 with colour flash | 900 ms |
| `poop_appeared` | Pet briefly faces the poop position, then looks away | 700 ms |
| `became_sick` | Fast shake: ±4 px random horizontal jitter | 600 ms |
| `healed` | Brief green colour overlay fading out | 500 ms |
| `died` | Slow float upward off the top of the canvas | 1200 ms |

Reactions are stored in a simple queue; if a new one arrives while one is
playing, it is appended and plays immediately after.

Status: `[x]`

### 5.7 Direction Flip (Sprite Mirroring)

The procedural `drawSprite` function currently always draws the pet facing
right. Update it to accept a `facingLeft` boolean and apply a horizontal
canvas mirror when true:

```js
// Before drawing the sprite body:
if (facingLeft) {
  ctx.save();
  ctx.translate(x + bodySize / 2, 0);
  ctx.scale(-1, 1);
  ctx.translate(-(x + bodySize / 2), 0);
}
// ... draw body, eyes, mouth ...
if (facingLeft) { ctx.restore(); }
```

Status: `[x]`

### 5.8 Reduced Motion

- `[S]` `gotchi.reducedMotion` (boolean, default `false`) — when true, skips the
  rAF loop entirely; sprite is drawn statically at canvas centre once per
  `stateUpdate`. Reaction animations are also skipped.
- On load, `sidebar.js` checks `window.matchMedia("(prefers-reduced-motion: reduce)")`;
  if matched, behaviour is the same as `gotchi.reducedMotion: true` regardless
  of the setting value.

Status: `[x]`

### 5.9 Implementation Notes

- Movement state held in `sidebar.js`: `petX`, `petY`, `petVx`, `petVy`,
  `facingLeft`, `reactionQueue`, `idleTimer`, `breathPhase`.
- `drawSprite(state, x, y, facingLeft)` — extend the existing signature.
- The rAF loop must be cancelled (`cancelAnimationFrame`) when the webview
  switches to the setup or dead screen to avoid drawing on the wrong canvas.
- Delta-time capped at 100 ms per frame to prevent large position jumps after
  tab-switch or focus loss.

### 5.10 Floor Item Sprites

Objects placed on the floor layer of the canvas (drawn before the pet so the
pet walks in front of them).

| Item | Trigger | Pixel art | Cleared when | Status |
|------|---------|-----------|-------------|--------|
| Gift box | `activeAttentionCall === "gift"` transitions in | 8×7 px at 2×, red body + gold ribbon/bow | Call dismissed (answered or expired) | `[x]` |
| Snack food (candy/bone, random) | `fed_snack` event | candy: 4×4 at 2×; bone: 6×5 at 2× | Pet walks to it and eats it | `[x]` |

Both item types use the same `H - 4 - itemHeight` ground Y as poo sprites.
When snack items are present the pet's normal idle-wandering movement is
overridden to walk toward the nearest item; a brief pause fires on contact
before normal movement resumes.

---

## 6. Interaction Improvements

Features that deepen the existing care actions.

### 6.1 Weight Display and Management

| Feature | Status | Notes |
|---------|--------|-------|
| Show weight in info line (next to age/stage) | `[x]` | Weight removed from info line; now shown in status bar tooltip on hover |
| Weight-related mood modifier (overweight/skinny → happiness debuff) | `[x]` | >66 or <17 weight → happiness decays 1.5× faster; threshold events fire |
| Weight-based sprite width tiers | `[x]` | >80 → 1.5× wider; >50 → 1.25× wider; <17 (skinny) → 0.75× narrower |
| Passive weight decay (-1/min) | `[x]` | -1 weight every `WEIGHT_DECAY_TICK_INTERVAL` (10) ticks |
| Play button disabled when energy < 25 (show tooltip) | `[x]` | Refused via `play_refused_no_energy` event in log |

### 6.2 Sleep / Wake Cycle

| Feature | Status | Notes |
|---------|--------|-------|
| Manual "Lights Off" button to put pet to sleep early | `[ ]` | |
| Auto-wake after energy reaches 100 | `[x]` | Implemented in BUGFIX-003; snack count resets on auto-wake |
| `[S]` `gotchi.autoWake` (default true) — auto-wake when energy full | `[ ]` | |
| Sleep schedule: pet refuses to sleep if recently slept | `[ ]` | |
| Visual night-mode on canvas when sleeping | `[ ]` | Darken canvas background |

### 6.3 Overfeeding Feedback

| Feature | Status | Notes |
|---------|--------|-------|
| Show remaining meals allowed this cycle in the UI | `[x]` | Badge on Feed button; counts down from 3 |
| Disable Feed Meal button when at max meals | `[x]` | Badge disappears and button becomes unavailable |
| Show snack count remaining in the UI | `[x]` | Badge on Snack button; counts down from 3; button disabled at 0 |

### 6.4 Sickness UX

| Feature | Status | Notes |
|---------|--------|-------|
| Medicine doses remaining shown on button | `[ ]` | |
| Disable Feed/Play while sick | `[ ]` | Engine enforces; no UI feedback |
| Sick animation (canvas shake or flicker) | `[ ]` | Superseded by section 5.6 `became_sick` reaction |

---

## 7. UI Navigation & Event Log

### 7.1 Screen Navigation

| Feature | Status | Notes |
|---------|--------|-------|
| Default view shows game screen (not setup) | `[x]` | Extension host sends state on open; routes immediately |
| Menu button on game screen → setup/home | `[x]` | `btn-new-game` label changed to "Menu" |
| Continue button on setup/home screen | `[x]` | Visible only when `hasActiveGame === true`; returns to game screen |
| UI refresh fix: setup screen not bounced by tick | `[x]` | `currentScreen` tracking suppresses `renderState` while on setup with live pet |

### 7.2 Humanised Event Log

All events are displayed using the pet's name and human-readable sentences instead of raw event codes.

| Event | Log message | Status |
|-------|-------------|--------|
| `play_refused_no_energy` | `<Name> doesn't have enough energy to play!` | `[x]` |
| `sickness_damage` | `<Name> is losing health from being sick!` | `[x]` |
| `starvation_damage` | `<Name> is starving and losing health!` | `[x]` |
| `unhappiness_damage` | `<Name> is miserable and losing health!` | `[x]` |
| `exhaustion_damage` | `<Name> is exhausted and losing health!` | `[x]` |
| `evolved_to_<stage>` | `<Name> evolved into <stage>!` | `[x]` |
| All other events | Named equivalents (e.g. fed, slept, woke, cleaned) | `[x]` |

---

## 8. Coding Activity Rewards

| Feature | Effect | Status | Notes |
|---------|--------|--------|-------|
| File save reward | Happiness +5, Discipline +2 | `[x]` | Throttled to 1 per 30 s |
| Save streak (5 saves / 30 min) | Happiness +10 bonus | `[ ]` | Partially in DESIGN.md |
| Save streak (10 saves / 1 hr) | Happiness +15, Weight −1 | `[ ]` | |
| Git commit event | Happiness +10 | `[ ]` | Listen via terminal or SCM API |
| Test pass event | Happiness +5, Energy −5 | `[ ]` | Parse task output |
| `[S]` `gotchi.codingRewards` (default true) | Enable/disable all coding rewards | `[ ]` | |
| `[S]` `gotchi.codingRewardThrottleSeconds` (default 30) | Reward cooldown | `[ ]` | |

### 8.1 Idle Detection

When the IDE has had no activity for ≥ **1 minute**, the pet is considered
idle. Hunger, happiness, and **energy** decay are all reduced to **10% of the
normal rate** (one in every 10 ticks fires decay; the rest are skipped). Aging
is also slowed to 10% during idle.

When the IDE has been idle for ≥ **10 minutes**, the pet enters **deep idle**.
Hunger and happiness are floored at `IDLE_STAT_FLOOR = 20` (cannot decay
below this value) and aging stops entirely (`ageIncrement = 0`). This protects
the pet during extended breaks.

Aging does **not** advance while the IDE is closed (`applyOfflineDecay`
preserves `dayTimer`/`ageDays` exactly).

| Threshold | Constant | Value |
|-----------|----------|-------|
| Idle after | `IDLE_THRESHOLD_SECONDS` | 60 s (1 min) |
| Deep idle after | `IDLE_DEEP_THRESHOLD_SECONDS` | 600 s (10 min) |
| Decay divisor | `IDLE_DECAY_TICK_DIVISOR` | 10 (1 pt/min vs 10 pt/min active) |
| Stat floor (deep idle) | `IDLE_STAT_FLOOR` | 20 |

Activity is tracked via `onDidChangeTextEditorSelection`, `onDidChangeTextDocument`,
`onDidChangeWindowState`, and `onDidChangeActiveTextEditor`. Any of these events
resets the idle timer. Additionally, any sidebar button click resets the timer
(BUGFIX-015: `markActivity` called at the top of `handleWebviewMessage`), and
mouse movement inside the sidebar panel resets it via a throttled `mousemove`
listener (at most once per 30 s) that posts `{ command: "user_activity" }` to
the host.

Status: `[x]`

---

## 9. Sickness & Death

| Feature | Status | Notes |
|---------|--------|-------|
| Sickness from overfeeding snacks (>3 consecutive) | `[x]` | |
| Sickness from uncleaned poops (>3) | `[x]` | |
| Sickness from hunger + happiness both critical | `[x]` | |
| Health reaches 0 → death | `[x]` | |
| Hunger stays 0 for 3+ ticks → health damage | `[x]` | `starvation_damage` event; humanised in event log |
| Unhappiness health drain | `[x]` | `unhappiness_damage` event; humanised in event log |
| Energy stays 0 while awake → health damage (2/tick) | `[x]` | `exhaustion_damage` event; slower than starvation/unhappiness (2 vs 5/tick) |
| Sleep decay: hunger/happiness lose 1 every 5th sleeping tick | `[x]` | Prevents infinite stat preservation during extended sleep |
| Sickness health drain message | `[x]` | `sickness_damage` event; humanised in event log |
| Death screen with age/stage stats | `[x]` | |
| Senior natural death (random chance after age ≥ 365d) | `[x]` | |
| Peaceful death animation | `[ ]` | Covered by `died` reaction in section 5.6 |
| `[S]` `gotchi.offlineDecayMaxFraction` (default 0.60) | `[ ]` | Cap offline stat loss; value hardcoded, expose as setting |

---

## 10. Status Bar

| Feature | Status | Notes |
|---------|--------|-------|
| Mood emoji + name displayed | `[x]` | |
| Click to focus sidebar | `[x]` | Uses `gotchiView.focus` command |
| Attention-needed indicator (⚠) | `[ ]` | |
| `[S]` `gotchi.statusBarEnabled` (default true) | `[ ]` | |

---

## 11. Persistence

| Feature | Status | Notes |
|---------|--------|-------|
| Full state saved to globalState on every action | `[x]` | |
| State loaded and restored on extension activation | `[x]` | |
| Offline decay applied on load (capped at 60%) | `[x]` | |
| State migration when PetState schema changes | `[ ]` | Add a `schemaVersion` field |
| Export / import pet via JSON file | `[ ]` | For sharing or backup |

---

## 11.1 High Score

| Feature | Status | Notes |
|---------|--------|-------|
| Record best-ever pet (by age) on death | `[x]` | Stored via `saveHighScore()` in `persistence.ts` |
| Display high score on dead screen | `[x]` | Shows name, age, stage, and real-time duration |
| Display high score on new-game (setup) screen | `[x]` | `renderSetupHighScore()` called from `showScreen("setup")`; hidden when no record exists |

---

## 12. Settings Reference

All settings live under the `gotchi.*` namespace in VS Code settings.

| Setting | Type | Default | Description | Status |
|---------|------|---------|-------------|--------|
| `gotchi.fontSize` | enum | `normal` | Sidebar font size: `small` / `normal` / `large` | `[x]` |
| `gotchi.reducedMotion` | boolean | `false` | Disable all pet movement and reaction animations | `[x]` |
| `gotchi.petStageHeight` | number | `96` | Height in px of the pet stage canvas (range 60–200) | `[x]` |
| `gotchi.codingRewards` | boolean | `true` | Enable coding-activity stat rewards | `[ ]` |
| `gotchi.codingRewardThrottleSeconds` | number | `30` | Minimum seconds between coding rewards | `[ ]` |
| `gotchi.autoWake` | boolean | `true` | Auto-wake pet when energy reaches 100 | `[ ]` |
| `gotchi.enableAttentionCalls` | boolean | `true` | Enable/disable the entire attention-call mechanic | `[x]` |
| `gotchi.idleThresholdSeconds` | integer | `60` | Seconds of no activity before idle mode (min 10) | `[x]` |
| `gotchi.idleDeepThresholdSeconds` | integer | `600` | Seconds of no activity before deep-idle mode (min 30) | `[x]` |
| `gotchi.customPrimaryColor` | string | `#ff8c00` | Pet body colour for the "Custom" palette | `[x]` |
| `gotchi.customSecondaryColor` | string | `#ffffff` | Pet eyes/details colour for the "Custom" palette | `[x]` |
| `gotchi.customBackgroundColor` | string | `#1a1a2e` | Canvas background colour for the "Custom" palette | `[x]` |
| `gotchi.alwaysShowGamePicker` | boolean | `false` | Always show game select screen before playing | `[ ]` |
| `gotchi.leftRightTimeoutMs` | number | `3000` | Milliseconds to respond in Left/Right game | `[ ]` |
| `gotchi.simonFlashDurationMs` | number | `600` | Flash duration in Pattern Memory game | `[ ]` |
| `gotchi.catchTheBugDifficulty` | enum | `normal` | `easy` / `normal` / `hard` | `[ ]` |
| `gotchi.typeSprintWordLength` | enum | `normal` | `short` (3–5 chars) / `normal` (3–8 chars) | `[ ]` |
| `gotchi.typeSprintTimeoutMs` | number | `5000` | Milliseconds to type word in Type Sprint | `[ ]` |
| `gotchi.offlineDecayMaxFraction` | number | `0.60` | Maximum fraction of stats lost while extension is off | `[ ]` |
| `gotchi.statusBarEnabled` | boolean | `true` | Show pet in VS Code status bar | `[ ]` |
| `gotchi.tickIntervalSeconds` | number | `6` | Game tick rate (lower = faster game time; min 1) | `[ ]` |

---

## 13. Future / Stretch Features

These are lower-priority ideas that require significant design work.

| Feature | Notes |
|---------|-------|
| Gotchi Points currency | Earned from minigame wins; spent in an in-game shop for cosmetics |
| In-game shop | Buy accessories, backgrounds, or extra colour palettes |
| Pixel-art sprite assets | Replace procedural canvas drawing with actual PNG sprite sheets |
| Sprite animation frames | Idle walk cycle, happy, sad, sleeping, eating — 2–4 frame flip-book per mood |
| Redesign game art | Replace placeholder minigame visuals (L/R doors, H/L number display) with pixel-art canvas graphics consistent with the pet sprite style |
| Egg-hatch animation | Wiggle → crack → burst sequence (fits naturally into reaction queue) |
| Sound effects | Short 8-bit clips (optional; respect system/VS Code mute and `gotchi.reducedMotion`) |
| Day/night cycle | Canvas background shifts with system clock; affects stat decay rates |
| Multiple simultaneous pets | Tabbed or scrollable sidebar; pets can interact |
| Marriage mechanic | Two users' pets meet via a shared code (e.g. VS Code Live Share) |
| Seasonal / holiday characters | Special evolution paths unlocked on calendar dates |
| New pet types via extension pack | Contribution point so third-party packs can add types |
| Leaderboard | Opt-in age record sharing via VS Code Settings Sync |

---

## 14. Suggested Implementation Order

1. **Stage area resize** — widen canvas to sidebar width; sets up room for movement (section 5.1)
2. **Animation loop** — replace one-shot draw with rAF loop; reduced-motion fallback (section 5.2)
3. **Idle wandering** — random drift + boundary bounce + direction flip (sections 5.3, 5.5, 5.7)
4. **Mood locomotion** — speed and pattern vary by mood/state (section 5.4)
5. **Reaction animations** — event-driven one-shots; queue architecture (section 5.6)
6. **Weight in UI** — low effort; value already in state (`weight` field)
7. **Overfeeding feedback** — disable Feed Meal at max; snack warning text
8. **Minigame overlay architecture** — generic overlay + game-select screen
9. **Left / Right minigame** — simplest interactive game; validates overlay pattern
10. **Higher or Lower minigame** — pure JS, no canvas required
11. **Pattern Memory (Simon)** — button flash timing; most polished feel
12. **Catch the Bug** — canvas animation; most visually engaging
13. **Type Sprint** — keyboard-focused; unique to a code editor context
14. **Attention calls** — poll state each tick; surface in status bar + event log
15. **Sleep/wake UX polish** — Lights Off button, auto-wake, visual night mode
16. **Settings wiring** — expose remaining `gotchi.*` settings in `package.json`
17. **Coding activity streaks** — build on existing file-save listener
