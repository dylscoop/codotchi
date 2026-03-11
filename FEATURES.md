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
| Energy       | 0–100  | `[x]`  | Depleted by play; restored during sleep |
| Health       | 0–100  | `[x]`  | Drops from starvation, unhappiness, sickness |
| Discipline   | 0–100  | `[x]`  | Affected by praise/scold; feeds into care score |
| Weight       | 1–99   | `[~]`  | Tracked internally; not yet shown in the UI |
| Age (days)   | int    | `[x]`  | Displayed in info line |
| Care Score   | 0.0–1.0| `[~]`  | Computed continuously; drives evolution tier |

---

## 2. Life Cycle

### 2.1 Stages

| Stage  | Duration        | Status | Notes |
|--------|-----------------|--------|-------|
| Egg    | ~2 min          | `[x]`  | Auto-hatches after timer |
| Baby   | ~10 min         | `[x]`  | Requires minimal care |
| Child  | ~1 hr           | `[x]`  | First stage of active care |
| Teen   | ~3 hr           | `[x]`  | 2 possible evolution variants per type |
| Adult  | Indefinite      | `[x]`  | Up to 3 variants per type based on care score |
| Senior | After ~24 h adult| `[x]` | Random daily death chance; peaceful death |
| Dead   | Terminal        | `[x]`  | Shows age at death; prompts new game |

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
| Feed Meal   | Hunger +20, Weight +1                            | Max 4 meals per wake cycle               | `[x]`  |
| Feed Snack  | Happiness +10, Weight +2                         | 3 consecutive snacks triggers sickness   | `[x]`  |
| Play        | Happiness +15, Energy −10, Weight −1             | Requires Energy > 10; launches minigame  | `[~]`  |
| Sleep       | Energy regenerates; cannot act while sleeping    | —                                        | `[x]`  |
| Wake        | Manually end sleep                               | —                                        | `[x]`  |
| Clean       | Removes all droppings; prevents sickness         | —                                        | `[x]`  |
| Medicine    | Health +20; cures sickness after 3 doses         | —                                        | `[x]`  |
| Praise      | Discipline +10                                   | —                                        | `[x]`  |
| Scold       | Discipline +10                                   | —                                        | `[x]`  |
| Light off   | Force sleep early (manual bedtime)               | —                                        | `[ ]`  |

### 3.1 Attention Calls (Misbehaviour)

The original Tamagotchi would call for attention unprompted. Implement an
"attention needed" flag that appears in the sidebar and status bar, requiring
the player to respond within a time window.

| Trigger                        | Attention Type  | Correct Response | Penalty if ignored       | Status |
|--------------------------------|-----------------|------------------|--------------------------|--------|
| Hunger < 20                    | Hungry call     | Feed             | Hunger continues dropping| `[ ]`  |
| Happiness < 20                 | Sad call        | Play or praise   | Happiness drops faster   | `[ ]`  |
| Poop present                   | Dirty call      | Clean            | Sickness risk after 5 min| `[ ]`  |
| Sick                           | Sick call       | Medicine         | Health drops faster      | `[ ]`  |
| Pet misbehaves (random, child+)| Misbehaviour    | Scold            | Discipline −5 if ignored | `[ ]`  |
| Pet does good deed (random)    | Good deed       | Praise           | Missed happiness boost   | `[ ]`  |

Status bar and event log should surface active attention calls. `[S]` Add a
setting `gotchi.enableAttentionNotifications` to show a VS Code notification
badge when attention is needed.

---

## 4. Minigames

Currently `Play` resolves immediately with a 65/35 random win/lose in the
client JS — no player interaction. All games below replace that with a real
interactive UI rendered in the sidebar webview.

Each game is launched in a temporary **game overlay** rendered inside the
sidebar (a `<div>` that covers the game screen for the duration of the game,
then disappears). Results are still sent to the engine as `win` / `lose` with
the `game` identifier.

The `Play` button should open a **game select screen** once more than one
minigame is implemented (or always show the screen if `gotchi.alwaysShowGamePicker`
is enabled).

### 4.1 Left / Right (Classic Tamagotchi)

*The closest port of the original Tamagotchi direction game.*

- Two doors are drawn on the canvas (or as styled `<div>` blocks).
- The pet hides behind one. A "ready" animation plays for 0.5 s.
- A 3-second countdown is shown.
- Player clicks **Left** or **Right** before time runs out.
- The door opens to reveal the pet (correct door) or nothing (wrong door).
- **Win**: Happiness +15, Energy −10.
- **Lose / timeout**: Happiness +5 (consolation).
- Rounds: 3 per session; best-of-3 determines overall win/lose sent to engine.
- `[S]` Setting `gotchi.leftRightTimeoutMs` (default 3000 ms) — adjustable for
  accessibility.

