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

## Step 3e — OpenCode npm package (when OpenCode plugin files change)

Whenever any of these files are modified, the `opencode-codotchi` npm package
must be kept in sync **before committing**:

| Source of truth | Mirror in npm package |
|---|---|
| `.opencode/plugins/gotchi.ts` | `opencode-codotchi/src/index.ts` |
| `.opencode/plugins/gameEngine.ts` | `opencode-codotchi/src/gameEngine.ts` |
| `.opencode/plugins/asciiArt.ts` | `opencode-codotchi/src/asciiArt.ts` |
| `.opencode/commands/codotchi.md` | `opencode-codotchi/commands/codotchi.md` |

**Three separate copies** are intentional (VS Code-style duplication). When
updating, copy the changed file(s) manually and include both copies in the same
commit.

After copying, verify the npm package builds and installs correctly:

```bash
cd opencode-codotchi
node bin/install.js --install
```

If the install fails, fix the errors before committing. The `dist/` directory is
gitignored — do not commit it.

Also update `opencode-codotchi/package.json` `"version"` to match the repo
version whenever the version is bumped.

## Step 3f — OpenCode zip artifact and reinstall

**Before finalising any release**, always rebuild the zip and reinstall the
plugin locally. The zip rebuild is automatic; the reinstall requires explicit
user confirmation before running.

### 3f-i. Rebuild the zip (always, no need to ask)

1. Rebuild the zip from the current source:
   ```bash
   # from opencode-codotchi/
   node scripts/package.js
   ```
   Output: `opencode-codotchi/opencode-codotchi-X.Y.Z.zip`

   The script removes the old zip automatically if the version changed.

2. Commit the new zip alongside any other release changes.

3. Add a row to `VERSIONS.md`:
   ```
   | `opencode-codotchi/opencode-codotchi-X.Y.Z.zip` | Rebuilt distributable zip for vX.Y.Z |
   ```

4. Update all README references to the zip filename (both
   `opencode-codotchi/README.md` and the root `README.md`).

### 3f-ii. Reinstall locally (always ask first)

After rebuilding the zip, **always ask the user to confirm** before running
the reinstall. The running OpenCode session uses the installed copy — skipping
this step means the old plugin stays active until manually replaced, so
confirmation is required before proceeding.

Ask: "The OpenCode plugin zip has been rebuilt. Reinstall it locally now?"
Only run the install command after the user confirms.

```bash
# from opencode-codotchi/
node bin/install.js --install
```

This copies the updated plugin source files into `~/.config/opencode/plugins/`
and the slash command into `~/.config/opencode/commands/` so the live OpenCode
session picks up the new code on next restart.

If the install fails, fix the errors before committing — do not commit a zip
that cannot be installed.

---

## Step 4 — Final checklist before committing

Work through this list in order. Do not commit until all items are checked.

0. [ ] Old artifacts archived (version bump only) — old `.vsix` moved to `vscode/archive/vsix/`, old `.zip` moved to `pycharm/archive/` (see `release-management` skill)
1. [ ] Version is identical in `package.json`, `build.gradle.kts`, and `plugin.xml`
2. [ ] `npm test` passes (run from `vscode/`) — 0 failures
2b. [ ] `gradlew unitTest --no-configuration-cache` passes (run from `pycharm/`) — 0 failures. **Do NOT run `gradlew test`** — the IntelliJ plugin hijacks it and fails with a JBR file-lock error when any IDE is open. See `git-workflow` skill → "PyCharm unit tests".
3. [ ] VS Code artifact rebuilt: `vscode/vscode-gotchi-X.Y.Z.vsix` exists and is up to date
4. [ ] PyCharm artifact rebuilt: `pycharm/build/distributions/pycharm-gotchi-X.Y.Z.zip` exists and is up to date
5. [ ] `VERSIONS.md` updated — row added for every changed file
6. [ ] `VERSIONS.md` constants block updated if any constant changed value
7. [ ] `vscode/FEATURES.md` updated — status cells and Notes column reflect current state
8. [ ] README prose updated — no hardcoded numbers refer to old constant values
9. [ ] README filenames updated — all `.vsix` / `.zip` references match the current version
10. [ ] `BUGFIXES.md` updated (bug fixes only)
11. [ ] `opencode-codotchi/` files updated to mirror any `.opencode/plugins/` or `.opencode/commands/` changes
12. [ ] `opencode-codotchi/package.json` version matches repo version
13. [ ] `opencode-codotchi/opencode-codotchi-X.Y.Z.zip` rebuilt (Step 3f-i)
14. [ ] Local reinstall confirmed by user and done: `node bin/install.js --install` run from `opencode-codotchi/` (Step 3f-ii) — **always ask before running**
15. [ ] Both artifacts are staged alongside all source changes in the same commit
