# Copilot Agent Instructions

## Plan Stage

- Always output the planning results to a markdown file with the date as an architectural decision record.

## Build Stage

- Do not write more than 3 files at a time when first building
- When editing, do not do more than 500 lines at a time. If you need to do more, ask for permission first
- Break up the building by commits. Once the file has been committed, continue building further

## Branch and Push Discipline

- **Never push to `main` directly.** Always work on a feature or bugfix branch.
- **Never commit directly to `main`.**
- **Never merge into `main` without explicit user instruction.**
- **Never create or push a tag without explicit user instruction.**
- **Never push anything to `origin` without explicit user instruction** — not branches, not tags, not merges.
- When work is done, stop and tell the user what is ready. Ask them if they want to push, merge, or tag.

## Language and Runtime

This is a **dual-IDE project** with two separate but functionally identical plugins:

| IDE | Language | Root dir |
|-----|----------|----------|
| VS Code | TypeScript | `vscode/` |
| PyCharm / JetBrains | Kotlin + JCEF | `pycharm/` |

All game logic must be kept in parity between both IDEs. Do **not** introduce Python files, a `.venv`, or any Python tooling. See the `ide-parity` skill for the full file mapping.

## Tooling Overview

### VS Code

| Tool | Purpose | Command | Run from |
|------|---------|---------|----------|
| `tsc` | TypeScript compiler | `npm run compile` | `vscode/` |
| `npm test` | Test suite | `npm test` | `vscode/` |
| `npx @vscode/vsce package` | Build `.vsix` artifact | (same) | `vscode/` |
| `markdownlint-cli2` | Markdown linter | `npm run lint:md` | repo root |
| `markdownlint-cli2 --fix` | Markdown auto-fix | `npm run format:md` | repo root |

### PyCharm

| Tool | Purpose | Command | Run from |
|------|---------|---------|----------|
| `gradlew.bat buildPlugin` | Build `.zip` artifact | see below | `pycharm/` |

Full PyCharm build command (must set `JAVA_HOME`):

```powershell
powershell -Command "$env:JAVA_HOME='C:\Users\DylanSiow-Lee\.gradle\caches\modules-2\files-2.1\com.jetbrains\jbre\jbr_jcef-17.0.10-windows-x64-b1207.12\extracted\jbr_jcef-17.0.10-windows-x64-b1207.12'; & '.\gradlew.bat' buildPlugin"
```

Output: `pycharm/build/distributions/pycharm-codotchi-X.Y.Z.zip`

## Validation Workflow

When making code changes, perform the following steps in order:

1. Compile TypeScript — must produce zero errors:

   ```bash
   npm run compile
   ```

2. Run tests:

   ```bash
   npm test
   ```

3. Build VS Code artifact:

   ```bash
   npx @vscode/vsce package
   ```

4. Build PyCharm artifact (from `pycharm/`):

   ```powershell
   powershell -Command "$env:JAVA_HOME='...'; & '.\gradlew.bat' buildPlugin"
   ```

5. Lint all markdown files — must produce zero errors:

   ```bash
   npm run lint:md
   ```

   If violations are found, auto-fix first, then re-lint to confirm:

   ```bash
   npm run format:md && npm run lint:md
   ```

Fix issues in this order.

## Definition of Done

A change is complete only if:

- `npm run compile` exits with zero errors
- `npm test` passes
- Both artifacts rebuilt and staged in the same commit
- `npm run lint:md` exits with zero errors (run from repo root)
- All markdown docs updated (VERSIONS.md, FEATURES.md, README files as applicable)
- Changes are committed on a feature/bugfix branch — **not** on `main`
