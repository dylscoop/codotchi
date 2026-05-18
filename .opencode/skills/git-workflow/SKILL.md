---
name: git-workflow
description: Enforces branch and commit discipline — never push directly to main, always work on a named feature branch, always ask the user for a branch name before touching any file, and commit after every completed todo item.
license: MIT
compatibility: opencode
---

## MANDATORY — do these two things before anything else

> **STOP. Before reading a single file or running a single command:**
>
> 1. Ask the user for a branch name (suggest one based on the task).
> 2. Create and check out that branch.
>
> Only after the branch is checked out may you read files, write code, or run builds.

If you are mid-session and have already done work without a branch, create the
branch immediately (all unstaged changes carry over automatically), then commit
what is done before continuing.

---

## Branch rules

- **Never push directly to `main`.**
- **Never commit directly to `main`.**
- **Never write, edit, or build any code until a feature branch is checked out.**
- For every new feature or bug fix, ask the user what branch name to use. Suggest a name based on the feature (e.g. `feat/poo-animation`, `fix/health-bar-colour`).
- Only skip asking if the user has already named the branch themselves in their message.
- Create and check out the branch immediately after the name is confirmed — before reading files, writing code, or running builds.

---

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

---

## Workflow

1. **Before touching any file:** ask for and confirm the target branch name.
2. **Immediately check out or create that branch** — do not read, edit, or build anything until this step is done.
3. Do the work (code changes, builds, doc updates).
4. **Commit after every todo item is completed** (see Commit style below).
5. When all work is done, stop and tell the user:
   - What was changed
   - What commits are on the branch
   - Which of the release steps still need to happen
6. Wait for the user to explicitly ask for each next step.

---

## Commit style

- **One commit per completed todo item.** Never batch multiple todos into a single commit.
- Each commit must be self-contained: source change + its doc updates + rebuilt artifacts (if source changed) — but only for that one item.
- **Commit immediately** when a todo item is marked done — do not continue to the next todo until the commit is made.
- Message format: `<type>: <short description>` — types are `feat`, `fix`, `chore`, `refactor`, `docs`, `test`.

---

## Post-build mandatory actions — do these immediately after every build

> **Exception: `unitTest` runs.** The post-build artifact steps below do **not** apply to `unitTest`. After `unitTest` completes successfully:
> 1. Confirm all tests passed (zero failures in the summary output).
> 2. If there are uncommitted files pending from the current todo item, commit them now.
> 3. If there is nothing to commit, mark the todo complete and move directly to the next todo item — do **not** pause, do **not** report "tests passed", do **not** wait for the user.
>
> **This is the root cause of recurring stuck behaviour** — `unitTest` produces no artifact, so the artifact verify/list/commit steps below cannot fire and cause a silent stall. Never apply the artifact flow to a test-only run.

After any **artifact build** command completes (VS Code `vsce package`, PyCharm `buildPlugin`, or OpenCode `package.js`), you **must** do all four of the following before stopping or waiting:

1. **Verify the artifact version** — immediately after the build command returns, run a directory listing to confirm the artifact file exists and its filename contains the correct version number (e.g. `Get-ChildItem vscode/codotchi-*.vsix` and `Get-ChildItem pycharm/build/distributions/*.zip`). If the filename does not match the expected version, stop and report the mismatch before committing anything.
2. **List the artifact files produced** — state the exact filename and path of every artifact that was just built.
3. **Commit the artifacts immediately** as `chore: rebuild artifacts for vX.Y.Z` — do not wait for the user to ask. The commit is already implied by the release flow. Stage and commit all three artifact files in a single commit.
4. **Continue immediately** — after the commit succeeds, move directly to the next todo item. Do not stop and say "build succeeded" and wait. Do not ask "shall I continue?" or "keep going?" Keep going until all todos are done or an explicit user decision is required (push, merge, tag, release, or reinstalling the OpenCode plugin via `node bin/install.js --install` — that step always requires explicit user confirmation before running; stop and ask, then wait for the answer).

