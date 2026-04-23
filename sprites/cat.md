# Cat Sprite Design

**Grid:** 48 × 32 quadruped (head faces left)
**Renderer:** standard quadruped — no special flags

---

## Colour legend

| Index | Colour | Usage |
|-------|--------|-------|
| 1 | primary (body fill) | body, ears, legs |
| 2 | secondary | eye dot, small muzzle accent |
| 3 | accent (primary × 0.70) | tabby stripes (teen/adult/senior), senior age spots |
| 4 | `#cccccc` fixed | whiskers (teen/adult/senior only) |

---

## Iconic cues (Rule 10)

1. **Pointy triangle ears** — two peaks above head left side
2. **Whiskers** (colour 4) — 2px each side, touching head, teen/adult/senior only
3. **Upward-curling tail** — arcs right and up from rump; tip + arc rows on teen/adult/senior; bare arc only on child/baby

---

## Per-stage feature matrix

| Feature | Baby | Child | Teen | Adult | Senior |
|---------|------|-------|------|-------|--------|
| Tail tip + arc rows | No | No | Yes | Yes | Yes |
| Whiskers (index 4) | No | No | Yes | Yes | Yes |
| Tabby stripes (index 3) | No | No | Yes | Yes | Yes |
| Age spots (index 3) | No | No | No | No | Yes |
| Leg width | 1px | 2px | 2px | 2px | 2px |

---

## Stage ASCII sketches

Key: `█` = colour 1 (body), `▓` = colour 2 (eye/muzzle), `░` = colour 3 (stripe/spot), `◆` = colour 4 (whisker)

### baby (~60% scale)

```
Row 20: ..........██.██.................████.............   ears + tail
Row 21: ..........██████................███..............   head + tail
Row 22: .........▓██████...............███...............   eye + head + tail
Row 23: .........████▓██..............███................   nose + tail base
Row 24: .........█████████████████████..................   chin into body
Row 25: ..........████████████████████..................   body
Row 26: ..........████████████████████..................   body
Row 27: ...........██████████████████...................   belly
Row 28: ...........████████████████.....................   belly bottom
Row 29: ...........█..█.....█..█........................   legs (1px)
Row 30: ...........█..█.....█..█........................   feet
Row 31: ...........█..█.....█..█........................   feet
```

### child (~75% scale)

```
Row 15: .........██.██....................████...........   ears + tail
Row 16: .........██████...................████...........   head + tail
Row 17: ........▓███████.................████............   eye + head + tail
Row 18: ........████▓███................████.............   nose + tail base
Row 19: ........█████████████████████████................   chin into body
Row 20: .........████████████████████████................   body
Row 21: .........████████████████████████................   body
Row 22: ..........██████████████████████.................   body
Row 23: ...........████████████████████..................   belly
Row 24: ...........██████████████████....................   belly bottom
Row 25: ...........██.██....██.██.......................   legs
Row 26: ...........██.██....██.██.......................   legs
Row 27: ...........██.██....██.██.......................   legs
Row 28: ...........██.██....██.██.......................   legs
Row 29: ...........██.██....██.██.......................   feet
Row 30: ...........██.██....██.██.......................   feet
```

### teen (~85% scale)

```
Row  8: ............................................██...   tail tip
Row  9: ...........................................██....   tail arc
Row 10: .......██..██..........................████......   ears + tail
Row 11: .......██████.........................████.......   head top + tail
Row 12: ......▓███████.......................████........   eye + head
Row 13: .◆◆...████▓███..◆◆..................████.........   whiskers + nose
Row 14: ......██████████████████████░░..████.............   chin + stripe + body
Row 15: .......█████████████████████████████.............   neck into body
Row 16: .......████████████░██████████████...............   body + stripe
Row 17: .......██████████████████████████................   body
Row 18: .......████████████░██████████████...............   body + stripe
Row 19: ........████████████████████████.................   body narrows
Row 20: ........██████████████████████..................   lower body
Row 21: .........████████████████████....................   lower body
Row 22: .........██████████████████.....................   belly
Row 23: ..........████████████████......................   belly
Row 24: ..........██████████████........................   belly bottom
Row 25: ..........██.██....██.██........................   legs
Row 26–31: (same legs/feet pattern)
```

### adult (reference / full scale)

```
Row  6: ............................................██...   tail tip
Row  7: ...........................................██....   tail arc
Row  8: .....██...██............................████.....   ears + tail
Row  9: .....███.███...........................█████.....   ears wider + tail
Row 10: .....███████...........................████......   head top + tail
Row 11: ....▓████████.........................████.......   eye . head . eye + tail
Row 12: ....▓████████........................████........   muzzle row
Row 13: .◆◆.████▓████.◆◆...................████.........   whiskers + nose + tail
Row 14: ....█████████.................░░..████...........   chin + stripe + body
Row 15: .....█████████████████████████████████..........   neck into body
Row 16: .....█████████████████████████████████..........   body
Row 17: .....██████████████░████████████████............   body + stripe
Row 18: .....██████████████████████████████.............   body
Row 19: .....██████████████░████████████████............   body + stripe
Row 20: .....████████████████████████████...............   body narrows
Row 21: ......██████████████████████████................   lower body
Row 22: ......████████████████████████..................   lower body
Row 23: .......██████████████████████...................   belly
Row 24: ........████████████████████....................   belly bottom
Row 25: ........██.██........██.██......................   legs
Row 26–31: (same legs/feet pattern)
```

### senior (adult + colour-3 age spots)

Identical to adult except 4 colour-3 age spots on torso:
- Row 16 col 14
- Row 20 col 16
- Row 22 col 12
- (plus existing tabby stripes on rows 17, 19)

---

## Renderer notes

- No changes to `UPRIGHT_TYPES` or `SIDE_FACING_UPRIGHT` — cat is a standard quadruped facing left
- Uses existing colour indices 1–4; no new indices required
