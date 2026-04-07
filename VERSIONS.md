# Version History

## v0.10.3 — current

### Changes from v0.10.2

| File | What changed |
|------|-------------|
| `opencode-codotchi/package.json` | Version bumped `0.10.2` → `0.10.3` |
| `.opencode/plugins/gotchi.ts` | Added `terminalEnabled` persistence across restarts; added session coding activity tracking (`sessionFilesEdited`, `sessionStartMs`); added `artHeader()` showing ASCII art + contextual speech bubble in every tool response; added `buildContextualSpeech` call combining pet mood and coding stats |
| `opencode-codotchi/src/index.ts` | Mirrored from `.opencode/plugins/gotchi.ts` (same changes) |
| `.opencode/plugins/asciiArt.ts` | Added `buildContextualSpeech()` helper combining pet mood + session coding activity; redesigned ASCII sprites for all 6 stages (distinct silhouettes) |
| `opencode-codotchi/src/asciiArt.ts` | Mirrored from `.opencode/plugins/asciiArt.ts` (same changes) |
| `.opencode/commands/codotchi.md` | Added `/codotchi new_game` entry; updated `/codotchi on` description to "every tool response" |
| `opencode-codotchi/commands/codotchi.md` | Mirrored from `.opencode/commands/codotchi.md` (same changes) |
| `vscode/FEATURES.md` | Updated OpenCode integration rows for v0.10.3 features |
| `README.md` | Install filenames updated to `0.10.3` |
| `vscode/README.md` | Install filenames updated to `0.10.3` |
| `pycharm/README.md` | Install filenames updated to `0.10.3` |
| `VERSIONS.md` | Added v0.10.3 section |
| `.opencode/plugins/gotchi.ts` | Removed `experimental.text.complete` hook (BUGFIX-041); removed `artHeader()` from `status` case (BUGFIX-042); added `Weight` to plain-text stats line (BUGFIX-043); replaced "Play with me?" phrases with third-person variants (BUGFIX-044) |
| `opencode-codotchi/src/index.ts` | Mirrored from `.opencode/plugins/gotchi.ts` (same changes) |
| `.opencode/plugins/asciiArt.ts` | Added `RESET` guard to `buildSpeechBubble` and `buildStatusBlock` output (BUGFIX-045); widened `buildBubble` default `maxWidth` 36 → 40; replaced "lonely" phrase (BUGFIX-044) |
| `opencode-codotchi/src/asciiArt.ts` | Mirrored from `.opencode/plugins/asciiArt.ts` (same changes) |
| `.opencode/commands/codotchi.md` | Removed `## Usage` section (was injected on every invocation); added `help` action; fixed `status` output format instructions |
| `opencode-codotchi/commands/codotchi.md` | Mirrored from `.opencode/commands/codotchi.md` (same changes) |
| `BUGFIXES.md` | Added BUGFIX-041 through BUGFIX-045 |
| `.opencode/skills/release-checklist/SKILL.md` | Made local reinstall (`node bin/install.js --install`) mandatory rather than optional |

### Features added

**ASCII art in every OpenCode tool response** — when terminal display is enabled
(`/codotchi on`), the pet's ASCII sprite and a contextual speech bubble appear
as part of every tool response, not just `/codotchi status`. The speech bubble
combines pet mood with session coding activity (files edited + session time) for
a dynamic message on every action. The `terminalEnabled` flag now persists
across OpenCode restarts. Sprites were redesigned with distinct silhouettes for
each of the 6 life stages.

### Bug fixes

- **BUGFIX-041** — Removed `experimental.text.complete` hook that caused double sprite and raw ANSI codes in markdown chat
- **BUGFIX-042** — Removed duplicate `artHeader()` call in `status` case that drew the sprite twice
- **BUGFIX-043** — Added missing `Weight` field to plain-text stats line in `/codotchi status`
- **BUGFIX-044** — Replaced first-person "Play with me?" phrases with third-person "Gotchi wants to play"
- **BUGFIX-045** — Added leading `RESET` to `buildSpeechBubble` and `buildStatusBlock` to prevent ANSI colour bleed

---

## v0.10.2 — previous

### Changes from v0.10.1

| File | What changed |
|------|-------------|
| `vscode/package.json` | Version bumped `0.10.1` → `0.10.2` |
| `pycharm/build.gradle.kts` | Version bumped `0.10.1` → `0.10.2` |
| `pycharm/src/main/resources/META-INF/plugin.xml` | Version bumped `0.10.1` → `0.10.2` |
| `opencode-codotchi/package.json` | Version bumped `0.10.1` → `0.10.2` |
| `opencode-codotchi/bin/install.js` | Fixed Windows config path bug: removed `win32 → %APPDATA%` branch; now always uses `XDG_CONFIG_HOME ?? ~/.config` (same logic OpenCode itself uses on all platforms) |
| `opencode-codotchi/README.md` | Corrected installer "What it does" section: replaced `%APPDATA%` Windows note with XDG note; updated zip filename to `0.10.2` |

### Bug fixes

**BUGFIX: installer wrote files to `%APPDATA%\opencode` on Windows instead of `~\.config\opencode`**
— On Windows, OpenCode stores its config in `~\.config\opencode` (XDG convention),
not `%APPDATA%\opencode`. The installer had a platform branch that resolved to the
wrong directory, so `/codotchi` was never available after install. Fixed by using
`XDG_CONFIG_HOME ?? os.homedir()/.config` unconditionally on all platforms.

---

## v0.10.1

### Changes from v0.10.0

| File | What changed |
|------|-------------|
| `vscode/package.json` | Version bumped `0.10.0` → `0.10.1` |
| `pycharm/build.gradle.kts` | Version bumped `0.10.0` → `0.10.1` |
| `pycharm/src/main/resources/META-INF/plugin.xml` | Version bumped `0.10.0` → `0.10.1` |
| `.opencode/commands/gotchi.md` | Renamed to `codotchi.md`; all `/gotchi` slash command references updated to `/codotchi` |
| `.opencode/plugins/gotchi.ts` | Updated comment block and all runtime strings: `/gotchi` → `/codotchi` |
| `.opencode/plugins/asciiArt.ts` | Updated comment reference `/gotchi status` → `/codotchi status` |
| `opencode-codotchi/` | New directory — npm-distributable OpenCode plugin package (`opencode-codotchi`) |
| `opencode-codotchi/src/index.ts` | Plugin entry point (adapted from `gotchi.ts`) |
| `opencode-codotchi/src/gameEngine.ts` | Copy of `.opencode/plugins/gameEngine.ts` |
| `opencode-codotchi/src/asciiArt.ts` | Copy of `.opencode/plugins/asciiArt.ts` |
| `opencode-codotchi/commands/codotchi.md` | Copy of `.opencode/commands/codotchi.md` |
| `opencode-codotchi/bin/install.js` | CLI script: copies slash command to `~/.config/opencode/commands/` |
| `opencode-codotchi/package.json` | npm package manifest (`name: "opencode-codotchi"`, `version: "0.10.1"`) |
| `opencode-codotchi/tsconfig.json` | TypeScript compiler config for the npm package |
| `opencode-codotchi/README.md` | npm package README with global install instructions |
| `opencode-codotchi/config/opencode.json` | New file — minimal example OpenCode config; copied to `~/.config/opencode/opencode.json` by `--install` if not already present |
| `opencode-codotchi/bin/install.js` | Extended `--install`: now also copies `config/opencode.json` → `~/.config/opencode/opencode.json` (skip if exists); updated usage message |
| `opencode-codotchi/package.json` | Added `"config/"` to `"files"` array so `config/opencode.json` is included in npm publish |
| `opencode-codotchi/README.md` | Updated Global install section: `--install` now handles both slash command and config file in one step |
| `README.md` | Updated Option B install steps: simplified to one `npx opencode-codotchi --install` command |
| `.opencode/skills/release-checklist/SKILL.md` | Added Step 3e: OpenCode npm package sync rule and two new checklist items |
| `README.md` | Install filenames updated to `0.10.1`; OpenCode section updated with npm install instructions; updated platform table |
| `README.md` | Added note that `opencode-codotchi` is not yet published to npm and requires `npm login` / `NPM_TOKEN` before global install works |
| `opencode-codotchi/README.md` | Added same unpublished-package note at top of Global install section |
| `opencode-codotchi/README.md` | Global install section rewritten: split into Option A (from source — `node bin/install.js --install`) and Option B (from npm — `npx opencode-codotchi --install`); local path works without npm publish |
| `README.md` | Option B rewritten: split into from-source (`node bin/install.js --install`) and from-npm (`npx opencode-codotchi --install`) paths with clear gating on the npm path |
| `opencode-codotchi/bin/install.js` | Rewritten: now copies TS plugin source files to `~/.config/opencode/plugins/` and creates/updates `~/.config/opencode/package.json` with `@opencode-ai/plugin` dep; removed `config/opencode.json` copy (local plugin path does not need a `"plugin"` config entry) |
| `opencode-codotchi/src/index.ts` | Updated header comment to document new zip-based install method |
| `opencode-codotchi/scripts/package.js` | New file — Node.js script that creates the distributable zip; run via `node scripts/package.js` from `opencode-codotchi/` |
| `opencode-codotchi/opencode-codotchi-0.10.1.zip` | New distributable zip for v0.10.1; contains `bin/`, `commands/`, `src/`, `package.json`, `README.md`; no clone required |
| `opencode-codotchi/README.md` | Global install rewritten: zip download (Option A) is now the primary path; from source is Option B; from npm (once published) is Option C; updated Building from source section |
| `README.md` | Option B rewritten: zip download is primary with macOS/Linux and Windows commands; from source and from npm kept as secondary paths |
| `.opencode/skills/release-checklist/SKILL.md` | Added Step 3f: always ask before rebuilding the opencode zip at release time; added checklist item 13 for zip artifact |
| `vscode/README.md` | Install filenames updated to `0.10.1` |
| `pycharm/README.md` | Install filenames updated to `0.10.1` |
| `vscode/FEATURES.md` | OpenCode integration row updated to reflect `/codotchi` and npm package |
| `VERSIONS.md` | Added v0.10.1 section |

