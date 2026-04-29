# Tiger Sprite Design

**Grid:** 48 × 32 quadruped (head faces left)
**Renderer:** standard quadruped — no special flags

---

## Colour legend

| Index | Colour | Usage |
|-------|--------|-------|
| 1 | primary (body fill) | body, ears, legs |
| 2 | secondary | eye dot, muzzle accent |
| 3 | accent (primary × 0.70) | vertical body stripes (all stages), senior age spots |
| 4 | unused | (whiskers present in cat are removed for tiger) |

---

## Iconic cues (Rule 10)

1. **Rounded ears** — two rounded bumps above head left side (teen/adult/senior); pointy on baby/child
2. **Vertical body stripes** (colour 3) — 2–3 stripe columns through torso, all stages
3. **Downward-hanging tail** — tail descends from rump and steps rightward each 2–3 rows; 1px wide on baby/child, 2px wide on teen/adult/senior
4. **No whiskers** — colour 4 is not used; whiskers removed from all stages
5. **Prowling head posture** — head shifted down 2 rows and left 2 cols relative to cat; head merges into body rows creating a low, forward-reaching silhouette

---

## Per-stage feature matrix

| Feature | Baby | Child | Teen | Adult | Senior |
|---------|------|-------|------|-------|--------|
| Ear shape | pointy | pointy | rounded | rounded | rounded |
| Whiskers (index 4) | No | No | No | No | No |
| Body stripes (index 3) | Yes (1) | Yes (2) | Yes (3) | Yes (3) | Yes (3) |
| Tail direction | downward | downward | downward | downward | downward |
| Tail width | 1px | 1px | 2px | 2px | 2px |
| Age spots (index 3) | No | No | No | No | Yes |
| Leg width | 1px | 2px | 3px | 3px | 3px |
| Back leg shift (vs front) | 0px | +2px | +3px | +4px | +4px |
| Head shift (vs cat) | down 2, left 2 | down 2, left 2 | down 2, left 2 | down 2, left 2 | down 2, left 2 |
| Head/body overlap rows | 24-25 | 19-20 | 15-16 | 15-16 | 15-16 |

---

## Stage ASCII sketches

Key: `█` = colour 1 (body), `▓` = colour 2 (eye/muzzle), `░` = colour 3 (stripe/spot)

### baby (~60% scale)

```
Row 20: ..........██.██.......................................   ears (pointy)
Row 21: ..........██████.......................................   head
Row 22: .........▓██████.......................................   eye + head
Row 23: .........████▓██.......................................   nose
Row 24: .........█████████░█████████..........................   body + stripe
Row 25: ..........████████░█████████..........................   body
Row 26: ..........████████░███████.█..........................   body (tail sep)
Row 27: ...........███████░███████..██.........................   belly (tail steps right)
Row 28: ...........████████████████....█.......................   belly bottom + tail
Row 29: ...........█..█.....█..█...............................   legs (1px)
Row 30: ...........█..█.....█..█...............................   feet
Row 31: ...........█..█.....█..█...............................   feet
```

### child (~75% scale)

```
Row 15: .........██.██........................................   ears (pointy)
Row 16: .........██████.......................................   head
Row 17: ........▓███████......................................   eye + head
Row 18: ........████▓███.....................................   nose
Row 19: ........█████████░████░███████████...................   body + 2 stripes + tail
Row 20: .........████████░████░███████████.█..................   body + tail
Row 21: .........████████░████░███████████.█..................   body + tail
Row 22: ..........███████░████░████████....█..................   body + tail step right
Row 23: ...........██████░████████████.....█..................   belly + tail
Row 24: ...........████████████████████....█..................   belly bottom + tail
Row 25: ...........██.██.....██.██.........█..................   legs (2px) + tail step right
Row 26: ...........██.██.....██.██...............................   legs
Row 27–30: (same legs/feet pattern)
```

### teen (~85% scale)

