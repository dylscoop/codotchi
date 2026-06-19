---
name: release-ai-usage-codotchi
description: Releases a new version of the OpenCode and Claude Code plugins to the ai_usage_codotchi repo (dsiowlee/ai_usage_codotchi). Copies folders and zips, rewrites the README from the canonical template, commits, pushes, and creates a GitHub release with both zips as assets.
license: MIT
compatibility: opencode
---

## When to apply this skill

Apply when the user says any of:
- "release a new version of the plugin"
- "publish to ai_usage_codotchi"
- "release to ai_usage_codotchi"
- "update ai_usage_codotchi"

**Prerequisite:** The `codotchi` repo must already be on `main` with all artifacts up to date (`opencode-codotchi-X.Y.Z.zip` present in `opencode-codotchi/`). If not, run the normal `release-checklist` + `git-workflow` release flow first.

---

## Paths

| Item | Path |
|------|------|
| Source repo | `C:\personal_repos\codotchi` |
| Target repo | `C:\personal_repos\ai_usage_codotchi` |
| OpenCode folder | `C:\personal_repos\codotchi\opencode-codotchi\` |
| Claude folder | `C:\personal_repos\codotchi\claude-codotchi\` |
| OpenCode zip | `C:\personal_repos\codotchi\opencode-codotchi\opencode-codotchi-X.Y.Z.zip` |
| Claude zip | `C:\personal_repos\codotchi\claude-codotchi\claude-codotchi-X.Y.Z.zip` |
| Target README | `C:\personal_repos\ai_usage_codotchi\README.md` |

---

## Git identity for ai_usage_codotchi

All commits and pushes to `ai_usage_codotchi` use the `dsiowlee` account.

```powershell
git -C "C:\personal_repos\ai_usage_codotchi" config --local user.name  "dsiowlee"
git -C "C:\personal_repos\ai_usage_codotchi" config --local user.email "dsiowlee@users.noreply.github.com"
```

Verify the remote URL is correct:

```powershell
git -C "C:\personal_repos\ai_usage_codotchi" remote get-url origin
# must show: https://github.com/dsiowlee/ai_usage_codotchi.git
```

**Never use `dylscoop` credentials for this repo.** Set `--local` only — never `--global`.

---

## Step 1 — Determine the version

Read the version from the OpenCode package:

```powershell
(Get-Content "C:\personal_repos\codotchi\opencode-codotchi\package.json" | ConvertFrom-Json).version
```

This is `X.Y.Z` for the rest of this skill.

---

## Step 2 — Build the claude zip (if not already built)

Check whether `claude-codotchi-X.Y.Z.zip` exists:

```powershell
Test-Path "C:\personal_repos\codotchi\claude-codotchi\claude-codotchi-X.Y.Z.zip"
```

If it does not exist, build it:

```powershell
# from claude-codotchi/
node scripts/package.js
```

Verify the zip was created:

```powershell
Get-ChildItem "C:\personal_repos\codotchi\claude-codotchi\claude-codotchi-*.zip"
```

---

## Step 3 — Confirm the OpenCode zip exists

```powershell
Get-ChildItem "C:\personal_repos\codotchi\opencode-codotchi\opencode-codotchi-*.zip"
```

If missing, stop and tell the user to run the main release flow first.

---

## Step 4 — Copy artifacts to ai_usage_codotchi

Copy the `opencode-codotchi/` folder, `claude-codotchi/` folder, and both zips.
**Always delete the old copies first** to avoid stale files.

```powershell
$target = "C:\personal_repos\ai_usage_codotchi"
$src    = "C:\personal_repos\codotchi"

# Remove old copies
Remove-Item -Recurse -Force "$target\opencode-codotchi" -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force "$target\claude-codotchi"   -ErrorAction SilentlyContinue
Remove-Item -Force "$target\opencode-codotchi-*.zip"    -ErrorAction SilentlyContinue
Remove-Item -Force "$target\claude-codotchi-*.zip"      -ErrorAction SilentlyContinue

# Copy folders
Copy-Item -Recurse "$src\opencode-codotchi" "$target\opencode-codotchi"
Copy-Item -Recurse "$src\claude-codotchi"   "$target\claude-codotchi"

# Copy zips
$ocZip = (Get-ChildItem "$src\opencode-codotchi\opencode-codotchi-*.zip")[0].FullName
$ccZip = (Get-ChildItem "$src\claude-codotchi\claude-codotchi-*.zip")[0].FullName
Copy-Item $ocZip $target
Copy-Item $ccZip $target
```

---

## Step 5 — Rewrite the README

Rewrite `C:\personal_repos\ai_usage_codotchi\README.md` from the template below.
Replace every occurrence of `X.Y.Z` with the actual version number.

> **This is a full rewrite every time.** Do not preserve old content.

---

### README template

```markdown
# Codotchi

A Tamagotchi-style virtual pet that lives inside your AI coding assistant.
Raises your pet in the terminal alongside your coding session and tracks your
daily API usage cost.