### Features added

**Renamed `/gotchi` slash command → `/codotchi`** — the OpenCode slash command
is now `/codotchi` to avoid name collisions and align with the package name.
All runtime strings (greetings, toasts, speech bubbles) updated accordingly.

**`opencode-codotchi` npm package** — globally-installable OpenCode plugin
distribution format (the `.vsix` equivalent for OpenCode):
- Add `"plugin": ["opencode-codotchi"]` to `~/.config/opencode/opencode.json`
  to have OpenCode automatically download and install the plugin via Bun
- Run `npx opencode-codotchi --install` once to copy the `/codotchi` slash
  command definition to `~/.config/opencode/commands/`
- Package contains: `src/index.ts` (plugin), `src/gameEngine.ts`,
  `src/asciiArt.ts`, `commands/codotchi.md`, `bin/install.js`
- Three separate copies of `gameEngine.ts` and `asciiArt.ts` are intentional
  (`.opencode/plugins/`, `opencode-codotchi/src/`, and `vscode/src/`) —
  the release-checklist skill now enforces keeping them in sync

---

## v0.10.0 — previous

### Changes from v0.9.4

| File | What changed |
|------|-------------|
| `vscode/package.json` | Version bumped `0.9.4` → `0.10.0` |
| `pycharm/build.gradle.kts` | Version bumped `0.9.4` → `0.10.0` |
| `pycharm/src/main/resources/META-INF/plugin.xml` | Version bumped `0.9.4` → `0.10.0` |
| `vscode/src/persistence.ts` | Added `getSharedStatePath()`, `saveSharedState()`, `loadSharedState()`; `saveState()` now also writes to shared JSON file; `loadState()` now prefers shared file when its `savedAt` timestamp is newer |
| `pycharm/src/main/kotlin/com/gotchi/GotchiPersistence.kt` | Added `getSharedStatePath()`, `saveToSharedFile()`, `loadFromSharedFile()`, inner class `SharedStateFile`; `savePetState()` also writes to shared file; `loadPetState()` prefers shared file when its `savedAt` is newer |
| `.opencode/plugins/gameEngine.ts` | New file — verbatim copy of `vscode/src/gameEngine.ts` (zero VS Code API dependencies) for use by the OpenCode plugin |
| `.opencode/plugins/asciiArt.ts` | New file — ASCII art renderer: 6 stages × 5 moods, `renderSpeechBubble()`, `renderStatus()`, `renderToast()` |
| `.opencode/plugins/gotchi.ts` | New file — main OpenCode plugin; tick loop, `file.edited` / `session.idle` / `server.connected` event hooks, `gotchi` tool with 10 actions |
| `.opencode/commands/gotchi.md` | New file — `/gotchi` slash command definition; maps subcommands to `gotchi` tool actions |
| `README.md` | Install filenames updated to `0.10.0`; added OpenCode plugin section |
| `vscode/README.md` | Install filenames updated to `0.10.0` |
| `pycharm/README.md` | Install filenames updated to `0.10.0` |
| `vscode/FEATURES.md` | Added OpenCode integration row to Section 11 (Persistence) |
| `VERSIONS.md` | Added v0.10.0 section |

### Features added

**Cross-IDE shared state bridge** — VS Code, PyCharm, and the new OpenCode
plugin all read from and write to a single shared JSON file on disk:
- Linux/macOS: `~/.config/gotchi/state.json`
- Windows: `%APPDATA%/gotchi/state.json`

Format:
```json
{ "state": { ...serialised PetState fields... }, "savedAt": <epoch ms> }
```
On load, whichever copy has the larger `savedAt` wins and is promoted into the
IDE's own storage. This allows the pet to be seamlessly handed off between
IDEs.

**OpenCode terminal plugin** — a native OpenCode plugin (`gotchi.ts`) that
runs the same game engine inside the OpenCode TUI:
- **Tick loop**: pet ticks every 6 s via `setInterval` inside the plugin
- **Event hooks**: reacts to `file.edited` (coding reward), `session.idle`
  (idle notification), and `server.connected` (greeting on startup/reconnect)
- **`gotchi` tool**: supports 10 actions — `status`, `feed`, `snack`, `play`,
  `pat`, `sleep`, `wake`, `clean`, `medicine`, `new_game`
- **ASCII art renderer** (`asciiArt.ts`): 30 distinct art frames (6 stages × 5
  moods), ANSI-coloured speech bubbles and status lines, toast notifications
- **`/gotchi` slash command**: maps `/gotchi`, `/gotchi feed`, etc. to the tool

---

## v0.9.4 — previous

### Changes from v0.9.3

| File | What changed |
|------|-------------|
| `vscode/src/gameEngine.ts` | Added `computeOldAgeDeathChance` (age-scaled lerp formula); added `rollOldAgeSickness`; wired both into `tick()` at day boundary; added 4 new constants: `OLD_AGE_DEATH_PEAK_AGE_DAYS`, `OLD_AGE_DEATH_PEAK_BEST_CARE_CHANCE`, `OLD_AGE_DEATH_PEAK_WORST_CARE_CHANCE`, `OLD_AGE_SICK_CHANCE_MULTIPLIER` |
| `vscode/src/extension.ts` | Added IDE popup notification for `died_of_old_age` event in `handleStateUpdate()` |
| `vscode/tests/unit/gameEngine.test.ts` | 13 new tests covering age-scaled death chance, senior sickness rolls, and boundary conditions (224 tests total) |
| `vscode/media/sidebar.js` | Updated `died_of_old_age` event log text; added `became_sick_old_age` entry |
| `pycharm/src/main/kotlin/com/gotchi/engine/Constants.kt` | Added 4 new constants matching the TS constants (`OLD_AGE_DEATH_BASE_CHANCE_PER_DAY`, `OLD_AGE_DEATH_RISK_MULTIPLIER`, `OLD_AGE_DEATH_PEAK_AGE_DAYS`, `OLD_AGE_DEATH_PEAK_BEST_CARE_CHANCE`, `OLD_AGE_DEATH_PEAK_WORST_CARE_CHANCE`, `OLD_AGE_SICK_CHANCE_MULTIPLIER`) |
| `pycharm/src/main/kotlin/com/gotchi/engine/GameEngine.kt` | Replaced dead-code `checkOldAgeDeath` with `computeOldAgeDeathChance`, `rollOldAgeDeath`, and `rollOldAgeSickness`; wired both rolls into `tick()` at day boundary |
| `pycharm/src/main/kotlin/com/gotchi/GotchiPlugin.kt` | Added IntelliJ balloon notification for `died_of_old_age` event in `broadcastState()` |
| `pycharm/src/main/resources/webview/sidebar.js` | Updated `died_of_old_age` event log text; added `became_sick_old_age` entry |
| `vscode/FEATURES.md` | Updated Section 9 senior natural death row to document age-scaled formula, sickness mechanic, and special death message |
| `VERSIONS.md` | Added v0.9.4 section |

### Features added

**Age-scaled senior death chance** — the per-day probability of natural death ramps
linearly from onset values at day 365 (best care: 0.1%/day, worst care: 1.0%/day) up
to peak values at day 1825 (5 in-game years; best care: 5%/day, worst care: 10%/day),
then stays capped at peak. The riskScore driving the range is the average of three
longevity factors: low happiness, unhealthy weight, and low discipline.

