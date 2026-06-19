---
name: opencode-claude-parity
description: Enforces feature parity between the OpenCode plugin and the Claude Code plugin — any functional change to one must be mirrored to the other unless the user explicitly restricts the change to one plugin only.
license: MIT
compatibility: opencode
---

## Rule

Any time a feature or functional change is made to either plugin, apply the equivalent change to the other as well — unless the user **explicitly** says to change only one (e.g. "OpenCode only", "just Claude Code", "don't touch the other plugin").

When in doubt, always do both.

---

## Shared files — literal copies (must be identical)

These files are maintained as separate copies but must always have identical content:

| Concern | OpenCode | Claude Code |
|---------|----------|-------------|
| Game engine | `opencode-codotchi/src/gameEngine.ts` | `claude-codotchi/src/gameEngine.ts` |
| ASCII art renderer | `opencode-codotchi/src/asciiArt.ts` | `claude-codotchi/src/asciiArt.ts` |

**When either shared file changes:** copy the updated file to the other plugin in the same commit. Never let these files diverge.

---

## Functional parity — equivalent but separate implementation

These concerns must deliver the same user-visible behaviour in both plugins, but the implementation files differ:

| Concern | OpenCode | Claude Code |
|---------|----------|-------------|
| Slash command definition | `opencode-codotchi/commands/codotchi.md` | `claude-codotchi/commands/codotchi.md` |
| Action handling | `opencode-codotchi/src/index.ts` | `claude-codotchi/scripts/action.mjs` |
| Session start hook | `opencode-codotchi/src/index.ts` (plugin `on` handler) | `claude-codotchi/scripts/hook-session-start.mjs` |
| Session stop hook | `opencode-codotchi/src/index.ts` | `claude-codotchi/scripts/hook-stop.mjs` |
| Post-tool hook | `opencode-codotchi/src/index.ts` | `claude-codotchi/scripts/hook-post-tool.mjs` |
| Statusline / display | `opencode-codotchi/src/index.ts` | `claude-codotchi/scripts/statusline.mjs` |
| Pet state management | `opencode-codotchi/src/index.ts` | `claude-codotchi/scripts/state.mjs` |

**When a new action is added:** add it to both `index.ts` and `action.mjs`, and update both `commands/codotchi.md` files.

**When a game mechanic changes** (thresholds, tick rates, stat decay, etc.): the change lives in `gameEngine.ts` (shared) — copy to both plugins automatically.

---

## Architecture differences to account for when porting

### Plugin host

- **OpenCode**: TypeScript plugin loaded via `@opencode-ai/plugin` API. Runs as part of the OpenCode process. Event handlers registered with `on(event, handler)`.
- **Claude Code**: Node.js `.mjs` scripts invoked by Claude Code hooks. Each hook is a separate process invocation. State is read/written via JSON files.

### Slash command response

- **OpenCode**: return a string from the command handler — OpenCode renders it in the session.
- **Claude Code**: write to stdout — Claude Code captures it as the command response.

### State persistence

- **OpenCode**: `statePathResolver.ts` detects and links to the VS Code state file. Falls back to `~/.config/opencode/codotchi-state.json`.
- **Claude Code**: `state.mjs` reads/writes `$CLAUDE_PLUGIN_DATA/codotchi-state.json`. No VS Code state linking.

### Tick loop

- **OpenCode**: `setInterval` inside the plugin process — runs continuously while OpenCode is open.
- **Claude Code**: tick is advanced on every hook invocation (post-tool) — no persistent timer between invocations.

---

## After any change

1. If `gameEngine.ts` or `asciiArt.ts` changed: copy the updated file to the other plugin immediately.
2. If a new action was added: verify both `commands/codotchi.md` files list it, and both action handlers implement it.
3. If a mechanic changed: confirm the behaviour is consistent in both plugins (same caps, same thresholds, same decay rates).
4. Rebuild both plugins:
   - OpenCode: `node scripts/package.js` (from `opencode-codotchi/`)
   - Claude Code: `node scripts/build.js` then `node scripts/package.js` (from `claude-codotchi/`)
5. Commit both sets of changes together.
