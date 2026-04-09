# Codotchi Sprites Reference

Complete design guide for all pixel-art sprites used in the VS Code and PyCharm Gotchi extensions.

---

## Overview

Sprites are defined in `vscode/media/sprites.js` (mirrored verbatim to
`pycharm/src/main/resources/webview/sprites.js`).

Two resolution tiers exist:

| Object | Grid | Used when |
|--------|------|-----------|
| `DEFS` / `SPRITES` | 12 × 16 | `petSize = "small"` or `"medium"` |
| `DEFS_LG` / `SPRITES_LG` | 24 × 32 | `petSize = "large"` |

Each entry has five life stages: `baby`, `child`, `teen`, `adult`, `senior`
(plus `egg`, which is drawn procedurally — not from a grid).

---

## Colour Index

| Index | Meaning | Notes |
|-------|---------|-------|
| `0` | Transparent | Never drawn |
| `1` | Primary (body fill) | From `getPalette(state.color).primary` |
| `2` | Secondary (eyes, snout, markings) | From `getPalette(state.color).secondary` |
| `3` | Accent / highlight | Falls back to `secondary` |
| `4` | Dark shadow | `primary` darkened ~55% — 24 × 32 only |

Special overrides applied at render time:
- `state.sick = true` → secondary becomes `#ff4444`
- `state.sleeping = true` → secondary becomes `#888888`

---

## Body Plan Templates

### Quadrupeds (cat, rat, ox, tiger, rabbit, horse, goat, dog, pig)

- **Orientation**: horizontal, head facing LEFT (col 0), tail at right (col 11 / 23)
- **4 legs**: two pairs in rows 10–11 (12 × 16) or 28–31 (24 × 32)
- **Growth**: baby = tiny head-only blob; each stage adds body length rightward;
  senior = full adult + age-stripe markings (index 3)

### Upright (classic, monkey, rooster)

- **Orientation**: vertical, front facing viewer
- **Growth**: gets wider and taller each stage

### Dragon

- **Orientation**: upright 2-legged; wings spread outward (grow wider)
- **Tail**: spiky pixels below body (index 3)

### Snake

- **Orientation**: horizontal S-curve
- **Legs**: none — leg rows are blank (no walk animation)
- **Tongue**: index-2 pixel at far left (index 2)

---

## Per-Animal Anatomy Guide

| Animal | Ears / Feature | Tail | Special |
|--------|---------------|------|---------|
| classic | — | none | Round blob, 2 stubs; purely upright |
| cat | Pointed triangles rows 0–1 | Long curl col 11 | |
| rat | Small round ears | Very long thin extending right | Narrow head |
| ox | Wide curved horn tips top-left (index 2) | Short stump col 11 | Heavy wide body |
| tiger | Round ears + stripe marks (index 3) | Short tail | 3-stripe pattern on body |
| rabbit | Tall ears 2 rows above head | Cotton-ball nub (index 2) | |
| horse | Mane bump top-left (index 2) | Long tail col 11 (index 2) | Longest body |
| goat | Curved horns top-left (index 2) | Short upright tail | Beard pixel below mouth |
| dog | Floppy ears cols 0–1, droop down | Wagging tail col 11 (index 2) | |
| pig | Round snout at far left (index 2) | Curly nub col 11 (index 2) | Chubby round body |
| monkey | Round ears at sides (index 2), lighter face (index 3), arms | Tail curls below-right | Upright |
| rooster | Comb top (index 3), wattle pixel | Fan tail behind right (index 3) | 2 legs, upright |
| dragon | Wings spread sides (grow each stage) | Spiky tail down (index 3) | 2 legs, upright |
| snake | Tongue pixel (index 2) | Entire lower body = tail | 0 legs |

---

## Sprite Grids — 12 × 16 (`DEFS`)

Each row is a 12-character string of colour indices. `0` = transparent.

### classic

```
baby            child           teen            adult           senior
000000000000    000000000000    000000000000    000000000000    000000000000
011111111110    011111111110    011111111110    011111111110    011111111110
011111111110    011111111110    011111111110    011111111110    011111111110
011111111110    013111131110    011111111110    011333311110    013133131110
011133111110    011111111110    011133111110    011111111110    011111131110
001111111100    011113111110    011133111110    011333311110    011131311110
000111111000    001111111100    001111111100    001111111100    001113111100
000111111000    000111111000    001133111100    001133311100    001131311100
000011110000    000111111000    000111111000    000111111000    000111111000
000000000000    000000000000    000000000000    000000000000    000000000000
...             ...             ...             ...             ...
```