Never silently halt after a build. Never leave artifact files uncommitted. Never wait for the user to say "keep going" after a successful build.

### If the build tool call times out or is aborted by the user

The build may take longer than the tool timeout, causing the call to be aborted even though Gradle/vsce continued running in the background. **When the user pastes build output showing BUILD SUCCESSFUL**, treat it as if the tool call returned that output:

1. **Immediately** run `Get-ChildItem` to verify the artifact exists at the expected path and version.
2. List the artifact filename and path.
3. Commit the artifact as `chore: rebuild artifacts for vX.Y.Z`.
4. Continue to the next todo item without pausing.

**Do not wait to be told to continue. Do not ask "shall I proceed?". Receipt of BUILD SUCCESSFUL output — by any means — is the trigger to verify, commit, and move on.**

> **Root cause of version mismatch:** If the version in `package.json` / `build.gradle.kts` was not bumped before building, the artifact will carry the old version number. Always bump versions in all four files (`vscode/package.json`, `pycharm/build.gradle.kts`, `pycharm/src/main/resources/META-INF/plugin.xml`, `opencode-codotchi/package.json`) and commit the bump **before** running any build.

---

## Build artifacts — required before merging to main

Do **not** rebuild on every individual commit. Rebuild once, as a dedicated
`chore:` commit, immediately before the branch is ready to merge to `main`:

| IDE | Command (run from the given directory) | Output artifact to commit |
|-----|----------------------------------------|--------------------------|
| VS Code | `npx @vscode/vsce package` (run from `vscode/`) | `vscode/codotchi-X.Y.Z.vsix` |
| PyCharm | See PyCharm build procedure below | `pycharm/build/distributions/pycharm-gotchi-X.Y.Z.zip` |

The build commit must come **after** all feature, fix, test, and doc commits on
the branch — never rebuild mid-branch and then continue adding changes on top.

Never merge to `main` without both artifacts present and up to date.

### PyCharm build procedure

The PyCharm build frequently fails with a file-lock error on `extnet.dll` when
another Java process is still running from a previous build attempt or IDE session.
**Always follow these steps in order:**

1. **Kill all lingering java/gradle processes** before running the build:
   ```powershell
   Get-Process | Where-Object { $_.Name -like "*java*" -or $_.Name -like "*gradle*" } | Stop-Process -Force
   Start-Sleep -Seconds 3
   ```

2. **Clear the Gradle configuration cache** (it gets poisoned when a build is
   interrupted mid-extraction):
   ```powershell
   Remove-Item -Recurse -Force ".gradle\configuration-cache" -ErrorAction SilentlyContinue
   ```
   (run from `pycharm/`)

3. **Run the build with `-x buildSearchableOptions --no-configuration-cache`** to prevent re-poisoning and skip the task that causes the file-lock hang:
   ```powershell
   $env:JAVA_HOME = 'C:\Users\DylanSiow-Lee\.gradle\caches\modules-2\files-2.1\com.jetbrains\jbre\jbr_jcef-17.0.10-windows-x64-b1207.12\extracted\jbr_jcef-17.0.10-windows-x64-b1207.12'
   & '.\gradlew.bat' buildPlugin -x buildSearchableOptions --no-configuration-cache
   ```
   (run from `pycharm/`)

   > **Why `-x buildSearchableOptions`?** This task launches a headless IDE
   > sandbox that extracts `extnet.dll` from the JBR tarball. When PyCharm is
   > open it holds a lock on that DLL, causing the build to fail or hang every
   > time. Skipping it produces a fully functional plugin zip.

> **Note:** The `powershell -Command "..."` one-liner form does **not** reliably
> set `$env:JAVA_HOME` inside the child shell on this machine. Always use the
> two-statement form above (set the variable, then call gradlew) in the same
> PowerShell session.

### PyCharm build — timeout and retry rules

The Bash tool default timeout is 120 000 ms (2 min). The PyCharm build can take
up to 3–4 min on a cold daemon. **Always use `timeout: 240000`** (4 min) when
invoking the build or `unitTest` task.

