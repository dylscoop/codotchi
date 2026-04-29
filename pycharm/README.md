# codotchi — JetBrains plugin

Grow and raise your personal virtual pet as a JetBrains plugin while you code.

## Overview

codotchi is a JetBrains plugin that lets you raise a digital pet inspired
by the original [Tamagotchi](https://en.wikipedia.org/wiki/Tamagotchi). Your pet
lives in a tool window panel, reacts to your coding activity, and needs regular
care to survive and evolve into its final form. Any support and feedback is much
appreciated (links at the bottom)!

## Features

- **Tool window pet panel** — pixel art pet with animated sprites, stat bars,
  and action buttons rendered in a JCEF webview
- **Classic Tamagotchi mechanics** — hunger, happiness, discipline, energy,
  health, weight, and age stats, all decaying in real time
- **Full care system** — feed meals and snacks, play mini-games, put pet to
  sleep, clean droppings, give medicine, scold and praise
- **Life cycle & evolution** — egg → baby → child → teen → adult → senior,
  with the final character determined by how well you cared for your pet
- **Pet customisation** — name your pet, choose a pet type, and pick a colour
  palette on first launch
- **Sickness & death** — neglect your pet and it gets sick; leave it untreated
  and it dies
- **OpenCode integration** — your pet lives in the terminal too; use `/codotchi`
  commands to care for it alongside your AI coding session, with shared state
  across VS Code, PyCharm, and OpenCode
- **Status bar integration** — pet name and stage always visible in the IDE
  status bar
- **Persistent state** — pet survives IDE restarts; offline time is accounted
  for with capped stat decay

## Requirements

- JetBrains IDE version **2024.1 or later** (IntelliJ IDEA, PyCharm, WebStorm,
  GoLand, Rider, etc.)
- JCEF must be enabled in your IDE (it is on by default in 2024.1+)

## Installation

See the [GitHub repository](https://github.com/dylscoop/codotchi) for full
installation instructions, pre-built releases, and the OpenCode integration
download.

## Using the plugin

Once installed and the IDE has restarted:

1. Click **Codotchi** in the right-hand tool window bar, or go to
   **View → Tool Windows → Codotchi**.

2. On first launch the **New Codotchi** setup screen appears:
   - Enter a name (up to 16 characters).
   - Choose a **pet type** — each has different stat decay rates.
   - Choose a **colour palette** — affects the sprite's colour scheme.
   - Click **Hatch!**

3. Your pet now lives in the tool window. Care for it using the action buttons:
   **Feed**, **Snack**, **Play**, **Pat**, **Sleep**, **Clean**, **Medicine**,
   **Praise**, and **Scold**.

4. Your pet's state is saved automatically and restored the next time the IDE
   opens. Stat decay while the IDE is closed is capped at 60 % of each maximum
   so a long break won't instantly kill your pet.

5. Your pet's name and current life stage are always visible in the **status
   bar** at the bottom of the IDE window.

## Actions

| Action | What it does |
| ------ | ------------ |
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

| Type        | Tendency                                    |
| ----------- | ------------------------------------------- |
| Codeling    | Balanced across all stats                   |
| Bytebug     | High energy, hunger decays faster           |
| Pixelpup    | High happiness, but happiness decays faster |
| Shellscript | Slow evolver, high base health              |

Each pet animal has its own sprite set

## Settings

Open **Settings → Tools → Codotchi** to configure the plugin.

| Setting | Default | Description |
| ------- | ------- | ----------- |
| Font size | `Normal` | Font size in the tool window panel (`Small` / `Normal` / `Large`). |
| Pet size | `Medium` | Sprite display size (`Small` / `Medium` / `Large`). Large uses a higher-detail 24×32 pixel grid. |
| Reduced motion | `off` | Disable all pet animations; pet is drawn statically. |
| Custom primary colour | `#ff8c00` | Pet body colour for the Custom palette. |
| Custom secondary colour | `#ffffff` | Pet eyes/details colour for the Custom palette. |
| Custom background colour | `#1a1a2e` | Canvas background colour for the Custom palette. |
| Enable attention calls | `on` | Enable attention calls (pet notifies you when it needs care). |
| Attention call expiry | `Standard` | Response window before an attention call expires: `Needy` (2 min) / `Standard` (5 min) / `Chilled` (10 min). |
| Attention call rate | `Fast` | How quickly calls can spawn: `Fast` / `Medium` (1.5×) / `Slow` (2×). |
| Idle threshold (s) | `60` | Seconds of inactivity before idle mode (decay slows to 10 %). |
| Deep idle threshold (s) | `600` | Seconds before deep idle (stats floor at 20, aging stops). |
| AI mode | `off` | Suppress idle-timer resets from document/cursor/tab events — use when an AI agent is editing for you. |
| Idle reset — document change | `on` | Reset idle timer on document edits (suppressed by AI mode). |
| Idle reset — cursor movement | `on` | Reset idle timer on cursor movement (suppressed by AI mode). |
| Idle reset — tab switch | `on` | Reset idle timer on tab switch (suppressed by AI mode). |
| Idle reset — window focus | `on` | Reset idle timer when the IDE regains focus. |
| Idle reset — mouse movement | `on` | Reset idle timer on mouse movement in the tool window (throttled to once per 30 s). |

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
