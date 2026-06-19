---
name: install-claude-codotchi
description: >
  Rebuild and reinstall the claude-codotchi Claude Code plugin globally.
  Apply whenever source files under claude-codotchi/src/, claude-codotchi/scripts/,
  or claude-codotchi/.claude-plugin/ change and the running plugin needs updating.
---

## When to apply

Apply this skill whenever:
- `src/asciiArt.ts` or `src/gameEngine.ts` are modified (TypeScript recompile required)
- Any `scripts/*.mjs` file is modified (no compile needed, but reinstall required)
- `.claude-plugin/plugin.json` version is bumped
- The user says "reinstall the plugin", "rebuild the plugin", or "update the plugin"

---

## Step 1 — Bump the version

Both files must stay in sync (update both every time):

| File | Field |
|------|-------|
| `claude-codotchi/.claude-plugin/plugin.json` | `"version"` |
| `claude-codotchi/package.json` | `"version"` |

Version bump rule: patch bump (e.g. 2.9.3 → 2.9.4) for any script or config change; minor bump for new features.

---

## Step 2 — Build TypeScript (only when src/ changed)

Run from the `claude-codotchi/` directory:

```powershell
cd claude-codotchi; npx tsc
```

Outputs: `dist/gameEngine.js`, `dist/asciiArt.js` (and `.d.ts` + `.map` files).

Skip this step if only `scripts/*.mjs` or `.claude-plugin/plugin.json` changed.

---

## Step 3 — Register marketplace and install (user runs these)

These are Claude Code interactive commands — they cannot be run from a shell script. Tell the user to type them in Claude Code:

```
/plugin marketplace add C:\personal_repos\codotchi
/plugin install claude-codotchi
```

If the marketplace is already registered, only the second command is needed. If updating an existing install, use:

```
/plugin update claude-codotchi
```

---

## Step 4 — Verify

After install:
1. Run `/codotchi status` — the speech bubble should appear with daily cost + token count and a 🟢/🟡/🔴 tier emoji
2. Check that `~/.codotchi-debug.json` is NOT being written every 10 seconds (debug lines must be absent)
3. Confirm `~/.claude/settings.json` → `enabledPlugins` lists `claude-codotchi`

---

## Traffic light thresholds (reference)

| Tier | Condition | Bubble | Suffix style |
|------|-----------|--------|-------------|
| 🟢 Normal | cost < `warnThreshold` (default $30) | Green | `"$X.XX and 22.6M tokens today."` |
| 🟡 Warning | cost >= `warnThreshold` | Yellow | `"⚠️ $X.XX today — getting spendy."` |
| 🔴 Shout | cost >= `shoutThreshold` (default $50) | Red | `"🚨 $X.XX TODAY — CHECK YOUR USAGE!"` (all-caps) |

User-configurable via `/codotchi warnthreshold <n>` and `/codotchi shoutthreshold <n>`.
