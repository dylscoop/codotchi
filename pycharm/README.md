# pycharm_gotchi

Grow and raise your personal virtual pet as a JetBrains plugin while you code.

## Overview

pycharm_gotchi is a plugin for JetBrains IDEs (PyCharm, IntelliJ IDEA, and any
other IDE built on the IntelliJ Platform) that lets you raise a digital pet
inspired by the original [Tamagotchi](https://en.wikipedia.org/wiki/Tamagotchi).
Your pet lives in a tool window panel, reacts to your coding activity, and needs
regular care to survive and evolve into its final form.

It shares the same game engine and webview UI as the
[VS Code extension](../vscode/README.md) in this repository.

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
- **Coding activity rewards** — every file save makes your pet a little happier
- **Status bar integration** — pet name and stage always visible in the IDE
  status bar
- **Persistent state** — pet survives IDE restarts; offline time is accounted
  for with capped stat decay

## Requirements

- JetBrains IDE version **2024.1 or later** (IntelliJ IDEA, PyCharm, WebStorm,
  GoLand, Rider, etc.)
- JCEF must be enabled in your IDE (it is on by default in 2024.1+)

## Installation

### Quick install (pre-built `.zip`)

1. **Download `pycharm-gotchi-0.6.2.zip`** from the
   [Releases page](https://github.com/dylscoop/vscode_gotchi/releases).
   Do **not** unzip it — JetBrains expects the archive as-is.

2. **Install from disk:**
   - Open **Settings / Preferences** → **Plugins**
     (`Ctrl+Alt+S` → Plugins, or `Cmd+,` → Plugins on macOS)
   - Click the **gear icon** (⚙) → **Install Plugin from Disk…**
   - Select the downloaded `.zip` file
   - Click **OK**

3. **Restart the IDE** when prompted. The **Gotchi** tool window appears in
   the right-hand tool window bar.

### Build from source

You need a JDK 17+ on your PATH (or the JBR bundled with your JetBrains IDE).

```bash
git clone https://github.com/dylscoop/vscode_gotchi.git
cd vscode_gotchi/pycharm

# On macOS / Linux
./gradlew buildPlugin

# On Windows
gradlew.bat buildPlugin
```

The plugin zip is produced at:

```text
pycharm/build/distributions/pycharm-gotchi-0.6.2.zip
```

Install it via **Settings → Plugins → ⚙ → Install Plugin from Disk…** as
described above.

> **Note for Windows users:** if your system JDK is not Java 17+, point Gradle
> at the JBR bundled with your IDE:
>
> ```bat
>    set "JAVA_HOME=C:\Users\<you>\AppData\Local\Programs\<IDE>\jbr"
> gradlew.bat buildPlugin
> ```

## Using the plugin

Once installed and the IDE has restarted:

1. Click **Gotchi** in the right-hand tool window bar, or go to
   **View → Tool Windows → Gotchi**.

2. On first launch the **New Gotchi** setup screen appears:
   - Enter a name (up to 16 characters).
   - Choose a **pet type** — each has different stat decay rates.
   - Choose a **colour palette** — affects the sprite's colour scheme.
   - Click **Hatch!**

3. Your pet now lives in the tool window. Care for it using the action buttons:
   **Feed**, **Snack**, **Play**, **Sleep**, **Clean**, **Medicine**,
   **Praise**, and **Scold**.

4. Every file you save gives your pet a happiness boost — keep coding to keep
   it happy.

5. Your pet's state is saved automatically and restored the next time the IDE
   opens. Stat decay while the IDE is closed is capped at 60 % of each maximum
   so a long break won't instantly kill your pet.

6. Your pet's name and current life stage are always visible in the **status
   bar** at the bottom of the IDE window.

## Actions

| Action | What it does |
| ------ | ------------ |
| **Feed** | Gives your pet a full meal. Restores a large chunk of hunger. Limited to 4 meals per wake cycle — overfeeding past that has no effect. |
| **Snack** | Gives a small treat. Boosts happiness instead of hunger, but adds more weight. More than 3 snacks in a row will make your pet sick. |
| **Play** | Starts a mini-game. Winning boosts happiness significantly; even losing gives a small consolation boost. Costs energy — your pet can't play if exhausted. |
| **Sleep** | Puts your pet to sleep. Energy slowly regenerates while it sleeps; no other actions are possible until it wakes. Wake it manually or wait for full energy. |
| **Clean** | Clears all droppings. Pets produce droppings over time. Leaving 3 or more uncleaned will make your pet sick. |
| **Medicine** | Treats sickness. Requires 3 doses to fully cure. Restores a small amount of health per dose. |
| **Praise** | Rewards good behaviour. Raises the discipline stat, which contributes to a better care score and a higher-tier evolution. |
| **Scold** | Corrects bad behaviour. Also raises discipline. |

> **Tip:** keep all four stat bars (Hunger, Happy, Energy, Health) out of the
> red to maximise your care score, which determines which character your pet
> evolves into at each life stage.

## Pet Types

| Type        | Tendency                                    |
| ----------- | ------------------------------------------- |
| Codeling    | Balanced across all stats                   |
| Bytebug     | High energy, hunger decays faster           |
| Pixelpup    | High happiness, but happiness decays faster |
| Shellscript | Slow evolver, high base health              |

## Architecture

| Layer | Technology | Responsibility |
| ----- | ---------- | -------------- |
| Plugin host | Kotlin | IntelliJ Platform API, tick scheduler, state machine, persistence, event hooks |
| Webview UI | JCEF (HTML / CSS / JS) | Tool window rendering, action buttons, sprite canvas |

The game logic (stat decay, evolution, poop intervals, sickness, death) is
implemented in `engine/GameEngine.kt` and is a direct port of the TypeScript
game engine in the VS Code extension. The webview files (`sidebar.html`,
`sidebar.css`, `sidebar.js`) are shared between both IDEs; a small shim
injected at runtime maps `acquireVsCodeApi().postMessage` to the JCEF
JS-query bridge.

## Project Structure

```text
vscode_gotchi/
├── vscode/                      ← VS Code extension (TypeScript)
└── pycharm/                     ← JetBrains plugin (this package)
    ├── build.gradle.kts
    ├── gradle.properties
    ├── src/main/
    │   ├── kotlin/com/gotchi/
    │   │   ├── engine/          # Kotlin game engine (GameEngine.kt, PetState.kt, …)
    │   │   ├── GotchiPlugin.kt          # Central service: tick loop + command dispatch
    │   │   ├── GotchiBrowserPanel.kt    # JCEF webview + JS bridge
    │   │   ├── GotchiToolWindow.kt      # Tool window factory
    │   │   ├── GotchiStatusWidget.kt    # Status bar widget
    │   │   ├── GotchiPersistence.kt     # Save / load via PropertiesComponent
    │   │   ├── GotchiEventsManager.kt   # File-save → happiness reward
    │   │   └── GotchiAppLifecycleListener.kt
    │   └── resources/
    │       ├── META-INF/plugin.xml
    │       └── webview/         # sidebar.html / .css / .js (shared with VS Code)
    └── build/distributions/
        └── pycharm-gotchi-0.6.2.zip     ← installable plugin archive
```
