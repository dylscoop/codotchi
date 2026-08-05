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