Formula:
```
ageFactor = clamp((ageDays − 365) / (1825 − 365), 0, 1)
minChance = lerp(0.001, 0.05,  ageFactor)   ← best care (riskScore = 0)
maxChance = lerp(0.010, 0.10,  ageFactor)   ← worst care (riskScore = 1)
chance    = lerp(minChance, maxChance, riskScore)
```

**Senior random sickness** — once per day boundary, senior pets also roll for an
age-related illness at 3× the current death-chance rate (`OLD_AGE_SICK_CHANCE_MULTIPLIER = 3`).
Fires the `became_sick_old_age` event and shows "came down with an age-related illness."
in the event log. Skipped if the pet is already sick.

**Special old-age death message** — `died_of_old_age` now renders as
"passed away of unforeseen natural causes due to old age." in the event log
(was "passed away of old age..."). Both VS Code and PyCharm fire an IDE popup
notification on this event (VS Code: `showInformationMessage`; PyCharm: `fireAttentionNotification`).

---

## v0.9.3 — previous

### Changes from v0.9.2

| File | What changed |
|------|-------------|
| `pycharm/src/main/kotlin/com/gotchi/GotchiPlugin.kt` | Added `startTicker()` (idempotent) and `stopTicker()` private helpers; `initialize()` now calls `startTicker()` instead of inlining `scheduleWithFixedDelay`; `applicationActivated` callback calls `startTicker()` on focus-gain; new `applicationDeactivated` callback saves state immediately and calls `stopTicker()` on focus-loss (unless AI mode is on); `dispose()` calls `stopTicker()` instead of `tickFuture?.cancel(false)` |
| `vscode/src/extension.ts` | `onDidChangeWindowState` focus-loss now skips `stopTicker()` when `aiMode` is on; focus-gain now skips `reloadAndRefreshUI()` when `aiMode` is on (in-memory state is already current); initial ticker start is unconditional when `aiMode` is on |
| `vscode/FEATURES.md` | Added PyCharm focus-gated ticker row and AI-mode exemption note to Section 11 (Persistence) |
| `VERSIONS.md` | Added v0.9.3 section |

### Bugs fixed

**PyCharm ticker runs while IntelliJ is unfocused** — `GotchiPlugin` is an
application-level singleton, so there was only one `tickFuture` across all
project windows (no multi-window divergence). However, the ticker continued
running while IntelliJ was in the background, causing pet stats to advance
even when the developer was not at their desk. Now the ticker stops when
IntelliJ loses focus (`applicationDeactivated`) and restarts when it regains
focus (`applicationActivated`). The idle clock still advances on wall time, so
the first tick after regaining focus will correctly observe any accumulated idle
period. State is also saved immediately on focus-loss to prevent progress loss.

