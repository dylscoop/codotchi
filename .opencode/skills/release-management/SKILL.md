---
name: release-management
description: Governs artifact archiving and releases/ folder hygiene — archive old artifacts before rebuilding, copy current artifacts to releases/ before merging to main, and enforce the 3-version retention rule.
license: MIT
compatibility: opencode
---

## When to apply this skill

Apply this skill at three specific moments:

| Moment | Trigger |
|--------|---------|
| **Version bump** | The version number changes before a rebuild |
| **Pre-merge** | Preparing to merge a feature branch to `main` |
| **Any write to `releases/`** | After copying new artifacts to `releases/` |

This skill is referenced by `release-checklist` (Step 2a) and `git-workflow` (Step 6).

---

## Archive locations

| IDE | Current artifact lives in | Archive destination |
|-----|--------------------------|---------------------|
| VS Code | `vscode/vscode-codotchi-X.Y.Z.vsix` | `vscode/archive/vsix/` |
| PyCharm | `pycharm/build/distributions/pycharm-codotchi-X.Y.Z.zip` | `pycharm/archive/` |

Both archive directories are tracked in git. Create them with `mkdir` if they do not exist yet.

> **CRITICAL:** Only ONE artifact file should ever exist in `vscode/` and ONE in
> `pycharm/build/distributions/` at any time. If you see more than one, archive
> all but the newest immediately before doing anything else.

---

## Step 1 — Archive old artifacts before rebuilding (version bump only)

When the version number is about to change, move the old artifact out of its
current location **before** running the build command. This keeps only one
version file in the working directory at a time.

**This step is mandatory. Never skip it.**

### VS Code

```
git mv vscode/vscode-codotchi-OLD.vsix vscode/archive/vsix/
```

Then rebuild:
```
npx @vscode/vsce package
```
(run from `vscode/`)

### PyCharm

Gradle does **not** automatically overwrite a zip with a different version
number in the filename, so move the old zip first:

```
git mv "pycharm/build/distributions/pycharm-codotchi-OLD.zip" pycharm/archive/
```

Then rebuild:
```
powershell -Command "$env:JAVA_HOME='C:\Users\DylanSiow-Lee\.gradle\caches\modules-2\files-2.1\com.jetbrains\jbre\jbr_jcef-17.0.10-windows-x64-b1207.12\extracted\jbr_jcef-17.0.10-windows-x64-b1207.12'; & '.\gradlew.bat' buildPlugin"
```
(run from `pycharm/`)

> **Note:** if the version number did NOT change (same X.Y.Z, source-only
> patch), skip Step 1 entirely — just rebuild in place.

---

## Step 2 — Copy artifacts to `releases/` before merging to main

This step is part of the release flow in `git-workflow` Step 6. Perform it
**after** the feature branch is merged to `main` but before pushing `main`.

```
copy vscode\vscode-codotchi-X.Y.Z.vsix releases\
```

For PyCharm, the zip is in `pycharm/build/distributions/` (the archive step
does NOT happen before copying to releases — copy first, then archive on the
next version bump):

```
copy "pycharm\build\distributions\pycharm-codotchi-X.Y.Z.zip" releases\
```

— OR, if it was already archived —

```
copy "pycharm\archive\pycharm-codotchi-X.Y.Z.zip" releases\
```

After copying, immediately apply the 3-version rule (Step 3 below), then
commit as:

```
chore: publish vX.Y.Z artifacts to releases/
```

Include only the `releases/` changes in this commit — no source changes.

---

## Step 3 — Enforce the 3-version retention rule in `releases/`

After every write to `releases/`, keep only the **latest 3 versions** of each
artifact type in the `releases/` root. Move older versions to
`releases/old_releases/`.

### Absolute rule — the latest release is always retained

**The highest-versioned artifact of each type must always remain in the
`releases/` root, no matter what.** Never move the latest version to
`old_releases/`. Apply the 3-version count only to the versions below it.

### How to determine "latest 3"

Sort the filenames by semantic version (not alphabetically). The three highest
version numbers stay; everything else moves. The highest version is always
first in that list and is never a candidate for removal.

Example — if `releases/` contains vsix files for
`0.2.2`, `0.3.2`, `0.4.2`, `0.5.2`:

- Keep: `0.5.2` (latest — always retained), `0.4.2`, `0.3.2`
- Move to `releases/old_releases/`: `0.2.2`

Apply the same rule independently to `.vsix` files and `.zip` files.

### Move command

```
git mv releases/vscode-codotchi-OLD.vsix releases/old_releases/
git mv releases/pycharm-codotchi-OLD.zip releases/old_releases/
```

> `releases/old_releases/` is tracked in git. Create it with `mkdir` if it
> does not exist yet.

---

## Quick checklist

- [ ] Version bumped? → Archive old VS Code vsix and old PyCharm zip before rebuilding
- [ ] Merging to main? → Copy current vsix and zip to `releases/`, apply 3-version rule, commit as `chore: publish vX.Y.Z artifacts to releases/`
- [ ] After writing to `releases/`? → Confirm latest version is in root; confirm only 3 vsix and 3 zip remain in root (latest always kept, 2 next most recent); move excess to `releases/old_releases/`
