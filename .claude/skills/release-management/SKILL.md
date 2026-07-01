---
name: release-management
description: Governs artifact archiving and releases/ folder hygiene — archive old artifacts before rebuilding, copy current artifacts to releases/ before merging to main, and enforce the 3-version retention rule.
---

## When to apply this skill

| Moment | Trigger |
|--------|---------|
| **Version bump** | The version number changes before a rebuild |
| **Pre-merge** | Preparing to merge a feature branch to `main` |
| **Any write to `releases/`** | After copying new artifacts to `releases/` |

This skill is referenced by `release-checklist` (Step 2a) and `git-workflow` (Step 6).

---

## Archive locations

| Platform | Current artifact lives in | Archive destination |
|----------|--------------------------|---------------------|
| VS Code | `vscode/codotchi-X.Y.Z.vsix` | `vscode/archive/vsix/` |
| PyCharm | `pycharm/build/distributions/pycharm-codotchi-X.Y.Z.zip` | `pycharm/archive/` |
| OpenCode | `opencode-codotchi/opencode-codotchi-X.Y.Z.zip` | `opencode-codotchi/archive/` |
| Claude Desktop | `claude-desktop-codotchi/codotchi-desktop.mcpb` | `claude-desktop-codotchi/archive/` |

> **CRITICAL:** Only ONE artifact file should ever exist in `vscode/`, ONE in
> `pycharm/build/distributions/`, ONE in `opencode-codotchi/`, and ONE in
> `claude-desktop-codotchi/` at any time.
> If you see more than one, archive all but the newest immediately.

> **Note:** The Claude Desktop `.mcpb` uses a fixed filename (`codotchi-desktop.mcpb`) rather
> than a version-stamped name — the version is encoded inside `manifest.json`. Archive the
> old one with a version suffix before replacing it, e.g. `codotchi-desktop-2.15.0.mcpb`.

---

## Step 1 — Archive old artifacts before rebuilding (version bump only)

### VS Code

```
git mv vscode/codotchi-OLD.vsix vscode/archive/vsix/
```

Then rebuild: `npx @vscode/vsce package` (from `vscode/`)

### PyCharm

```
git mv "pycharm/build/distributions/pycharm-codotchi-OLD.zip" pycharm/archive/
```

Then rebuild (from `pycharm/`):
```powershell
$env:JAVA_HOME = "C:\Users\DylanSiow-Lee\.gradle\caches\modules-2\files-2.1\com.jetbrains\jbre\jbr_jcef-17.0.10-windows-x64-b1207.12\extracted\jbr_jcef-17.0.10-windows-x64-b1207.12"; .\gradlew.bat buildPlugin -x buildSearchableOptions --no-configuration-cache
```

### OpenCode

```
git mv opencode-codotchi/opencode-codotchi-OLD.zip opencode-codotchi/archive/
```

Then rebuild: `node scripts/package.js` (from `opencode-codotchi/`)

### Claude Desktop

```
git mv claude-desktop-codotchi/codotchi-desktop.mcpb "claude-desktop-codotchi/archive/codotchi-desktop-OLD.mcpb"
```

Then rebuild: `npm run build && npm run bundle` (from `claude-desktop-codotchi/`)

> If the version number did NOT change, skip Step 1 entirely — just rebuild in place.

---

## Step 2 — Copy artifacts to `releases/` before merging to main

```
copy vscode\codotchi-X.Y.Z.vsix releases\
copy "pycharm\build\distributions\pycharm-codotchi-X.Y.Z.zip" releases\
copy "opencode-codotchi\opencode-codotchi-X.Y.Z.zip" releases\
copy "claude-desktop-codotchi\codotchi-desktop.mcpb" "releases\codotchi-desktop-X.Y.Z.mcpb"
```

After copying, apply the 3-version rule (Step 3), then commit as:

```
chore: publish vX.Y.Z artifacts to releases/
```

---

## Step 3 — Enforce the 3-version retention rule in `releases/`

Keep only the **latest 3 versions** of each artifact type in `releases/` root. Move older versions to `releases/old_releases/`.

**The highest-versioned artifact of each type must always remain in the `releases/` root.**

Sort by semantic version. Three highest stay; everything else moves.

Example — vsix files for `0.2.2`, `0.3.2`, `0.4.2`, `0.5.2`:
- Keep: `0.5.2`, `0.4.2`, `0.3.2`
- Move: `0.2.2` → `releases/old_releases/`

Apply the same rule independently to `.vsix`, `pycharm-codotchi-*.zip`, `opencode-codotchi-*.zip`, and `codotchi-desktop-*.mcpb` files.

```
git mv releases/codotchi-OLD.vsix releases/old_releases/
git mv releases/pycharm-codotchi-OLD.zip releases/old_releases/
git mv releases/opencode-codotchi-OLD.zip releases/old_releases/
git mv releases/codotchi-desktop-OLD.mcpb releases/old_releases/
```

---

## Quick checklist

- [ ] Version bumped? → Archive old VS Code vsix, old PyCharm zip, old OpenCode zip, and old Desktop mcpb before rebuilding
- [ ] Merging to main? → Copy current vsix, PyCharm zip, OpenCode zip, and Desktop mcpb (renamed with version) to `releases/`, apply 3-version rule, commit as `chore: publish vX.Y.Z artifacts to releases/`
- [ ] After writing to `releases/`? → Confirm latest version is in root; confirm only 3 vsix, 3 pycharm zip, 3 opencode zip, and 3 desktop mcpb remain in root; move excess to `releases/old_releases/`
