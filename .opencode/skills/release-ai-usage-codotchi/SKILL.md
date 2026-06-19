---
name: release-ai-usage-codotchi
description: Releases a new version of the OpenCode and Claude Code plugins to the ai_usage_codotchi repo (dsiowlee/ai_usage_codotchi). Copies folders and zips, updates version numbers in the existing README (never rewrites it), commits, pushes, and creates a GitHub release with both zips as assets.
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

## Step 5 — Update version numbers in the README

**Never rewrite or replace the README.** The `ai_usage_codotchi/README.md` is maintained by the user and may contain custom content (screenshots, custom feature descriptions, etc.) that must be preserved.

Instead, perform a targeted find-and-replace of the old version number with the new one:

```powershell
# Read current README, replace old version with new version, write back
$readmePath = "C:\personal_repos\ai_usage_codotchi\README.md"
$content = Get-Content $readmePath -Raw
# Replace all occurrences of the previous version number with the new one
$content = $content -replace 'X\.OLD\.Z', 'X.Y.Z'
Set-Content $readmePath $content
```

In practice: find every occurrence of the old `X.OLD.Z` version string (e.g. `2.10.2`) in the README and replace it with the new version (`X.Y.Z`, e.g. `2.11.0`). This covers the zip filenames in the Installation sections and the "Current release" line at the bottom.

Do **not** add, remove, or reorder any sections. Do **not** change any prose other than the version numbers.

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
- [ ] `ai_usage_codotchi/README.md` version numbers updated (find-and-replace old → new, no other changes)
- [ ] Committed in `ai_usage_codotchi` as `chore: release vX.Y.Z`
- [ ] Pushed to `dsiowlee/ai_usage_codotchi` (explicit user instruction required)
- [ ] GitHub release created with both zips uploaded (explicit user instruction required)