Status: `[ ]`

### 4.2 Pattern Memory (Simon Says)

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
- **Win** (≥ 4 correct): Happiness +15, Energy −10.
- **Lose** (≤ 3 correct): Happiness +5.

Status: `[ ]`

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

### Minigame Architecture Notes

- All game logic (timers, scoring, animations) runs entirely in `sidebar.js`.
- Game results are sent to the extension host as:
  ```js
  vscode.postMessage({ command: "play", game: "<id>", result: "win"|"partial"|"lose" })
  ```
- `gameEngine.ts` `applyMinigameResult()` maps game id + result → stat deltas.
- Add new games by: (1) adding an overlay render function in `sidebar.js`,
  (2) wiring up its result message, (3) adding a case in `applyMinigameResult`.

---

## 5. Interaction Improvements

Features that deepen the existing care actions.

### 5.1 Weight Display and Management

| Feature | Status | Notes |
|---------|--------|-------|
| Show weight in info line (next to age/stage) | `[ ]` | Value exists in state; not rendered |
| Weight-related mood modifier (overweight → sad) | `[ ]` | |
| Play button disabled when energy < 10 (show tooltip) | `[ ]` | Logic exists; no UI feedback |

### 5.2 Sleep / Wake Cycle

| Feature | Status | Notes |
|---------|--------|-------|
| Manual "Lights Off" button to put pet to sleep early | `[ ]` | |
| Auto-wake after energy reaches 100 | `[ ]` | |
| `[S]` `gotchi.autoWake` (default true) — auto-wake when energy full | `[ ]` | |
| Sleep schedule: pet refuses to sleep if recently slept | `[ ]` | |
| Visual night-mode on canvas when sleeping | `[ ]` | Darken canvas background |

### 5.3 Overfeeding Feedback

| Feature | Status | Notes |
|---------|--------|-------|
| Show remaining meals allowed this cycle in the UI | `[ ]` | mealsGivenThisCycle tracked; not shown |
| Disable Feed Meal button when at max meals | `[ ]` | |
| Show snack warning after 2 consecutive snacks | `[ ]` | |

### 5.4 Sickness UX

| Feature | Status | Notes |
|---------|--------|-------|
| Medicine doses remaining shown on button | `[ ]` | |
| Disable Feed/Play while sick | `[ ]` | Engine enforces; no UI feedback |
| Sick animation (canvas shake or flicker) | `[ ]` | |

---

## 6. Coding Activity Rewards

| Feature | Effect | Status | Notes |
|---------|--------|--------|-------|
| File save reward | Happiness +5, Discipline +2 | `[x]` | Throttled to 1 per 30 s |
| Save streak (5 saves / 30 min) | Happiness +10 bonus | `[ ]` | Partially in DESIGN.md |
| Save streak (10 saves / 1 hr) | Happiness +15, Weight −1 | `[ ]` | |
| Git commit event | Happiness +10 | `[ ]` | Listen via terminal or SCM API |
| Test pass event | Happiness +5, Energy −5 | `[ ]` | Parse task output |
| `[S]` `gotchi.codingRewards` (default true) | Enable/disable all coding rewards | `[ ]` | |
| `[S]` `gotchi.codingRewardThrottleSeconds` (default 30) | Reward cooldown | `[ ]` | |

---

## 7. Sickness & Death

| Feature | Status | Notes |
|---------|--------|-------|
| Sickness from overfeeding snacks (>3 consecutive) | `[x]` | |
| Sickness from uncleaned poops (>3) | `[x]` | |
| Sickness from hunger + happiness both critical | `[x]` | |
| Health reaches 0 → death | `[x]` | |
| Hunger stays 0 for 3+ ticks → health damage | `[x]` | |
| Death screen with age/stage stats | `[x]` | |
| Senior natural death (random chance after day 20) | `[x]` | |
| Peaceful death animation | `[ ]` | Ghost/angel sprite |
| `[S]` `gotchi.offlineDecayMaxFraction` (default 0.60) | Cap offline stat loss | `[ ]` | Value hardcoded; expose as setting |

---

## 8. Status Bar

| Feature | Status | Notes |
|---------|--------|-------|
| Mood emoji + name displayed | `[x]` | |
| Click to focus sidebar | `[ ]` | |
| Attention-needed indicator (⚠) | `[ ]` | |
| `[S]` `gotchi.statusBarEnabled` (default true) | `[ ]` | |

