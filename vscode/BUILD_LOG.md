# BUILD_LOG.md — vscode_gotchi

Build narrative and development summary for the vscode_gotchi VS Code extension.

---

## Current status

The extension is feature-complete and packaged. It is a **fully self-contained
TypeScript VS Code extension** — no Python or external runtime required.

- All game logic lives in `src/gameEngine.ts` (pure TypeScript, zero external deps)
- 143 unit + integration tests passing (`npm test`)
- Python artefacts fully removed from the repository
- `npm run compile` compiles with zero TypeScript errors

---

## Prerequisites (development)

| Tool | Version |
|------|---------|
| VS Code | ≥ 1.85 |
| Node.js | ≥ 18 |
| npm | ≥ 9 (bundled with Node) |

---

## Install and run (development)

```bash
git clone https://github.com/dylscoop/vscode_gotchi.git
cd vscode_gotchi

npm install
npm run compile

# Press F5 in VS Code to launch the Extension Development Host
```

---

## Build and install permanently

```bash
npm install
npx vsce package --no-dependencies
code --install-extension vscode-gotchi-0.0.1.vsix
```

---

## Validation workflow (must pass before every commit)

```bash
npm run compile   # TypeScript — zero errors required
npm test          # Test suite
```

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
| `2aea83b` | docs: add BUILD_LOG.md with install guide and commit history |
| `46a82df` | docs: add installation and launch guide to README |
| `28ef743` | chore: add vsce, fix .vscodeignore, add repository field to package.json |
| `10486a1` | chore: add .gitignore; retire Python, adopt all-TypeScript architecture |
| `c3771c5` | docs: rewrite BUILD_LOG to reflect all-TypeScript architecture |
| `a4b270e` | feat: add TypeScript game engine; wire extension and persistence to gameEngine |
| `a62b3a4` | feat: wire sidebarProvider, events, and statusBar to gameEngine |
| `6fbc09d` | test: add 143-test suite for gameEngine; add tsconfig.test.json and npm test script |
| `d9e5992` | chore: remove retired Python source tree and root-level Python config files |
| `ff083c8` | chore: remove retired Python test directories and test fixtures |
| `a7679cc` | chore: remove pythonBridge.ts and gotchi.pythonPath config |

---

## Architecture

The extension is a single self-contained TypeScript process:

```
VS Code Extension Host (TypeScript)
  ├─ extension.ts          Activation, tick timer, command registration
  ├─ gameEngine.ts         Pet state machine — stats, decay, evolution (in progress)
  ├─ sidebarProvider.ts    WebviewViewProvider — dispatches button actions
  ├─ statusBar.ts          Mood emoji + pet name in the status bar
  ├─ persistence.ts        Save/load via context.globalState
  └─ events.ts             onDidSaveTextDocument → happiness boost

Webview (media/)
  ├─ sidebar.html          Panel shell
  ├─ sidebar.css           Retro pixel-art styling
  └─ sidebar.js            Stat bars, procedural sprite canvas, action buttons
```

Full design rationale and amendment history: `docs/adr/2026-03-11-architecture.md`

---

## Development decisions log

### Python subprocess → TypeScript (ADR amendment A1)

The original design used a Python 3.14 subprocess for all game logic,
communicating with the TypeScript extension host via newline-delimited JSON
over stdin/stdout. This was prototyped and fully tested (94 passing tests).

**Decision reversed:** VS Code extensions are distributed as self-contained
`.vsix` bundles. A `.vsix` cannot bundle a Python interpreter, and requiring
users to have Python installed is an unacceptable external dependency.

All game logic is being ported to TypeScript so the extension has zero runtime
dependencies beyond VS Code itself.

### .gitignore missing from initial scaffold

No `.gitignore` was created at project initialisation. Python's `__pycache__`
directories (bytecode cache files — auto-generated, not needed in version
control) and `node_modules/` accumulated as untracked files. A `.gitignore`
was added in commit `10486a1`.

---

## Remaining work

| Task | Notes |
|------|-------|
| Sprite assets | `media/sprites/` — procedural canvas placeholder currently used |

---

## Known limitations

- Sprite assets in `media/sprites/` are not included; the webview renders a
  procedural pixel-art placeholder sprite.
- Offline decay is capped at 60 % of each stat maximum to prevent instant
  death after a long IDE closure.