Available for **OpenCode** and **Claude Code**.

---

## OpenCode

### Features

| Feature | Description |
|---------|-------------|
| **Tick loop** | Pet advances every 6 s via a background timer |
| **Event hooks** | Reacts to file edits (coding reward), session idle, and server connect |
| **`/codotchi` slash command** | 10+ actions: status, feed, snack, play, pat, sleep, wake, clean, medicine, new_game |
| **ASCII art renderer** | 30 frames (6 stages × 5 moods), ANSI-coloured speech bubbles, status bars |
| **Daily cost tracking** | Pet speech bubble colour reflects today's OpenCode API spend |

### Installation

Download `opencode-codotchi-X.Y.Z.zip` from the
[Releases page](https://github.com/dsiowlee/ai_usage_codotchi/releases),
extract it, then run the installer:

**Windows (PowerShell):**

```powershell
Expand-Archive opencode-codotchi-X.Y.Z.zip
cd opencode-codotchi-X.Y.Z
node bin/install.js --install
```

**macOS / Linux:**

```bash
unzip opencode-codotchi-X.Y.Z.zip
cd opencode-codotchi-X.Y.Z
node bin/install.js --install
```

Node.js is the only prerequisite. No npm publish or repository clone required.

After running the installer, open any project in OpenCode. Your codotchi will
greet you in a speech bubble on first startup.

### Actions

```text
/codotchi              — show status
/codotchi feed         — give a meal
/codotchi snack        — give a snack
/codotchi play         — play with your pet
/codotchi pat          — gently pat your pet
/codotchi sleep        — put your pet to sleep
/codotchi wake         — wake your pet up
/codotchi clean        — clean up droppings
/codotchi medicine     — give medicine to cure sickness
/codotchi new_game name=<name> petType=<type>  — start a fresh pet
```

Pet types: `codeling` (default), `bytebug`, `pixelpup`, `shellscript`

---

## Claude Code

### Features

| Feature | Description |
|---------|-------------|
| **Statusline pet** | Multiline ANSI ASCII art renders in the statusline, refreshes every 10 seconds |
| **Coding rewards** | Every file write/edit boosts your pet's happiness and discipline |
| **Session hooks** | Pet greets you on session start and says farewell when the session stops |
| **`/codotchi` slash command** | Care actions available directly in Claude Code |
| **Daily cost tracking** | Pet speech bubble colour reflects today's Claude API spend |

### Installation

Download `claude-codotchi-X.Y.Z.zip` from the
[Releases page](https://github.com/dsiowlee/ai_usage_codotchi/releases),
extract it, then run the installer script to get the exact commands for your
machine:

**Windows (PowerShell):**

```powershell
Expand-Archive claude-codotchi-X.Y.Z.zip
cd claude-codotchi-X.Y.Z
.\install.ps1
```

**macOS / Linux:**

```bash
unzip claude-codotchi-X.Y.Z.zip
cd claude-codotchi-X.Y.Z
chmod +x install.sh && ./install.sh
```

The script prints the two `/plugin` commands to paste into a Claude Code
session:

```
/plugin marketplace add <path-to-extracted-folder>
/plugin install claude-codotchi
```

See `INSTALL.md` inside the zip for full installation details.

### Actions

| Action | Description |
|--------|-------------|
| `/codotchi` or `/codotchi status` | Show the pet's ASCII art and full stats |
| `/codotchi feed` | Give a meal (max 3 per wake cycle) |
| `/codotchi pat` | Pat the pet |
| `/codotchi sleep` | Put the pet to sleep |
| `/codotchi wake` | Wake the pet up |
| `/codotchi clean` | Remove droppings |
| `/codotchi medicine` | Give medicine (3 doses to cure sickness) |
| `/codotchi on` | Enable ASCII art in statusline |
| `/codotchi off` | Disable ASCII art |
| `/codotchi rename <name>` | Rename your pet |
| `/codotchi warnthreshold <amount>` | Set warning spend threshold (default: $30) |
| `/codotchi shoutthreshold <amount>` | Set shout spend threshold (default: $50) |

---

## Daily cost tracking

The pet's speech bubble colour reflects how much you've spent on API calls today:

| Spend | Colour | Tone |
|-------|--------|------|
| Below warn threshold | Green | Cheerful |
| Warn → shout threshold | Yellow | Concerned |
| Above shout threshold | Red | ALL CAPS alarm |

Default thresholds: **$30 warn / $50 shout**. Configurable per plugin.

---

## Current release: vX.Y.Z

- `opencode-codotchi-X.Y.Z.zip` — OpenCode plugin
- `claude-codotchi-X.Y.Z.zip` — Claude Code plugin
```

---

## Step 6 — Commit in ai_usage_codotchi

```powershell
git -C "C:\personal_repos\ai_usage_codotchi" add -A
git -C "C:\personal_repos\ai_usage_codotchi" commit -m "chore: release vX.Y.Z"
```

---

## Step 7 — Push to dsiowlee/ai_usage_codotchi (explicit permission required)

Only push after the user explicitly says "push" or "push to ai_usage_codotchi".

```powershell
git -C "C:\personal_repos\ai_usage_codotchi" push origin main
```

If the remote URL does not embed the username, set it first:

```powershell
git -C "C:\personal_repos\ai_usage_codotchi" remote set-url origin https://dsiowlee@github.com/dsiowlee/ai_usage_codotchi.git
```

---

## Step 8 — Create GitHub release on dsiowlee/ai_usage_codotchi (explicit permission required)

Only create after the user explicitly says "create a release" or "publish it".

### 8a — Retrieve PAT for dsiowlee

```powershell
$lines = @('protocol=https', 'host=github.com', 'username=dsiowlee', '')
$creds = $lines | & 'C:\Program Files\Git\mingw64\libexec\git-core\git-credential-wincred.exe' get
$creds
$token = ($creds | Where-Object { $_ -match '^password=' }) -replace '^password=', ''
```

If the credential is not stored, ask the user to paste their PAT for `dsiowlee`. A classic PAT (`ghp_`) with `repo` scope is required.

### 8b — Create draft release

Write to a temp script and run it:

```powershell
# create_ai_release.ps1 (delete after use)
$token   = 'PASTE_TOKEN_HERE'
$version = 'X.Y.Z'

$releaseBody = @"
## Codotchi vX.Y.Z

### Artifacts
- ``opencode-codotchi-X.Y.Z.zip`` — OpenCode plugin
- ``claude-codotchi-X.Y.Z.zip`` — Claude Code plugin
"@

$payload = @{
    tag_name         = "v$version"
    target_commitish = 'main'
    name             = "v$version"
    body             = $releaseBody
    draft            = $true
    prerelease       = $false
} | ConvertTo-Json -Depth 3

$headers = @{
    Authorization          = "token $token"
    Accept                 = 'application/vnd.github+json'
    'X-GitHub-Api-Version' = '2022-11-28'
}

$r = Invoke-RestMethod -Uri 'https://api.github.com/repos/dsiowlee/ai_usage_codotchi/releases' `
     -Method Post -Headers $headers -Body $payload -ContentType 'application/json'
Write-Host "Release ID: $($r.id)"
Write-Host "Draft URL:  $($r.html_url)"
```

### 8c — Upload both zips as assets

```powershell
# upload_ai_assets.ps1 (delete after use)
$token     = 'PASTE_TOKEN_HERE'
$releaseId = RELEASE_ID_HERE
$version   = 'X.Y.Z'
$uploadBase = "https://uploads.github.com/repos/dsiowlee/ai_usage_codotchi/releases/$releaseId/assets"

$artifacts = @(
    @{ path = "C:\personal_repos\codotchi\opencode-codotchi\opencode-codotchi-$version.zip"; name = "opencode-codotchi-$version.zip"; type = 'application/zip' },
    @{ path = "C:\personal_repos\codotchi\claude-codotchi\claude-codotchi-$version.zip";     name = "claude-codotchi-$version.zip";   type = 'application/zip' }
)

$headers = @{
    Authorization          = "token $token"
    Accept                 = 'application/vnd.github+json'
    'X-GitHub-Api-Version' = '2022-11-28'
}

foreach ($a in $artifacts) {
    $uri   = "$uploadBase`?name=$($a.name)"
    $h     = $headers.Clone(); $h['Content-Type'] = $a.type
    $bytes = [System.IO.File]::ReadAllBytes($a.path)
    $r     = Invoke-RestMethod -Uri $uri -Method Post -Headers $h -Body $bytes
    Write-Host "Uploaded: $($r.name) ($($r.size) bytes)"
}

# Publish the draft
$r = Invoke-RestMethod -Uri "https://api.github.com/repos/dsiowlee/ai_usage_codotchi/releases/$releaseId" `
     -Method Patch -Headers $headers -Body '{"draft":false}' -ContentType 'application/json'
Write-Host "Published: $($r.html_url)"
```

Delete both scripts immediately after running (they contain the PAT).

---

## Quick checklist

- [ ] Version confirmed from `opencode-codotchi/package.json`
- [ ] `claude-codotchi-X.Y.Z.zip` built (`node scripts/package.js` from `claude-codotchi/`)
- [ ] `opencode-codotchi-X.Y.Z.zip` confirmed present
- [ ] Both folders + both zips copied to `ai_usage_codotchi/`
- [ ] `ai_usage_codotchi/README.md` rewritten from template with correct version
- [ ] Committed in `ai_usage_codotchi` as `chore: release vX.Y.Z`
- [ ] Pushed to `dsiowlee/ai_usage_codotchi` (explicit user instruction required)
- [ ] GitHub release created with both zips uploaded (explicit user instruction required)
