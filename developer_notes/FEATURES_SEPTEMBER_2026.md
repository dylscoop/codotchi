# codotchi — September 2026 Backlog

Snapshot of the repository state on **2026-09-24** (v2.20.12), plus the new
features, bugs, clean-up work and marketing drafts planned for this cycle.
Items here do not replace `developer_notes/vscode/FEATURES.md` or
`developer_notes/vscode/FEATURES_2.md`; where an item already exists there it
is cross-referenced.

Status legend:

- `[x]` Implemented
- `[~]` Partially implemented
- `[ ]` Not yet implemented
- `[S]` Controlled by a setting

---

## 0. Current State

### 0.1 Headline numbers

| Area | State |
|------|-------|
| Released version | v2.20.12 (VS Code, PyCharm, OpenCode, Claude Code plugin, Claude Desktop) |
| Open bugs in `BUGFIXES.md` | 0 — the file is a log of 160 fixed bugs; every entry is `Fixed` |
| `TODO` / `FIXME` / `HACK` comments in source | 0 |
| Open rows in `FEATURES.md` | ~45 after the September tick-off (was 57) |
| Open rows in `FEATURES_2.md` | ~52 after the September tick-off (was 60) |
| Tests | vscode (engine, Copilot quota), claude-codotchi (unit + integration), opencode (partial), pycharm (engine, quota, panel); claude-desktop has none; no CI runs any of them |

### 0.2 Ticked off in the September review

Rows found to be already implemented (or partially implemented) and updated
in the older docs as part of this review:

| Doc | Item | New status |
|-----|------|------------|
| FEATURES.md §1 | Care Score | `[x]` |
| FEATURES.md §2.2 | Tamagotchi-style sprite redesign (ox/tiger archived) | `[x]` |
| FEATURES.md §2.2 | Evolution fanfare (animation; no sound) | `[x]` |
| FEATURES.md §2.2 | Egg-hatch animation (egg rocks, no crack/burst) | `[~]` |
| FEATURES.md §3 / §6.2 | Light off / manual bedtime (Sleep button has no energy gate) | `[x]` |
| FEATURES.md §5.6 | Reaction animations (`died` never implemented) | `[~]` (was wrongly `[x]`) |
| FEATURES.md §6.4 | Sick animation | `[x]` |
| FEATURES.md §10 | Attention ⚠ indicator (tooltip only, when sick) | `[~]` |
| FEATURES.md §11 / §14 | State schema migration (defaults fill-in, no `schemaVersion`) | `[~]` |
| FEATURES.md §14 | Sprite animation frames (2-frame walk only) | `[~]` |
| FEATURES_2.md §1.5 | Pause command, `paused` field, offline-decay exclusion | `[x]` |
| FEATURES_2.md §1.5 | Paused UI indicator (title-bar icon, no canvas banner) | `[~]` |
| FEATURES_2.md §1.7 | Egg wiggle phase (whole egg stage) | `[~]` |
| FEATURES_2.md §3.1 | Idle walk cycle | `[x]` |
| FEATURES_2.md §3.2 | Clock-based background + darker night palette | `[x]` |

### 0.3 Still-open themes carried from older docs

- **Tamagotchi parity:** potty training, sound effects and mute, the full
  egg-hatch sequence, a medicine-dose badge, greying out Feed/Play while sick,
  and a night-mode canvas while sleeping.
- **Connection era:** matchmaker, marriage and offspring, friendship, gifts,
  Gotchi Points and the shop, and the generation counter.
- **Minigames:** Pattern Memory, Catch the Bug and Type Sprint are not in the
  picker.
- **Settings table (FEATURES.md §12):** none of the planned `gotchi.*` settings
  exist, and the table uses an old prefix (the real prefix is `codotchi.*`).
- **Platform:** export/import of a pet as JSON, extension-pack pet types,
  seasonal characters, multiple pets (§2.4 below) and language packs (§2.3
  below).

---

## 1. Bugs

### BUG-S01 — Claude token count and today's cost go wrong when a session crosses midnight

