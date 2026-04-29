# Dragon Sprite Design

**Grid:** 32 × 48 upright
**Renderer:** `UPRIGHT_TYPES = { ..., dragon: 1 }` — Chinese imperial serpentine dragon (v1.8.0)
**Animation:** Float/bob (no legs) — `floatPhase` sinusoidal ±3 px vertical oscillation; `legFrame = -1`

---

## Colour legend

| Index | Colour | Usage |
|-------|--------|-------|
| 1 | primary (body fill) | body, coils |
| 2 | secondary | eye |
| 3 | accent (primary × 0.70) | mane, horns, belly accent markings, flame tail tip |
| 4 | `#FFD700` gold (fixed) | pearl — teen/adult/senior only |

---

## Iconic cues (Rule 10)

1. **Curved horns** (colour 3) — pair above head, teen/adult/senior only
2. **Flowing mane** (colour 3) — along neck/skull, adult/senior full, teen partial
3. **Coiling serpentine body** — clockwise coils, head faces right
4. **Gold pearl** (colour 4) — held at body edge, teen/adult/senior only
5. **Flame-tipped tail** (colour 3) — narrows to wisp at end

---

## Stage ASCII sketches

Key: `█` = colour 1 (body), `▓` = colour 2 (eye), `░` = colour 3 (mane/horns/accent/flame), `◆` = colour 4 (gold pearl)

### baby (3 tight coils, rows 16–38)

```
Row 16: ....████................   head top
Row 17: ....████████............   head
Row 18: ...▓████████............   eye + snout
Row 19: ....████████............   lower face
Row 20: .....████...............   neck
Row 21: .....████...............   neck
Row 22: ......████..............   curves right
Row 23: .......████.............   coil 1 right
Row 24: ........████░...........   belly accent
Row 25: .......████.............   curving left
Row 26: ......████..............
Row 27: .....████...............
Row 28: .....████░..............   belly accent (trough)
Row 29: .....███................   curving right
Row 30: .....████...............   coil 2 right
Row 31: ......███░..............   belly accent + peak
Row 32: ......███...............   curving left
Row 33: ......███...............
Row 34: ......██░...............   belly accent (trough)
Row 35: .....███................   coil 3
Row 36: ......██................   tail narrows
Row 37: ......░█................   flame tip
Row 38: ......░.................   flame wisp
```

### child (3 wider coils, rows 11–37)

```
Row 11: ...░...░................   horn buds
Row 12: ...█████................   skull
Row 13: ...█████████............   head
Row 14: ...▓████████............   eye + snout
Row 15: ...█████████............   lower face
Row 16: ....████................   neck
Row 17: .....████...............   curves right
Row 18: ......████..............   coil 1 right
Row 19: .......████.............
Row 20: ........████░...........   belly accent + peak
Row 21: .......████.............   curving left
Row 22: ......████..............
Row 23: .....████...............
Row 24: .....████░..............   belly accent (trough)
Row 25: ......████..............   curving right
Row 26: .......████.............   coil 2 right
Row 27: ........████░...........   belly accent + peak
Row 28: .......████.............   curving left
Row 29: ......████..............
Row 30: .....████...............
Row 31: .....████░..............   belly accent (trough)
Row 32: .....███................   coil 3 right
Row 33: ......███...............   tail narrows
Row 34: .......░█...............   tail tip + belly accent
Row 35: .......█................   tail
Row 36: ......░█................   flame tip
Row 37: ......░.................   flame wisp
```

### teen (4 coils, rows 6–38, partial mane + pearl)

