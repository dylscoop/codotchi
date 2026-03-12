# Copilot Agent Instructions

## Plan Stage

- Always output the planning results to a markdown file with the date as an architectural decision record.

## Build Stage

- Do not write more than 3 files at a time when first building
- When editing, do not do more than 500 lines at a time. If you need to do more, ask for permission first
- Break up the building by commits. Once the file has been committed, continue building further

## Language and Runtime

This is a **pure TypeScript** VS Code extension. There is no Python runtime
dependency. All game logic lives in `src/` and runs inside the VS Code
extension host process.

Do **not** introduce Python files, a `.venv`, or any Python tooling.

## Tooling Overview

| Tool | Purpose | Command | Run from |
|---|---|---|---|
| `tsc` | TypeScript compiler | `npm run compile` | `vscode/` |
| `npm test` | Test suite | `npm test` | `vscode/` |
| `markdownlint-cli2` | Markdown linter | `npm run lint:md` | repo root |
| `markdownlint-cli2 --fix` | Markdown auto-fix | `npm run format:md` | repo root |

## Validation Workflow

When making code changes, the agent must perform the following steps in order:

1. Compile TypeScript — must produce zero errors:

   ```bash
   npm run compile
   ```

2. Run tests:

   ```bash
   npm test
   ```

3. Lint all markdown files — must produce zero errors:

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
- `npm run lint:md` exits with zero errors (run from repo root)