---

## 9. Persistence

| Feature | Status | Notes |
|---------|--------|-------|
| Full state saved to globalState on every action | `[x]` | |
| State loaded and restored on extension activation | `[x]` | |
| Offline decay applied on load (capped at 60%) | `[x]` | |
| State migration when PetState schema changes | `[ ]` | Add a `schemaVersion` field |
| Export / import pet via JSON file | `[ ]` | For sharing or backup |

---

## 10. Settings Reference

All settings live under the `gotchi.*` namespace in VS Code settings.

| Setting | Type | Default | Description | Status |
|---------|------|---------|-------------|--------|
| `gotchi.codingRewards` | boolean | `true` | Enable coding-activity stat rewards | `[ ]` |
| `gotchi.codingRewardThrottleSeconds` | number | `30` | Minimum seconds between coding rewards | `[ ]` |
| `gotchi.autoWake` | boolean | `true` | Auto-wake pet when energy reaches 100 | `[ ]` |
| `gotchi.enableAttentionNotifications` | boolean | `false` | Show VS Code notification badge when attention needed | `[ ]` |
| `gotchi.alwaysShowGamePicker` | boolean | `false` | Always show game select screen before playing | `[ ]` |
| `gotchi.leftRightTimeoutMs` | number | `3000` | Milliseconds to respond in Left/Right game | `[ ]` |
| `gotchi.simonFlashDurationMs` | number | `600` | Flash duration in Pattern Memory game | `[ ]` |
| `gotchi.catchTheBugDifficulty` | enum | `normal` | `easy` / `normal` / `hard` | `[ ]` |
| `gotchi.typeSprintWordLength` | enum | `normal` | `short` (3–5 chars) / `normal` (3–8 chars) | `[ ]` |
| `gotchi.typeSprintTimeoutMs` | number | `5000` | Milliseconds to type word in Type Sprint | `[ ]` |
| `gotchi.offlineDecayMaxFraction` | number | `0.60` | Maximum fraction of stats lost while extension is off | `[ ]` |
| `gotchi.statusBarEnabled` | boolean | `true` | Show pet in VS Code status bar | `[ ]` |
| `gotchi.tickIntervalSeconds` | number | `5` | Game tick rate (lower = faster game time; min 1) | `[ ]` |

---

## 11. Future / Stretch Features

These are lower-priority ideas that require significant design work.

| Feature | Notes |
|---------|-------|
| Gotchi Points currency | Earned from minigame wins; spent in an in-game shop for cosmetics |
| In-game shop | Buy accessories, backgrounds, or extra colour palettes |
| Pixel-art sprite assets | Replace procedural canvas drawing with actual PNG sprite sheets |
| Sprite animation frames | Idle, happy, sad, sleeping, eating, playing — 2-frame flip-book |
| Egg-hatch animation | Wiggle → crack → burst sequence on canvas |
| Sound effects | Short 8-bit clips (optional; respect system/VS Code mute) |
| Day/night cycle | Canvas background shifts with system clock; affects stat decay rates |
| Multiple simultaneous pets | Tabbed or scrollable sidebar; pets can interact |
| Marriage mechanic | Two users' pets meet via a shared code (e.g. VS Code Live Share) |
| Seasonal / holiday characters | Special evolution paths unlocked on calendar dates |
| New pet types via extension pack | Contribution point so third-party packs can add types |
| Leaderboard | Opt-in age record sharing via VS Code Settings Sync |

---

## 12. Suggested Implementation Order

Priority order for the features the user wants first (interactions + minigames):

1. **Weight in UI** — low effort; value already in state (`weight` field)
2. **Overfeeding feedback** — disable Feed Meal at max; snack warning text
3. **Minigame overlay architecture** — build the generic overlay + game-select screen first
4. **Left / Right minigame** — simplest interactive game; validates the overlay pattern
5. **Higher or Lower minigame** — pure JS, no canvas required
6. **Pattern Memory (Simon)** — needs button flash timing; most polished feel
7. **Catch the Bug** — canvas animation; most visually engaging
8. **Type Sprint** — keyboard-focused; unique to a code editor context
9. **Attention calls** — poll state each tick; surface in status bar + event log
10. **Sleep/wake UX polish** — Lights Off button, auto-wake, visual night mode
11. **Settings wiring** — expose `gotchi.*` settings in `package.json`; read them at runtime
12. **Coding activity streaks** — build on existing file-save listener
