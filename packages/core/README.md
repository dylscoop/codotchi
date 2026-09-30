# packages/core

The only place to edit the TypeScript code shared by the codotchi plugins.

| File | Copied into |
|------|-------------|
| `src/gameEngine.ts` | `vscode/src/`, `opencode-codotchi/src/`, `claude-codotchi/src/`, `claude-desktop-codotchi/src/` |
| `src/asciiArt.ts` | `opencode-codotchi/src/`, `claude-codotchi/src/`, `claude-desktop-codotchi/src/` |

`node scripts/sync-core.mjs` (from the repo root) writes the copies. Each
plugin's `build` / `compile` / `test` script runs it first, so a normal build
always picks up core changes. The copies are committed, and each starts with a
"GENERATED — do not edit" header.

`node scripts/sync-core.mjs --check` fails if any copy differs from core. CI
runs it on every push.

Plugin-specific behaviour lives behind config or options, not in forks:

- `GameConfig.immortal` / `LOCAL_PET_GAME_CONFIG`: the Claude Code pet can't die.
- `buildContextualSpeech(..., { costStyle: "hourlyRate" })`: Claude Code's
  cost wording (🟢/🟡/🔴 lights and a `$X/hr` suffix). OpenCode uses the default
  `"lastHour"` wording.

The PyCharm engine is Kotlin (`pycharm/src/main/kotlin/com/codotchi/engine/`)
and is kept in parity by hand. See the `ide-parity` skill.
