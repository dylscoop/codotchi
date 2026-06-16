# Dog Sprite Design

**Grid:** 573 x 550 imported image grid
**Renderer:** imported sprite grid
**Version updated:** v2.6.0

---

## Colour Legend

| Index | Colour | Usage |
|-------|--------|-------|
| 1 | `#f2994a` | Shiba orange body, ears, legs, curled tail |
| 2 | `#f2eadf` | Cream muzzle, ear, chest, and belly markings |
| 3 | `#5b2f1f` | Dark eye/facial detail and senior age spots |

---

## Source

The `dog` sprite is imported from `downloaded_sprites/shiba-masked.png`, an
edge-masked PNG derived from `downloaded_sprites/shiba.jpg`. The specified WebP
source, `downloaded_sprites/shiba-inu-cute-dog-pixel-260nw-2004636437.webp`,
could not be transcoded locally because no WebP-capable converter was installed.
The preprocessing removes only near-white background connected to the image
edges, preserving the Shiba's white chest/front fur before running
`scripts/import_sprite.js`. The `shiba` character code maps to this `dog`
sprite type and defaults the pet name to Shibagotchi.

---

## Iconic Cues

1. Pointed Shiba ears.
2. Cream muzzle/chest/belly markings.
3. Curled tail connected to the rump.

---

## Checklist

- [x] Feet appear near the bottom of the imported image grid.
- [x] Body connects directly into the leg pixels in the source image.
- [x] All five stages have leg/foot pixels.
- [x] Senior is adult plus index-3 age spots only.
- [x] Tail is connected to the body in every stage.
- [x] Baby and child are proportional shrinks of adult.
