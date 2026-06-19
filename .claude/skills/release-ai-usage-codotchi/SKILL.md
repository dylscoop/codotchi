---
name: release-ai-usage-codotchi
description: Releases a new version of the OpenCode and Claude Code plugins to the ai_usage_codotchi repo (dsiowlee/ai_usage_codotchi). Copies folders and zips, rewrites the README from the canonical template, commits, pushes, and creates a GitHub release with both zips as assets.
---

## When to apply

Apply when the user says "release a new version of the plugin", "publish to ai_usage_codotchi", or "release to ai_usage_codotchi".

**Prerequisite:** Main `codotchi` repo must be on `main` with `opencode-codotchi-X.Y.Z.zip` present. Run the normal release flow first if not.

---

## Paths

| Item | Path |
|------|------|
| Source repo | `C:\personal_repos\codotchi` |
| Target repo | `C:\personal_repos\ai_usage_codotchi` |
| OpenCode zip | `opencode-codotchi\opencode-codotchi-X.Y.Z.zip` |
| Claude zip | `claude-codotchi\claude-codotchi-X.Y.Z.zip` |

---

## Git identity for ai_usage_codotchi

```powershell
git -C "C:\personal_repos\ai_usage_codotchi" config --local user.name  "dsiowlee"
git -C "C:\personal_repos\ai_usage_codotchi" config --local user.email "dsiowlee@users.noreply.github.com"
```

Remote must be: `https://dsiowlee@github.com/dsiowlee/ai_usage_codotchi.git`

**Never use `dylscoop` credentials for this repo.**

---

## Step 1 — Determine version

```powershell
(Get-Content "C:\personal_repos\codotchi\opencode-codotchi\package.json" | ConvertFrom-Json).version
```

---

## Step 2 — Build claude zip (if missing)

```powershell
# from claude-codotchi/
node scripts/package.js
```

---

## Step 3 — Confirm OpenCode zip exists

```powershell
Get-ChildItem "C:\personal_repos\codotchi\opencode-codotchi\opencode-codotchi-*.zip"
```

---

## Step 4 — Copy artifacts to ai_usage_codotchi

```powershell
$target = "C:\personal_repos\ai_usage_codotchi"
$src    = "C:\personal_repos\codotchi"

Remove-Item -Recurse -Force "$target\opencode-codotchi" -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force "$target\claude-codotchi"   -ErrorAction SilentlyContinue
Remove-Item -Force "$target\opencode-codotchi-*.zip"    -ErrorAction SilentlyContinue
Remove-Item -Force "$target\claude-codotchi-*.zip"      -ErrorAction SilentlyContinue

Copy-Item -Recurse "$src\opencode-codotchi" "$target\opencode-codotchi"
Copy-Item -Recurse "$src\claude-codotchi"   "$target\claude-codotchi"

$ocZip = (Get-ChildItem "$src\opencode-codotchi\opencode-codotchi-*.zip")[0].FullName
$ccZip = (Get-ChildItem "$src\claude-codotchi\claude-codotchi-*.zip")[0].FullName
Copy-Item $ocZip $target
Copy-Item $ccZip $target
```

---

## Step 5 — Rewrite README

Rewrite `C:\personal_repos\ai_usage_codotchi\README.md` from the template below (full rewrite every time — replace `X.Y.Z` with actual version).

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
| **`/codotchi` slash command** | Control your pet directly from OpenCode |
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

---

## Claude Code

### Features

| Feature | Description |
|---------|-------------|
| **Statusline pet** | Multiline ANSI ASCII art renders in the statusline, refreshes every 10 seconds |
| **Coding rewards** | Every file write/edit boosts your pet's happiness and discipline |
| **Session hooks** | Pet greets you on session start and says farewell when the session stops |
| **`/codotchi` slash command** | Control your pet directly from Claude Code |
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

The script prints the two `/plugin` commands to paste into a Claude Code session:

```
/plugin marketplace add <path-to-extracted-folder>
/plugin install claude-codotchi
```