```
Row 10: .......███.███........................................   ears (rounded)
Row 11: .......██████.........................................   head
Row 12: ......▓███████........................................   eye + head
Row 13: ......████▓███........................................   nose (no whiskers)
Row 14: ......█████████......................................   chin
Row 15: ......█████░████░████░████████████████...............   body + 3 stripes + tail
Row 16: ......█████░████░████░████████████.██..................   body + tail
Row 17: ......█████░████░████░███████████..██...................   body + tail step right
Row 18: ......█████░████░████░███████████...██..................   body + tail
Row 19: .......████░████░████████████████.█.██..................   body narrows + tail
Row 20: .......█████░████████████████████....███................   lower body + tail step right
Row 21: ........█████████████████████████....███................   lower body + tail
Row 22: ........████████████████████████.....███................   belly + tail
Row 23: .........███████████████████████......███...............   belly + tail step right
Row 24: .........█████████████████████........███...............   belly bottom + tail
Row 25: .........███.███....███.███...........███...............   legs (3px) + tail
Row 26–31: (same legs/feet, no tail)
```

### adult (reference / full scale)

```
Row  8: .....███.███.........................................   ears (rounded)
Row  9: .....████████........................................   head
Row 10: .....████████........................................   head
Row 11: ....▓████████........................................   eye + head
Row 12: ....▓████████........................................   muzzle
Row 13: ....█████▓████.......................................   nose (no whiskers)
Row 14: ....█████████........................................   chin
Row 15: .....█░███░███░████░████████████████████.............   body + 3 stripes + tail
Row 16: .....█░███░███░████░█████████████████.██...............   body + tail
Row 17: .....█░███░███░████░███████░████████..██...............   body + tail
Row 18: .....█░███░███░████░████████████████...██...............   body + tail step right
Row 19: .....█░███░███░████░████████████████....██..............   body + tail
Row 20: ......░███░███░█████░████████████████....███.............   body narrows + tail
Row 21: ......░███░████████████████████████......███.............   lower body + tail step right
Row 22: .......████████████████████████████......███.............   lower body + tail
Row 23: ........███████████████████████████.......███............   belly + tail
Row 24: .........████████████████████████.........███............   belly bottom + tail step right
Row 25: .........███.███.........███.███..........███............   legs (3px, back +4px) + tail
Row 26: .........███.███.........███.███..........███............   legs + tail
Row 27: .........███.███.........███.███...........███...........   legs + tail step right
Row 28: .........███.███.........███.███...........███...........   legs + tail
Row 29: .........███.███.........███.███...........███...........   legs + tail
Row 30: .........███.███.........███.███............................   feet
Row 31: .........███.███.........███.███............................   feet
```

### senior (adult + colour-3 age spots)

Identical to adult except colour-3 age spots on torso:
- Row 16: age spot within body (col ~14)
- Row 20: age spot within body (col ~16)
- Row 22: age spot within body (col ~12)

---

## Tail stepping reference (pixel data cols, 0-indexed)

| Stage | Rows | Tail cols |
|-------|------|-----------|
| Baby | 25 | col 27 (1px, adjacent body) |
| Baby | 26 | col 27 (1px, gap from body) |
| Baby | 27 | cols 27-28 (2px, step right) |
| Baby | 28 | col 28 (1px, further right) |
| Child | 19-21 | col 30 (1px) |
| Child | 22-24 | col 31 (1px, step right) |
| Child | 25 | col 32 (1px, step right into leg row) |
| Teen | 15-16 | cols 35-36 (2px) |
| Teen | 17-18 | cols 36-37 (2px, step right) |
| Teen | 19 | cols 36-37 (2px) |
| Teen | 20-22 | cols 37-38 (2px, step right) |
| Teen | 23-24 | cols 38-39 (2px, step right) |
| Teen | 25 | cols 38-39 (2px, extends into leg row) |
| Adult | 15-16 | cols 38-39 (2px) |
| Adult | 17 | cols 38-39 (2px) |
| Adult | 18-19 | cols 39-40 (2px, step right) |
| Adult | 20-23 | cols 39-40→40-41 (step right) |
| Adult | 24-26 | cols 41-42 (2px) |
| Adult | 27-29 | cols 42-43 (2px, step right into leg rows) |

---

## Renderer notes

- No changes to `UPRIGHT_TYPES` or `SIDE_FACING_UPRIGHT` — tiger is a standard quadruped facing left
- Uses colour indices 1–3; index 4 is not used (whiskers removed)
- Senior age spots use colour 3 (same as stripes), placed within the torso rows
