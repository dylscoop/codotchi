# BUILD_LOG.md — vscode_gotchi

Build narrative and install guide for the vscode_gotchi VS Code extension.

---

## Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| Node.js | ≥ 18 | `node --version` |
| npm | ≥ 9 | bundled with Node |
| Python | 3.14 | `py -3.14 --version` on Windows |
| VS Code | ≥ 1.85 | target engine version |

---

## Install

```bash
# 1. Clone the repository
git clone <repo-url>
cd vscode_gotchi

# 2. Install Node dependencies
npm install

# 3. Create the Python virtual environment (Windows)
py -3.14 -m venv .venv
.venv\Scripts\pip install -r requirements.txt

# 4. Compile TypeScript
npm run compile
```

---

## Validation workflow (must pass before every commit)

Run these five commands in order:

```bash
# 1. Check formatting (fix with: ruff format python/ tests/)
.venv\Scripts\ruff format --check python/ tests/

# 2. Lint
.venv\Scripts\ruff check python/ tests/

# 3. Type-check
.venv\Scripts\mypy python/ tests/

# 4. Unit tests
.venv\Scripts\pytest tests/unit_tests

# 5. Integration tests
.venv\Scripts\pytest tests/integration_tests
```

All five must report success with zero errors before a commit is made.

---

## Running in VS Code (development)

1. Open the repository folder in VS Code.
2. Press **F5** to launch the Extension Development Host.
3. In the new window, open the activity bar icon (dragon head) or run
   `Gotchi: Open Panel` from the command palette.
4. The Python game engine starts automatically. If it cannot find Python,
   set `gotchi.pythonPath` in settings to the full path of your interpreter.

---

## Commit history

| Hash | Description |
|------|-------------|
| `8aa5a52` | scaffold: add package.json and tsconfig.json |
| `1955215` | chore: add requirements.txt with Python 3.14 dev tooling |
| `52fafa3` | docs: add ADR 2026-03-11 vscode_gotchi architecture |
| `396bb43` | chore: update .github instructions for vscode_gotchi |
| `a4df46c` | fix: update naming example to match project domain |
| `0433bda` | chore: add .vscodeignore and activity bar icon |
| `ce14734` | feat: add core game constants, pet type models, and Pet dataclass |
| `06ed560` | feat: add pure action functions and evolution helpers |
| `8912a79` | feat: add game engine stdin/stdout loop and mini-game delta module |
| `8178b3b` | test: add pytest conftest and package init files |
| `e2b9fbe` | test: add unit tests for Pet dataclass and all action functions (55 tests) |
| `0ada7ca` | test: add unit tests for evolution helpers and mini-game delta logic |
| `f4ec987` | test: add integration tests for game engine JSON protocol (94 tests total) |
| `65644d2` | feat: add TypeScript Python bridge, persistence helpers, and status bar |
| `3e41bfd` | feat: add extension entry point, sidebar provider, and save-event listener |
| `97f20de` | feat: add retro pixel-art sidebar webview UI |

---

## Architecture summary

The extension is split into two processes that communicate via
newline-delimited JSON over stdin/stdout:

```
VS Code Extension Host (TypeScript)
  └─ PythonBridge  ──stdin/stdout JSON──►  python/game_engine.py (Python 3.14)
       │                                         │
       ├─ SidebarProvider (WebviewViewProvider)  ├─ pet.py      (Pet dataclass)
       ├─ StatusBarManager                       ├─ actions.py  (pure functions)
       ├─ EventsManager (onDidSaveTextDocument)  ├─ evolution.py
       └─ persistence.ts (globalState)           ├─ minigames.py
                                                 └─ config.py / models.py
```

Full design rationale is in `docs/adr/2026-03-11-architecture.md`.

---

## Known limitations / future work

- Sprite assets in `media/sprites/` are not yet included; the webview
  renders a procedural pixel-art placeholder sprite instead.
- The Python engine path defaults to the system `python` / `python3`
  binary; set `gotchi.pythonPath` if your environment differs.
- Offline decay is capped at 60 % of maximum to prevent instant death
  after long IDE closures.
