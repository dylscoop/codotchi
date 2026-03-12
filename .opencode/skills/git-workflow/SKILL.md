---
name: git-workflow
description: Enforces branch and commit discipline — never push directly to main, always work on a named feature branch, and always ask the user before creating a branch or pushing.
license: MIT
compatibility: opencode
---

## Branch rules

- **Never push directly to `main`.**
- **Never commit directly to `main`.**
- For every new feature or bug fix, ask the user what branch name to use before starting work. Suggest a name based on the feature (e.g. `feat/poo-animation`, `fix/health-bar-colour`).
- Only skip asking if the user has already named the branch themselves in their message.

## Workflow

1. Before starting any code change, confirm the target branch with the user.
2. Check out or create that branch.
3. Commit work there.
4. When work is done, tell the user and ask if they want to:
   - Open a pull request into `main`, or
   - Just push the branch and let them decide later.
5. **Never merge into `main` without explicit user instruction.**
6. **Never push a tag without explicit user instruction.**

## Commit style

- One commit per logical unit of work (per todo item).
- Message format: `<type>: <short description>` — types are `feat`, `fix`, `chore`, `refactor`, `docs`, `test`.

## Release / merge to main

Only perform a release (version bump, merge to `main`, tag, push) when the user **explicitly** asks for it. Do not do this automatically at the end of a feature.
