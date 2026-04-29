# codotchi — VS Code extension

<img src="media/icon.svg" width="64" height="64" alt="Codotchi icon" />

Grow and raise your personal virtual pet as a VS Code extension while you code.

## Overview

codotchi is a VS Code extension that lets you raise a digital pet inspired
by the original [Tamagotchi](https://en.wikipedia.org/wiki/Tamagotchi). Your pet
lives in a sidebar panel, reacts to your coding activity, and needs regular care
to survive and evolve into its final form. Any support and feedback is much appreciated
(links at the bottom)!

Your pet is drawn from one of **14 sprite sets**, each based on a zodiac animal,
assigned to you at random when you start a new game.

## Features

- **Sidebar pet panel** — pixel art pet with animated sprites, stat bars, and
  action buttons, all rendered in a dedicated sidebar webview
- **Classic Tamagotchi mechanics** — hunger, happiness, discipline, energy,
  health, weight, and age stats, all decaying in real time
- **Full care system** — feed meals and snacks, play mini-games, put pet to
  sleep, clean droppings, give medicine, scold and praise
- **Life cycle & evolution** — egg → baby → child → teen → adult → senior, with
  the final character determined by how well you cared for your pet
- **Pet customization** — name your pet, choose a pet type, and pick a color
  palette on first launch
- **Sickness & death** — neglect your pet and it gets sick; leave it untreated
  and it dies
- **OpenCode integration** — your pet lives in the terminal too; use `/codotchi`
  commands to care for it alongside your AI coding session, with shared state
  across VS Code, PyCharm, and OpenCode
- **Status bar integration** — pet name and mood always visible in the VS Code
  status bar; click to open the sidebar
- **Persistent state** — pet survives VS Code restarts; offline time is
  accounted for with capped stat decay
- **Configurable** — customise font size, pet size, colours, idle thresholds,
  attention call behaviour, and more via **Settings → Extensions → codotchi**

## Installation

See the [GitHub repository](https://github.com/dylscoop/codotchi) for full
installation instructions, pre-built releases, and the OpenCode integration
download.

## Using the extension

Once installed and VS Code has reloaded:

1. Click the **icon** in the activity bar (left sidebar) to open the **Your
   Pet** panel. Alternatively, run **Codotchi: Open Pet Panel** from the command
   palette (`Ctrl+Shift+P` / `Cmd+Shift+P`).

2. On first launch the **New Codotchi** setup screen appears:
   - Enter a name (up to 16 characters).
   - Choose a **pet type** — each has different stat decay rates.
   - Choose a **colour palette** — affects the sprite's colour scheme.
   - Click **Hatch!**

3. Your pet now lives in the sidebar. Care for it using the action buttons:
   **Feed**, **Snack**, **Play**, **Pat**, **Sleep**, **Clean**, **Medicine**,
   **Praise**, and **Scold**.

4. Your pet's state is saved automatically and restored the next time VS Code
   opens. Stat decay while VS Code is closed is capped at 60 % of each
   maximum so a long break won't instantly kill your pet.

5. Your pet's name and current mood are always visible in the **status bar**
   at the bottom of VS Code.

## Actions

| Action | What it does |
| ------ | ----------- |
| **Feed** | Gives your pet a full meal. Restores a large chunk of hunger. Limited to 3 meals per wake cycle — overfeeding past that has no effect. |
| **Snack** | Gives a small treat. Boosts happiness instead of hunger, but adds more weight. More than 3 snacks in a row will make your pet sick. |
| **Play** | Opens the mini-game picker. Choose Left / Right, Higher or Lower, or Coin Flip. Winning gives +15–25 happiness; losing applies a −5 penalty. Costs 25 energy — your pet can't play if exhausted. |
| **Pat** | Gives your pet a gentle pat. Boosts happiness by +10. Costs 20 energy. Accessed via the Play menu (same overlay as the mini-games). Cannot be used while your pet is sleeping or exhausted. |
| **Sleep** | Puts your pet to sleep. Energy slowly regenerates while it sleeps and your pet cannot take any other actions. Wake it manually or wait for full energy. |
| **Clean** | Clears all droppings from the screen. Pets produce droppings roughly every 20 minutes. Leaving 3 or more uncleaned will make your pet sick. |
| **Medicine** | Treats sickness. Requires 3 doses to fully cure. Restores a small amount of health per dose. Use it as soon as your pet falls ill to prevent health loss. |
| **Praise** | Rewards good behaviour. Raises the discipline stat, which contributes to a better care score and a higher-tier evolution. |
| **Scold** | Corrects bad behaviour. Also raises discipline. Use it when your pet misbehaves rather than at random, as it has no direct stat benefit beyond discipline. |

> **Tip:** keep all four stat bars (Hunger, Happy, Energy, Health) out of the
> red to maximise your care score, which determines which character your pet
> evolves into at each life stage.

## Mini-games

Clicking **Play** opens the game picker (requires 25 energy). Three games are
available:

| Game | How to win |
|------|-----------|
| **Left / Right** | 3 rounds. The pet hides behind one of two doors. You have 3 seconds per round to pick the correct door. Win 2 out of 3 rounds to win. |
| **Higher or Lower** | 5 rounds. A number is shown (1–100). Guess whether the next number will be higher or lower. Get 4 out of 5 correct to win. |
| **Coin Flip** | Call Heads or Tails. A single coin flip decides the outcome. |

## Pet Types

| Type        | Tendency                                   |
| ----------- | ------------------------------------------ |
| Codeling    | Balanced across all stats                  |
| Bytebug     | High energy, hunger decays faster          |
| Pixelpup    | High happiness, but happiness decays faster|
| Shellscript | Slow evolver, high base health             |

Each pet animal has its own sprite set

---

> "Grow your best pet by writing your best code."

---

## Support

**GitHub:** [github.com/dylscoop/codotchi](https://github.com/dylscoop/codotchi)

### Sponsor this project

<a href="https://buymeacoffee.com/dylscoop"><img src="../bmc_qr.png" width="120" alt="Buy Me a Coffee QR code"></a>

[buymeacoffee.com/dylscoop](https://buymeacoffee.com/dylscoop)

[![Liberapay](https://img.shields.io/badge/Liberapay-dylscoop-yellow)](https://liberapay.com/dylscoop)

[liberapay.com/dylscoop](https://liberapay.com/dylscoop)

### Codotchi Sprites

Want to see a new sprite in the game? Send a drawn sprite or request one to be added — a passcode will be given every time one gets implemented.

[Open a sprite request on GitHub Issues](https://github.com/dylscoop/codotchi/issues)

---