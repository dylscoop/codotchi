# Bug Tracker

All known bugs and their resolution status for the vscode_gotchi project.

---

## BUGFIX-001 — Font size setting does not hot-reload

**Status:** Fixed (commit `db47873`)
**File:** `vscode/src/sidebarProvider.ts`

**Problem:** `buildHtml()` is called once at webview creation. Changing
`gotchi.fontSize` while the webview is open has no effect until the panel is
fully destroyed and re-created.

**Fix:** Added a `vscode.workspace.onDidChangeConfiguration` listener inside
`resolveWebviewView`. When `gotchi.fontSize` changes the listener reassigns
`webviewView.webview.html` from a fresh `buildHtml()` call, which instantly
applies the new body class (`font-small` / `font-normal` / `font-large`).

---

## BUGFIX-002 — Care actions work while pet is sleeping

**Status:** Fixed (commit `ef4d710`)
**Files:** `vscode/src/sidebarProvider.ts`, `vscode/media/sidebar.js`,
`vscode/media/sidebar.css`

**Problem:** Clicking Feed, Play, Clean, Medicine, Scold, or Praise while the
pet is sleeping dispatched the command to the game engine, producing stat
changes at a time when the pet should be unreachable.

**Fix (host):** Added a guard in `handleWebviewMessage` that returns early for
the six blocked commands whenever `state.sleeping === true`.

**Fix (webview):** `renderState()` now sets `btn.disabled = state.sleeping` on
all six action buttons after each state update.

**Fix (CSS):** Added `.action-btn:disabled { opacity: 0.35; cursor: not-allowed; }`
so disabled buttons are visually dimmed.

---

## BUGFIX-003 — Pet never auto-wakes when energy is full

**Status:** Fixed (commit `f8d55e6`)
**File:** `vscode/src/gameEngine.ts`

**Problem:** The `tick()` function regenerated energy while the pet slept but
never checked whether energy had reached 100. The pet would remain sleeping
indefinitely unless the user manually clicked "Wake".

**Fix:** After the energy-regen branch in `tick()`, if `sleeping && energy >=
STAT_MAX` the pet is automatically woken: `sleeping` is set to `false`,
`ageDays` is incremented by 1, and the event `"auto_woke_up"` is pushed.

---

## BUGFIX-004 — Health has no recovery path when pet is not sick

**Status:** Fixed (commit `b4f02a0`)
**File:** `vscode/src/gameEngine.ts`

**Problem:** Health could be drained by three sources (starvation, happiness
critical, sickness) but the only recovery source was `giveMedicine()`, which
requires `sick === true`. A pet whose health was low but was not sick had no
way to recover.

**Fix:** Added a passive health regeneration of **+1 HP per tick** when the
pet is not sick and health is below the maximum. This is applied after all
damage sources but before the death check, so damage still wins when multiple
conditions fire in the same tick.

---

## BUGFIX-005 — Status bar click does not focus the sidebar panel

**Status:** Fixed (branch `bugfix/small_fixes`)
**File:** `vscode/src/extension.ts`

**Problem:** The status bar item was wired to
`workbench.view.extension.gotchi-sidebar`, which opens the side-bar
container but does not focus the gotchi webview panel inside it.

**Fix:** Changed the command to `gotchiView.focus`, which directly focuses
the registered `WebviewView`.

---

## BUGFIX-006 — TypeScript picks up `@types/katex` from root `node_modules`

**Status:** Fixed (branch `bugfix/small_fixes`)
**File:** `vscode/tsconfig.json`

**Problem:** After adding a root-level `package.json` (for markdownlint-cli2),
TypeScript's type resolution walked up to the repo root `node_modules` and
found `@types/katex` (a transitive dependency of markdownlint-cli2), causing
compile errors in `vscode/src/`.

**Fix:** Added `"typeRoots": ["./node_modules/@types"]` to `vscode/tsconfig.json`
to pin type resolution to `vscode/node_modules` only.

---

## BUGFIX-007 — Starvation sickness cannot be cured with medicine

**Status:** Fixed (branch `bugfix/small_fixes`)
**File:** `vscode/src/gameEngine.ts`

**Problem:** When `hungerZeroTicks >= HUNGER_ZERO_TICKS_BEFORE_RISK`, the
`tick()` function dealt direct health damage but never set `sick = true`. As a
result `giveMedicine()` returned `medicine_not_needed` for a starving pet, leaving
no way to stop the health drain short of feeding the pet back above 0.

**Fix:** In the starvation damage block, if the pet is not already sick, set
`sick = true` and push `"became_sick"`. This unifies starvation-induced illness
under the same `sick` flag used by all other sickness sources, so medicine works
identically.