**Status:** Fixed (v2.20.13, branch `fix/daily-token-cost`, BUGFIX-161)
**Files:** `claude-codotchi/scripts/state.mjs` (`scanAllDailyUsage`, ~233-274),
`vscode/src/sidebarProvider.ts` (`scanClaudeCodeDailyUsage`, ~84-129),
`pycharm/src/main/kotlin/com/codotchi/CodotchiPlugin.kt` (`scanClaudeCodeDailyUsage`, ~366-417),
`opencode-codotchi/src/index.ts`

**Problem:** The "tokens per message" figure in pet speech and the "Today's
Token Cost" total sometimes don't add up when a Claude Code session runs
across midnight.

**Root causes** (the first three are in all three scanners, which are copies of each other):

1. **The day boundary is UTC, not local.** "Today" is
   `new Date().toISOString().slice(0,10)` (Kotlin: `LocalDate.now(ZoneOffset.UTC)`),
   and messages are filtered with `timestamp.startsWith(today)`. In BST the
   counter resets at 01:00 local time. Messages sent between 00:00 and 01:00
   count towards the previous day, and a session running over midnight is
   split at the wrong place. The file-modified pre-filter uses the same UTC
   date.
2. **Duplicate transcript lines are never removed.** Claude Code writes one
   JSONL line per content block, and each line repeats the same
   `message.usage`. A sample session had 20 assistant lines but only 10 unique
   `message.id:requestId` pairs. Cost, tokens and `messageCount` all come out
   about 2× too high, and the per-message average leans towards replies with
   many content blocks.
3. **Subagent transcripts are skipped.** Newer Claude Code versions write
   Task/subagent turns to `~/.claude/projects/<proj>/<sessionId>/subagents/*.jsonl`.
   The scanners only read top-level `*.jsonl`, although the JSDoc says Task
   turns are included.
4. **OpenCode day rollover** (`opencode-codotchi/src/index.ts`):
   - `countedMessageIds.add(msgId)` runs before `checkDayRollover()`, which
     clears the set, so the message that triggers the rollover is forgotten.
   - Live events are assigned to the wall-clock day they arrive, not their
     `completedAt`. `pendingLiveEvents` replay doesn't check the day either.
   - The fallback path (`!trackASucceeded`) adds up the whole session's usage,
     so a session touched today brings its earlier days' cost with it.
   - `reloadDaily` refreshes cost and tokens but not `dailyMessages`, so the
     average drifts across windows.
5. **Minor:** the 3-second statusline usage cache (`statusline.mjs`) has no
   date field, so it can briefly show yesterday's total after rollover.

**Proposed fix:**

- Compute `localMidnightMs` once per scan and compare
  `Date.parse(msg.timestamp) >= localMidnightMs` (Kotlin: `Instant.parse`
  against `LocalDate.now().atStartOfDay(ZoneId.systemDefault())`). Apply the
  same rule to the file-mtime pre-filter.
- Keep a `Set` of `message.id + ":" + requestId` per scan and skip repeats.
- Scan `<sessionId>/subagents/*.jsonl` recursively.
- OpenCode: check rollover before recording the ID, bucket by `completedAt`,
  filter the fallback on `time.completed >= todayStartMs`, and reload
  `dailyMessages`.
- Put the date in the statusline cache key.
- Tests: a transcript fixture with a message at 23:59 local and one at 00:01
  local, duplicate content-block lines, and a subagent file. Assert the totals
  in all three hosts.
- Parity: the scanner and the `MODEL_PRICING` table are copied three times.
  Moving them into one module would stop this happening again (see §3).

---

### BUG-S02 — Idle pets still lose health

**Status:** Open
**Files:** `vscode/src/gameEngine.ts` (`tick()`), plus the claude-codotchi,
opencode-codotchi and claude-desktop-codotchi copies, and
`pycharm/.../engine/GameEngine.kt`

**Problem:** While the user is idle:

- starvation (−5/tick), unhappiness (−5/tick) and exhaustion (−2/tick) damage
  have no idle guard
- sickness still does −1/tick in regular idle, and is off only in deep idle
- health keeps falling until the idle floor (`IDLE_STAT_FLOOR = 20`) stops it

So a user who steps away comes back to a pet at 20 health. The senior
old-age death and sickness rolls are not gated on idle either, so a senior can
die while the user is away. Poop and poop-sickness are already paused while
idle.