If the build times out:

1. **Do not stop.** Kill lingering processes, clear the configuration cache, and
   retry immediately with `timeout: 240000`.
2. Retry up to **two more times** (three attempts total) before asking the user
   for help.
3. If all three attempts fail with a timeout, report the exact error output and
   ask the user whether to continue.

**Never leave the build in an unresolved state.** If the build succeeds on a
retry, continue immediately with the next step — do not wait for the user to
say "keep going".

### PyCharm unit tests

**NEVER run `gradlew test`** — the `org.jetbrains.intellij` plugin hijacks the
built-in `test` task to set up an IDE sandbox, which re-extracts the JBR and
fails with a file-lock error (`extnet.dll`) when any IDE or Java process is
running.

Instead, always run the custom `unitTest` task:
```powershell
$env:JAVA_HOME = 'C:\Users\DylanSiow-Lee\.gradle\caches\modules-2\files-2.1\com.jetbrains\jbre\jbr_jcef-17.0.10-windows-x64-b1207.12\extracted\jbr_jcef-17.0.10-windows-x64-b1207.12'
& '.\gradlew.bat' unitTest --no-configuration-cache
```
(run from `pycharm/`)

The `unitTest` task runs JUnit 5 tests directly on the JVM toolchain — no
sandbox, no JBR extraction, no IDE dependency. It is safe to run at any time,
including while PyCharm or VS Code is open.

#### PyCharm unit tests — timeout, stuck-check, and retry rules

**Always use `timeout: 240000`** (4 min) when invoking `unitTest` — JVM
cold-start can be slow even without the sandbox.

If the tool call **times out** but the process may have continued running,
**check for test result XML before declaring failure**:

```powershell
Get-ChildItem "pycharm\build\test-results\unitTest\*.xml" | Select-Object Name, LastWriteTime
```

If result files exist and their `LastWriteTime` is **after** the run started,
the tests completed successfully — read the XML, confirm all tests passed, and
proceed as if the command succeeded. Do **not** retry in this case.

If no result files exist (genuine hang or failure), follow the same kill →
clear → retry cycle as `buildPlugin`:

1. Kill lingering java/gradle processes and wait 3 seconds:
   ```powershell
   Get-Process | Where-Object { $_.Name -like "*java*" -or $_.Name -like "*gradle*" } | Stop-Process -Force
   Start-Sleep -Seconds 3
   ```
2. Clear the Gradle configuration cache (run from `pycharm/`):
   ```powershell
   Remove-Item -Recurse -Force ".gradle\configuration-cache" -ErrorAction SilentlyContinue
   ```
3. Re-run with `timeout: 240000`:
   ```powershell
   $env:JAVA_HOME = 'C:\Users\DylanSiow-Lee\.gradle\caches\modules-2\files-2.1\com.jetbrains\jbre\jbr_jcef-17.0.10-windows-x64-b1207.12\extracted\jbr_jcef-17.0.10-windows-x64-b1207.12'
   & '.\gradlew.bat' unitTest --no-configuration-cache
   ```

Retry up to **three attempts total**. After each timeout, check for XML results
before retrying — the test run may have completed despite the tool timeout. If
all three attempts fail with no result XML, report the exact error output and
ask the user whether to continue.

**Never leave tests in an unresolved state.** If tests pass on a retry,
continue immediately to the next todo item without waiting for the user.

---

## Release / merge to main

The release flow has multiple discrete steps. **Each step requires its own explicit user instruction.** Do not perform any of them automatically at the end of a feature or bug fix.

Typical release flow (each line needs separate approval):