```
Row  6: ...░░..░░...............   curved horns
Row  7: ....░░░.................   horn bases
Row  8: ..░░████████............   partial mane + skull
Row  9: ..░█████████............   mane + head
Row 10: ..░██▓█████████.........   mane + eye + snout
Row 11: ....████████████........   jaw + neck
Row 12: .....░░░████............   mane + neck narrows
Row 13: .....█████..............   curves right
Row 14: ......█████.............   coil 1 right
Row 15: .......█████░...........
Row 16: ........█████░..........   belly accent + peak
Row 17: .......█████................   curving left
Row 18: ......█████.............
Row 19: .....█████..............
Row 20: .....█████░.............   belly accent
Row 21: ......█████.............   trough
Row 22: .......█████............   coil 2 right
Row 23: ........█████░..........   belly accent + peak
Row 24: .......█████◆...........   pearl (gold)
Row 25: ......█████.............   curving left
Row 26: .....█████..............
Row 27: .....█████░.............   belly accent
Row 28: ......█████.............   trough
Row 29: .......████.............   coil 3 right
Row 30: ........████░...........   belly accent + peak
Row 31: .......████.............   curving left
Row 32: ......████..............
Row 33: .....████░..............   belly accent (trough)
Row 34: .....███................   coil 4
Row 35: ......███...............   tail narrows
Row 36: .......░█...............   tail + belly accent
Row 37: .......█................   tail tip
Row 38: ......░.................   flame tip
```

### adult (5 coils, rows 4–46, full features)

```
Row  4: ...░░..░░...............   curved horns
Row  5: ....░░..................   horn bases
Row  6: ..░░░█████████..........   flowing mane + skull
Row  7: ..░█████████████........   mane + head
Row  8: ..░██▓███████████.......   mane + eye + long snout
Row  9: ....█████████████░......   jaw + whisker
Row 10: ....░░░███..............   mane + neck
Row 11: .....░████..............   curves right
Row 12: ......█████.............   coil 1 right
Row 13: .......██████...........
Row 14: ........█████░..........
Row 15: .........███████░.......   belly accent + peak right
Row 16: .........███████◆.......   pearl (gold)
Row 17: ........█████░..........   curving left
Row 18: .......█████............
Row 19: ......█████.............
Row 20: .....█████..............
Row 21: .....█████░.............   belly accent
Row 22: ......█████.............   trough left
Row 23: .......████.............   coil 2 right
Row 24: ........████░...........
Row 25: .........█████..........
Row 26: ........█████░..........   belly accent + peak
Row 27: .......█████............   curving left
Row 28: ......█████.............
Row 29: .....█████..............
Row 30: .....█████░.............   belly accent
Row 31: ......█████.............   trough left
Row 32: .......████.............   coil 3 right
Row 33: ........█████░..........   belly accent + peak
Row 34: .......█████............   curving left
Row 35: ......█████.............
Row 36: .....█████░.............   belly accent + trough
Row 37: .....███................   coil 4 right
Row 38: ......████..............
Row 39: .......███░.............   belly accent + peak
Row 40: .......███..............   curving left
Row 41: ......███...............   coil 5
Row 42: .......░█...............   belly accent
Row 43: ........██..............   tail narrows
Row 44: ........█...............   tail tip
Row 45: ......░░█...............   flame tip
Row 46: ......░.................   flame wisp
```

### senior (adult + colour-3 age spots)

Identical to adult except colour-3 age spots scattered on torso:
- Row 14 col 14
- Row 19 col 13
- Row 25 col 14
- Row 30 col 13

---

## Special rules for dragon

- **No legs** — dragon floats. Rules 1, 2, and 3 (legs/feet) are **explicitly exempt** for the dragon.
- **Float animation** — `legFrame = -1`; `floatPhase` advances at 1.2 rad/s; hover Y offset = `floorY − 12% bodyHeight ± 3px` sinusoidal bob.
- **Pearl** (index 4 gold) — present on teen, adult, and senior only. Absent on baby and child.
- **Horns** — absent on baby, horn buds on child, curved horns on teen/adult/senior.
- **Mane** — absent on baby, absent on child, partial on teen, full flowing on adult/senior.

---

## Renderer notes

- Added `dragon: 1` to `UPRIGHT_TYPES` in both `vscode/media/sprites.js` and `pycharm/src/main/resources/webview/sprites.js`
- Index 4 (`#FFD700`) added to `colorMap` in `renderSpriteGrid`
- Float logic lives in `sidebar.js` — `isDragon` branch with `floatPhase` state variable
