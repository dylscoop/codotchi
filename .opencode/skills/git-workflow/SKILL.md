---
name: git-workflow
description: Enforces branch and commit discipline — never push directly to main, always work on a named feature branch, and always ask the user before pushing, merging, or tagging.
license: MIT
compatibility: opencode
---

## Branch rules

- **Never push directly to `main`.**
- **Never commit directly to `main`.**
- For every new feature or bug fix, ask the user what branch name to use before starting work. Suggest a name based on the feature (e.g. `feat/poo-animation`, `fix/health-bar-colour`).
- Only skip asking if the user has already named the branch themselves in their message.

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

1. Before starting any code change, confirm the target branch with the user.
2. Check out or create that branch.
3. Commit work there.
4. When work is done, stop and tell the user:
   - What was changed
   - What commits are on the branch
   - Which of the release steps still need to happen
5. Wait for the user to explicitly ask for each next step.

## Commit style

- One commit per logical unit of work (per todo item).
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
6. Copy artifacts to `releases/`, commit, and push — publish artifacts
7. Create GitHub release — publish release notes