1. Rebuild both IDE artifacts and commit as `chore: rebuild artifacts for vX.Y.Z` — **this must be the last commit on the branch before merging**
2. Rebuild the OpenCode zip: `node scripts/package.js` (run from `opencode-codotchi/`) and commit as `chore: rebuild opencode-codotchi zip for vX.Y.Z`
3. **Ask the user** to confirm before reinstalling the OpenCode plugin locally: `node bin/install.js --install` (run from `opencode-codotchi/`) — **never run without explicit user confirmation**
4. `git push origin <branch>` — push the feature branch
5. `git checkout main && git merge <branch>` — merge to main
6. `git push origin main` — push main
7. `git tag vX.Y.Z` — create the version tag locally on main
8. `git push origin vX.Y.Z` — push the tag (bypasses the rule with a "Bypassed rule violations" warning — this is expected and the tag is created successfully)
9. Copy artifacts to `releases/`, apply the 3-version rule, move older releases to `releases/old_releases/` — see `release-management` skill — commit and push
10. Create GitHub release — publish release notes

## Pushing a tag

Use a plain `git push`:

```powershell
git push origin vX.Y.Z
```

The remote will respond with a "Bypassed rule violations" warning — this is expected. The tag is created on the remote successfully despite the warning. No API call or PAT required.

---

## GitHub release body — what to include

When creating a GitHub release for `vX.Y.Z`, the release body must cover **everything new since the previous GitHub release** (not the previous git tag). These two are often different — some tags are never published as GitHub releases, and some GitHub releases are deleted. Follow these steps:

1. Find the most recent **GitHub release** (not git tag) by fetching the releases list:
   ```powershell
   # use get_release.ps1 pattern to call:
   # GET https://api.github.com/repos/dylscoop/codotchi/releases
   # look at the tag_name of the first (most recent) entry
   ```
   This tells you the `<prev-release-tag>` to use as the baseline.

2. Collect all non-merge commits between the previous release tag and the new one:
   ```
   git log <prev-release-tag>..vX.Y.Z --oneline --no-merges
   ```

3. For each `feat:` and `fix:` commit, summarise the **user-visible** change. Group into sections:
   - **Features** — new capabilities (`feat:` commits)
   - **Bug fixes** — defects corrected (`fix:` commits; cross-reference BUGFIX-NNN if applicable)
   - Omit `chore:`, `docs:`, and `test:` commits from the release body entirely

4. Include the artifact filenames so users know exactly what to download:
   ```
   ## Artifacts
   - `codotchi-X.Y.Z.vsix` — VS Code extension
   - `pycharm-codotchi-X.Y.Z.zip` — PyCharm plugin
   - `opencode-codotchi-X.Y.Z.zip` — OpenCode plugin
   ```

5. **`gh` CLI is not available on this machine.** Use the GitHub REST API via a PowerShell script instead (see below).

## Creating a GitHub release without `gh` CLI

`gh` is not installed. Use this PowerShell approach every time.

### Step 1 — retrieve the stored PAT

> **WARNING:** The Windows Credential Manager may only store one entry for `github.com`
> and it may belong to `dsiowlee` (a different account without push access). Always
> verify the retrieved token's username. If it returns `dsiowlee`, ask the user to
> paste the `dylscoop` PAT directly — do not use the `dsiowlee` token.

Attempt retrieval with:

```powershell
$lines = @('protocol=https', 'host=github.com', '')
$creds = $lines | & 'C:\Program Files\Git\mingw64\libexec\git-core\git-credential-wincred.exe' get
$creds  # check that username=dylscoop before using the password
$token = ($creds | Where-Object { $_ -match '^password=' }) -replace '^password=', ''
```

If the username is not `dylscoop`, ask the user to paste their PAT. A **classic PAT**
(prefix `ghp_`) with `repo` scope works for both git push and API calls. Fine-grained
PATs (prefix `github_pat_`) have been observed to pass API permission checks but still
fail git push with 403 — prefer classic PATs for pushing.

> **Note:** the pipe-from-`echo` form (`echo 'protocol=https' | ...`) does **not** work in PowerShell 5.1 — use the `@()` array form above.

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
- ``codotchi-X.Y.Z.vsix`` - VS Code extension
- ``pycharm-codotchi-X.Y.Z.zip`` - PyCharm plugin
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

