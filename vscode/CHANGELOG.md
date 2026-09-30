# Changelog

## [2.21.0] — 2026-09-30

### Fixed

- **"Threw the snack away" with several windows open** — when more than one IDE window was open, the other windows said your pet threw the snack away after it ate it. They now stay quiet.
- **Attention call expiry now matches the setting** — Needy, Standard and Chilled calls now last 2, 5 and 10 minutes as labelled. Before, they expired in half that time.
- **Time away no longer builds up calls** — time spent away doesn't make calls more likely when you come back, and misbehaviour and gift calls no longer appear while you're away.

## [2.20.18] — 2026-09-29

### Added

- **Little whims** — every now and then your pet just wants to play a game, get a pat, or have a meal or a snack, even when it isn't hungry or sad. Answer in time and it's happy; ignore it and its health suffers. The Attention Call Rate and Expiry settings apply to these too.
- Terminal plugins: `/codotchi play` and `/codotchi snack` (Claude Code, OpenCode), and play / snack tools in Claude Desktop.

### Fixed

- **Same call rate in VS Code and PyCharm** — after a call, the pet now waits 5 minutes of active time before repeating it in both IDEs. Previously VS Code repeated calls about twice as often, and time spent away counted towards the wait.
- **Answered call after a mini-game** — finishing a mini-game to answer a call now shows the "answered" message, which was previously lost.

## [2.20.17] — 2026-09-28

### Changed

- **Safe while you're away** — your pet no longer loses health while you're idle or away from the IDE, and a senior pet can't die of old age while you're gone. It still gets hungry and bored (slowly), so there's something to do when you're back.
- **More forgiving mess** — your pet tolerates more droppings before getting sick, and only gets sick if they're left for a while, so cleaning up in time prevents it. Ignoring a "clean up" call counts as a care mistake rather than always making the pet sick.

## [2.20.16] — 2026-09-25

### Fixed

- **Pet stuck walking right** — narrowing the sidebar while a snack was on the floor could leave the snack out of reach, so the pet pushed against the right wall forever. Snacks now stay inside the visible area.

## [2.20.15] — 2026-09-25

### Fixed

- **GitHub leaderboard sign-in re-prompts when it expires** — if GitHub rejects your saved sign-in, codotchi asks VS Code for a fresh one (Submit / Delete / Sign in) instead of failing with `GitHub API error: 401`. Background live pushes show a one-off **Sign in** notification, and the sidebar shows **Sign in to GitHub again**. Sign-in errors are now shown with a **Retry** button instead of being swallowed.
- **Copilot quota** — the Today’s Token Cost bubble now says when the Copilot GitHub sign-in has expired.

## [2.21.0] — 2026-08-10

### Added

- **Leaderboard pet-name confirmation** — clicking "Submit to Leaderboard" now prompts you to type your pet's name before submitting, preventing automated or accidental submissions.
- **Stage-first leaderboard ranking** — the public leaderboard and in-sidebar rank now sort by stage (senior → egg) first, then by ageDays within each stage.

### Changed

- **Live ages shown as-submitted** — live leaderboard entries now display the age at the time of the last push from the IDE, with no extrapolation based on elapsed time.

### Security

- **Stage-age consistency validation** — the server now rejects submissions where the reported stage and ageDays are physically inconsistent (e.g. `stage: "egg"` with `ageDays: 500`).
- **Timestamp sanity checks** — `spawnedAt` and `diedAt` in the future or older than 3 years are rejected.

## [2.20.5] — 2026-08-06

### Fixed

- **Live leaderboard upsert** — live score pushes now use a stable per-IDE-installation ID (`vscode.env.machineId` / `PermanentInstallationID`) instead of `spawnedAt`, so repeat pushes correctly replace the previous entry rather than accumulating duplicates.
- **PyCharm death submission** — leaderboard submissions from PyCharm now POST directly to the GitHub API from the IDE; the browser URL (which users could edit before submitting) is no longer used.
- **Live entry cleanup** — when a user submits their death score or requests a deletion, their live entry in `live.json` is now automatically removed by the GitHub Actions workflow.

## [2.20.4] — 2026-08-05

### Added

- **Leaderboard sign-in button** — a "Sign in to GitHub" button and signed-in status label now appear in the sidebar when your pet is alive, making it clear whether you're authenticated for leaderboard pushes.
- **Sign in to GitHub (Leaderboard)** section added to PyCharm Settings > Tools > Codotchi with sign-in and sign-out buttons.

### Fixed

- **Live leaderboard pet uniqueness** — multiple pets from the same GitHub account (VS Code + PyCharm, or two windows) are now tracked as separate entries in `live.json` instead of overwriting each other.
- **Real-time live rank** — live leaderboard rank now extrapolates current age from the last push timestamp, so scores stay accurate between syncs. Push interval also reduced from 60 min to 15 min.

## [2.15.2] — 2026-07-08

### Changed

- Enabled `codotchi.aiMode` by default so AI agent edits (document changes, cursor movement, tab switches) no longer keep the idle timer perpetually reset — pets now decay naturally when you're idle, regardless of agent activity.

## [2.15.1] — 2026-06-26

### Changed

- Reworked the dog sprite with a new beige/tan palette and resized grid to match the cat sprite.
- Scaled down cat and dog renders at medium size (0.85x, was 1.0x).

## [2.15.0] — 2026-06-25

### Removed

- Trimmed the pet rotation to cat, dog, snake, sheep, classic, kangaroo, and dragon (removed rooster and tiger).

## [2.14.1] — 2026-06-25

### Changed

- Updated sprite showcase in README to feature dog, dragon, and kangaroo.

## [2.14.0]

### Added

- Dragon sprite added to the pet rotation — a fiery new companion you can hatch.
