# Codotchi for Claude Code — Installation Guide

A Tamagotchi-style virtual pet that lives inside **Claude Code**. Your pet
appears in the statusline, reacts to your coding activity, and can be cared
for via the `/codotchi` slash command.

---

## Prerequisites

- **Node.js 18+** on your PATH
- **Claude Code** CLI installed and up to date

Verify Node.js is available:

```bash
node --version   # must show v18.0.0 or higher
```

---

## Installation

Claude Code's plugin system requires interactive `/plugin` commands. Run the
helper script first to get the exact commands for your machine, then paste
them into a Claude Code session.

### Step 1 — Get the install commands

**Windows (PowerShell):**

```powershell
.\install.ps1
```

**macOS / Linux:**

```bash
chmod +x install.sh
./install.sh
```

The script prints two lines like:

```
/plugin marketplace add C:\path\to\claude-codotchi-X.Y.Z
/plugin install claude-codotchi
```

### Step 2 — Run the commands in Claude Code

Open a Claude Code session and paste both commands in order.

### Updating an existing install

If you have a previous version installed, use:

```
/plugin update claude-codotchi
```

---

## What you get

| Feature | Description |
|---------|-------------|
| **Statusline pet** | Multiline ANSI ASCII art renders in the statusline, refreshes every 10 seconds |
| **Coding rewards** | Every file write/edit boosts your pet's happiness and discipline |
| **Session hooks** | Pet greets you on session start and says farewell when the session stops |
| **`/codotchi` slash command** | Control your pet directly from Claude Code |
| **Daily cost tracking** | Pet speech bubble colour reflects today's Claude API spend |

---

## Daily cost tracking

The pet's speech bubble colour reflects your Claude API spend today:

| Spend | Colour | Tone |
|-------|--------|------|
| Below warn threshold | Green | Cheerful |
| Warn → shout threshold | Yellow | Concerned |
| Above shout threshold | Red | ALL CAPS alarm |

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

## Source

This plugin is part of the [codotchi](https://github.com/dsiowlee/ai_usage_codotchi) project.
