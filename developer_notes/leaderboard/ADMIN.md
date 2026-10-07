# Leaderboard Admin Guide

Admin operations require repo-owner access to `dylscoop/codotchi`.

---

## Delete a leaderboard entry

### Option A — Admin workflow (GitHub Actions)

1. Go to **Actions → "Delete Leaderboard Score (Admin)" → Run workflow**
2. Fill in the inputs:
   - `github_username` — the GitHub username whose entry to delete (e.g. `dylscoop`)
   - `spawned_at` — the `spawnedAt` epoch-ms of the specific run (optional — omit to delete **all** entries for that user)
3. Click **Run workflow**

The workflow removes the matching entry from `leaderboard/scores.json` on the `leaderboard` branch and commits immediately.

### How to find `spawned_at`

Open `leaderboard/scores.json` on the `leaderboard` branch and copy the `spawnedAt` value for the entry you want to remove:

```
https://github.com/dylscoop/codotchi/blob/leaderboard/leaderboard/scores.json
```

Example entry:
```json
{
  "githubUsername": "dylscoop",
  "petName": "Codotchi",
  "spawnedAt": 1785773317734,
  ...
}
```

Pass `1785773317734` as `spawned_at` to delete only that run.

---

### Option B — User self-delete (VS Code only)

Users can delete their own entries without admin access via the VS Code plugin:
- On the game over screen → click **Delete entry**
- This creates a GitHub issue with label `leaderboard-delete`; the `process-leaderboard-delete.yml` workflow handles it and verifies the issue author matches the claimed username

---

## Edit live.json directly

`leaderboard/live.json` on the `leaderboard` branch holds currently-alive pet snapshots. Entries older than 48 hours are automatically hidden by the leaderboard page — so manual cleanup is rarely needed.

To force-remove a stale entry, edit the file directly on the `leaderboard` branch on GitHub (or locally) and commit.

The file format is an array:
```json
[
  {
    "username": "someuser",
    "petName": "Fluffy",
    "petRunId": 1234567890000,
    "ageDays": 5,
    "stage": "teen",
    "petType": "codeling",
    "updatedAt": 1785925546905
  }
]
```

---

## Leaderboard signing key (required since v2.27.0)

Every leaderboard issue (`[Leaderboard]` scores and `[Live]` updates) carries an
HMAC-SHA256 signature. The workflows reject issues without a valid signature,
so hand-written issues never reach `scores.json` / `live.json`. The plugins also
seal their state file with the same key, so a hand-edited save marks the pet
"tampered" and it can't be submitted. See
`developer_notes/adr/2026-10-07-leaderboard-integrity.md`.

The key is **never committed**. One key is shared by the workflows and every
build:

1. Generate a key once:

   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))" > .leaderboard-key
   ```

   `.leaderboard-key` sits in the repo root and is gitignored. Keep a copy in a
   password manager; losing it means every in-progress pet becomes "tampered"
   when builds switch to a new key.

2. Give it to the workflows:

   ```bash
   gh secret set LEADERBOARD_HMAC_KEY < .leaderboard-key
   ```

3. Build as usual. `scripts/sync-core.mjs` (run by every plugin's
   prebuild/pretest) reads `CODOTCHI_LEADERBOARD_KEY` or `.leaderboard-key` and
   writes the gitignored `src/leaderboardKey.ts` in VS Code, OpenCode and Claude
   Desktop. PyCharm's Gradle build generates
   `pycharm/src/main/kotlin/com/codotchi/generated/LeaderboardKey.kt` the same way.

**Check before releasing:** the sync-core output says
`(with leaderboard key)`. A build made without the key still plays normally,
but its Submit / Push live progress buttons are disabled ("This build of
Codotchi can't submit to the leaderboard").

If `LEADERBOARD_HMAC_KEY` is missing, the workflows fail closed: every signed
submission is rejected. The issue is still closed and the run still shows
green, so check the *Validate* step log for
`rejected: … (server key not configured)`. `gh secret list` should show the
secret.

Unsigned submissions from pre-2.27.2 clients are accepted as **legacy**
(`verified: false, legacy: true`). They pass the same age and timing checks
and get a *legacy* badge on the page (see the ADR amendment in
`developer_notes/adr/2026-10-07-leaderboard-integrity.md`).

**Limits:** the plugins are open source and the key ships inside the built
artifacts, so someone who extracts it from a `.vsix` or `.zip` could still forge
a signed entry. The physics floor (fastest real aging rate per pet type) and the
stage-age bounds still apply to those. Remove forged entries with the admin
delete workflow above.
