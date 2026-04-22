# Rooster Sprite Design

**Grid:** 32 × 48 upright (side profile facing left)
**Renderer:** `SIDE_FACING_UPRIGHT = { ..., rooster: 1 }` — flips when not facing left (same logic as monkey)

---

## Colour legend

| Index | Colour | Usage |
|-------|--------|-------|
| 1 | primary (body fill) | body, neck, legs |
| 2 | secondary | beak, eye, tail fan feathers |
| 3 | accent (primary × 0.70) | comb, wattle, senior age spots |

---

## Iconic cues (Rule 10)

1. **Serrated comb** (colour 3) — 3-row bump on top of head
2. **Curved tail fan** (colour 2) — arcs upward from rump (~rows 23–31)
3. **Pointed beak** (colour 2) — juts left from head

---

## Stage ASCII sketches

### baby (~60% scale)

```
Row 20: ..░░..........
Row 21: .░░░..........
Row 22: ..░░..........
Row 23: .████.........   head
Row 24: .█▓███........   eye (2)
Row 25: ▓▓██████......   beak (2)
Row 26: ..░█████......   wattle (3)
Row 27: ..██████......   neck
Row 28: ..███████.....   body
Row 29: .████████.....
Row 30: .████████.....
Row 31: .████████.▓▓..   tail start
Row 32: ..███████▓▓▓▓▓   tail
Row 33: ..██████▓▓▓▓▓.   tail connected
Row 34: ...█████▓▓▓▓..   tail end
Row 35: ...█████......   lower body
Row 36: ...████.......
Row 37: ...█.█........   legs
...
Row 46: ..██.██.......   feet
Row 47: ..██.██.......
```

### child (~75% scale)

```
Row 16: ..░░..........
Row 17: .░░░░.........
Row 18: ..░░..........
Row 19: .█████........   head
Row 20: .███████......
Row 21: .█▓██████.....   eye (2)
Row 22: ▓▓█████████...   beak (2)
Row 23: ..░████████...   wattle (3)
Row 24: .█████████....   neck
Row 25: .██████████...   body
Row 26: .██████████...
Row 27: .██████████...
Row 28: .██████████.▓▓   tail start
Row 29: ..█████████▓▓▓▓▓
Row 30: ..████████▓▓▓▓▓▓▓
Row 31: ...████████▓▓▓▓.   tail
Row 32: ...████████▓▓▓▓
Row 33: ...███████......   lower body
Row 34: ...██████.......
Row 35: ...█████........
Row 36: ...████.........
Row 37: ....█.█.........   legs
...
Row 46: ...██.██........   feet
Row 47: ...██.██........
```

### teen (~85% scale)

```
Row  9: ..░░..........
Row 10: .░░░░.........
Row 11: ..░░..........
Row 12: .██████.......   head
Row 13: .████████.....
Row 14: .█▓███████....   eye (2)
Row 15: ▓▓█████████...   beak (2)
Row 16: ..░█████████..   wattle (3)
Row 17: .██████████...   neck
Row 18: .███████████..   body
Row 19: ████████████..
Row 20: ████████████..
Row 21: ████████████..
Row 22: ████████████..
Row 23: ████████████..
Row 24: .███████████..
Row 25: .███████████.▓▓   tail start
Row 26: ..██████████▓▓▓▓▓▓
Row 27: ..█████████▓▓▓▓▓▓▓
Row 28: ...████████▓▓▓▓▓▓▓
Row 29: ...████████▓▓▓▓▓
Row 30: ...████████▓▓▓▓
Row 31: ...███████.....   lower body
Row 32: ...███████.....
Row 33: ...█████.......
Row 34: ...█████.......
Row 35: ...█████.......
Row 36: ...████........
Row 37: ....█.█........   legs
...
Row 46: ...██.██.......   feet
Row 47: ...██.██.......
```

### adult (reference / full scale)

```
Row  7: ..░░░.........   comb
Row  8: .████.........   comb (wider)
Row  9: ..░░░.........   comb
Row 10: .███████......   head
Row 11: .█████████....
Row 12: .█▓████████...   eye (2)
Row 13: ▓▓█████████...   beak (2)
Row 14: ..░█████████..   wattle (3)
Row 15: .█████████....   neck
Row 16: .██████████...   body
Row 17: .████████████.
Row 18: .█████████████
Row 19: ██████████████
Row 20: ██████████████
Row 21: ██████████████
Row 22: ██████████████
Row 23: ██████████████.▓▓   tail start
Row 24: .█████████████▓▓▓▓▓
Row 25: .█████████████▓▓▓▓▓▓▓
Row 26: ..████████████▓▓▓▓▓▓▓▓
Row 27: ..█████████▓▓▓▓▓▓▓▓▓▓
Row 28: ...████████▓▓▓▓▓▓▓
Row 29: ...████████▓▓▓▓▓
Row 30: ....████████▓▓▓▓   tail end, rump
Row 31: ....████████▓▓     lower body (wider -1 left vs row 32)
Row 32: ....████████       lower body
Row 33: ....████████
Row 34: ....███████
Row 35: ....██████
Row 36: ....████
Row 37: ....█.█            legs
...
Row 46: ...██.██           feet
Row 47: ...██.██
```

### senior (adult + colour-3 age spots)

Identical to adult except 4 colour-3 age spots scattered on torso:
- Row 18 col 9
- Row 20 col 10
- Row 22 col 9
- Row 25 col 9

---

## Renderer notes

- Added `rooster: 1` to `SIDE_FACING_UPRIGHT` in both `vscode/media/sprites.js` and `pycharm/src/main/resources/webview/sprites.js`
- No new colours required — uses existing indices 1, 2, 3