**Proposed fix:** see §2.1. While `isIdle || isDeepIdle`:

- health must never go below its value at the start of the tick
- skip the old-age rolls
- suppress the poop attention call

Also, `claude-codotchi/scripts/statusline.mjs` and `hook-stop.mjs` replay
elapsed ticks as `tick(state, false, false)` ("always active"). When they tick
the shared IDE pet state, that bypasses idle protection. They should pass
through the IDE's idle flag, or skip damage.

---

### BUG-S03 — Zodiac species draw nothing in VS Code

**Status:** Open
**File:** `vscode/media/sprites.js` (~6186)

**Problem:** When a `spriteType` has no grid, the renderer falls back to
`SPRITES["monkey"]`, but monkey was moved to `media/archived_sprites/`. The
fallback is therefore empty and nothing is drawn for rat, ox, tiger, rabbit,
horse, monkey, rooster or pig. The claude, opencode and desktop engines still
include `rooster` and `tiger` in `ROTATION_ANIMALS`, so pets hatched there and
shown in the IDE are invisible.

**Proposed fix:** fall back to the species' adult grid, then to `classic`
(drawn procedurally). Line `ROTATION_ANIMALS` up across all engines. The real
fix is §2.2 (bulk sprites).

---

### BUG-S04 — Feed and Play are not blocked while sick

**Status:** Open
**Files:** `vscode/src/gameEngine.ts` (`feedMeal`, `play`), `vscode/media/sidebar.js`

**Problem:** FEATURES.md §6.4 says the engine blocks Feed/Play while the pet
is sick, but `feedMeal` and `play` never check `sick`. The sidebar only
disables buttons while sleeping or paused.

**Proposed fix:** decide on the intended behaviour. Either enforce it in the
engine and grey out the buttons, or correct the docs.

---

### BUG-S05 — `died` reaction animation never implemented

**Status:** Open
**File:** `vscode/media/sidebar.js`

**Problem:** FEATURES.md §5.6 listed a `died` float-up reaction (1200 ms) as
done. `REACTION_DURATIONS` has no `died` entry and nothing queues one; death
shows only a speech bubble and the game-over screen.

**Proposed fix:** add the reaction, or drop it from the spec. The §5.6 status
has been corrected to `[~]`.

---

### BUG-S06 — Attention-call cooldowns differ between TypeScript and Kotlin

**Status:** Open
**Files:** `vscode/src/gameEngine.ts`, `pycharm/.../engine/Constants.kt`

**Problem:** `ATTENTION_ANSWER_COOLDOWN_TICKS` / `ATTENTION_EXPIRY_COOLDOWN_TICKS`
are 50/20 in TypeScript but 100/40 in Kotlin, so PyCharm pets call for
attention half as often.

**Proposed fix:** pick one pair of values and mirror it (ide-parity).

---

### BUG-S07 — Sprite tooling broken or out of step

**Status:** Open
**Files:** `scripts/inject_sprites.js`, `scripts/validate_sprites.js`,
`pycharm/src/main/resources/webview/sprites.js`

**Problems:**

- `inject_sprites.js` looks for `DEFS["classic"] = {`, which no longer exists
  (classic is procedural now).
- `validate_sprites.js` validates the output of `gen_sprites.js`, not
  `sprites.js`, so imported dog/cat/dragon/roo data is never checked.
- PyCharm's `sprites.js` differs from VS Code's by ~1,700 lines. It still
  contains the archived zodiac sprites and defines `DEFS["cat"]` twice (the
  old 48×32 one and the new one).

**Proposed fix:** covered by §2.2 and §3.

---

### BUG-S08 — GitHub account sync doesn't re-prompt properly when sign-in fails

**Status:** Fixed (v2.20.15, branch `fix/github-reauth`, BUGFIX-163)
**Files:** `vscode/src/sidebarProvider.ts` (`handleSignInLeaderboard`,
`pushLiveScore`, leaderboard submit/delete handlers, Copilot quota segment),
`vscode/src/copilotQuota.ts`, `pycharm/src/main/kotlin/com/codotchi/CodotchiPlugin.kt`
(`pushLiveScoreAsync`, `submitLeaderboardAsync`, `startDeviceFlowAsync`),
`pycharm/.../CopilotQuota.kt`

