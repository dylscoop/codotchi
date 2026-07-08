# Codotchi for OpenCode — User Guide

Meet your new coding buddy! Codotchi is a virtual Tamagotchi-style pet that lives in your OpenCode terminal. It grows up through six life stages, reacts to your coding activity, and keeps you company while you work. It also tracks your AI usage!

This guide covers the **OpenCode terminal edition** (`opencode-codotchi`).

## Prerequisites

Before you start, you'll need:

- **Node.js** (any recent LTS version — 18.x or higher recommended)
- **OpenCode** installed and running ([opencode.ai](https://opencode.ai))

That's it! No git clone, no npm publish, no extra dependencies.

## Installation

### Step 1: Download the ZIP

Message Dylan if you don't have the zip

### Step 2: Extract the archive

**Windows (PowerShell):**
```powershell
Expand-Archive opencode-codotchi-2.8.1.zip
cd opencode-codotchi-2.8.1
```

### Step 3: Run the installer

Both macOS/Linux and Windows use the same command:

```bash
node bin/install.js --install
```

This does three things:

1. **Copies the `/codotchi` slash command** to your OpenCode config directory
   - macOS/Linux: `~/.config/opencode/commands/codotchi.md`
   - Windows: `C:\Users\<you>\.config\opencode\commands\codotchi.md`

2. **Copies the plugin source files** to the global plugin directory
   - `~/.config/opencode/plugins/codotchi.ts`
   - `~/.config/opencode/plugins/gameEngine.ts`
   - `~/.config/opencode/plugins/asciiArt.ts`

3. **Adds the plugin dependency** (`@opencode-ai/plugin`) to your OpenCode config

### Step 4: Open OpenCode

Once installation is complete, open any project in OpenCode. On first startup:

- OpenCode will run `bun install` automatically to fetch the plugin dependency
- Your codotchi will greet you with a speech bubble in the terminal
- Your pet is now active and ready to interact with!

## Features

### ASCII Art Display 🎨
- 6 life stages (Egg → Baby → Child → Teen → Adult → Senior)
  
Toggle the art display on/off with `/codotchi show` and `/codotchi hide`.

### Daily Cost & Token Tracking 💰

As you use OpenCode with integrated LLMs, your codotchi monitors your daily spending and reports your average tokens-per-message usage — a number comparable to the model's context window (e.g. ~300k), rather than an unbounded running total. It speaks in different tones based on cost thresholds:

- **Normal** ($0–$30): cheerful, supportive tone green light
- **Warning** ($30–$50): concerned, suggesting breaks orange light
- **Shouting** ($50+): ALL CAPS alarm red light

You can customize the warning and shout thresholds with `/codotchi warnthreshold` and `/codotchi shoutthreshold`.

### OpenCode-Local Pet 🏠

- **Respawns automatically** after old-age death
- **Keeps evolving** and growing through all stages
- Can be **renamed** with `/codotchi rename <name>`

## Actions — The `/codotchi` Slash Command

Type any of these in your OpenCode terminal:

| Command | What it does |
|---------|-------------|
| `/codotchi` or `/codotchi status` | Show your pet's current stats and ASCII art |
| `/codotchi show` | Enable ASCII art display in every response |
| `/codotchi hide` | Disable ASCII art display |
| `/codotchi rename <name>` | Rename your OpenCode pet (local pet only) |
| `/codotchi warnthreshold <amount>` | Set the daily USD cost for warning tone (default $30) |
| `/codotchi shoutthreshold <amount>` | Set the daily USD cost for shouting (default $50) |
| `/codotchi new_game name=<name> petType=<type>` | Start a fresh pet |
| `/codotchi help` | List all available actions |

## Uninstalling

If you want to remove codotchi from OpenCode:

### macOS/Linux

```bash
rm ~/.config/opencode/commands/codotchi.md
rm ~/.config/opencode/plugins/codotchi.ts
rm ~/.config/opencode/plugins/gameEngine.ts
rm ~/.config/opencode/plugins/asciiArt.ts
```

Then edit `~/.config/opencode/package.json` and remove the line containing `@opencode-ai/plugin`.

### Windows (PowerShell)

```powershell
Remove-Item -LiteralPath "C:\Users\$env:USERNAME\.config\opencode\commands\codotchi.md"
Remove-Item -LiteralPath "C:\Users\$env:USERNAME\.config\opencode\plugins\codotchi.ts"
Remove-Item -LiteralPath "C:\Users\$env:USERNAME\.config\opencode\plugins\gameEngine.ts"
Remove-Item -LiteralPath "C:\Users\$env:USERNAME\.config\opencode\plugins\asciiArt.ts"
```

Then edit `C:\Users\<you>\.config\opencode\package.json` and remove the `@opencode-ai/plugin` dependency.

## Troubleshooting

### Pet won't appear

- Check that OpenCode has restarted after installation
- Run `/codotchi help` to verify the slash command is loaded
- Try `/codotchi status` to check if the pet exists

### Installation failed

- Ensure Node.js is installed: `node --version`
- Check that you extracted the ZIP completely
- Try running the installer again: `node bin/install.js --install`

Enjoy raising your codotchi! 🐣→🐥→🦆→🦅→👑✨
