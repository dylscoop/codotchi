---
name: doc-sync
description: Whenever a bug is fixed or a feature is added, always update the relevant markdown documentation files before committing.
license: MIT
compatibility: opencode
---

## Rule

Any time a bug is fixed or a feature is added (or changed), update the relevant
markdown files **in the same commit** as the code change — never leave docs
behind.

---

## Which file to update for what

| Type of change | File(s) to update |
|----------------|-------------------|
| New bug fix | `BUGFIXES.md` — add a new `BUGFIX-NNN` section |
| Bug behaviour changed / status updated | `BUGFIXES.md` — update the relevant section |
| New feature or feature behaviour change | `vscode/FEATURES.md` — update the status cell (`[x]` / `[~]` / `[ ]`) and any effect descriptions in the care-actions or stats tables |
| New constant or removed constant | `VERSIONS.md` — add/remove from the "New constants" / "Removed constants" block for the current version |
| Any code change in a release cycle | `VERSIONS.md` — add a row to the current version's changes table |
| New VS Code setting added | `vscode/FEATURES.md` section 11 (Settings Reference) |

---

## BUGFIXES.md format

Each entry must follow this template exactly:

```markdown
## BUGFIX-NNN — Short description of the problem

**Status:** Fixed (branch `<branch-name>`)
**File:** `path/to/changed/file.ts`

**Problem:** One or two sentences describing what was wrong and when it occurred.

**Fix:** One or two sentences describing what was changed and why it resolves
the problem.
```

- Number entries sequentially (BUGFIX-001, BUGFIX-002, …).
- Always place the newest entry **at the bottom** of the file.

---

## VERSIONS.md format

The top section is always the current (unreleased) version. Add a row to its
changes table for every file touched:

```markdown
## v0.0.X — current (branch `<branch-name>`)

### Changes from v0.0.X-1

| File | What changed |
|------|-------------|
| `path/to/file` | One-line description of what changed and why |
```

When a version ships (merges to `main`), rename `— current` to `— (commit <sha>)`
and add a new `## vX.X.X — current` section above it.

---

## FEATURES.md status cells

Use exactly these tokens — no others:

| Token | Meaning |
|-------|---------|
| `[x]` | Fully implemented |
| `[~]` | Partially implemented |
| `[ ]` | Not yet implemented |
| `[S]` | Controlled by a VS Code setting |

When a feature moves from `[ ]` to `[x]`, also update any effect descriptions
in the same row (e.g. energy cost, stat delta) to match the current constants
in `gameEngine.ts`.

---

## Checklist before every commit

1. Did any constant change value? → update `VERSIONS.md` constants block and
   `FEATURES.md` effect descriptions.
2. Did `sick`, `health`, `hunger`, `happiness`, or `energy` logic change? →
   check `FEATURES.md` sections 1, 3, and 8 for stale descriptions.
3. Did a previously `[ ]` feature get implemented? → flip its status cell.
4. Is this a new bug fix? → add a `BUGFIX-NNN` entry to `BUGFIXES.md`.
5. Run `npm run lint:md` from the repo root and confirm 0 errors before committing.