**Problem:** When GitHub sign-in or token use fails, codotchi doesn't
reliably ask the user to sign in again, so they get stuck.

- **VS Code, invalid or revoked session:**
  - `getSession("github", …, { createIfNone: true })` returns the cached
    session even if its token has been revoked or lost scope.
  - The `api.github.com/user` call then gets a 401. The submit and delete
    handlers show `GitHub API error: 401`, and nothing requests a fresh
    session (`forceNewSession`).
  - Every retry reuses the same bad session.
- **VS Code, failed or cancelled sign-in:**
  - `handleSignInLeaderboard` swallows all exceptions ("silent — sign-in is
    best-effort"), so a failed sign-in gives no feedback and no retry prompt.
  - A cancelled sign-in just clears the username.
- **VS Code, background live pushes:** these use `createIfNone: false` and
  return silently when there is no session or it is invalid, so a user with
  live push on can stop appearing on the leaderboard without being told.
- **VS Code, Copilot quota:**
  - The "sign in to GitHub" hint appears only once per session
    (`copilotNoSessionHintShown`).
  - `unauthorized` results are dropped silently, so an expired session never
    leads to a new sign-in prompt.
- **PyCharm, stored PAT or device-flow token:**
  - When the token in PasswordSafe goes bad (401/403), `pushLiveScoreAsync`
    returns silently and submit shows a status error.
  - The stale token is never cleared and the device flow never restarts, so
    the plugin keeps using the dead token until the user clears it by hand in
    Settings.

**Proposed fix:**

- Treat a 401/403 from GitHub as "session invalid" in every flow:
  - VS Code: call `getSession(…, { forceNewSession: { detail: "Your GitHub
    sign-in expired — sign in again to sync your codotchi." } })`.
  - PyCharm: clear the `Codotchi/github-pat` credential and restart
    `startDeviceFlowAsync`, retrying the original action once.
- Background pushes should not open a sign-in popup. They should set a
  `leaderboardAuthExpired` flag and show a "Sign in again" button or banner in
  the sidebar leaderboard panel and a notification with a **Sign in** action.
  Clear the flag on the next success.
- Replace the silent `catch` in `handleSignInLeaderboard` with a
  `leaderboard_sign_in_result` message that carries an error, and show a
  **Retry** button.
- Copilot: on `unauthorized`, show the sign-in hint again (not only once) and
  offer a **Sign in to GitHub** command.
- Tests: mock `getSession` / HTTP to return 401 and check that a new session
  is requested (VS Code) or the credential is cleared and the device flow
  restarted (PyCharm). Mirror the change in both IDEs (ide-parity).

---

## 2. New Features

### 2.1 More Forgiving Poop and Idle Health

| Feature | Status | Notes |
|---------|--------|-------|
| Raise `MAX_UNCLEANED_POOPS_BEFORE_SICK` from 3 to 5 | `[ ]` | Update all 4 TS engines + `Constants.kt` |
| Poop sickness grace period | `[ ]` | New `POOP_SICK_GRACE_TICKS` (suggested 20 ticks ≈ 1 min): the pet only gets sick after being over the poop limit for that many consecutive active ticks, so cleaning up in time prevents it |
| Expired poop attention call → care mistake instead of guaranteed sickness | `[ ]` | Today an expired `poop` call makes the pet sick; replace that with `careMistakes += 1` and only make it sick if the poop count is over the limit |
| No health loss of any kind while idle | `[ ]` | Fixes BUG-S02. Starvation, unhappiness, exhaustion and sickness damage are all skipped while `isIdle` or `isDeepIdle`; the health floor becomes `max(health, state.health)` |
| Idle freezes poop timer | `[x]` | Already true: poop builds up only while `!sleeping && !isIdle` |
| Old-age rolls skipped while idle | `[ ]` | Stops a senior pet dying while the user is away |
| Poop attention call suppressed while idle | `[ ]` | The call can currently fire while idle even though it can't expire |

**Design notes:**

- Hunger and happiness can still fall while idle (slowed by
  `IDLE_DECAY_TICK_DIVISOR`) so there is something to care for on return, but
  health does not fall.
- Sickness already present stays in place while idle (no auto-cure) but does
  no damage.
- Docs to update when this is built: `DEV_NOTES.md` (idle / deep idle /
  poop sections), `vscode/package.json` deep-idle setting description,
  `vscode/README.md`, `pycharm/README.md`, `plugin.xml`, and the user guides.

---

### 2.2 Bulk Sprite Upload

Goal: drop in images for every animal at once, instead of running
`import_sprite.js` five times per species and fixing the metadata by hand.

| Feature | Status | Notes |
|---------|--------|-------|
| Folder convention `sprites/<species>/{baby,child,teen,adult,senior}.png` | `[ ]` | Source images live in git, and these files are the source of truth |
| Optional `sprites/<species>/sprite.json` | `[ ]` | `palette {primary, secondary, accent}`, `transparent`, `legRowStart`, `upright`, `flip`, `inRotation`, `passcode`, `defaultName` |
| `scripts/import_sprites_bulk.js` | `[ ]` | Imports every species folder in one run |
| Refactor `import_sprite.js` into a reusable module | `[ ]` | Export `decode`, `quantize`, `buildDefsEntry`; keep the CLI as a thin wrapper |
| One grid shared by all stages of a species | `[ ]` | Fixes the clash where `SPRITE_GRID_META` is overwritten by the last stage imported; stages are padded bottom-centre onto the largest cropped size (≤ 192×128) |
| One palette per species | `[ ]` | Quantize all stages against the same 3 colours |
| Generated `media/sprites.generated.js` | `[ ]` | DEFS + META + PALETTES written from scratch each run, instead of regex-splicing into the hand-maintained `sprites.js`; loaded by `sidebar.html`, `sprite_preview.html` and the PyCharm loaders |
| Copy generated output into PyCharm `webview/` | `[ ]` | Or have Gradle copy it from `vscode/media` at build time, so the two can't drift |
| Missing-stage report | `[ ]` | Lists species/stage pairs with no image |
| Rewrite `validate_sprites.js` against the real data | `[ ]` | Row width == cols, row count == rows, all 5 stages present, palette present, allowed digits only; run it in the test suites |
| Renderer fallback: adult → classic | `[ ]` | Fixes BUG-S03 |
| Terminal plugin support | `[ ]` | Add a `SPRITE_HEAD` (asciiArt.ts ×3) and an emoji (`emoji.mjs`) for each new species |
| In-IDE "Import sprites from folder…" (dev mode) | `[ ]` | Phase 2: button in the Sprite Preview panel (VS Code `showOpenDialog`, PyCharm `FileChooser`); writes a user sprite pack to globalStorage, because installed extension media is read-only; needs CSP and loader changes |

**Design notes:**

- Species waiting for real art: **rat, ox, tiger, rabbit, horse, monkey,
  rooster, pig**. Design notes for several of these already exist in
  `developer_notes/sprites/*.md`.
- Size budget: about 128 lines × 195 chars per stage at the cap. Eight
  species add roughly 1 MB of source to each copy, which is another reason to
  generate the file rather than hand-edit it. Shrink `roo` (644×531, before the
  cap) down to the cap at the same time.
- Registration (`customCharacters.ts`, `customCharacters.js`,
  `CustomCharacters.kt`, the `SpriteType` union, `ROTATION_ANIMALS`) can be
  generated from `sprite.json` once the shared core package exists (§3).

---

### 2.3 Language Packs — Scottish and Australian English

Expands the FEATURES.md §14 "Language packs" row.

| Feature | Status | Notes |
|---------|--------|-------|
| Pull user-facing strings out into `lang/en.json` | `[ ]` | String IDs with `__Name__` placeholders (same pattern as `customCharacters.js`) |
| `en-SCO` pack (Scottish English) | `[ ]` | Keys it doesn't define fall back to `en` |
| `en-AU` pack (Australian English) | `[ ]` | Keys it doesn't define fall back to `en` |
| `[S]` `codotchi.languagePack` setting (`en` / `en-SCO` / `en-AU`) | `[ ]` | VS Code setting + PyCharm settings page |
| `/codotchi lang <pack>` command | `[ ]` | Claude Code and OpenCode plugins; saved in plugin state |
| Community packs loadable at runtime | `[ ]` | Phase 2: drop a JSON file into the codotchi state folder |

**Where the strings live today** (none localised):

- Webview: `humaniseEvent()`, `_sleepTexts`, `_praiseTexts`, `_scoldTexts`,
  and bubble text in `vscode/media/sidebar.js`. There is a copy in
  `pycharm/src/main/resources/webview/sidebar.js`.
- Terminal: `buildContextualSpeech`, `TODO_COMPLETE_PHRASES` and
  `SESSION_DIFF_PHRASES` in `asciiArt.ts` (claude, opencode and desktop
  copies); inline phrases in `opencode-codotchi/src/index.ts`;
  `claude-codotchi/scripts/action.mjs` command responses; `MOOD_MESSAGES` in
  `claude-desktop-codotchi/src/tools.ts`.
- IDE notifications: `vscode/src/extension.ts`, `CodotchiPlugin.kt`.
- Reference catalogue: `DEV_NOTES.md` "Pet Phrases Reference".

**Sample phrases:**

| Key | en | en-SCO | en-AU |
|-----|----|--------|-------|
| `hungry` | `__Name__ is hungry.` | `__Name__'s starvin'. Gie us a piece!` | `__Name__'s starvin', mate. Chuck us a snag?` |
| `happy` | `__Name__ is happy!` | `__Name__'s pure buzzin'!` | `__Name__'s stoked!` |
| `sick` | `__Name__ feels unwell.` | `__Name__'s lookin' awfy peely-wally.` | `__Name__'s feelin' crook.` |
| `sleep` | `__Name__ fell asleep.` | `__Name__'s away for a wee kip.` | `__Name__'s havin' a nap this arvo.` |
| `praise` | `Good job!` | `Braw, that!` | `Good on ya!` |
| `scold` | `__Name__ was scolded.` | `__Name__'s been gettin' a row.` | `__Name__ copped an earful.` |
| `poop` | `__Name__ made a mess.` | `__Name__'s made a right midden.` | `__Name__'s left a mess, fair dinkum.` |
| `cost_high` | `That's a lot of tokens today.` | `Haud on, that's a lot o' tokens!` | `Strewth, that's heaps of tokens!` |

**Design notes:**

- The `stu` (Scottish) and `kangaroo`/`roo` (Australian) custom characters
  already have voice overrides (`patBubbles`, `patToasts`, `giftMessage`).
  Unlocking these characters could suggest the matching pack.
- One `en.json` should be the source for all hosts. A build step copies it into
  each plugin, as with the shared core in §3.

---

### 2.4 Multiple Pets and Talking to Other People's Codotchis

Expands the FEATURES.md §14 "Multiple simultaneous pets" row and builds on
FEATURES_2.md §2.

#### Phase A — several pets per user

| Feature | Status | Notes |
|---------|--------|-------|
| `pets: PetState[]` + `activePetId` in saved state | `[ ]` | Needs a `schemaVersion` and a migration (FEATURES.md §11) |
| Pet switcher in sidebar (tabs or arrows) | `[ ]` | Inactive pets tick at the idle decay rate |
| Adopt / release a pet | `[ ]` | Maximum of 3 pets, to keep ticking cheap |
| Pets interact on the same canvas | `[ ]` | Idle wandering together; occasional play/emote reactions |
| Terminal plugins show the active pet | `[ ]` | `/codotchi switch <name>` |

#### Phase B — visit and talk to other people's pets

| Feature | Status | Notes |
|---------|--------|-------|
| Browse live pets | `[ ]` | Reads the leaderboard `live.json` snapshots already pushed hourly through the GitHub-issue + Actions pipeline; add `spriteType` / `stage` to the snapshot if they're missing |
| Visit a pet | `[ ]` | The visitor pet appears on your canvas for a short time |
| Send a preset emote / phrase | `[ ]` | Preset list only (wave, gift, play, "nice code!"), with no free text, so no moderation is needed |
| Message delivery | `[ ]` | v1: a `[Visit]` GitHub issue, turned into `visits.json` on the `leaderboard` branch and polled by the recipient. Later: a small relay service |
| `[S]` `codotchi.social.enabled` (default `false`) | `[ ]` | Opt-in; uses the existing leaderboard GitHub sign-in |
| Block / mute a user | `[ ]` | Stored locally |

**Phase C — Connection-era mechanics:** friendship meter, gift exchange,
matchmaker, marriage and offspring, and the generation counter. The designs are
already in FEATURES_2.md §2.1-2.4 and §3.3; they build on the Phase B link.

---

## 3. Clean-up Opportunities

Most valuable first.

| # | Item | Status | Notes |
|---|------|--------|-------|
| 1 | Shared core package | `[ ]` | `gameEngine.ts` is copied 4 times (~2,500 lines each, drifting by 29-55 lines) and `asciiArt.ts` 3 times (the claude-desktop copy uses an old `buildContextualSpeech` signature). Create `packages/core` and build it into each plugin; move plugin-specific behaviour (immortal pets, rotation list) into config |
| 2 | Generate PyCharm webview assets | `[ ]` | `sidebar.js/.css/.html`, `customCharacters.js`, `spriteConstants.js` and `sprites.js` are hand-copied into `pycharm/src/main/resources/webview/`; copy them at build time instead |
| 3 | Move release binaries out of git | `[ ]` | ~564 MB of tracked zip/vsix/mcpb files under `archive/` and `releases/` (`.git` is 185 MB). Use GitHub Releases, which the release skill already publishes to |
| 4 | Stop shipping archived sprites | `[ ]` | `vscode/media/archived_sprites/` is packaged into the vsix; add it and `archive/` to `vscode/.vscodeignore` |
| 5 | Remove stray tracked files | `[ ]` | stale `vscode/tests/unit/gameEngine.test.js` (+ `.map`), `.idea/`, `pycharm/build/test-results/`, old `claude-codotchi/claude-codotchi-2.17.0.zip` |
| 6 | Tidy repo root | `[ ]` | Move `dog_adult_1x.png`, `dragon_adult_1x.png`, `kangaroo_adult_1x.png`, `example_skippy.png`, `bmc_qr.png` to `docs/images/` and update the README URLs that point at them; delete the local `downloaded_sprites/` folder (gitignored) |
| 7 | Prune `scripts/` | `[ ]` | Delete `inject_sprites.js` (broken) and `mirror_roo.js` (replaced by `--flip`); archive `gen_sprites.js`; rewrite `validate_sprites.js` (§2.2) |
| 8 | One usage scanner + pricing table | `[ ]` | `MODEL_PRICING` and the transcript scan exist in `state.mjs`, `sidebarProvider.ts` and `CodotchiPlugin.kt` (BUG-S01) |
| 9 | Split `sidebarProvider.ts` | `[ ]` | Move usage parsing into `usageScanner.ts`; break the ~215-line `handleWebviewMessage` switch into handlers |
| 10 | Dead code | `[ ]` | `ZODIAC_ANIMALS` (union-only); unused `readSessionUsage` and leftover `codotchi-daily.json` load/save in `state.mjs`; local `UPRIGHT_TYPES` in `sprites.js` shadowing `spriteConstants.js`; duplicate `DEFS["cat"]` in the PyCharm copy |
| 11 | Name mismatch | `[ ]` | `asciiArt.ts` `SPRITE_HEAD` uses `goat` but the engine calls it `sheep`; no heads for kangaroo, roo, tim, stu |
| 12 | Tests and CI | `[ ]` | `usageBackfill.test.ts` isn't in opencode's `test` script; claude-desktop has no tests; no sprite-data test; add a GitHub Actions workflow that runs every suite |
| 13 | Doc drift | `[ ]` | See the list below |

**Doc drift to fix (item 13):**

- `VERSIONS.md` has two `— current` headings (v2.20.11 and v2.20.10), and
  `vscode/CHANGELOG.md` has 2.21.0 at the top.
- `FEATURES.md`:
  - two `## 12.` sections
  - Pattern Memory has no `### 4.2` heading
  - the §12 settings table uses `gotchi.*` and is missing
    `attentionCallExpiry`, `attentionCallRate`, `petSize`,
    `tokenCostSources`, `leaderboard.autoRefresh` and `leaderboard.livePush`
  - `alwaysShowGamePicker` no longer makes sense (the picker always shows)
- `PLAN-crossproject-daily-cost.md` says "not yet implemented", but the
  SQLite track is in `opencode-codotchi/src/index.ts`.
- `SPRITE_IMPORT.md` gives a 700×550 cap, but the code uses 192×128; it
  doesn't document `--flip` and quotes a stale line number.
- `SPRITES.md` still lists rooster and tiger in rotation, and grid sizes for
  archived species.
- The VS Code and PyCharm READMEs and `plugin.xml` say medicine restores health
  per dose, but `giveMedicine` no longer changes health.
- `vscode/package.json` says deep idle floors stats at 20; the floor only
  applies when sick or damaged that tick.
- `DEV_NOTES.md` says offline decay hits energy and health; the code only
  decays hunger and happiness.
- `BUGFIXES.md` has one section with no `## BUGFIX-` heading (classic sprite
  ground anchor), and BUGFIX-119 sits at the top of the file.

---

## 4. Marketing Drafts

Suggested visuals: `dragon_adult_1x.png`, `dog_adult_1x.png`,
`kangaroo_adult_1x.png` and `example_skippy.png` from the repo root, plus a
short screen recording of the pet reacting to a save or commit and the
"Today's Token Cost" readout.

### 4.1 LinkedIn

> I built a Tamagotchi that lives in my IDE. 🥚➡️🐉
>
> codotchi is a pixel-art virtual pet for developers. It hatches from an egg,
> grows through five life stages, and evolves based on how well you look after
> it. Feed it, play mini-games, put it to bed, clean up after it… and it
> reacts to your real work: saves and commits make it happier.
>
> The part I'm most pleased with: it keeps an eye on your AI spend. Your pet
> shows today's Claude Code / OpenCode token cost and GitHub Copilot quota, so
> you get a gentle nudge before a long agent session gets expensive.
>
> It runs in:
> 🔹 VS Code
> 🔹 JetBrains IDEs (PyCharm, IntelliJ…)
> 🔹 Claude Code
> 🔹 OpenCode
> 🔹 Claude Desktop
>
> There's a public leaderboard too. Submit your pet when it dies, or push live
> progress while it's still going.
>
> It's free and open source: github.com/dylscoop/codotchi
> Coming soon: bulk sprites for all the zodiac animals, Scottish and Aussie
> language packs, and visiting your friends' codotchis.
>
> What would you want your coding pet to react to? 👇
>
> #DeveloperTools #VSCode #JetBrains #ClaudeCode #AI #OpenSource #IndieDev #PixelArt

### 4.2 Instagram — launch post

> Meet your new coding buddy 🐣💻
>
> codotchi is a Tamagotchi that lives in your IDE. Feed it, play with it and
> keep it clean, and it levels up every time you save or commit ✨
>
> 🐉 Dragons, dogs, cats, kangaroos and more
> 🎮 Built-in mini-games
> 💸 Tracks your AI token spend
> 🏆 Public leaderboard
>
> Free for VS Code, JetBrains, Claude Code, OpenCode and Claude Desktop.
> Link in bio 🔗
>
> #codinglife #programmer #developer #tamagotchi #pixelart #vscode #indiedev #techtok #100daysofcode #devlife

**Suggested carousel:** 1) egg → 2) baby → 3) adult dragon → 4) the sidebar
mid-mini-game → 5) the leaderboard page.

### 4.3 Instagram — feature teaser (language packs)

> Your codotchi's picking up an accent 🏴󠁧󠁢󠁳󠁣󠁴󠁿🇦🇺
>
> "Skippy's lookin' awfy peely-wally" 🤒
> "Strewth, that's heaps of tokens!" 💸
>
> Scottish and Aussie language packs are coming soon. Which accent should
> be next? 👇
>
> #codotchi #pixelart #developer #scotland #australia #codinghumour #indiedev

### 4.4 X / Threads (short)

> I made a Tamagotchi for your IDE 🥚 It evolves when you code, gets sick if
> you ignore it, and tells you how much Claude has cost you today 💸
> VS Code · JetBrains · Claude Code · OpenCode · Claude Desktop
> github.com/dylscoop/codotchi
