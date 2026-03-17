---
name: release-checklist
description: Full pre-commit checklist for every feature addition and bug fix — rebuild artifacts with the correct version, update all markdown docs, and keep README prose in sync with current constants.
license: MIT
compatibility: opencode
---

## When to apply this skill

Apply **every time** a feature is added or changed, or a bug is fixed, before
committing. This skill does not govern version bumps or releases to `main` —
those are covered by `git-workflow`.

---

## Step 1 — Confirm the version number

The current version must be identical in all three source-of-truth locations:

| File | Field |
|------|-------|
| `vscode/package.json` | `"version": "X.Y.Z"` |
| `pycharm/build.gradle.kts` | `version = "X.Y.Z"` |
| `pycharm/src/main/resources/META-INF/plugin.xml` | `<version>X.Y.Z</version>` |

If any of the three differs, fix them to agree before doing anything else.

---

## Step 2 — Rebuild both artifacts

After any source change, **always** rebuild both distribution artifacts and
include them in the commit. Use the exact commands below.

### Step 2a — Archive old artifacts first (version bump only)

If the version number changed since the last build, **move the old artifacts
to their archive locations before rebuilding**. See the `release-management`
skill for the exact `git mv` commands and archive paths.

Skip this sub-step if the version number is unchanged.

### VS Code `.vsix`

Run from `vscode/`:

```
npx @vscode/vsce package
```

Output: `vscode/vscode-gotchi-X.Y.Z.vsix`

### PyCharm `.zip`

Run from `pycharm/`:

```
powershell -Command "$env:JAVA_HOME='C:\Users\DylanSiow-Lee\.gradle\caches\modules-2\files-2.1\com.jetbrains\jbre\jbr_jcef-17.0.10-windows-x64-b1207.12\extracted\jbr_jcef-17.0.10-windows-x64-b1207.12'; & '.\gradlew.bat' buildPlugin"
```

Output: `pycharm/build/distributions/pycharm-gotchi-X.Y.Z.zip`

---

## Step 3 — Update markdown documentation

Update **all** of the files below that are affected by the change. Do not skip
a file just because the change seems minor — stale docs are harder to find than
stale code.

### 3a. VERSIONS.md

`VERSIONS.md` lives at the repo root. The topmost section is always the
in-flight version. Add one row per changed file to its changes table:

```markdown
| `path/to/file` | One-line description of what changed and why |
```

If a constant changed value, also update (or add) its row in the "Updated
constants" block for the current version. Use this format:

```markdown
CONSTANT_NAME: type = new_value   // brief note
```

### 3b. vscode/FEATURES.md

FEATURES.md tracks every feature with a status token. Update it when:

- A `[ ]` feature is fully implemented → change to `[x]`
- A `[~]` feature is completed → change to `[x]`
- A feature's tuning constant changes (e.g. cap, boost, cost) → update the
  "Notes" cell in the same row to reflect the new value
- A new feature is added → add a new row with the appropriate status token

Status tokens:

| Token | Meaning |
|-------|---------|
| `[x]` | Fully implemented |
| `[~]` | Partially implemented |
| `[ ]` | Not yet implemented |
| `[S]` | Controlled by a VS Code setting |

### 3c. README files — prose that mirrors constants

The three README files contain prose descriptions of game mechanics. Any time a
constant that affects player-visible behaviour changes, scan these files for
matching prose and update the number:

| File | What to look for |
|------|-----------------|
| `README.md` | Quick install filenames (`vscode-gotchi-X.Y.Z.vsix`, `pycharm-gotchi-X.Y.Z.zip`), "Current release" line |
| `vscode/README.md` | Install filenames and `code --install-extension` examples; Actions table prose (e.g. "Limited to N meals per wake cycle", "More than N snacks in a row") |
| `pycharm/README.md` | Install filenames and manual install examples |

**Critical rule:** if `FEED_MEAL_MAX_PER_CYCLE`, `SNACK_MAX_PER_CYCLE`,
`PLAY_ENERGY_COST`, or any other player-facing constant changes, grep all
three README files for the old number and update every occurrence.

Common locations of hardcoded numbers in README prose:

```
vscode/README.md  line ~111  "Limited to N meals per wake cycle"
vscode/README.md  line ~112  "More than N snacks in a row"
README.md         line ~32   vscode-gotchi-X.Y.Z.vsix filename
README.md         line ~44   pycharm-gotchi-X.Y.Z.zip filename
README.md         line ~104  "Current release: vX.Y.Z"
vscode/README.md  line ~37   vscode-gotchi-X.Y.Z.vsix filename
vscode/README.md  line ~45   code --install-extension vscode-gotchi-X.Y.Z.vsix
vscode/README.md  line ~72   "Package → produces vscode-gotchi-X.Y.Z.vsix"
vscode/README.md  line ~76   code --install-extension vscode-gotchi-X.Y.Z.vsix
pycharm/README.md line ~46   pycharm-gotchi-X.Y.Z.zip filename
pycharm/README.md line ~78   pycharm/build/distributions/pycharm-gotchi-X.Y.Z.zip
pycharm/README.md line ~181  pycharm-gotchi-X.Y.Z.zip filename
```

### 3d. BUGFIXES.md (bug fixes only)

When fixing a bug, add a new entry at the **bottom** of `BUGFIXES.md`:

```markdown
## BUGFIX-NNN — Short description of the problem

**Status:** Fixed (branch `<branch-name>`)
**File:** `path/to/changed/file.ts`

**Problem:** One or two sentences describing what was wrong and when it occurred.

**Fix:** One or two sentences describing what was changed and why it resolves
the problem.
```

Number entries sequentially (BUGFIX-001, BUGFIX-002, …).

---

## Step 4 — Final checklist before committing

Work through this list in order. Do not commit until all items are checked.

0. [ ] Old artifacts archived (version bump only) — old `.vsix` moved to `vscode/archive/vsix/`, old `.zip` moved to `pycharm/archive/` (see `release-management` skill)
1. [ ] Version is identical in `package.json`, `build.gradle.kts`, and `plugin.xml`
2. [ ] `npm test` passes (run from `vscode/`) — 0 failures
3. [ ] VS Code artifact rebuilt: `vscode/vscode-gotchi-X.Y.Z.vsix` exists and is up to date
4. [ ] PyCharm artifact rebuilt: `pycharm/build/distributions/pycharm-gotchi-X.Y.Z.zip` exists and is up to date
5. [ ] `VERSIONS.md` updated — row added for every changed file
6. [ ] `VERSIONS.md` constants block updated if any constant changed value
7. [ ] `vscode/FEATURES.md` updated — status cells and Notes column reflect current state
8. [ ] README prose updated — no hardcoded numbers refer to old constant values
9. [ ] README filenames updated — all `.vsix` / `.zip` references match the current version
10. [ ] `BUGFIXES.md` updated (bug fixes only)
11. [ ] Both artifacts are staged alongside all source changes in the same commit
