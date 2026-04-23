# Rat Sprite Design

**Grid:** 48 × 32 quadruped (head faces left)
**Renderer:** standard quadruped — no special flags
**Version introduced:** v1.10.0

---

## Colour legend

| Index | Colour | Usage |
|-------|--------|-------|
| 1 | primary (body fill) | body, head, legs |
| 2 | secondary | eye dot, snout tip |
| 3 | accent (primary × 0.70) | belly highlight row, tail, senior age spots |
| 4 | `#cccccc` fixed | whiskers (teen/adult/senior only) |

---

## Iconic cues (Rule 10)

1. **Pointed snout** — index-2 pixels at snout tip
2. **Long thin diagonal tail** — index-3 single-pixel diagonal descending right from upper body
3. **Whiskers** — index-4, teen/adult/senior only (two pixels left of snout row)

---

## Stage layout summary

All stages use the quadruped 48×32 grid. Head faces left. Body is low-slung and elongated.

### Baby (rows 25–31)
- No ears
- Head top: row 25 cols 7–10
- Eye + head: row 26
- Snout + body: row 27 cols 4–25
- Belly + tail start: row 28 (tail col 24, overlaps body above)
- Lower body + tail: row 29 (tail col 25)
- Legs + tail tip: row 30 (1px legs, tail col 26)
- Feet: row 31

### Child (rows 22–31)
- Ears: row 22 cols 6 and 8 (`█.█`)
- Head top: row 23 cols 6–9
- Eye + head: row 24
- Snout + body: row 25 cols 3–26
- Body: row 26 cols 5–29
- Belly + tail start: row 27 (tail col 27)
- Lower body + tail: row 28 (tail col 28)
- Belly bottom + tail: row 29 (tail col 29)
- Feet + tail: rows 30–31 (2px legs, tail cols 30–31)

### Teen (rows 18–31)
- Ears: row 18 cols 8 and 10 (`█.█`)
- Head top: row 19 cols 8–12
- Eye + head: row 20
- Whiskers + snout + body: rows 21–22 (index 4 at cols 0–1)
- Body: row 23 cols 6–33
- Belly + tail start: row 24 (tail col 31)
- Lower body + tail: rows 25–27 (tail cols 32–34)
- Legs + tail: rows 28–31 (2px legs, tail cols 35–38)

### Adult (rows 16–31)
- Ears: row 16 cols 0 and 2 (`█.█`)
- Head top: row 17 cols 0–4
- Eye + head: row 18 cols 0–8 (index 2 at col 0)
- Whiskers + snout + body: rows 19–21 (index 4 at cols 0–1)
- Body: rows 22–24 cols 2–35
- Belly: row 23 cols 2–32 (index 3), body at col 33 (tail overlap)
- Tail start: row 24 overlaps at col 33 (body covers it); separate tail from row 25
- Tail: rows 25–31 cols 35–41 (diagonal right+down)
- Legs: rows 28–31 (2px legs at cols 4–8 front, cols 21–25 rear)

### Senior (rows 16–31)
- Identical to adult
- Age spots (index 3) at: row 20 col 14, row 21 col 22, row 24 col 18, row 25 col 26

---

## Tail connection rule

The tail starts at a column that the body occupies on rows above it (overlapping),
so there is no visual gap between body and tail. The tail then diagonals right+down
one pixel per row for the remaining rows.

---

## Checklist (sprite-drawing rules)

- [x] Rule 1: Feet in rows 30–31
- [x] Rule 2: Body last non-zero row directly above first leg row (no gap)
- [x] Rule 3: All 5 stages have legs
- [x] Rule 6: Senior = adult + index-3 age spots only
- [x] Rule 7: Index 4 used only for whiskers
- [x] Rule 8: Tail connected to body (overlapping column) on all stages
- [x] Rule 9: Baby and child are proportional shrinks of adult
- [x] Rule 10: Tamagotchi style — 3 iconic cues, chunky contiguous blocks
