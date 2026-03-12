# Version History

## v0.0.4 — current (branch `bugfix/small_fixes`)

### Changes from v0.0.3

| File | What changed |
|------|-------------|
| `vscode/src/gameEngine.ts` | `FEED_SNACK_HUNGER_BOOST = 5` added — snacks now also raise hunger by 5; `MEDICINE_HEALTH_BOOST` removed — `giveMedicine()` no longer modifies health (still cures after 3 doses); `PLAY_ENERGY_COST` raised from `10` → `25`; `ENERGY_DECAY_PER_TICK = 1` added — energy drains 1/tick while awake; `HEALTH_REGEN_AWAKE_TICK_INTERVAL = 5` added — health regens 1 HP/tick while sleeping but only 1 HP every 5 ticks while awake |
| `vscode/src/extension.ts` | Status bar click command changed from `workbench.view.extension.gotchi-sidebar` to `gotchiView.focus` so clicking it reliably focuses the panel (BUGFIX-005) |
| `vscode/media/sidebar.js` | Persistent pixel-art poo sprites drawn on canvas floor in `drawSprite()` — up to 3 brown 12×14 px poos spread across the canvas base; disappear when `state.poops` returns to 0 |
| `vscode/tsconfig.json` | Added `"typeRoots": ["./node_modules/@types"]` to prevent root `node_modules/@types/katex` bleed (BUGFIX-006) |
| `vscode/tests/unit/gameEngine.test.ts` | Updated 5 tests to match new engine behaviour: play energy cost (10 → 25), medicine no longer boosts health, sleeping-while-full-energy auto-wake interaction |

### New constants (v0.0.4)

```ts
FEED_SNACK_HUNGER_BOOST: number = 5       // hunger gained per snack
PLAY_ENERGY_COST: number        = 25       // was 10
ENERGY_DECAY_PER_TICK: number   = 1        // passive energy drain while awake
HEALTH_REGEN_AWAKE_TICK_INTERVAL: number = 5  // ticks between awake regen pulses
```

### Removed constants (v0.0.4)

```ts
MEDICINE_HEALTH_BOOST  // medicine no longer changes health directly
```

---

## v0.0.3

### Changes from v0.0.2

| File | What changed |
|------|-------------|
| `vscode/media/sidebar.css` | Health bar uses `width %` instead of `scaleX`; distinct colours `#ff9800` (mid) / `#e53935` (low); `color: var(--vscode-foreground, #cccccc)` fallback for dark mode; `.sprite-container { position: relative }` for poo overlay; `.poo-anim` + `@keyframes poo-float` animation |
| `vscode/media/sidebar.js` | `spawnPooAnim()` — pixel-art turd canvas (6×7 px art, scale ×3, `#6B3A2A` / `#A0522D`); triggered when `"pooped"` in `state.events` |
| `vscode/src/gameEngine.ts` | Fix: advance poop counter during offline decay (`applyOfflineDecay`) |
| `pycharm/` | **New**: full PyCharm/IntelliJ JCEF plugin (Kotlin). Mirrors all VS Code game logic and webview. Includes `GotchiPlugin`, `GotchiBrowserPanel`, `GotchiPersistence`, `GotchiToolWindow`, `GotchiStatusWidget`, `GotchiEventsManager`, `GotchiAppLifecycleListener`, `GameEngine`, `PetState`, `Constants` |
| `pycharm/src/main/kotlin/.../GotchiSettings.kt` | **New**: app service — persists `fontSize` and `textColor` to `gotchi_settings.xml` |
| `pycharm/src/main/kotlin/.../GotchiConfigurable.kt` | **New**: `Settings > Tools > Gotchi` — `JComboBox` (Small/Normal/Large) + `ColorPanel`; calls `reloadWebview()` on Apply |
| `pycharm/src/main/resources/webview/sidebar.css` | Port of all VS Code CSS fixes above + PyCharm-specific dark mode + poo animation |
| `pycharm/src/main/resources/webview/sidebar.js` | Port of all VS Code JS fixes above including `spawnPooAnim()` |

---

## v0.0.2 — (commit `7ee39a6`)

### Changes from v0.0.1

| File | What changed |
|------|-------------|
| `vscode/src/gameEngine.ts` | BUGFIX-003 (auto-wake when energy reaches 100); BUGFIX-004 (passive +1 health regen per tick when not sick); per-pet-type stochastic poop rate (`nextPoopIntervalTicks`, `poopIntervalMultiplier`, `poopIntervalVolatility`, `sampleNextPoopInterval`) |
| `vscode/src/sidebarProvider.ts` | BUGFIX-001 (hot-reload webview HTML on `fontSize` setting change via `onDidChangeConfiguration`); BUGFIX-002 (server-side sleep-blocking guard in `handleWebviewMessage`) |
| `vscode/media/sidebar.js` | BUGFIX-002 (disable care buttons while pet is sleeping); `setHealthBar()` helper for colour-coded health bar |
| `vscode/media/sidebar.css` | BUGFIX-002 (`.action-btn:disabled` style); health bar colour classes (`.health-mid`, `.health-low`) |

### New `PetState` fields (v0.0.2 only)

```ts
nextPoopIntervalTicks: number   // ticks until next dropping (stochastically sampled)
```

### New `PetTypeModifiers` fields (v0.0.2 only)

```ts
poopIntervalMultiplier: number  // scales base poop interval per pet type
poopIntervalVolatility: number  // ± fraction of variance around the mean interval
```

---

## v0.0.1 — baseline (commit `e25ac0e`)

Initial TypeScript rewrite. All game logic ported from the retired Python
subprocess architecture into `gameEngine.ts` as pure functions. VS Code
extension wired up via `extension.ts`, `sidebarProvider.ts`, `statusBar.ts`,
`persistence.ts`, and `events.ts`.

Archive of the four files that changed in v0.0.2 is preserved at:

```text
archive/v0.0.1/vscode/src/gameEngine.ts
archive/v0.0.1/vscode/src/sidebarProvider.ts
archive/v0.0.1/vscode/media/sidebar.js
archive/v0.0.1/vscode/media/sidebar.css
```
