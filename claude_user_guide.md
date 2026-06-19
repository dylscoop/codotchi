# Codotchi for Claude Code — User Guide

A Tamagotchi-style virtual pet that lives inside **Claude Code**. Your pet
appears in the statusline, reacts to your coding activity, and can be cared
for via the `/codotchi` slash command.

---

## Prerequisites

- **Node.js 18+** on your PATH (required to run the plugin scripts)
- **Claude Code** CLI installed and up to date

Verify Node.js is available:

```bash
node --version   # must show v18.0.0 or higher
```

---

## Installation

### Option A — Local install (from this repository)

Use this if you have the repo cloned locally.

In a Claude Code session, run:

```
/plugin marketplace add C:\personal_repos\codotchi
/plugin install claude-codotchi
```

Or on macOS / Linux:

```
/plugin marketplace add /path/to/codotchi
/plugin install claude-codotchi
```

### Option B — From GitHub (once merged to main)

```
/plugin marketplace add dylscoop/codotchi
/plugin install claude-codotchi
```

### What happens during install

Claude Code copies the `claude-codotchi/` directory to its plugin cache,
activates the statusline script, registers the event hooks, and makes the
`/codotchi` slash command available.

---

## What you get

| Feature | Description |
|---------|-------------|
| **Statusline pet** | Multiline ANSI ASCII art renders in the statusline and refreshes every 10 seconds |
| **Coding rewards** | Every file write / edit boosts your pet's happiness and discipline (throttled to once per 10 s) |
| **Session hooks** | Pet greets you on session start and says farewell when the session stops |
| **Slash command** | `/codotchi <action>` for all care actions |
| **Daily cost tracking** | Pet speech bubble colour reflects today's Claude API spend |

---

## Actions — `/codotchi`

| Action | Description |
|--------|-------------|
| `/codotchi` or `/codotchi status` | Show the pet's current ASCII art and full stats |
| `/codotchi feed` | Give a meal — restores hunger (max 3 meals per wake cycle) |
| `/codotchi pat` | Pat the pet — gentle happiness boost |
| `/codotchi sleep` | Put the pet to sleep — energy regenerates 3× faster while sleeping |
| `/codotchi wake` | Wake the pet up |
| `/codotchi clean` | Remove droppings — improves mood and cleanliness |
| `/codotchi medicine` | Give medicine — takes 3 doses to cure sickness |
| `/codotchi on` | Enable ASCII art in the statusline (default: on) |
| `/codotchi off` | Disable ASCII art — shows plain text stats instead |
| `/codotchi rename <name>` | Rename your Claude Code pet |
| `/codotchi warnthreshold <amount>` | Set the daily USD spend at which the pet speaks in a warning tone (default: $30) |
| `/codotchi shoutthreshold <amount>` | Set the daily USD spend at which the pet shouts in ALL CAPS (default: $50) |
| `/codotchi help` | Show this action list |

---

## Daily cost tracking

The pet's speech bubble colour reflects how much you've spent on Claude API
calls today (UTC day):

| Spend | Bubble colour | Tone |
|-------|--------------|------|
| Below warn threshold | Green | Cheerful |
| Warn → shout threshold | Yellow | Concerned |
| Above shout threshold | Red | ALL CAPS alarm |

Default thresholds: **$30 warn / $50 shout**. Change them any time:

```
/codotchi warnthreshold 20
/codotchi shoutthreshold 40
```

---

## Pet state location

State is stored in a persistent data directory that survives plugin updates:

| Platform | Path |
|----------|------|
| Windows | `%CLAUDE_PLUGIN_DATA%\codotchi-state.json` |
| macOS / Linux | `$CLAUDE_PLUGIN_DATA/codotchi-state.json` |
| Outside Claude Code (testing) | `~/.codotchi/claude/codotchi-state.json` |

Additional files in the same directory:
- `codotchi-daily.json` — daily cost accumulator (UTC-date keyed)
- `codotchi-config.json` — thresholds and display toggle

---

## Uninstalling

```
/plugin disable claude-codotchi
```

To remove entirely:

```
/plugin uninstall claude-codotchi
```

---

## Building from source

If you want to modify the plugin or rebuild after pulling changes:

```bash
cd claude-codotchi
npm install          # one-time: installs TypeScript compiler
node scripts/build.js  # compiles src/ → dist/
```

The `dist/` directory must exist before any scripts run. The compiled files
(`gameEngine.js`, `asciiArt.js`) are shared by the statusline, hooks, and
action scripts.

---

## Troubleshooting

### Pet won't appear in the statusline

1. Check that `dist/` exists in the plugin directory:
   ```bash
   ls claude-codotchi/dist/
   # must show gameEngine.js and asciiArt.js
   ```
2. If missing, rebuild: `cd claude-codotchi && node scripts/build.js`
3. Check Node.js is on PATH: `node --version`
4. Restart Claude Code after rebuilding.

### Plugin not found during install

Ensure `marketplace.json` is at the **repo root** (`.claude-plugin/marketplace.json`),
not inside `claude-codotchi/`. Run:

```bash
ls .claude-plugin/
# must show marketplace.json
```

### `/codotchi` command not available

The slash command requires the plugin to be installed and enabled. Run
`/plugin list` to confirm `claude-codotchi` appears as enabled.

### Pet state looks wrong after updating the plugin

State files are backward-compatible. If you see unexpected behaviour, delete
the state file to start fresh:

```bash
# Windows
del "%CLAUDE_PLUGIN_DATA%\codotchi-state.json"

# macOS / Linux
rm "$CLAUDE_PLUGIN_DATA/codotchi-state.json"
```
