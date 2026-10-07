---
name: opencode-claude-parity
description: Enforces feature parity between the OpenCode plugin, the Claude Code plugin, and the Claude Desktop integration — any functional change to a shared file must be mirrored to all copies unless the user explicitly restricts the change.
---

## Rule

Any time a feature or functional change is made to any plugin, apply the equivalent change to the others as well — unless the user **explicitly** says to change only one (e.g. "OpenCode only", "just Claude Code", "don't touch the Desktop integration").

When in doubt, always do all three.

---

## Shared files — generated from `packages/core` (never edit the copies)

| Concern | Source of truth | Generated copies |
|---------|-----------------|------------------|
| Game engine | `packages/core/src/gameEngine.ts` | `vscode/src/`, `opencode-codotchi/src/`, `claude-codotchi/src/`, `claude-desktop-codotchi/src/` |
| ASCII art renderer | `packages/core/src/asciiArt.ts` | `opencode-codotchi/src/`, `claude-codotchi/src/`, `claude-desktop-codotchi/src/` |

**When a shared file changes:** edit `packages/core/src/`, then run `node scripts/sync-core.mjs` (each plugin's build/test also runs it) and commit the core file and the regenerated copies together. `node scripts/sync-core.mjs --check` (run in CI) fails if a copy was edited by hand. Plugin-specific behaviour goes behind config or options — e.g. `GameConfig.immortal` / `LOCAL_PET_GAME_CONFIG` for the Claude Code pet, and `buildContextualSpeech(..., { costStyle: "hourlyRate" })` for Claude Code's cost wording.

---

## Functional parity — equivalent but separate implementation

| Concern | OpenCode | Claude Code |
|---------|----------|-------------|
| Slash command definition | `opencode-codotchi/commands/codotchi.md` | `claude-codotchi/commands/codotchi.md` |
| Action handling | `opencode-codotchi/src/index.ts` | `claude-codotchi/scripts/action.mjs` |
| Session start hook | `opencode-codotchi/src/index.ts` | `claude-codotchi/scripts/hook-session-start.mjs` |
| Session stop hook | `opencode-codotchi/src/index.ts` | `claude-codotchi/scripts/hook-stop.mjs` |
| Post-tool hook | `opencode-codotchi/src/index.ts` | `claude-codotchi/scripts/hook-post-tool.mjs` |
| Statusline / display | `opencode-codotchi/src/index.ts` | `claude-codotchi/scripts/statusline.mjs` |
| Pet state management | `opencode-codotchi/src/index.ts` | `claude-codotchi/scripts/state.mjs` |

**New action added:** update both `commands/codotchi.md` files and both action handlers (`index.ts` + `action.mjs`).

**Game mechanic changed:** lives in `packages/core/src/gameEngine.ts` — edit there and run `node scripts/sync-core.mjs`.

---

## Architecture differences

### Plugin host
- **OpenCode**: TypeScript plugin, `@opencode-ai/plugin` API, event handlers registered with `on(event, handler)`.
- **Claude Code**: Node.js `.mjs` hook scripts, each a separate process invocation. State via JSON files.

### Slash command response
- **OpenCode**: return string from command handler.
- **Claude Code**: write to stdout.

### State persistence
- **OpenCode**: `statePathResolver.ts` links to VS Code state file; fallback to `~/.config/opencode/codotchi-state.json`.
- **Claude Code**: `state.mjs` reads/writes `$CLAUDE_PLUGIN_DATA/codotchi-state.json`. No VS Code linking.

### Tick loop
- **OpenCode**: `setInterval` — continuous while OpenCode is open.
- **Claude Code**: tick advanced on every hook invocation — no persistent timer.

---

## After any change

1. Shared file changed → edit `packages/core/src/`, run `node scripts/sync-core.mjs`.
2. New action → all `commands/codotchi.md` files + all action handlers.
3. Mechanic changed → verify consistent behaviour in all plugins.
4. Rebuild all:
   - OpenCode: `node scripts/package.js` (from `opencode-codotchi/`)
   - Claude Code: `npm run build` (commit the rebuilt `dist/`) then `node scripts/package.js` (from `claude-codotchi/`)
   - Claude Desktop: `npm run build` then `npm run bundle` (from `claude-desktop-codotchi/`)
5. Commit all sets of changes together.