See `INSTALL.md` inside the zip for full installation details.

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

## Step 6 — Commit

```powershell
git -C "C:\personal_repos\ai_usage_codotchi" add -A
git -C "C:\personal_repos\ai_usage_codotchi" commit -m "chore: release vX.Y.Z"
```

---

## Step 7 — Push (explicit permission required)

```powershell
git -C "C:\personal_repos\ai_usage_codotchi" push origin main
```

---

## Step 8 — GitHub release (explicit permission required)

### 8a — Retrieve dsiowlee PAT

```powershell
$lines = @('protocol=https', 'host=github.com', 'username=dsiowlee', '')
$creds = $lines | & 'C:\Program Files\Git\mingw64\libexec\git-core\git-credential-wincred.exe' get
$token = ($creds | Where-Object { $_ -match '^password=' }) -replace '^password=', ''
```

If not stored, ask user to paste their PAT for `dsiowlee`.

### 8b — Create draft release + upload zips + publish

Write to temp scripts and run; delete immediately after (they contain the PAT).

**create_ai_release.ps1:**
```powershell
$token = 'PASTE_TOKEN_HERE'; $version = 'X.Y.Z'
$body = @"
## Codotchi vX.Y.Z

### Artifacts
- ``opencode-codotchi-X.Y.Z.zip`` — OpenCode plugin
- ``claude-codotchi-X.Y.Z.zip`` — Claude Code plugin
"@
$payload = @{ tag_name='v'+$version; target_commitish='main'; name='v'+$version; body=$body; draft=$true; prerelease=$false } | ConvertTo-Json -Depth 3
$h = @{ Authorization="token $token"; Accept='application/vnd.github+json'; 'X-GitHub-Api-Version'='2022-11-28' }
$r = Invoke-RestMethod -Uri 'https://api.github.com/repos/dsiowlee/ai_usage_codotchi/releases' -Method Post -Headers $h -Body $payload -ContentType 'application/json'
Write-Host "Release ID: $($r.id)"; Write-Host "URL: $($r.html_url)"
```

**upload_ai_assets.ps1:**
```powershell
$token='PASTE_TOKEN_HERE'; $releaseId=RELEASE_ID_HERE; $version='X.Y.Z'
$base="https://uploads.github.com/repos/dsiowlee/ai_usage_codotchi/releases/$releaseId/assets"
$h=@{ Authorization="token $token"; Accept='application/vnd.github+json'; 'X-GitHub-Api-Version'='2022-11-28' }
@(
  @{ path="C:\personal_repos\codotchi\opencode-codotchi\opencode-codotchi-$version.zip"; name="opencode-codotchi-$version.zip" },
  @{ path="C:\personal_repos\codotchi\claude-codotchi\claude-codotchi-$version.zip";     name="claude-codotchi-$version.zip" }
) | ForEach-Object {
  $uh=$h.Clone(); $uh['Content-Type']='application/zip'
  $r=Invoke-RestMethod -Uri "$base`?name=$($_.name)" -Method Post -Headers $uh -Body ([IO.File]::ReadAllBytes($_.path))
  Write-Host "Uploaded: $($r.name)"
}
$r=Invoke-RestMethod -Uri "https://api.github.com/repos/dsiowlee/ai_usage_codotchi/releases/$releaseId" -Method Patch -Headers $h -Body '{"draft":false}' -ContentType 'application/json'
Write-Host "Published: $($r.html_url)"
```

---

## Quick checklist

- [ ] Version confirmed from `opencode-codotchi/package.json`
- [ ] `claude-codotchi-X.Y.Z.zip` built
- [ ] `opencode-codotchi-X.Y.Z.zip` confirmed present
- [ ] Both folders + both zips copied to `ai_usage_codotchi/`
- [ ] `README.md` rewritten from template with correct version
- [ ] Committed as `chore: release vX.Y.Z`
- [ ] Pushed (explicit user instruction required)
- [ ] GitHub release created + both zips uploaded (explicit user instruction required)
