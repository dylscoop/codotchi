# Copilot Agent Instructions

## Plan Stage
- Always output the planning results to a markdown file with the date as an architectural decision record.

## Build Stage
- Do not write more than 3 files at a time when first building
- When editing, do not do more than 500 lines at a time. If you need to do more, ask for permission first
- Break up the building by commits. Once the file has been committed, continue building further

## Python Environment

This repository uses its own venv.

All Python-related commands MUST be executed via the local py314 venv:

```
# Windows
.venv\Scripts\<command>

# macOS/Linux
.venv/bin/<command>
```

## Tooling Overview

- Formatting: ruff format
- Linting: ruff check
- Type checking: mypy
- Tests: pytest

## Validation Workflow

When making code changes, the agent must perform the following steps in order:

1. Check formatting:
   ```
   .venv/Scripts/ruff format --check src/ tests/
   ```

   If formatting fails, fix with:
   ```
   .venv/Scripts/ruff format src/ tests/
   ```

2. Run linting:
   ```
   .venv/Scripts/ruff check src/ tests/
   ```

3. Run type checking:
   ```
   .venv/Scripts/mypy src/ tests/
   ```

4. Run default test suites:
   - Unit tests:
     ```
     .venv/Scripts/pytest tests/unit_tests
     ```
   - Integration tests:
     ```
     .venv/Scripts/pytest tests/integration_tests
     ```

Fix issues in this order.

## Definition of Done

A change is complete only if:

- Formatting passes
- Linting passes
- Type checking passes
- Unit tests pass
- Integration tests pass
