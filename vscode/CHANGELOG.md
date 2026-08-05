# Changelog

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
