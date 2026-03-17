---
name: git-workflow
description: Enforces branch and commit discipline — never push directly to main, always work on a named feature branch, and always ask the user before pushing, merging, or tagging.
license: MIT
compatibility: opencode
---

## Branch rules

- **Never push directly to `main`.**
- **Never commit directly to `main`.**
- **Never write, edit, or build any code until a feature branch is checked out.**
- For every new feature or bug fix, ask the user what branch name to use before doing anything else. Suggest a name based on the feature (e.g. `feat/poo-animation`, `fix/health-bar-colour`).
- Only skip asking if the user has already named the branch themselves in their message.
- Create and check out the branch immediately after the name is confirmed — before reading files, writing code, or running builds.

## Push / merge / tag rules — explicit permission required for every step

The following actions each require **explicit user instruction** before performing them. Do not bundle or assume permission for one because permission was given for another:

| Action | What "explicit" means |
|--------|----------------------|
| Push a branch to `origin` | User says "push the branch" or "push to origin" |
| Merge into `main` | User says "merge to main" or "merge it" |
| Push `main` to `origin` | User says "push main" |
| Create a tag | User says "tag it" or "create a tag" |
| Push a tag to `origin` | User says "push the tag" |
| Create a GitHub release | User says "create a release" or "publish it" |

**Never chain these steps together automatically.** After completing work, stop and report what is done. Ask the user how they want to proceed with each step.

## Workflow

1. **Before touching any file:** confirm the target branch name with the user.
2. **Immediately check out or create that branch** — do not read, edit, or build anything until this step is done.
3. Do the work (code changes, builds, doc updates).
4. Commit work on that branch.
5. When work is done, stop and tell the user:
   - What was changed
   - What commits are on the branch
   - Which of the release steps still need to happen
5. Wait for the user to explicitly ask for each next step.

## Commit style

- **One commit per feature or bug fix.** Never batch multiple features or fixes into a single commit.
- Each commit must be self-contained: include the source change, its doc updates, and rebuilt artifacts together — but only for that one feature or fix.
- If a task has multiple independent features or fixes, commit each one separately before starting the next.
- **Commit after every todo item is completed.** When working through a todo list, create a commit immediately after each item is marked done — do not accumulate multiple completed todos before committing.
- Message format: `<type>: <short description>` — types are `feat`, `fix`, `chore`, `refactor`, `docs`, `test`.

## Build artifacts — required before every feature/fix commit

Before committing any feature or bug fix, **always rebuild both distribution artifacts** and include them in the same commit:

| IDE | Command (run from the given directory) | Output artifact to commit |
|-----|----------------------------------------|--------------------------|
| VS Code | `npx @vscode/vsce package` (run from `vscode/`) | `vscode/vscode-gotchi-X.Y.Z.vsix` |
| PyCharm | `powershell -Command "$env:JAVA_HOME='C:\Users\DylanSiow-Lee\.gradle\caches\modules-2\files-2.1\com.jetbrains\jbre\jbr_jcef-17.0.10-windows-x64-b1207.12\extracted\jbr_jcef-17.0.10-windows-x64-b1207.12'; & '.\gradlew.bat' buildPlugin"` (run from `pycharm/`) | `pycharm/build/distributions/pycharm-gotchi-X.Y.Z.zip` |

Never commit source changes without regenerating both artifacts.

## Release / merge to main

The release flow has multiple discrete steps. **Each step requires its own explicit user instruction.** Do not perform any of them automatically at the end of a feature or bug fix.

Typical release flow (each line needs separate approval):

1. `git push origin <branch>` — push the feature branch
2. `git checkout main && git merge <branch>` — merge to main
3. `git push origin main` — push main
4. `git tag vX.Y.Z` — create the version tag
5. `git push origin vX.Y.Z` — push the tag
   6. Copy artifacts to `releases/`, apply the 3-version rule, move older releases to `releases/old_releases/` — see `release-management` skill — commit and push
7. Create GitHub release — publish release notes

## GitHub release body — what to include

When creating a GitHub release for `vX.Y.Z`, the release body must cover **everything new since the previous release tag**, not just the most recent commit. Follow these steps:

1. Find the previous release tag:
   ```
   git tag --sort=-version:refname | head -5
   ```
2. Collect all commits between the previous tag and the new one:
   ```
   git log <prev-tag>..vX.Y.Z --oneline
   ```
3. For each commit, summarise the user-visible changes. Group them into sections:
   - **Features** — new capabilities (`feat:` commits)
   - **Bug fixes** — defects corrected (`fix:` commits; cross-reference BUGFIX-NNN if applicable)
   - **Chores / internal** — version bumps, artifact rebuilds, doc updates (`chore:`, `docs:` commits) — keep this section brief or omit if empty

4. Include the artifact filenames so users know exactly what to download:
   ```
   ## Artifacts
   - `vscode-gotchi-X.Y.Z.vsix` — VS Code extension
   - `pycharm-gotchi-X.Y.Z.zip` — PyCharm plugin
   ```

5. **`gh` CLI is not available on this machine.** Use the GitHub REST API via a PowerShell script instead (see below).

## Creating a GitHub release without `gh` CLI

`gh` is not installed. Use this PowerShell approach every time.

### Step 1 — retrieve the stored PAT

The PAT is stored in Windows Credential Manager under `git:https://dylscoop@github.com`.
Retrieve it with:

```powershell
$creds = (echo 'protocol=https'; echo 'host=github.com'; echo 'username=dylscoop'; echo '') |
    & 'C:\Program Files\Git\mingw64\libexec\git-core\git-credential-wincred.exe' get
$token = ($creds | Where-Object { $_ -match '^password=' }) -replace '^password=', ''
```

### Step 2 — write a temporary PS1 script and run it

Inline PowerShell with complex quoting is unreliable in the Bash tool. Always write the
script to a temp file and execute it with `-ExecutionPolicy Bypass -File`:

```powershell
# create_release.ps1  (delete after use)
$token = 'PASTE_TOKEN_HERE'
$releaseBody = @"
## Features
- ...

## Bug fixes
- ...

## Artifacts
- ``vscode-gotchi-X.Y.Z.vsix`` - VS Code extension
- ``pycharm-gotchi-X.Y.Z.zip`` - PyCharm plugin
"@

$payload = @{
    tag_name         = 'vX.Y.Z'
    target_commitish = 'main'
    name             = 'vX.Y.Z - Short release headline'
    body             = $releaseBody
    draft            = $false
    prerelease       = $false
} | ConvertTo-Json -Depth 3

$headers = @{
    Authorization          = "token $token"
    Accept                 = 'application/vnd.github+json'
    'X-GitHub-Api-Version' = '2022-11-28'
}

try {
    $r = Invoke-RestMethod -Uri 'https://api.github.com/repos/dylscoop/codotchi/releases' `
         -Method Post -Headers $headers -Body $payload -ContentType 'application/json'
    Write-Host "SUCCESS: $($r.html_url)"
} catch {
    Write-Host "ERROR: $($_.Exception.Message)"
    Write-Host $_.ErrorDetails.Message
}
```

Run it:
```
powershell -ExecutionPolicy Bypass -File create_release.ps1
```

Then delete the script immediately (it contains the PAT).

### Notes
- Use backtick-escaped backticks (` `` `) inside `@"..."@` here-strings to produce literal backticks in the Markdown body.
- The repo is `dylscoop/codotchi`; update the URI if the repo ever changes.
- After a successful release, verify at `https://github.com/dylscoop/codotchi/releases`.