*(Remaining rows are transparent for upright bodies — full data in sprites.js:55)*

### cat

Horizontal quadruped. Pointed ear tips at cols 2–3 (index 2). Long curling tail at col 11.

*(Full data in sprites.js:156)*

### rat

Horizontal. Narrow head, small round ears. Exceptionally long thin tail at right.

*(Full data in sprites.js:257)*

### ox

Horizontal. Wide curved horn tips (index 2) at cols 0–1. Heavy wide body. Short stump tail.

*(Full data in sprites.js:358)*

### tiger

Horizontal. Round ears. Three stripe marks across body (index 3).

*(Full data in sprites.js:459)*

### rabbit

Horizontal. Tall ears extend 2 rows above head row (index 1). Cotton-ball tail nub (index 2).

*(Full data in sprites.js:560)*

### dragon

Upright 2-legged. Wings spread outward left and right, growing wider each stage. Spiky tail pixels below (index 3).

*(Full data in sprites.js:661)*

### snake

Horizontal S-curve. Tongue pixel (index 2) at left. Zero leg rows. Tapers to tail at right.

*(Full data in sprites.js:763)*

### horse

Horizontal. Mane bump at top-left (index 2). Longest body of all quadrupeds. Long flowing tail at col 11 (index 2).

*(Full data in sprites.js:864)*

### goat

Horizontal. Curved horn tips at top-left (index 2). Beard pixel below mouth. Short upright tail.

*(Full data in sprites.js:965)*

### monkey

Upright. Round ears at sides (index 2). Lighter face patch (index 3). Arms visible at sides. Curling tail below-right.

*(Full data in sprites.js:1066)*

### rooster

Upright 2-legged. Comb on top (index 3). Wattle pixel below beak. Fan tail behind right side (index 3).

*(Full data in sprites.js:1167)*

### dog

Horizontal quadruped. Floppy ears hang from head (cols 0–1, droop down). Wagging tail at far right (index 2).

*(Full data in sprites.js:1268)*

### pig

Horizontal quadruped. Round snout at far left (index 2 = pink nostrils). Curly tail nub at right (index 2). Chubby round body.

*(Full data in sprites.js:1369)*

---

## Sprite Grids — 24 × 32 (`DEFS_LG`)

Each row is a 24-character string. Same colour-index rules apply plus index 4 (dark shadow).
Large sprites use pixel-doubling of the 12 × 16 design, plus additional shadow detail.

Leg rows: 28–31 (last 4 rows).

| Sprite | Location in sprites.js |
|--------|------------------------|
| classic | 1487 |
| cat | 1661 |
| rat | 1835 |
| ox | 2009 |
| tiger | 2183 |
| rabbit | 2357 |
| dragon | 2531 |
| snake | 2705 |
| horse | 2879 |
| goat | 3053 |
| monkey | 3230 |
| rooster | 3406 |
| dog | 3582 |
| pig | 3758 |

---

## Rendering

`renderSpriteGrid(ctx, state, x, bodyY, facingLeft, legFrame, breathPhase, ...)` in `sprites.js:3940` handles:

- **Scale**: `STAGE_SCALES[stage]` × `sizeMultiplier` × `weightWidthMultiplier(weight)`
- **Egg**: procedural rocking ellipse, ignores the grid tables
- **Walking animation**: rows ≥ `legRowStart` (`14` for 12×16, `30` for 24×32) receive alternating Y offsets (`legFrame` 0/1)
- **Sleeping breath**: bob Y offset via `sin(breathPhase)`
- **Facing direction**: canvas mirror-flip when `facingLeft = false`
- **Colour fallback**: unknown sprite type falls back to `classic`

> **Note on leg animation**: The new quadruped designs place legs in rows 10–11
> (12×16) and 28–31 (24×32). For 12×16 sprites `legRowStart = 14` only animates
> the last 2 rows (now blank in the new designs). A future update should lower
> `legRowStart` to `10` for the small grid or make it per-animal.

---

## File Locations

```
vscode/media/sprites.js                              ← source of truth
pycharm/src/main/resources/webview/sprites.js        ← exact copy (updated after every sprites.js change)
SPRITES.md                                           ← this file
```