**Focus-gated ticker paused game in AI mode** — when `aiMode` was enabled and
the IDE window lost focus (e.g. the developer switched to a browser while an AI
agent coded), the ticker stopped and the game froze. The focus-gate exists only
to prevent multi-window state divergence; AI mode avoids that problem by design
(the AI doesn't open extra windows). Fixed in both VS Code (`extension.ts`) and
PyCharm (`GotchiPlugin.kt`): `stopTicker()` is now skipped when `aiMode` is on,
so the game continues advancing in the background. The initial ticker start at
activation is also unconditional in AI mode (VS Code only — PyCharm already
starts unconditionally).

---

## v0.9.2 — previous

### Changes from v0.9.1

| File | What changed |
|------|-------------|
| `vscode/src/extension.ts` | Extracted tick body into `runOneTick()`; added `startTicker()` (idempotent), `stopTicker()`, and `reloadAndRefreshUI()` helpers; initial ticker now conditional on `vscode.window.state.focused`; `onDidChangeWindowState` stops ticker on focus-loss and reloads globalState + restarts ticker on focus-gain |
| `vscode/FEATURES.md` | Added single-window ticker row to Section 11 (Persistence) |
| `VERSIONS.md` | Added v0.9.2 section |

### Bug fixed

**Multi-window ticker divergence** — when multiple VS Code windows were open,
each ran its own independent `setInterval` and wrote to the shared `globalState`,
causing pet state to diverge across windows. Now only the focused window ticks.
On focus-gain a window reloads the latest state from `globalState` (applying any
offline decay), clears stale events (already displayed in the prior window), and
restarts the interval. On focus-loss it saves state and clears the interval.

---

## v0.9.1 — previous

### Changes from v0.9.0

| File | What changed |
|------|-------------|
| `vscode/package.json` | Version bumped `0.9.0` → `0.9.1` |
| `pycharm/build.gradle.kts` | Version bumped `0.9.0` → `0.9.1` |
| `pycharm/src/main/resources/META-INF/plugin.xml` | Version bumped `0.9.0` → `0.9.1` |
| `vscode/src/gameEngine.ts` | Replaced dead `checkOldAgeDeath` stub with `rollOldAgeDeath(state, random)` — probabilistic old-age death roll for seniors; added `computeOldAgeDeathChance(state)` private helper; added `OLD_AGE_DEATH_BASE_CHANCE_PER_DAY` and `OLD_AGE_DEATH_RISK_MULTIPLIER` exported constants; wired `rollOldAgeDeath` into end of `tick()` at day boundaries |
| `vscode/tests/unit/gameEngine.test.ts` | Replaced `checkOldAgeDeath` describe block with `rollOldAgeDeath` (10 tests): non-senior no-op, ageDays < 365 no-op, kill when random < chance, spare when random ≥ chance, happiness factor, weight factor, discipline factor, perfect-stats boundary, worst-stats boundary, `SENIOR_NATURAL_DEATH_AGE_DAYS` constant value |
| `vscode/FEATURES.md` | Updated Section 9 senior natural death row with formula detail |
| `VERSIONS.md` | Added v0.9.1 section |

### New constants

```
OLD_AGE_DEATH_BASE_CHANCE_PER_DAY: number = 0.001   // minimum death chance per day for a perfectly-cared-for senior
OLD_AGE_DEATH_RISK_MULTIPLIER:     number = 9        // multiplier; worst-care chance = BASE × (1 + 9) = 1.0%/day
```

---

## v0.9.0 — previous

### Changes from v0.8.4

| File | What changed |
|------|-------------|
| `vscode/package.json` | Version bumped `0.8.4` → `0.9.0`; added `gotchi.aiMode` boolean setting (default false); added `gotchi.idleResetOnDocumentChange`, `gotchi.idleResetOnCursorMovement`, `gotchi.idleResetOnTabSwitch`, `gotchi.idleResetOnWindowFocus`, `gotchi.idleResetOnMouseMovement` boolean settings (all default true) |
| `pycharm/build.gradle.kts` | Version bumped `0.8.4` → `0.9.0` |
| `pycharm/src/main/resources/META-INF/plugin.xml` | Version bumped `0.8.4` → `0.9.0`; registered `GotchiTabSwitchListener` as a project listener for `FileEditorManagerListener` |
| `vscode/src/extension.ts` | Activity listeners now respect `gotchi.aiMode` and individual `gotchi.idleResetOn*` settings; `idleResetOnWindowFocus` gate added to the focus listener |
| `vscode/src/sidebarProvider.ts` | Injects `idleResetOnMouseMovement` as `data-idle-reset-mouse` into the webview HTML; added `gotchi.idleResetOnMouseMovement` to the `onDidChangeConfiguration` reload list |
| `vscode/media/sidebar.html` | Added `data-idle-reset-mouse="{{idleResetOnMouseMovement}}"` attribute to `<body>` |
| `vscode/media/sidebar.js` | `mousemove` idle-reset listener now skipped entirely when `data-idle-reset-mouse` is `"false"` |
| `pycharm/src/main/kotlin/com/gotchi/GotchiSettings.kt` | Added `aiMode`, `idleResetOnDocumentChange`, `idleResetOnCursorMovement`, `idleResetOnTabSwitch`, `idleResetOnWindowFocus`, `idleResetOnMouseMovement` fields to `State` class and as accessor properties |
| `pycharm/src/main/kotlin/com/gotchi/GotchiConfigurable.kt` | Added 6 new `JCheckBox` rows (rows 16–21): AI mode, and five idle-reset trigger toggles; filler moved to row 22; `isModified()`, `apply()`, `reset()` updated |
| `pycharm/src/main/kotlin/com/gotchi/GotchiPlugin.kt` | AWT callback now checks per-event-type settings and `aiMode`; added `ApplicationActivationListener` subscription via app message bus for window-focus idle reset; added `markActivity()` public method; `dispose()` disconnects message bus |
| `pycharm/src/main/kotlin/com/gotchi/GotchiTabSwitchListener.kt` | New file — project-level `FileEditorManagerListener` that calls `GotchiPlugin.markActivity()` when `aiMode` is off and `idleResetOnTabSwitch` is on |
| `vscode/FEATURES.md` | Added 6 new rows to Settings Reference (section 12) for `aiMode` and five `idleResetOn*` settings |
| `VERSIONS.md` | Added v0.9.0 section |

---

## v0.8.4 — previous

### Changes from v0.8.3

| File | What changed |
|------|-------------|
| `vscode/package.json` | Version bumped `0.8.3` → `0.8.4` |
| `pycharm/build.gradle.kts` | Version bumped `0.8.3` → `0.8.4` |
| `pycharm/src/main/resources/META-INF/plugin.xml` | Version bumped `0.8.3` → `0.8.4` |
| `vscode/src/gameEngine.ts` | Sickness damage block now guarded by `!isDeepIdle`; pet cannot die from pre-existing sickness during lock screen or OS sleep (BUGFIX-040) |
| `vscode/tests/unit/gameEngine.test.ts` | Added 3 tests for BUGFIX-040: no damage during deep idle, damage still fires during regular idle, pet at 5 hp survives deep idle |
| `BUGFIXES.md` | Added BUGFIX-040 |
| `VERSIONS.md` | Added v0.8.4 section |

---

## v0.8.3 — previous

### Changes from v0.8.2

| File | What changed |
|------|-------------|
| `vscode/package.json` | Version bumped `0.8.2` → `0.8.3` |
| `pycharm/build.gradle.kts` | Version bumped `0.8.2` → `0.8.3` |
| `pycharm/src/main/resources/META-INF/plugin.xml` | Version bumped `0.8.2` → `0.8.3` |
| `README.md` | Install filenames updated to `0.8.3` |
| `vscode/README.md` | Install filenames updated to `0.8.3` |
| `pycharm/README.md` | Install filenames updated to `0.8.3` |
| `VERSIONS.md` | Added v0.8.3 section |

---

## v0.8.2 — previous

### Changes from v0.8.1

| File | What changed |
|------|-------------|
| `vscode/package.json` | Version bumped `0.8.1` → `0.8.2`; added `gotchi.devModeHealthFloor` integer setting (default 1, min 0, max 100) |
| `pycharm/build.gradle.kts` | Version bumped `0.8.1` → `0.8.2` |
| `pycharm/src/main/resources/META-INF/plugin.xml` | Version bumped `0.8.1` → `0.8.2` |
| `vscode/src/gameEngine.ts` | `GameConfig` extended with `devModeHealthFloor: number`; `DEFAULT_GAME_CONFIG` updated; `tick()` health floor uses `config.devModeHealthFloor` instead of hardcoded `1` |
| `vscode/src/extension.ts` | Reads `gotchi.devModeHealthFloor` setting and passes it (clamped 0–100) into `GameConfig` |
| `vscode/tests/unit/gameEngine.test.ts` | All existing `GameConfig` objects updated with `devModeHealthFloor: 1`; added 2 new dev mode health floor tests |
| `pycharm/src/main/kotlin/com/gotchi/GotchiSettings.kt` | Added `devModeHealthFloor: Int = 1` field and accessor property |
| `pycharm/src/main/kotlin/com/gotchi/engine/Constants.kt` | `GameConfig` extended with `devModeHealthFloor: Int = 1` |
| `pycharm/src/main/kotlin/com/gotchi/engine/GameEngine.kt` | `tick()` health floor uses `config.devModeHealthFloor` instead of hardcoded `1` |
| `pycharm/src/main/kotlin/com/gotchi/GotchiPlugin.kt` | Passes `devModeHealthFloor` (clamped 0–100) into `GameConfig` |
| `pycharm/src/main/kotlin/com/gotchi/GotchiConfigurable.kt` | Added `devModeHealthFloorSpinner` (row 15, 0–100, step 1); filler moved to row 16; `isModified()`, `apply()`, `reset()` updated |
| `vscode/FEATURES.md` | Added `gotchi.devModeHealthFloor` row to settings table; updated dev mode behaviour row to reflect configurable floor |
| `VERSIONS.md` | Added v0.8.2 section |
| `README.md` | Install filenames updated to `0.8.2` |
| `vscode/README.md` | Install filenames updated to `0.8.2` |
| `pycharm/README.md` | Install filenames updated to `0.8.2` |
| `vscode/src/extension.ts` | Added `lastDeepIdleTickMs` and `DEEP_IDLE_REENTRY_GRACE_MS` (60 s); `deepIdle` flag now includes a 60-second grace period after returning from deep idle (BUGFIX-036); state saved immediately on window focus loss (BUGFIX-039) |
| `vscode/src/gameEngine.ts` | `applyOfflineDecay` resets `hungerZeroTicks` to 0 (BUGFIX-037); `applyOfflineDecay` floors decayed hunger and happiness at `IDLE_STAT_FLOOR` (20) (BUGFIX-038) |
| `BUGFIXES.md` | Added BUGFIX-036 through BUGFIX-039 |

### New settings

```
gotchi.devModeHealthFloor: integer = 1   // minimum health in dev mode (0–100); set to 0 to allow pet death
```

### New config fields

```
devModeHealthFloor: Int = 1   // mirrors gotchi.devModeHealthFloor; clamped to 0–100
```

### New constants

```
DEEP_IDLE_REENTRY_GRACE_MS: number = 60_000   // ms of deep-idle protection retained after user returns from lock/sleep
```

---

## v0.8.1 — previous

### Changes from v0.8.0

| File | What changed |
|------|-------------|
| `vscode/package.json` | Version bumped `0.8.0` → `0.8.1` |
| `pycharm/build.gradle.kts` | Version bumped `0.8.0` → `0.8.1` |
| `pycharm/src/main/resources/META-INF/plugin.xml` | Version bumped `0.8.0` → `0.8.1` |
| `vscode/src/extension.ts` | Dev mode now requires BOTH `gotchi.devModeEnabled = true` AND the correct passcode |
| `vscode/package.json` | Added `gotchi.devModeEnabled` boolean setting |
| `vscode/media/sidebar.html` | Added `#dev-mode-banner` div in game screen; added reset best run button + confirm UI in setup screen |
| `vscode/media/sidebar.css` | Added `.dev-mode-banner`, `.action-btn.danger-btn`, `.reset-hs-confirm`, `.reset-hs-question`, `.reset-hs-btn` rules |
| `vscode/media/sidebar.js` | Added element refs for banner/reset; added reset button event listeners; updated `renderSetupHighScore()` to show/hide reset controls; updated message handler for `highScore === null` and `devMode` banner toggle |
| `vscode/src/sidebarProvider.ts` | Passes `devMode` flag in `stateUpdate` message payload; handles `reset_high_score` command |
| `vscode/src/gameEngine.ts` | `pat()` loses 3 weight (`PAT_WEIGHT_LOSS`); `applyMinigameResult()` loses 3 bonus weight for `left_right` and `higher_lower` only (BUGFIX-034); `endCoinFlipGame()` result text is clean win/lose only (BUGFIX-035) |
| `vscode/tests/unit/gameEngine.test.ts` | Added tests for `pat` weight loss and `applyMinigameResult` weight loss per minigame type (BUGFIX-034) |
| `pycharm/src/main/kotlin/com/gotchi/GotchiSettings.kt` | Added `devModeEnabled: Boolean = false` field |
| `pycharm/src/main/kotlin/com/gotchi/GotchiConfigurable.kt` | Added dev mode enabled checkbox (row 12); renumbered passcode → 13, aging → 14 |
| `pycharm/src/main/kotlin/com/gotchi/GotchiPlugin.kt` | Dev mode requires BOTH `devModeEnabled` AND the correct passcode; handles `reset_high_score` command; passes `devMode` to `postState()` |
| `pycharm/src/main/kotlin/com/gotchi/GotchiBrowserPanel.kt` | `postState()` now accepts `devMode: Boolean` and includes it in JSON payload |
| `pycharm/src/main/kotlin/com/gotchi/GotchiPersistence.kt` | Added `clearHighScore()` method |
| `pycharm/src/main/kotlin/com/gotchi/engine/Constants.kt` | Added `PAT_WEIGHT_LOSS = 3` and `PLAY_WEIGHT_LOSS_BONUS = 3` (BUGFIX-034) |
| `pycharm/src/main/kotlin/com/gotchi/engine/GameEngine.kt` | `pat()` loses 3 weight; `applyMinigameResult()` loses 3 bonus weight for `left_right` / `higher_lower` only (BUGFIX-034) |
| `pycharm/src/main/resources/webview/sidebar.html` | Added `#dev-mode-banner` in game screen; reset best run button + confirm UI in setup screen |
| `pycharm/src/main/resources/webview/sidebar.css` | Added dev-mode banner and reset button CSS rules |
| `pycharm/src/main/resources/webview/sidebar.js` | Element refs; reset button listeners; `renderSetupHighScore()` shows/hides reset controls; message handler handles `highScore === null` and `devMode` banner; `endCoinFlipGame()` clean text (BUGFIX-035) |
| `vscode/FEATURES.md` | Added dev mode enabled checkbox row and reset best run row |
| `BUGFIXES.md` | Added BUGFIX-034 and BUGFIX-035 entries |
| `README.md` | Install filenames updated to `0.8.1` |
| `vscode/README.md` | Install filenames updated to `0.8.1` |
| `pycharm/README.md` | Install filenames updated to `0.8.1` |

### New settings

```
gotchi.devModeEnabled: boolean = false   // must be true AND passcode must match to activate dev mode
```

### New constants

```
PAT_WEIGHT_LOSS:        Int = 3   // weight lost on each pat action (BUGFIX-034)
PLAY_WEIGHT_LOSS_BONUS: Int = 3   // extra weight lost after left_right or higher_lower minigame (BUGFIX-034)
```

---

## v0.8.0 — previous

### Changes from v0.7.7

| File | What changed |
|------|-------------|
| `vscode/package.json` | Version bumped `0.7.7` → `0.8.0`; added `gotchi.developerPasscode` and `gotchi.devModeAgingMultiplier` settings |
| `pycharm/build.gradle.kts` | Version bumped `0.7.7` → `0.8.0` |
| `pycharm/src/main/resources/META-INF/plugin.xml` | Version bumped `0.7.7` → `0.8.0` |
| `vscode/src/gameEngine.ts` | `GameConfig` extended with `devMode` and `devModeAgingMultiplier`; `tick()` applies aging multiplier and health floor when dev mode is active |
| `pycharm/src/main/kotlin/com/gotchi/engine/Constants.kt` | `GameConfig` extended with `devMode: Boolean` and `devModeAgingMultiplier: Double` |
| `pycharm/src/main/kotlin/com/gotchi/engine/GameEngine.kt` | `tick()` applies `devModeAgingMultiplier` to aging and floors health at 1 when `devMode` is true |
| `vscode/src/extension.ts` | Reads `developerPasscode` and `devModeAgingMultiplier` settings, passes them into `GameConfig`; high score update guarded with `!devModeActive` |
| `pycharm/src/main/kotlin/com/gotchi/GotchiSettings.kt` | Added `developerPasscode: String` and `devModeAgingMultiplier: Int` fields |
| `pycharm/src/main/kotlin/com/gotchi/GotchiPlugin.kt` | Wires dev mode settings into `GameConfig`; adds `lastDevMode` field; high score update guarded with `!lastDevMode` |
| `pycharm/src/main/kotlin/com/gotchi/GotchiConfigurable.kt` | Added "Developer passcode" text field (row 12) and "Dev mode aging multiplier" spinner (row 13) |
| `vscode/tests/unit/gameEngine.test.ts` | Added `GameConfig` import; added 5 dev mode unit tests (health floor, aging multiplier) |
| `vscode/FEATURES.md` | Added developer mode feature rows |
| `README.md` | Install filenames updated to `0.8.0` |
| `vscode/README.md` | Install filenames updated to `0.8.0` |
| `pycharm/README.md` | Install filenames updated to `0.8.0` |

### New settings

```
gotchi.developerPasscode:      string  = ""   // set to "1234" to enable dev mode
gotchi.devModeAgingMultiplier: integer = 10   // aging speed multiplier in dev mode
```

### New constants / config fields

```
GameConfig.devMode:                  Boolean/boolean = false
GameConfig.devModeAgingMultiplier:   Double/number   = 10.0
```

---

## v0.7.7 — previous

### Changes from v0.7.6

| File | What changed |
|------|-------------|
| `vscode/package.json` | Version bumped `0.7.6` → `0.7.7` |
| `pycharm/build.gradle.kts` | Version bumped `0.7.6` → `0.7.7` |
| `pycharm/src/main/resources/META-INF/plugin.xml` | Version bumped `0.7.6` → `0.7.7` |
| `vscode/src/gameEngine.ts` | `PAT_HAPPINESS_BOOST` reduced from 15 to 10 |
| `pycharm/src/main/kotlin/com/gotchi/engine/Constants.kt` | Mirrored `PAT_HAPPINESS_BOOST` reduction (15 → 10) |
| `vscode/FEATURES.md` | Updated Pat rows to reflect new happiness boost of +10 |

### Updated constants

```
PAT_HAPPINESS_BOOST: Int = 10   // was 15 (net pat happiness total now 10)
```

---

## v0.7.6 — previous

### Changes from v0.7.5

| File | What changed |
|------|-------------|
| `vscode/package.json` | Version bumped `0.7.5` → `0.7.6` |
| `pycharm/build.gradle.kts` | Version bumped `0.7.5` → `0.7.6` |
| `pycharm/src/main/resources/META-INF/plugin.xml` | Version bumped `0.7.5` → `0.7.6` |
| `vscode/src/gameEngine.ts` | Rebalanced minigame reward constants as deltas applied on top of the play baseline (+15); renamed `LOSE_CONSOLATION` → `LOSE_DELTA` for LR and HL; updated inline comments in `happinessDeltaForMinigame()` |
| `pycharm/src/main/kotlin/com/gotchi/engine/Constants.kt` | Mirrored reward constant rebalance and renames from `gameEngine.ts` |
| `pycharm/src/main/kotlin/com/gotchi/engine/GameEngine.kt` | Updated `happinessDeltaForMinigame()` inline comments and constant references to match new delta semantics |
| `vscode/tests/unit/gameEngine.test.ts` | Updated all reward assertions to match new constant values and delta semantics |
| `vscode/FEATURES.md` | Updated minigame reward reference table and game descriptions to reflect new delta values |

### Updated constants

```
MINIGAME_LR_WIN_MIN:   Int = 5    // was 20 (now delta on top of +15 play baseline; net win 20–30)
MINIGAME_LR_WIN_MAX:   Int = 15   // was 30
MINIGAME_LR_LOSE_DELTA (renamed from MINIGAME_LR_LOSE_CONSOLATION): Int = -5   // was +10
MINIGAME_HL_WIN_MIN:   Int = 10   // was 25 (net win 25–35)
MINIGAME_HL_WIN_MAX:   Int = 20   // was 35
MINIGAME_HL_LOSE_DELTA (renamed from MINIGAME_HL_LOSE_CONSOLATION): Int = -5   // was +10
MINIGAME_COIN_FLIP_WIN: Int = 0   // was 15 (net win 15 = 0 + play baseline)
MINIGAME_COIN_FLIP_LOSE: Int = -10  // was +5 (net lose 5 = −10 + play baseline)
```

---

## v0.7.5 — previous

### Changes from v0.7.4

| File | What changed |
|------|-------------|
| `vscode/package.json` | Version bumped `0.7.4` → `0.7.5` |
| `pycharm/build.gradle.kts` | Version bumped `0.7.4` → `0.7.5` |
| `pycharm/src/main/resources/META-INF/plugin.xml` | Version bumped `0.7.4` → `0.7.5` |
| `vscode/media/sidebar.html` | Removed standalone `btn-pat` from `.btn-grid`; added `btn-mg-pat` to `#mg-select`; changed `#mg-select` title from "Play a game!" to "Play or Pat" |
| `pycharm/src/main/resources/webview/sidebar.html` | Mirrored from `vscode/media/sidebar.html` |
| `vscode/media/sidebar.js` | Added `PAT_ENERGY_COST = 20` constant; changed Play button gate from `PLAY_ENERGY_COST` to `PAT_ENERGY_COST`; removed standalone `btn-pat` click listener; added `btn-mg-pat` click listener (calls `hideMgOverlay()` then `pat` command); removed `"btn-pat"` from sleep-disable array |
| `pycharm/src/main/resources/webview/sidebar.js` | Mirrored from `vscode/media/sidebar.js` |
| `vscode/FEATURES.md` | Updated Pat row Notes: accessed via Play menu; updated Section 4 intro to mention Pat is also in the menu |
| `README.md` | Install filenames and current release updated to `0.7.5` |
| `vscode/README.md` | Install filenames updated to `0.7.5`; updated Pat row in Actions table |
| `pycharm/README.md` | Install filenames updated to `0.7.5` |
| `vscode/src/gameEngine.ts` | BUGFIX-033: passive weight decay now throttled during idle (10× slower, matching hunger/happiness) |
| `pycharm/src/main/kotlin/com/gotchi/engine/GameEngine.kt` | BUGFIX-033: mirrored weight decay throttle fix |
| `BUGFIXES.md` | Added BUGFIX-033 entry |
| `vscode/src/gameEngine.ts` | Rebalanced minigame and pat reward constants (LR 20–30, HL 25–35, coin +15/+5, pat +15) |
| `pycharm/src/main/kotlin/com/gotchi/engine/Constants.kt` | Mirrored reward constant rebalance |
| `pycharm/src/main/kotlin/com/gotchi/engine/GameEngine.kt` | Coin flip lose now uses `MINIGAME_COIN_FLIP_LOSE` constant instead of hardcoded `0` |
| `vscode/tests/unit/gameEngine.test.ts` | Updated reward assertions to match new constant values |
| `vscode/FEATURES.md` | Updated Pat action row and minigame rewards table to reflect new values |

### New constants

```
PAT_ENERGY_COST: Int = 20         // (already existed in engine) now also declared in sidebar.js UI layer
MINIGAME_COIN_FLIP_LOSE: Int = 5  // coin flip lose consolation (new — was hardcoded 0)
```

### Updated constants

```
PAT_HAPPINESS_BOOST: Int = 15     // was 10
MINIGAME_LR_WIN_MIN: Int = 20     // was 15
MINIGAME_LR_WIN_MAX: Int = 30     // was 25
MINIGAME_HL_WIN_MIN: Int = 25     // was 10
MINIGAME_HL_WIN_MAX: Int = 35     // was 20
MINIGAME_COIN_FLIP_WIN: Int = 15  // was 5
```

---

## v0.7.4 — previous

### Changes from v0.7.3

| File | What changed |
|------|-------------|
| `vscode/src/gameEngine.ts` | Added `PAT_HAPPINESS_BOOST = 10`, `PAT_ENERGY_COST = 20` constants and `pat()` function — gives +10 happiness, −20 energy, no minigame |
| `pycharm/src/main/kotlin/com/gotchi/engine/Constants.kt` | Mirrored `PAT_HAPPINESS_BOOST` and `PAT_ENERGY_COST` constants |
| `pycharm/src/main/kotlin/com/gotchi/engine/GameEngine.kt` | Mirrored `pat()` function |
| `vscode/src/sidebarProvider.ts` | Added `pat` import, `"pat"` case in message switch, added `"pat"` to `SLEEP_BLOCKED` list |
| `pycharm/src/main/kotlin/com/gotchi/GotchiPlugin.kt` | Added `"pat"` case in `handleCommand()`, added `"pat"` to `sleepBlocked` set |
| `vscode/media/sidebar.html` | Added `btn-pat` button to `.btn-grid`; added `btn-mg-cf` to `#mg-select`; added `#mg-coin-flip` panel (Panel 3); renumbered Result to Panel 4 |
| `pycharm/src/main/resources/webview/sidebar.html` | Mirrored from `vscode/media/sidebar.html` |
| `vscode/media/sidebar.js` | Added `btn-pat` click listener; added coin flip game functions (`startCoinFlipGame`, `handleCFChoice`, `endCoinFlipGame`); wired `btn-mg-cf`; added `patted`, `pat_refused_no_energy`, `minigame_coin_flip_win/lose` to `humaniseEvent`; added `btn-pat` to sleep-disable list |
| `pycharm/src/main/resources/webview/sidebar.js` | Mirrored from `vscode/media/sidebar.js` |
| `vscode/package.json` | Version bumped `0.7.3` → `0.7.4` |
| `pycharm/build.gradle.kts` | Version bumped `0.7.3` → `0.7.4` |
| `pycharm/src/main/resources/META-INF/plugin.xml` | Version bumped `0.7.3` → `0.7.4` |
| `vscode/FEATURES.md` | Added Pat row to Section 3 care actions table; updated minigame intro to "Three"; added Section 4.6 Coin Flip `[x]`; added Minigame Reward Reference table |
| `README.md` | Install filenames and current release updated to `0.7.4` |
| `vscode/README.md` | Install filenames updated to `0.7.4` |
| `pycharm/README.md` | Install filenames updated to `0.7.4` |

### New constants

```
PAT_HAPPINESS_BOOST: Int = 10   // happiness boost from pat action
PAT_ENERGY_COST:     Int = 20   // energy cost of pat action
```

---

## v0.7.3 — previous

### Changes from v0.7.2

| File | What changed |
|------|-------------|
| `vscode/media/sidebar.css` | Changed `#sprite-container.anim-jump` selector to `#sprite-canvas.anim-jump` so the jump animation targets only the pet sprite canvas, not the whole container |
| `vscode/media/sidebar.js` | `handleHLChoice()`: replaced `document.getElementById("sprite-container")` local re-query with the existing top-level `spriteCanvas` const; all four animation references updated accordingly |
| `pycharm/src/main/resources/webview/sidebar.css` | Mirrored from `vscode/media/sidebar.css` |
| `pycharm/src/main/resources/webview/sidebar.js` | Mirrored from `vscode/media/sidebar.js` |
| `vscode/package.json` | Version bumped `0.7.2` → `0.7.3` |
| `pycharm/build.gradle.kts` | Version bumped `0.7.2` → `0.7.3` |
| `pycharm/src/main/resources/META-INF/plugin.xml` | Version bumped `0.7.2` → `0.7.3` |
| `vscode/FEATURES.md` | Section 13: added "Redesign game art" row to stretch features table |
| `BUGFIXES.md` | Added BUGFIX-032 (jump animates whole stage instead of pet only) |
| `README.md` | Install filenames and current release updated to `0.7.3` |
| `vscode/README.md` | Install filenames updated to `0.7.3` |
| `pycharm/README.md` | Install filenames updated to `0.7.3` |

---

## v0.7.2 — previous

### Changes from v0.7.1

| File | What changed |
|------|-------------|
| `vscode/media/sidebar.html` | Removed `#mg-overlay`; wrapped action buttons and game panels in `#action-area`; game panels moved to `#game-panels` div alongside `.btn-grid` |
| `vscode/media/sidebar.css` | Removed `.mg-overlay` absolute positioning and `#stats-game-area { position: relative }`; added `#action-area { min-height: 140px }` and `#game-panels` styles; replaced `slide-left`/`slide-right` keyframes with `jump` keyframe; replaced `.anim-slide-*` with `.anim-jump` |
| `vscode/media/sidebar.js` | `showMgOverlay()` now hides `.btn-grid` and shows `#game-panels`; `hideMgOverlay()` reverses this; `showMgPanel()` queries panels from `#game-panels`; `handleHLChoice()` triggers `anim-jump` only on correct guess instead of slide animation on every guess |
| `pycharm/src/main/resources/webview/sidebar.html` | Mirrored from `vscode/media/sidebar.html` |
| `pycharm/src/main/resources/webview/sidebar.css` | Mirrored from `vscode/media/sidebar.css` |
| `pycharm/src/main/resources/webview/sidebar.js` | Mirrored from `vscode/media/sidebar.js` |
| `vscode/package.json` | Version bumped `0.7.1` → `0.7.2` |
| `pycharm/build.gradle.kts` | Version bumped `0.7.1` → `0.7.2` |
| `pycharm/src/main/resources/META-INF/plugin.xml` | Version bumped `0.7.1` → `0.7.2` |
| `BUGFIXES.md` | Added BUGFIX-030 (game panels in overlay instead of action area), BUGFIX-031 (HL slide animation confusing) |
| `README.md` | Install filenames and current release updated to `0.7.2` |
| `vscode/README.md` | Install filenames updated to `0.7.2` |
| `pycharm/README.md` | Install filenames updated to `0.7.2` |

---

## v0.7.1 — previous

### Changes from v0.7.0

| File | What changed |
|------|-------------|
| `vscode/media/sidebar.html` | `#game-screen` section rewritten: `#lr-canvas hidden` added inside `#sprite-container`; `.stats` wrapped in `#stats-game-area`; `#mg-overlay` moved inside `#stats-game-area`; `#lr-canvas` removed from `#mg-left-right`; OK button added to `#mg-result`; `style="position:relative"` removed from `#game-screen` |
| `vscode/media/sidebar.css` | `#game-screen { position: relative }` replaced with `#stats-game-area { position: relative }`; `#lr-canvas` changed from `display:block; margin:0 auto` to `position:absolute; inset:0; z-index:5; pointer-events:none`; added `slide-left`/`slide-right` keyframes and `#sprite-container.anim-slide-left/right` rules; added `.mg-ok-btn`; `margin-top` on `.mg-result-text` reduced from 24px to 8px |
| `vscode/media/sidebar.js` | `sendPlayResult()` no longer auto-hides the overlay; `hideMgOverlay()` now also hides `#lr-canvas`; `btn-mg-ok` click handler added; `startLeftRightGame()` shows `#lr-canvas`; `endLeftRightGame()` clears and hides `#lr-canvas`; `drawLRDoors()` rewritten with relative geometry; `handleHLChoice()` adds slide animation on `#sprite-container` |
| `vscode/src/gameEngine.ts` | Replaced shared `MINIGAME_INTERACTIVE_*` constants with per-game constants; updated `happinessDeltaForMinigame()` with separate `left_right`, `higher_lower`, `coin_flip` branches |
| `vscode/tests/unit/gameEngine.test.ts` | Updated L/R lose consolation (5→10), H/L win range (15–25→10–20), H/L lose consolation (5→10); updated integration test expected values; added `coin_flip` unit tests and integration describe block |
| `pycharm/src/main/resources/webview/sidebar.html` | Mirrored from `vscode/media/sidebar.html` |
| `pycharm/src/main/resources/webview/sidebar.css` | Mirrored from `vscode/media/sidebar.css` |
| `pycharm/src/main/resources/webview/sidebar.js` | Mirrored from `vscode/media/sidebar.js`: `sendPlayResult()` fix, OK handler, LR canvas show/hide, `drawLRDoors()` rewrite, `handleHLChoice()` slide animation |
| `pycharm/src/main/kotlin/com/gotchi/engine/Constants.kt` | Old `MINIGAME_INTERACTIVE_*` constants removed; per-game constants added |
| `pycharm/src/main/kotlin/com/gotchi/engine/GameEngine.kt` | `happinessDeltaForMinigame()` updated with per-game logic and `coin_flip` case |
| `vscode/package.json` | Version bumped `0.7.0` → `0.7.1` |
| `pycharm/build.gradle.kts` | Version bumped `0.7.0` → `0.7.1` |
| `pycharm/src/main/resources/META-INF/plugin.xml` | Version bumped `0.7.0` → `0.7.1` |
| `vscode/FEATURES.md` | Section 4 rewards updated to reflect per-game constants; 4.4 H/L win/lose rewards updated |
| `BUGFIXES.md` | Added BUGFIX-027 (overlay scope), BUGFIX-028 (pet hidden by canvas), BUGFIX-029 (result screen auto-dismissed) |
| `README.md` | Install filenames and current release updated to `0.7.1` |
| `vscode/README.md` | Install filenames updated to `0.7.1` |
| `pycharm/README.md` | Install filenames updated to `0.7.1` |

### Updated constants (v0.7.1, gameEngine.ts / Constants.kt)

```
MINIGAME_LR_WIN_MIN:          Int = 15    // was part of shared INTERACTIVE_WIN_BASE+BONUS range 15–25 (unchanged)
MINIGAME_LR_WIN_MAX:          Int = 25    // was part of shared INTERACTIVE_WIN range (unchanged)
MINIGAME_LR_LOSE_CONSOLATION: Int = 10    // was 5 (shared INTERACTIVE_WIN_BASE − INTERACTIVE_LOSE_PENALTY)
MINIGAME_HL_WIN_MIN:          Int = 10    // was 15 (shared INTERACTIVE_WIN_BASE + BONUS_MIN)
MINIGAME_HL_WIN_MAX:          Int = 20    // was 25 (shared INTERACTIVE_WIN_BASE + BONUS_MAX)
MINIGAME_HL_LOSE_CONSOLATION: Int = 10    // was 5
MINIGAME_COIN_FLIP_WIN:       Int = 5     // new
```

### Removed constants (v0.7.1)

```
MINIGAME_INTERACTIVE_WIN_BASE      // replaced by per-game constants
MINIGAME_INTERACTIVE_WIN_BONUS_MIN // replaced by per-game constants
MINIGAME_INTERACTIVE_WIN_BONUS_MAX // replaced by per-game constants
MINIGAME_INTERACTIVE_LOSE_PENALTY  // replaced by per-game constants
```

---

## v0.7.0 — previous

### Changes from v0.6.3

| File | What changed |
|------|-------------|
| `vscode/src/gameEngine.ts` | Added `MINIGAME_INTERACTIVE_WIN_BASE`, `MINIGAME_INTERACTIVE_WIN_BONUS_MIN`, `MINIGAME_INTERACTIVE_WIN_BONUS_MAX`, `MINIGAME_INTERACTIVE_LOSE_PENALTY` constants; added `happinessDeltaForMinigame()` and `applyMinigameResult()` support for `left_right` and `higher_lower`; fixed lose path to return `WIN_BASE − LOSE_PENALTY = +5` (consolation) instead of a negative value |
| `vscode/media/sidebar.html` | Added `#mg-overlay` div with game-select, Left/Right, Higher or Lower, and result sub-panels; `#game-screen` given `style="position:relative"` |
| `vscode/media/sidebar.css` | Added overlay/game styles: `.mg-overlay`, `.mg-panel`, `.mg-title`, `.mg-btn-row`, `.mg-dir-btn`, `.mg-score`, `.mg-big-num`, `.mg-feedback`, `.mg-result-text`, `#lr-canvas`, `.mg-countdown`; `#game-screen { position: relative }` |
| `vscode/media/sidebar.js` | Full Left/Right and Higher or Lower minigame implementations: `showMgOverlay`, `hideMgOverlay`, `showMgPanel`, `sendPlayResult`, `startLeftRightGame`, `startLRRound`, `handleLRChoice`, `resolveLRRound`, `drawLRDoors`, `updateLRScore`, `startHigherLowerGame`, `startHLRound`, `handleHLChoice`, `finishHL`; event log entries for win/lose of both games |
| `pycharm/src/main/kotlin/com/gotchi/engine/Constants.kt` | Added same four `MINIGAME_INTERACTIVE_*` constants; fixed `MINIGAME_INTERACTIVE_LOSE_PENALTY` to `5` (positive) |
| `pycharm/src/main/kotlin/com/gotchi/engine/GameEngine.kt` | Updated `happinessDeltaForMinigame()` to handle `left_right` and `higher_lower`; fixed lose path to `WIN_BASE - LOSE_PENALTY` |
| `pycharm/src/main/resources/webview/sidebar.html` | Mirrored from `vscode/media/sidebar.html` |
| `pycharm/src/main/resources/webview/sidebar.css` | Mirrored from `vscode/media/sidebar.css` |
| `pycharm/src/main/resources/webview/sidebar.js` | Mirrored from `vscode/media/sidebar.js` |
| `vscode/tests/unit/gameEngine.test.ts` | Added unit tests for `left_right` and `higher_lower` win/lose deltas and clamping; added integration test suites `integration — play + left_right minigame` and `integration — play + higher_lower minigame` |
| `vscode/package.json` | Version bumped `0.6.3` → `0.7.0` |
| `pycharm/build.gradle.kts` | Version bumped `0.6.3` → `0.7.0` |
| `pycharm/src/main/resources/META-INF/plugin.xml` | Version bumped `0.6.3` → `0.7.0` |
| `vscode/FEATURES.md` | Section 4 intro updated; Left/Right (4.1) and Higher or Lower (4.4) status set to `[x]` |
| `README.md` | Install filenames and current release updated to `0.7.0` |
| `vscode/README.md` | Install filenames updated to `0.7.0` |
| `pycharm/README.md` | Install filenames updated to `0.7.0` |
| `.opencode/skills/integration-testing/SKILL.md` | New skill: always write integration tests when adding new features |

### Updated constants (v0.7.0, gameEngine.ts / Constants.kt)

```
MINIGAME_INTERACTIVE_WIN_BASE:      Int = 10   // base happiness added on interactive minigame win
MINIGAME_INTERACTIVE_WIN_BONUS_MIN: Int = 5    // minimum random bonus on top of base (win total: 15–25)
MINIGAME_INTERACTIVE_WIN_BONUS_MAX: Int = 15   // maximum random bonus on top of base
MINIGAME_INTERACTIVE_LOSE_PENALTY:  Int = 5    // consolation = WIN_BASE − LOSE_PENALTY = 10 − 5 = +5
```

---

## v0.6.3 — previous

### Changes from v0.6.2

| File | What changed |
|------|-------------|
| `vscode/media/sidebar.js` | BUGFIX-026: `GRAVITY` raised `60 → 500` px/s²; `HOP_IMPULSE` scaled `−60 → −175` px/s so hop height (~30 px) is preserved with the new gravity |
| `pycharm/src/main/resources/webview/sidebar.js` | Mirrored from `vscode/media/sidebar.js` (identical file) |
| `vscode/package.json` | Version bumped `0.6.2` → `0.6.3` |
| `pycharm/build.gradle.kts` | Version bumped `0.6.2` → `0.6.3` |
| `pycharm/src/main/resources/META-INF/plugin.xml` | Version bumped `0.6.2` → `0.6.3` |
| `BUGFIXES.md` | Added BUGFIX-026 (gravity too slow) |
| `README.md` | Install filenames updated to `0.6.3` |
| `vscode/README.md` | Install filenames updated to `0.6.3` |
| `pycharm/README.md` | Install filenames updated to `0.6.3` |

### Updated constants (v0.6.3, sidebar.js)

```
GRAVITY:      500   // px/s² — was 60; falls full 96 px canvas in ~0.62 s (was 1.79 s)
HOP_IMPULSE: -175   // px/s upward — was -60; preserves ~30 px hop height with new gravity
```

---

## v0.6.2 — previous

### Changes from v0.6.0

| File | What changed |
|------|-------------|
| `vscode/package.json` | Version bumped `0.6.0` → `0.6.2` |
| `pycharm/build.gradle.kts` | Version bumped `0.6.0` → `0.6.2` |
| `pycharm/src/main/resources/META-INF/plugin.xml` | Version bumped `0.6.0` → `0.6.2` |
| `vscode/media/sidebar.js` | BUGFIX-024: hop guard tightened to `petVy >= 0` (no hops on upward bounce frames); mood guard `lastState.mood === "happy"` removed so all moods can hop; BUGFIX-025: `fell_asleep` event saves `petX` to `localStorage`; first-load block restores `petX` from `localStorage` when state is sleeping; sleeping movement block explicitly zeros `petVx`, `petVy`, sets `petY = floorY`; `STAGE_BASE_SPEED_PPS` baby raised `12→22`, child raised `20→35`; wander wall-pause block removed; `petVx===0` guard added before wander direction assignment |
| `pycharm/src/main/resources/webview/sidebar.js` | Mirrored from `vscode/media/sidebar.js` (identical file) |
| `BUGFIXES.md` | Added BUGFIX-024 (hop stacking) and BUGFIX-025 (sleep drift to centre) |
| `README.md` | Install filenames updated to `0.6.2` |
| `vscode/README.md` | Install filenames updated to `0.6.2` |
| `pycharm/README.md` | Install filenames updated to `0.6.2` |

### Updated constants (v0.6.2, sidebar.js)

```
STAGE_BASE_SPEED_PPS.baby:  22   // was 12
STAGE_BASE_SPEED_PPS.child: 35   // was 20
```

---

## v0.6.0 — previous

### Changes from v0.5.2

| File | What changed |
|------|-------------|
| `vscode/package.json` | Version bumped `0.5.2` → `0.6.0`; added `gotchi.petStageHeight` (default 96) and `gotchi.reducedMotion` (default false) settings |
| `pycharm/build.gradle.kts` | Version bumped `0.5.2` → `0.6.0` |
| `pycharm/src/main/resources/META-INF/plugin.xml` | Version bumped `0.5.2` → `0.6.0` |
| `vscode/media/sidebar.html` | Canvas `height` attribute changed to `{{stageHeight}}` placeholder; `data-reduced-motion="{{reducedMotion}}"` added to `<body>` |
| `vscode/media/sidebar.js` | Full rewrite: delta-time physics (`petVx`/`petVy` in px/s), 2D gravity and floor bounce, continuous rAF loop, mood-based locomotion, stage-based speed constants, idle wandering with random pauses, happy hops every 4 s, egg rocking (rotation), sleeping breath bob, snack-item targeting, reaction queue (`fed_meal`, `fed_snack`, `played`, `fell_asleep`, `woke_up`, `scolded`, `praised`, `evolved`, `poop_appeared`, `became_sick`, `healed`), reduced-motion static fallback |
| `vscode/src/sidebarProvider.ts` | `buildHtml()` injects `{{stageHeight}}` and `{{reducedMotion}}` from settings; config change listener updated to watch both new settings |
| `pycharm/src/main/resources/webview/sidebar.html` | Same `{{stageHeight}}` and `data-reduced-motion="{{reducedMotion}}"` placeholder changes mirrored |
| `pycharm/src/main/resources/webview/sidebar.js` | Mirrored from `vscode/media/sidebar.js` (identical file) |
| `pycharm/src/main/kotlin/com/gotchi/GotchiSettings.kt` | Added `petStageHeight: Int = 96` and `reducedMotion: Boolean = false` fields + property accessors |
| `pycharm/src/main/kotlin/com/gotchi/GotchiConfigurable.kt` | Added "Pet stage height (px)" spinner (row 10) and "Reduced motion" checkbox (row 11); filler `JPanel` moved to row 12; `isModified()`, `apply()`, `reset()` updated |
| `pycharm/src/main/kotlin/com/gotchi/GotchiBrowserPanel.kt` | `buildHtml()` reads `petStageHeight` and `reducedMotion` from settings; injects `{{stageHeight}}` and `{{reducedMotion}}` |
| `vscode/FEATURES.md` | Features 5.1–5.8 marked `[x]`; `gotchi.reducedMotion` and `gotchi.petStageHeight` rows in Settings Reference updated to `[x]` |
| `.opencode/skills/git-workflow/SKILL.md` | Added "commit after every todo item" rule to Commit style section |
| `README.md` | Install filenames updated to `0.6.0` |
| `vscode/README.md` | Install filenames updated to `0.6.0` |
| `pycharm/README.md` | Install filenames updated to `0.6.0` |

### New settings (v0.6.0)

```
gotchi.petStageHeight:  number  = 96     // canvas stage height in px (range 60–200)
gotchi.reducedMotion:   boolean = false  // disable rAF animation loop; static draw only
```

### New constants (v0.6.0, sidebar.js)

```
STAGE_BASE_SPEED_PPS = { egg:0, baby:12, child:20, teen:30, adult:28, senior:15 }
MOOD_MULTIPLIER       = { happy:1.5, neutral:1.0, sad:0.4 }
GRAVITY               = 60   // px/s²
HOP_IMPULSE           = -60  // px/s upward
HOP_INTERVAL          = 4.0  // seconds between happy hops
BOUNCE_COEFF          = 0.25 // floor bounce damping
BOUNCE_MIN            = 2    // px/s — zero out vy below this
```

---

## v0.5.2 — previous

### Changes from v0.5.1

| File | What changed |
|------|-------------|
| `vscode/package.json` | Version bumped `0.5.1` → `0.5.2`; added `gotchi.customPrimaryColor`, `gotchi.customSecondaryColor`, `gotchi.customBackgroundColor` settings |
| `pycharm/build.gradle.kts` | Version bumped `0.5.1` → `0.5.2` |
| `pycharm/src/main/resources/META-INF/plugin.xml` | Version bumped `0.5.1` → `0.5.2` |
| `vscode/src/sidebarProvider.ts` | `buildHtml()` reads 3 custom colour settings and injects them as CSS vars via `{{customColorsStyle}}` placeholder; config listener expanded to watch the 3 new settings |
| `vscode/media/sidebar.html` | `{{customColorsStyle}}` placeholder added after `<link>` tag; "Custom" button added to colour picker row |
| `vscode/media/sidebar.js` | `getPalette(colorKey)` helper added after `COLOR_PALETTES`; `drawSprite` updated to call `getPalette(state.color)` instead of `COLOR_PALETTES[state.color]` |
| `pycharm/src/main/resources/webview/sidebar.html` | "Custom" button added to colour picker row |
| `pycharm/src/main/resources/webview/sidebar.js` | `getPalette(colorKey)` helper added; `drawSprite` updated to call `getPalette(state.color)` |
| `pycharm/src/main/kotlin/com/gotchi/GotchiSettings.kt` | Added `customPrimaryColor`, `customSecondaryColor`, `customBackgroundColor` fields with defaults `#ff8c00`, `#ffffff`, `#1a1a2e` |
| `pycharm/src/main/kotlin/com/gotchi/GotchiConfigurable.kt` | Added 3 `ColorPanel` fields; new rows 2–4 in settings UI for custom body/details/background colours; `isModified()`, `apply()`, `reset()` updated |
| `pycharm/src/main/kotlin/com/gotchi/GotchiBrowserPanel.kt` | `buildHtml()` reads 3 custom colour settings and appends CSS vars to the inline style block |
| `vscode/FEATURES.md` | Added custom colour scheme rows to Section 12 settings table |
| `README.md` | Install filenames updated to `0.5.2` |
| `vscode/README.md` | Install filenames updated to `0.5.2` |
| `pycharm/README.md` | Install filenames updated to `0.5.2` |

### New settings (v0.5.2)

```
gotchi.customPrimaryColor:    string = "#ff8c00"  // pet body colour for "custom" palette
gotchi.customSecondaryColor:  string = "#ffffff"  // pet eyes/details colour for "custom" palette
gotchi.customBackgroundColor: string = "#1a1a2e"  // canvas background colour for "custom" palette
```

---

## v0.5.1 — previous

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
| `vscode/src/gameEngine.ts` | BUGFIX-023: moved `consecutiveSnacks` increment from `startSnack` into `consumeSnack`; sickness now fires when the 3rd snack is physically eaten, not when the 3rd snack button is pressed |
| `pycharm/src/main/kotlin/com/gotchi/engine/GameEngine.kt` | BUGFIX-023: same `consecutiveSnacks` increment move mirrored from TypeScript |
| `vscode/tests/unit/gameEngine.test.ts` | BUGFIX-023: renamed `startSnack` "increments consecutiveSnacks" test; updated `consumeSnack` sickness seeds from 3→2; removed stale `snacksGivenThisCycle: 0` resets from integration test |
| `BUGFIXES.md` | Added BUGFIX-023 |

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
