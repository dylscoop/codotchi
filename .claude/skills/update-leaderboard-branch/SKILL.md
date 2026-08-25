---
name: update-leaderboard-branch
description: Merge main into the leaderboard branch and push. Run after any leaderboard/index.html change lands on main. Resolves conflicts by taking main's version.
---

## When to apply

Run this skill after any change to `leaderboard/index.html` (or any leaderboard-related
file) is committed and pushed to `main`, to keep the deployed `leaderboard` branch in sync.

## Steps

### 1 — Switch to leaderboard and pull remote changes

```powershell
git checkout leaderboard
git pull origin leaderboard
```

### 2 — Merge main

```powershell
git merge main --no-edit
```

If the merge completes cleanly, jump to Step 4.

### 3 — Resolve conflicts (take main's version for everything)

If `leaderboard/index.html` conflicts, **always take main's version** — the
leaderboard branch only adds `live.json` / `scores.json` data; all HTML logic
lives on main.

```powershell
git checkout --theirs leaderboard/index.html
git add leaderboard/index.html
git commit --no-edit
```

If other files conflict, apply the same rule: take `--theirs` (main) for any
source/logic file; take `--ours` (leaderboard) for any data file (`live.json`,
`scores.json`).

### 4 — Push

```powershell
git push origin leaderboard
git checkout main
```

GitHub Pages serves the `leaderboard` branch automatically — no further deploy step needed.
