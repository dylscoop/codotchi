# Version History

## v0.0.2 — current (commit `7ee39a6`)

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

```
archive/v0.0.1/vscode/src/gameEngine.ts
archive/v0.0.1/vscode/src/sidebarProvider.ts
archive/v0.0.1/vscode/media/sidebar.js
archive/v0.0.1/vscode/media/sidebar.css
```
