---
name: release-checklist
description: Full pre-commit checklist for every feature addition and bug fix — rebuild artifacts with the correct version, update all markdown docs, and keep README prose in sync with current constants.
---

## When to apply this skill

Apply **every time** a feature is added or changed, or a bug is fixed, before
committing. This skill does not govern version bumps or releases to `main` —
those are covered by `git-workflow`.

---

## Step 1 — Confirm the version number

The current version must be identical in all **five** source-of-truth locations:

| File | Field |
|------|-------|
| `vscode/package.json` | `"version": "X.Y.Z"` |
| `pycharm/build.gradle.kts` | `version = "X.Y.Z"` |
| `pycharm/src/main/resources/META-INF/plugin.xml` | `<version>X.Y.Z</version>` |
| `opencode-codotchi/package.json` | `"version": "X.Y.Z"` |
| `claude-desktop-codotchi/package.json` | `"version": "X.Y.Z"` |

If any of the five differs, fix them to agree before doing anything else.

> **Version bump rule:** A bug fix or feature **always** requires a patch version bump (e.g. 1.19.1 → 1.19.2). Never build artifacts at the same version number as the previous release — the artifact filename will collide. Bump first, archive the old artifact, then build.

---

## Step 2 — Rebuild both artifacts

After any source change, **always** rebuild both distribution artifacts and
include them in the commit. Use the exact commands below.

### Step 2a — Archive old artifacts first (version bump only)

If the version number changed since the last build, **move the old artifacts
to their archive locations before rebuilding**. See the `release-management`
skill for the exact `git mv` commands and archive paths.

Skip this sub-step if the version number is unchanged.

### Step 2b — Verify artifact version after build

After each build completes, **immediately** verify the output filename matches the expected version:

```powershell
# VS Code
Get-ChildItem vscode\codotchi-*.vsix

# PyCharm
Get-ChildItem pycharm\build\distributions\*.zip

# Claude Desktop
Get-ChildItem claude-desktop-codotchi\*.mcpb
```

If the filename contains the old version, **stop and fix the version bump** before committing.

### VS Code `.vsix`

Run from `vscode/`:

```
npx @vscode/vsce package
```

Output: `vscode/codotchi-X.Y.Z.vsix`

### PyCharm `.zip`

Run from `pycharm/` (PowerShell — set JAVA_HOME inline, skip `buildSearchableOptions` to avoid the JBR file-lock error):

```powershell
$env:JAVA_HOME = "C:\Users\DylanSiow-Lee\.gradle\caches\modules-2\files-2.1\com.jetbrains\jbre\jbr_jcef-17.0.10-windows-x64-b1207.12\extracted\jbr_jcef-17.0.10-windows-x64-b1207.12"; .\gradlew.bat buildPlugin -x buildSearchableOptions --no-configuration-cache
```

Output: `pycharm/build/distributions/pycharm-codotchi-X.Y.Z.zip`

### Claude Desktop `.mcpb`

Run from `claude-desktop-codotchi/`:

```
npm run build && npm run bundle
```

Output: `claude-desktop-codotchi/codotchi-desktop.mcpb` (note: the `.mcpb` uses a fixed name, not version-stamped in the filename).

---

## Step 3 — Update markdown documentation

Update **all** of the files below that are affected by the change.

### 3a. VERSIONS.md

Add one row per changed file to the in-flight version's changes table:

```markdown
| `path/to/file` | One-line description of what changed and why |
```

If a constant changed value, also update its row in the "Updated constants" block.

### 3b. vscode/FEATURES.md

Update when:
- A `[ ]` feature is fully implemented → change to `[x]`
- A feature's tuning constant changes → update the "Notes" cell
- A new feature is added → add a new row

Status tokens: `[x]` fully implemented · `[~]` partial · `[ ]` not yet · `[S]` setting-controlled

### 3c. README files — prose that mirrors constants

| File | What to look for |
|------|-----------------|
| `README.md` | Quick install filenames, "Current release" line |
| `vscode/README.md` | Install filenames, Actions table prose (meal/snack caps) |
| `pycharm/README.md` | Install filenames and manual install examples |

**Critical:** if `FEED_MEAL_MAX_PER_CYCLE`, `SNACK_MAX_PER_CYCLE`, `PLAY_ENERGY_COST`, or any other player-facing constant changes, grep all three README files for the old number and update every occurrence.

### 3d. BUGFIXES.md (bug fixes only)

Add a new entry at the **bottom**:

```markdown
## BUGFIX-NNN — Short description of the problem

**Status:** Fixed (branch `<branch-name>`)
**File:** `path/to/changed/file.ts`

**Problem:** One or two sentences describing what was wrong and when it occurred.

**Fix:** One or two sentences describing what was changed and why it resolves the problem.
```

### 3e — OpenCode npm package (when OpenCode plugin files change)

| Source of truth | Mirror in npm package |
|---|---|
| `.opencode/plugins/gotchi.ts` | `opencode-codotchi/src/index.ts` |
| `.opencode/plugins/gameEngine.ts` | `opencode-codotchi/src/gameEngine.ts` |
| `.opencode/plugins/asciiArt.ts` | `opencode-codotchi/src/asciiArt.ts` |
| `.opencode/commands/codotchi.md` | `opencode-codotchi/commands/codotchi.md` |

After copying, verify: `node bin/install.js --install` from `opencode-codotchi/`.

### 3f — OpenCode zip artifact and reinstall

Rebuild zip: `node scripts/package.js` (from `opencode-codotchi/`). Always ask user before reinstalling: `node bin/install.js --install`.

---

## Step 4 — Final checklist before committing

0. [ ] Old artifacts archived (version bump only)
1. [ ] Version identical in all five files
2. [ ] `npm test` passes from `vscode/` — 0 failures
3. [ ] `gradlew unitTest --no-configuration-cache` passes from `pycharm/` — 0 failures (**not** `gradlew test`)
4. [ ] VS Code artifact rebuilt: `vscode/codotchi-X.Y.Z.vsix` exists
5. [ ] PyCharm artifact rebuilt: `pycharm/build/distributions/pycharm-codotchi-X.Y.Z.zip` exists
6. [ ] `VERSIONS.md` updated
7. [ ] `vscode/FEATURES.md` updated
8. [ ] README prose updated — no hardcoded numbers refer to old constant values
9. [ ] README filenames updated — all `.vsix` / `.zip` references match current version
10. [ ] `BUGFIXES.md` updated (bug fixes only)
11. [ ] `opencode-codotchi/` files updated to mirror any `.opencode/plugins/` changes
12. [ ] `opencode-codotchi/package.json` version matches repo version
13. [ ] `opencode-codotchi/opencode-codotchi-X.Y.Z.zip` rebuilt
14. [ ] Local reinstall confirmed by user and done
15. [ ] `claude-desktop-codotchi/package.json` version matches repo version
16. [ ] `claude-desktop-codotchi/` rebuilt: `npm run build && npm run bundle`
17. [ ] All artifacts staged alongside all source changes in the same commit
