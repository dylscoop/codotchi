# Codotchi for OpenCode — User Guide

Meet your new coding buddy! Codotchi is a virtual Tamagotchi-style pet that lives in your OpenCode terminal. It grows up through six life stages, reacts to your coding activity, and keeps you company while you work. Feed it, play with it, keep it healthy — and watch it evolve!

This guide covers the **OpenCode terminal edition** (`opencode-codotchi`). If you're using VS Code or PyCharm, see the main [README](https://github.com/dylscoop/codotchi).

## Prerequisites

Before you start, you'll need:

- **Node.js** (any recent LTS version — 18.x or higher recommended)
- **OpenCode** installed and running ([opencode.ai](https://opencode.ai))

That's it! No git clone, no npm publish, no extra dependencies.

## Installation

### Step 1: Download the ZIP

Download `opencode-codotchi-2.8.1.zip` from the [GitHub Releases page](https://github.com/dylscoop/codotchi/releases).

### Step 2: Extract the archive

**macOS / Linux:**
```bash
unzip opencode-codotchi-2.8.1.zip
cd opencode-codotchi-2.8.1
```

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

### Always-On Pet 🐾

Your codotchi runs in the background with a **6-second tick cycle**. It gets hungry, happy, tired, and restless just like a real Tamagotchi. Stats decay over time, and you'll need to care for it to keep it alive and healthy.

### Reacts to Your Coding

The pet watches what you do:

- **File save** → +5 happiness, +2 discipline
- **Git commit** → +15 happiness, +2 discipline
- **Idle detection** → decay slows down after 1 minute of inactivity
- **Deep idle** → after 10 minutes, hunger and happiness nearly stop decaying

This means the more you code, the happier your pet gets. Periods of inactivity are forgiven — your pet doesn't starve while you're in a meeting.

### ASCII Art Display 🎨

Your pet is rendered in **30 unique ASCII frames**:
- 6 life stages (Egg → Baby → Child → Teen → Adult → Senior)
- 5 mood states (happy, neutral, hungry, sleepy, sick)
- ANSI-coloured speech bubbles with thoughts and status updates
- Health, hunger, happiness, energy, and weight bars

Toggle the art display on/off with `/codotchi show` and `/codotchi hide`.

### Daily Cost & Token Tracking 💰

As you use OpenCode with integrated LLMs, your codotchi monitors your daily spending and token usage. It speaks in different tones based on cost thresholds:

- **Normal** ($0–$30): cheerful, supportive tone
- **Warning** ($30–$50): concerned, suggesting breaks
- **Shouting** ($50+): ALL CAPS alarm
- **Critical** (highest): desperate pleas

You can customize the warning and shout thresholds with `/codotchi warnthreshold` and `/codotchi shoutthreshold`.

### Cross-IDE Shared State 🔗

The same pet appears whether you open OpenCode, VS Code, or PyCharm. All three share a central state file:

- **macOS/Linux**: `~/.config/gotchi/state.json`
- **Windows**: `C:\Users\<you>\AppData\Roaming\codotchi\vscode\state.json`

Your pet's age, evolution, and memories carry across every IDE seamlessly.

### OpenCode-Local Pet 🏠

If no VS Code or PyCharm window is open with the codotchi extension, OpenCode spawns its own pet (called "Copilot" by default). This pet:

- **Cannot die from neglect** — health is floored at 1
- **Respawns automatically** after old-age death
- **Keeps evolving** and growing through all stages
- Can be **renamed** with `/codotchi rename <name>`

## Actions — The `/codotchi` Slash Command

Type any of these in your OpenCode terminal:

| Command | What it does |
|---------|-------------|
| `/codotchi` or `/codotchi status` | Show your pet's current stats and ASCII art |
| `/codotchi feed` | Give a meal (Hunger +20, Weight +2) |
| `/codotchi snack` | Give a snack (Happiness +10, Hunger +5) |
| `/codotchi play` | Play a minigame (Happiness +15, Energy −25) |
| `/codotchi pat` | Gently pat your pet (Happiness +10, Energy −20) |
| `/codotchi sleep` | Put your pet to sleep (restores Energy) |
| `/codotchi wake` | Wake your pet up |
| `/codotchi clean` | Clean up droppings (prevents sickness) |
| `/codotchi medicine` | Give medicine (3 doses cure sickness) |
| `/codotchi show` | Enable ASCII art display in every response |
| `/codotchi hide` | Disable ASCII art display |
| `/codotchi rename <name>` | Rename your OpenCode pet (local pet only) |
| `/codotchi warnthreshold <amount>` | Set the daily USD cost for warning tone (default $30) |
| `/codotchi shoutthreshold <amount>` | Set the daily USD cost for shouting (default $50) |
| `/codotchi new_game name=<name> petType=<type>` | Start a fresh pet |
| `/codotchi help` | List all available actions |

### Minigames

When you play with your pet, it picks a random minigame:

- **Left or Right** — Your pet hides behind one of two doors; guess correctly 3 times in a row
- **Higher or Lower** — Predict whether the next number (1–100) is higher or lower
- **Coin Flip** — Simple 50/50 heads or tails

More games (Simon says, bug catching, code typing) are planned for future releases!

## Pet Types

When you start a new game, choose one of four pet types. Each has unique growth and behavior:

| Type | Tendency | Speed |
|------|----------|-------|
| **Codeling** | Balanced all-rounder | Normal (1×) |
| **Bytebug** | Faster hunger decay, quick energy recovery | Fast (1.5×) |
| **Pixelpup** | Faster happiness decay, needs more affection | Fast (1.25×) |
| **Shellscript** | Slow hunger, strong health, calm demeanor | Slow (0.75×) |

Start with `Codeling` if you're new to Tamagotchi!

## Life Stages

Your pet grows through six stages:

1. **Egg** — Auto-hatches after a timer
2. **Baby** — Tiny, pudgy blob
3. **Child** — Legs appear, more interactive
4. **Teen** — Two evolution variants (good care vs neglected)
5. **Adult** — Peak form with up to 3 variants based on overall care quality
6. **Senior** — Graceful old age; eligible for natural death after 365+ game days

Evolution is driven by your **care score**:
- ≥ 0.80 care score → evolves to the `_a` (best) tier
- ≥ 0.55 → evolves to the `_b` (mid) tier
- < 0.55 → evolves to the `_c` (neglected) tier

Perfect care (0 mistakes + ≥ 0.95 score) → secret best tier  
Many care mistakes → secret worst tier

## Keeping Your Pet Healthy 💚

### The Big Four Stats

| Stat | Range | What happens |
|------|-------|-------------|
| **Hunger** | 0–100 | Decays over time; below 25 = pet calls for food |
| **Happiness** | 0–100 | Decays when ignored; below 40 = demands play |
| **Energy** | 0–100 | Used by play and patting; restored by sleep |
| **Health** | 0–100 | Drops from starvation, sickness, or neglect; 0 = death |

### Daily Care Tips

1. **Feed regularly** — Don't let hunger drop below 25. Use `/codotchi feed` for meals.
2. **Play often** — Make your pet happy! Use `/codotchi play` (requires Energy ≥ 25).
3. **Let it sleep** — When energy is low, use `/codotchi sleep` to recharge.
4. **Clean droppings** — Poop accumulation causes sickness. Use `/codotchi clean`.
5. **Give medicine** — If your pet gets sick, give 3 doses of medicine with `/codotchi medicine`.
6. **Snacks sparingly** — Snacks bring quick happiness but too many (3 in a row) make your pet sick.

### Idle Periods are Forgiving

- **After 1 minute idle** → decay slows to 10% of normal
- **After 10 minutes idle** → hunger and happiness are nearly frozen
- **When you return** → full decay resumes immediately

This means you can step away without guilt. Your pet won't starve during a lunch break!

## Sprite Types & Custom Characters

Your pet randomly appears as one of **8 sprite types**:
- cat, dog (Shiba Inu), snake, sheep, rooster, tiger, kangaroo, classic

You can unlock **custom characters** by entering special passcodes:
- `teawtim` → Tim (tea-themed)
- `straya` → Skippy (kangaroo)
- `shiba` → Shibagotchi (Shiba Inu pixel art)
- `rubylovessalmon` → Stu (Scottish, loves salmon)

Each custom character has unique snacks and personality quirks!

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

### Pet keeps dying

- Feed it before hunger hits 0
- Let it sleep when energy is low
- Play with it to boost happiness

### Installation failed

- Ensure Node.js is installed: `node --version`
- Check that you extracted the ZIP completely
- Try running the installer again: `node bin/install.js --install`

### Cross-IDE sync not working

- Ensure all three IDEs (VS Code, PyCharm, OpenCode) have the latest plugin version
- The state file should be in `~/.config/gotchi/` (macOS/Linux) or `AppData/Roaming/codotchi/` (Windows)
- Manual sync: close all IDEs, edit the state file, then reopen

## Support & Links

- **GitHub repository**: [github.com/dylscoop/codotchi](https://github.com/dylscoop/codotchi)
- **Report bugs or request features**: [GitHub Issues](https://github.com/dylscoop/codotchi/issues)
- **Want a new sprite?** Open a [sprite request](https://github.com/dylscoop/codotchi/issues) — you'll get a passcode!

## Sponsor This Project

If you love your codotchi, consider supporting the developer:

- **Buy Me a Coffee**: [buymeacoffee.com/dylscoop](https://buymeacoffee.com/dylscoop)
- **Liberapay**: [liberapay.com/dylscoop](https://liberapay.com/dylscoop)

---

Enjoy raising your codotchi! 🐣→🐥→🦆→🦅→👑✨
