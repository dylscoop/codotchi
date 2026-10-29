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

---

## Imported image sprites (`sprites/kangaroo/`)

The hand-drawn grid above is superseded by bulk-imported images, one per stage
(`baby.png` … `senior.png`). The originals live in the git-ignored
`downloaded_sprites/kangaroo/`. Before import each image was preprocessed:

- Teen and adult (Alamy stock JPGs): the black watermark footer bar was cut off,
  and the "alamy" text marks on the body were painted over with the surrounding
  fur colour.
- All JPG stages: near-white background removed by an edge-connected flood fill
  (keeps the cream belly), plus fully white enclosed pockets; then trimmed tightly
  to the kangaroo so the importer can scale and centre it.

Without this, teen and adult kept their white background (the black footer meant
the four corners didn't match, so auto background removal was skipped) and the
padded canvases shrank every stage on the shared grid (now 146 × 128).
`sprite.json` sets `"stageScale": { "baby": 2, "child": 2 }` because those two
source images are drawn much smaller than the others.
