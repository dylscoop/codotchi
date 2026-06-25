---
name: install-vscode-extension
description: >
  Install or update the Codotchi VS Code extension from the locally built .vsix.
  Always asks user permission before running the install command.
---

## When to apply

Apply when:
- The user says "install the extension", "update the extension", "sideload the vsix", or "install the vsix"
- As part of a release flow after a new `.vsix` has been built and committed

---

## Step 1 — Identify the vsix to install

Find the latest built vsix in `vscode/`:

```powershell
Get-ChildItem vscode\codotchi-*.vsix | Sort-Object LastWriteTime -Descending | Select-Object -First 1
```

Confirm the filename matches the current version in `vscode/package.json` before proceeding.

---

## Step 2 — Ask for permission

**STOP. Do not run the install command without explicit user confirmation.**

Tell the user:

> Ready to install `codotchi-X.Y.Z.vsix` into VS Code using:
> ```
> code --install-extension vscode\codotchi-X.Y.Z.vsix --force
> ```
> This will replace the currently installed version. Proceed?

Wait for the user to say yes before continuing.

---

## Step 3 — Install

Once the user confirms, run from the repo root:

```powershell
code --install-extension vscode\codotchi-X.Y.Z.vsix --force
```

The `--force` flag ensures the extension is updated even if the same version is already installed.

---

## Step 4 — Verify

After the command completes, confirm success by checking the output contains:

```
Extension 'codotchi-X.Y.Z.vsix' was successfully installed.
```

If VS Code is already open, remind the user to **reload the window** (`Ctrl+Shift+P` → "Developer: Reload Window") for the new version to take effect.
