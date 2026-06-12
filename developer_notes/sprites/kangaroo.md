# Kangaroo Sprite Design

**Grid:** 48 x 32 side profile (head faces left)
**Renderer:** standard quadruped grid, web-image-derived silhouette
**Version introduced:** v2.5.10

---

## Colour legend

| Index | Colour | Usage |
|-------|--------|-------|
| 1 | primary | tan body, ears, legs, tail |
| 2 | secondary | dark pouch and arm detail from the source image |
| 3 | accent | senior age spots only |

---

## Source

The adult silhouette was sampled from the BRIK kangaroo pixel-art image linked by
the user, then mapped into Codotchi's 48 x 32 sprite grid. Baby, child, and teen
are proportional nearest-neighbour shrinks of the sampled adult silhouette.

---

## Iconic cues

1. Tall upright ears and left-facing head.
2. Dark pouch/arm detail on the torso.
3. Long heavy tail and large rear foot.

---

## Checklist

- [x] Feet appear in rows 30-31 for every stage.
- [x] Body connects directly into the leg/tail support pixels.
- [x] All five stages have leg/foot pixels.
- [x] Senior is adult plus index-3 age spots only.
- [x] Tail is connected to the body in every stage.
- [x] Baby and child are proportional shrinks of adult.
