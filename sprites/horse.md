# Horse Sprite Design

**Grid:** 48 × 32 quadruped (head faces left)
**Renderer:** standard quadruped — no special flags
**Version introduced:** v1.11.0 (full redesign)

---

## Colour legend

| Index | Colour | Usage |
|-------|--------|-------|
| 1 | primary (body fill) | body, head, neck, legs, ears |
| 2 | secondary | eye dot, nostril |
| 3 | accent (primary × 0.70) | mane, tail, hooves, senior age spots |
| 4 | not used | — |

Colour 3 represents dark keratin — the same material for mane hair, tail hair,
and hooves — so all three features share one thematic accent colour.

---

## Iconic cues (Rule 10)

1. **Upright pointed ears** — two `1·1` peaks above the head
2. **Arched neck + mane** — colour-3 cascade down the back of the neck (top-right edge of neck), widening from 1px at ears to 4px at withers
3. **Shape-only hooves** — bottom 2 rows of legs widen from 2px to 3px (adult/teen) or 1px to 1px with colour 3 (child/baby)

---

## Per-stage feature matrix

| Feature | Baby | Child | Teen | Adult | Senior |
|---------|------|-------|------|-------|--------|
| Ears | `1·1` 1px | `1·1` 1px | `1·1` 1px | `1·1` 1px | `1·1` 1px |
| Mane rows (col 3) | 1 row | 2 rows | 3 rows | 4 rows | 4 rows |
| Eye (col 2) | 1px | 1px | 1px | 1px | 1px |
| Nostril (col 2) | 1px | 1px | 1-2px | 2px | 2px |
| Tail (col 3) | 2 rows | 3 rows | 5 rows | 5 rows | 5 rows |
| Leg width | 1px | 1px | 2px | 2px | 2px |
| Hoof colour | col 3 | col 3 | col 3 | col 3 | col 3 |
| Age spots (col 3) | no | no | no | no | yes (4 spots) |

---

## Stage ASCII sketches

Key: `█` = colour 1 (body), `▓` = colour 2 (eye/nostril), `░` = colour 3 (mane/tail/hooves), `·` = transparent

### adult (reference / full scale)

```
     0         1         2         3         4      47
     012345678901234567890123456789012345678901234567

 0:  ················································
 1:  ················································
 2:  ················································
 3:  ················································
 4:  ················································
 5:  ················································
 6:  ················································
 7:  ····█·█·········································  ears
 8:  ····███░········································  ear base + mane
 9:  ···█████░·······································  head + mane
10:  ···██████░░·····································  head + mane cascade
11:  ···█▓█████░░····································  eye + mane cascade
12:  ··█████████░····································  wide neck + mane
13:  ·██▓████████████································  nostril + neck widens
14:  ·█████████████████████████████████··············  neck meets body
15:  ····████████████████████████████████░░░·········  body + tail starts
16:  ····████████████████████████████████░░░░░·······  body + tail widens
17:  ····████████████████████████████████░░░░░·······  body + tail
18:  ····████████████████████████████████░░░·········  body + tail
19:  ···█████████████████████████████████░░··········  body + tail thins
20:  ········████████████████████████████············  body tapers
21:  ·········███████████████████████████············  body tapers
22:  ··········██████████████████████████············  body tapers
23:  ···········█████████████████████████············  belly
24:  ············████████████████████████············  belly bottom
25:  ············██·██············██·██··············  4 legs 2px
26-29: (same leg pattern)
30:  ············░░·░░░···········░░░·░░░············  hooves colour 3
31:  ············░░·░░░···········░░░·░░░············
```

### teen (~85% of adult)

```
 8:  ·····█·█········································  ears
 9:  ·····███░·······································  ear base + mane
10:  ····█████░░·····································  head + mane
11:  ····█▓████░░····································  eye + mane cascade
12:  ···████████░····································  wide neck + mane
13:  ··██▓███████████████████████████████············  nostril + full body + tail start
14:  ·····█████████████████████████████████░░········  body + tail
15-18: (body + narrowing tail)
19:  ········████████████████████████████············  tapers
20-24: (further taper)
25:  ···············██·██·····██·██··················  4 legs 2px
30:  ···············░░·░░░····░░·░░░·················  hooves colour 3
```

### child (~75% of adult)

```
12:  ·····█·█········································  ears
13:  ·····███░·······································  ear base + mane
14:  ····█████░······································  head + mane
15:  ····█▓████░·····································  eye + mane
16:  ···█▓██████░░████████████████████··············  nostril + body + tail start
17-19: (body + tail)
20-24: (taper)
25:  ················█·····█···████·█···············  4 legs 1px
30:  ················░·····░···░░░░·░···············  hooves colour 3
```

### baby (~60% of adult)

```
14:  ······█·█·······································  ears
15:  ······███░······································  ear base + mane
16:  ·····█████░·····································  head + mane
17:  ·····█▓████░····································  eye + mane
18:  ····█▓██████████████████████····················  nostril + body + tail start
19-20: (body + tail)
21-24: (taper)
25:  ·············█·█·█··█···························  4 legs 1px
30:  ·············░·░·░··░···························  hooves colour 3
```

### senior (adult + colour-3 age spots)

Identical to adult except 4 colour-3 age spots scattered on torso:
- Row 16, col 17
- Row 18, col 20
- Row 20, col 17
- Row 21, col 24

---

## Tail connection rule (Rule 8)

The tail (colour 3) originates at the right edge of the body on the first full
body row (row 15 on adult, row 13 on teen, row 16 on child, row 19 on baby).
It is directly adjacent to the last body pixel on each row — no gap. The tail
drapes downward-right, narrowing from 3-5px at the top to 1px at the bottom.

---

## Checklist (sprite-drawing rules)

- [x] Rule 1: Feet in rows 30–31
- [x] Rule 2: Body last non-zero row (24) directly above first leg row (25) — no gap
- [x] Rule 3: All 5 stages have legs
- [x] Rule 6: Senior = adult + 4 colour-3 age spots on torso only
- [x] Rule 7: Colour 4 unused
- [x] Rule 8: Tail connected to body on all stages
- [x] Rule 9: Baby and child are proportional shrinks of adult
- [x] Rule 10: Tamagotchi style — 3 iconic cues (ears, arched neck+mane, hooves), chunky contiguous blocks
