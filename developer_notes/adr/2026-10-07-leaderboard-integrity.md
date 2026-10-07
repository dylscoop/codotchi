# ADR 2026-10-07 — Leaderboard integrity

## Status

Accepted (v2.27.0).

## Context

Nothing on the leaderboard could be trusted:

- Anyone could open a `[Leaderboard] …` issue by hand with made-up JSON and it
  was accepted. `spawnedAt` could be up to three years back, so the 240 s/day
  "physics floor" let through almost any age.
- `[Live]` issues were appended to `live.json` almost unchecked.
- The state file was plain JSON, so editing `ageDays` / `spawnedAt` was picked
  up on the next load.
- Dev mode (10× aging, health floor) was only checked at the moment of death.
  Turning it off and pressing **Submit** got a dev-mode pet onto the board.

## Decision

1. **Sticky dev-mode flag.** `PetState.devModeEverUsed` is set by any tick with
   dev mode on (including break naps) and never cleared. Such a pet can't be
   submitted or pushed live.
2. **Sealed state file.** Every writer of the shared state file (VS Code,
   PyCharm, OpenCode, Claude Desktop) stores a top-level `seal`: an HMAC over the
   fields that decide a score (identity, age, vital stats, the integrity flags).
   The seal covers the state *as a reader deserialises it*, so defaults and
   migrations never break it. On load, a wrong seal sets
   `leaderboardIneligible = "tampered"` and a missing one (a pre-2.27.0 save)
   sets `"unverified"`. Both are sticky; the pet keeps playing.
3. **Signed submissions.** Scores and live updates (`schemaVersion: 2`) carry
   `clientVersion` and `sig`, an HMAC over a canonical text that includes the
   GitHub username. The workflows recompute it with the repo secret
   `LEADERBOARD_HMAC_KEY` (`.github/scripts/leaderboard-validate.mjs`). Unsigned,
   edited or re-posted issues are rejected, and the workflows fail closed with no
   secret.
4. **Physics floor per pet type.** The fastest real rate is asleep or on a break
   nap: 720 s per game day divided by the type's aging multiplier (bytebug
   480 s, pixelpup 576 s, codeling 720 s, shellscript 960 s), with 10% slack.
5. **Whitelisted storage.** Workflows store only validated fields, plus
   `verified: true`. Unverified live entries are pruned; old scores stay and the
   page tags them *legacy*.
6. **No issue text in `${{ }}`.** Failure reasons travel through a file or an env
   var, fixing a script-injection hole in the score and delete workflows.

The key is never committed. `scripts/sync-core.mjs` and a PyCharm Gradle task
inject it at build time (see `developer_notes/leaderboard/ADMIN.md`).
`packages/core/fixtures/integrity-vector.json` pins the canonical strings, so the
TypeScript, Kotlin and workflow implementations can't drift apart.

## Alternatives considered

- **Server-observed heartbeat chain.** Only pets pushed live from hatch would be
  eligible, and age could never outgrow server timestamps. This is stronger
  against someone who extracts the key, but it makes live push mandatory. It was
  rejected for now.
- **Client checks only** (no signature). This was rejected because any GitHub
  user could still hand-write an issue.

## Consequences

- Casual cheating (editing the save, hand-written issues, dev mode then submit)
  is blocked.
- Someone who extracts the key from a built artifact can still forge entries
  within the physics floor. Admins remove those by hand.
- Pets alive when 2.27.0 installs are "unverified". Since v2.27.1 they can still
  push live and be submitted (signed, no legacy tag): they were hatched by a real
  client, and blocking them broke live progress for every existing pet. The
  trade-off: a save with its seal deleted also loads as "unverified", so an edited
  save without a seal is not caught. Tampered and dev-mode pets stay blocked.
- Older clients (schemaVersion 1) are rejected with a hint to update.
