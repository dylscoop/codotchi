---
name: sprite-drawing
description: Enforces pixel-art sprite drawing rules — legs always touch the bottom, body always connects to legs, all stages including baby must have legs, classic is locked, and every ambiguous sprite change requires explicit user confirmation before any pixels are written.
license: MIT
compatibility: opencode
---

## When to apply this skill

Apply this skill any time a sprite is being created or modified in
`vscode/media/sprites.js` (and its mirror
`pycharm/src/main/resources/webview/sprites.js`).

---

## Rule 1 — Feet must touch the bottom of the grid

- **Quadruped grid (48×32):** At least one non-zero pixel must appear in row 30
  or row 31 (the last two rows). Row 31 is the preferred foot row. Row 30 is
  acceptable as the lowest foot row only if row 31 is intentionally blank for
  ground-clearance reasons.
- **Upright grid (32×48):** At least one non-zero pixel must appear in row 46
  or row 47 (the last two rows). Row 47 is preferred.

**Never leave both of the last two rows blank.** If they are both blank, the
sprite has no visible feet and violates this rule.

---

## Rule 2 — Body and legs must always be connected — strict adjacency

The bottom row of the body and the top row of the legs must be **directly
adjacent** — the body's last non-zero row must be exactly **one row above
the first leg pixel row**. There must be **zero blank rows** between them.

- **Quadruped default:** `legRowStart = 25`. Normally the body's last
  non-zero row is row 24 and legs begin at row 25.
- **Upright default:** `legRowStart = 37`. Normally the body's last
  non-zero row is row 36 and legs begin at row 37.
- **Short-legged animals** (e.g. rabbit with 3-row legs): legs may begin
  below `legRowStart` (e.g. row 29), in which case the body's last non-zero
  row must be row 28 — one row above the first actual leg pixel. Rows
  between `legRowStart` and the first leg pixel row must remain empty (no
  belly fill inserted to paper over the gap).

**The zero-gap rule is absolute** — the body's last non-zero row must be
immediately above the first leg pixel row with no blank rows between them.
Any all-zero row between body bottom and first leg pixel is a layout bug.

---

## Rule 8 — Tails must be connected to the body

If an animal has a tail, the tail pixels must originate from the body — there
must be no gap between the last body row and the first tail pixel. Tails that
float in empty space disconnected from the body are a layout bug.

### Animals with tails and where the tail connects

| Animal | Tail type | Connection point |
|--------|-----------|-----------------|
| monkey | curl to lower-right | attaches at lower-right of torso |
| cat | upward curl | attaches at right end of body rows |
| rat | long thin straight | extends right from body right edge |
| rabbit | fluffy nub | attaches at right end of lower body |
| dog | raised wag | attaches at upper-right of body |
| horse | flowing drape | attaches at right end of body rows |
| pig | curly nub | attaches at right end of body rows |
| rooster | fan feathers | attaches at right end of body rows |

For every stage (including baby and child), the tail must be present and
attached. Scale tail down for younger stages — a baby tail can be 1–2 pixels —
but it must touch a body pixel.

---

## Rule 3 — All stages must have legs — no exceptions

Every life stage — **baby, child, teen, adult, senior** — must have leg pixels
in the leg zone:

- Quadruped: rows 25–31
- Upright: rows 37–47

Baby and child stages are NOT exempt. A stage with no legs is a layout bug.
Scale legs down proportionally for younger stages (shorter, thinner) but they
must always be present and must always satisfy Rule 1 (feet in last 1–2 rows).

---

## Rule 4 — Classic sprite is permanently locked

**Never edit any pixel data for the `classic` animal unless the user
explicitly grants permission in their message for that specific edit.**

The classic sprite (all 5 stages) is the original Codotchi design and is
frozen. This rule overrides all other rules — even if the classic technically
violates Rule 1, 2, or 3, do NOT fix it without explicit permission.

Permission granted in one session does not carry over. Fresh explicit
permission is required each session before touching classic pixels.

---

## Rule 5 — Confirm before redesigning any sprite when the change is ambiguous

When the exact pixel-level change is **not fully specified** by the user:

1. **Describe what will change** — state the current state and the proposed
   change clearly.
2. **Propose the new design** — show the visual layout using ASCII art notation
   (pipe-bordered rows, `█` for colour-1, `▓` for colour-2, `░` for colour-3).
3. **Wait for explicit user confirmation** — do not write a single pixel until
   the user confirms (e.g. "yes", "looks good", "go ahead").

If the user has already fully specified the pixel layout (e.g. by providing
exact row strings or a complete SPRITES.md grid), proceed directly without
asking again.

---

## Rule 6 — Senior = adult + colour-3 age spots only

The senior stage must be identical to the adult stage except for the addition
of colour-3 (`3`) pixels scattered across the torso as age spots. Do not change
leg shape, body outline, tail, ears, wings, or any other feature between adult
and senior.

---

## Rule 7 — Colour index conventions

| Index | Colour | Usage |
|-------|--------|-------|
| `0` | transparent | background |
| `1` | primary | body fill |
| `2` | secondary | eyes, snout, ear tips, markings |
| `3` | accent (primary ×0.70) | stripes, comb, hooves, age spots |
| `4` | `#cccccc` fixed | whiskers and fine detail only — never body fill |

---

## Rule 9 — Baby and child must be proportional shrinks of the adult

Baby and child stages must be **scaled-down versions of the adult
silhouette** — smaller in **both width and height**, not just narrower.
The silhouette shape, feature placement, and pose must match the adult;
only the overall size changes.

- **Do not** keep adult body height and merely reduce the width.
- **Do not** invent chibi proportions (oversized head, stubby body) unless
  the adult silhouette already has those proportions.
- All features present on the adult (ears, tail, snout, haunch, horns,
  stripes, etc.) must appear on baby and child at reduced scale.
- Typical scale targets:
  - **Teen:** ~85% of adult width AND ~85% of adult height
  - **Child:** ~75% of adult width AND ~75% of adult height
  - **Baby:** ~60% of adult width AND ~60% of adult height
- Legs must still satisfy Rules 1, 2, and 3 (touch the bottom, connect to
  body, present on all stages) — scale legs thinner/stubbier but keep them.
- Head scales with body. Head must occupy the same proportional fraction
  of the total silhouette as in the adult — no disproportionately large heads.

**Note:** The `rat` animal was designed before Rule 9 was adopted and is
grandfathered — its baby/child stages use chibi proportions and must not
be "fixed" unless the user explicitly requests it.

---

## Rule 10 — Tamagotchi pixel-art style

All sprites must read as **Tamagotchi-style pixel art**, not realistic illustrations.

- Aim for **2–3 iconic silhouette cues** per animal (e.g. shiba = prick ears + curled tail + fox muzzle). Do NOT add breed-accurate fine detail (urajiro gradients, saddle shading, chest markings, leg socks, nose tips, etc.)
- Each colour must form **large contiguous blocks**, not scattered single pixels. The only exceptions are senior age spots (Rule 6) and intentional marking patterns pre-approved by the user.
- Colour 3 should be used for **one primary purpose** per animal (shading OR markings OR legs/hooves — pick one). Do not sprinkle it across multiple unrelated features.
- Prefer **blocky chunky shapes** over anatomical accuracy. A slightly oversized head on an adult is correct Tamagotchi style.
- **Reference benchmark:** the shipped cat, pig, and sheep sprites are the correct style level. Do not exceed their pixel density or detail level.
- When in doubt, **simplify** — remove the detail rather than adding it.

---

## Checklist before writing any sprite pixel data

- [ ] Rule 1: Feet pixels present in last 1–2 rows of grid?
- [ ] Rule 2: Is the body's last non-zero row directly adjacent (one row above) the first leg pixel row, with zero blank rows between them?
- [ ] Rule 3: All 5 stages have legs in the leg zone?
- [ ] Rule 4: Is this the classic sprite? → **STOP** unless user explicitly granted permission this session.
- [ ] Rule 5: Is the change ambiguous? → Show proposed design and wait for confirmation.
- [ ] Rule 6: If senior stage — is it adult + colour-3 spots only?
- [ ] Rule 7: Colour 4 used only for whiskers/details, not body fill?
- [ ] Rule 8: If animal has a tail — is it connected to the body in all stages including baby/child?
- [ ] Rule 9: Baby and child are proportional shrinks of adult in BOTH width and height (not chibi unless adult is already chibi)?
- [ ] Rule 10: Is the design Tamagotchi-style (2–3 iconic cues, chunky contiguous colour blocks, no fine anatomical detail)?
- [ ] Rule 11: Does the ASCII sketch use square character cells and match the grid's COLS×ROWS proportions? (Quadruped ~3:2 wide, Upright ~2:3 tall — sketches in a monospaced editor are accurate.)

---

## Grid reference

```
Quadruped (48 cols × 32 rows) — head faces LEFT
  Rows 0–7:   empty / features above body (ears, tail arc, etc.)
  Rows 8–10:  head (eye, snout, markings)
  Rows 11–17: full-width torso
  Rows 18–24: lower belly (indented — narrower than torso)
  Rows 25–31: legs — MUST attach directly to row 24 with NO gap
              Feet MUST appear in row 30 or 31

Upright (32 cols × 48 rows) — character faces viewer
  Rows 0–7:   empty
  Rows 8–10:  head top / horns / ears
  Rows 11–22: face, shoulders, torso
  Rows 23–36: lower torso, pelvis — narrows toward leg tops
  Rows 37–47: legs — MUST attach directly to row 36 with NO gap
              Feet MUST appear in row 46 or 47
```

---

## UPRIGHT_TYPES

Only these animals use the upright (32×48) grid:

```js
var UPRIGHT_TYPES = { classic: 1, dragon: 1, monkey: 1, rooster: 1 };
```

All other animals are quadrupeds (48×32).

---

## Sprite design reference — Dragon

The full dragon design spec (colour legend, iconic cues, and per-stage ASCII sketches) lives in `sprites/dragon.md`.

When implementing or modifying the dragon sprite, write the design to `sprites/dragon.md` (or overwrite it if it already exists) before touching any pixel data in `sprites.js`.

---

## Sprite design reference — Rooster

**Grid:** 32 × 48 upright. Side profile facing left.
**Renderer:** `SIDE_FACING_UPRIGHT = { ..., rooster: 1 }` — flips when not facing left.

### Colour legend

| Index | Colour | Usage |
|-------|--------|-------|
| 1 | primary (body fill) | body, neck, legs |
| 2 | secondary | beak, eye, tail fan feathers |
| 3 | accent (primary × 0.70) | comb, wattle, senior age spots |

### Iconic cues

1. **Serrated comb** (colour 3) — 3-row bump on top of head
2. **Curved tail fan** (colour 2) — arcs upward from rump (~rows 23–31)
3. **Pointed beak** (colour 2) — juts left from head

### Stage ASCII sketches

Key: `█` = colour 1 (body), `▓` = colour 2 (beak/eye/tail), `░` = colour 3 (comb/wattle)

**baby** (~60% scale)
```
Row 20: ..░░..........   comb
Row 21: .░░░..........   comb
Row 22: ..░░..........   comb
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

**child** (~75% scale)
```
Row 16: ..░░..........   comb
Row 17: .░░░░.........   comb
Row 18: ..░░..........   comb
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
Row 31: ...████████▓▓▓▓.
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

**teen** (~85% scale)
```
Row  9: ..░░..........   comb
Row 10: .░░░░.........   comb
Row 11: ..░░..........   comb
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

**adult** (reference / full scale)
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
Row 30: ....████████▓▓▓▓
Row 31: ....████████▓▓
Row 32: ....████████
Row 33: ....████████
Row 34: ....███████
Row 35: ....██████
Row 36: ....████
Row 37: ....█.█            legs
...
Row 46: ...██.██           feet
Row 47: ...██.██
```

**senior** — identical to adult, plus colour-3 age spots at:
- Row 18 col 9
- Row 20 col 10
- Row 22 col 9
- Row 25 col 9

---

## Rule 11 — Design sprites for square pixel cells; ASCII sketches are the source of truth

### How the renderer maps grid pixels to screen

The renderer computes cell dimensions as:

```
cellW = round(bodyWidth / COLS)
cellH = round(bodyHeight / ROWS)
```

where `bodyHeight = bodyWidth * spriteHeightRatio(spriteType)` and:

```
spriteHeightRatio = ROWS / COLS
```

This means **`cellW ≈ cellH`** — every pixel cell is approximately square on
screen. The rendered sprite will therefore have the same proportions as the
raw grid.

### ASCII sketches are proportionally accurate

Because cells are square, an ASCII sketch drawn in a monospaced editor (where
each character is ~1:1) is a valid visual representation of how the sprite will
look in the extension. Design sprites against the ASCII sketches in `SPRITES.md`
— what you draw there is what players see.

### What used to go wrong (BUGFIX-086)

Before v1.5.1, `bodyHeight` was computed from a flat `STAGE_BODY_HEIGHT_MULTS`
table that used 0.67 for all stages regardless of grid orientation. This made
cells rectangular (wider than tall) and squashed all sprites vertically —
upright sprites (32×48) were rendered at ~44% of their correct height.

**Do not reintroduce per-stage height multipliers.** The correct formula is
always `spriteHeightRatio = ROWS / COLS` derived from the grid dimensions.

### Practical sizing reference

| Grid type | COLS | ROWS | spriteHeightRatio | Cell shape on screen |
|-----------|------|------|-------------------|----------------------|
| Quadruped / Snake | 48 | 32 | 0.667 | slightly wider than tall |
| Upright | 32 | 48 | 1.500 | slightly taller than tall |

> Both ratios are close to square (within 1.5×), so neither orientation looks
> distorted. The grid proportions directly reflect the rendered proportions.

### Sketch proportions to keep in mind when designing

- A quadruped sprite at adult scale (`stageScale = 1.0`, `petSize = medium 1.5×`)
  renders at approximately **144 × 96 px** on screen (before weight scaling).
- An upright sprite at adult scale renders at approximately **144 × 216 px**.
- The stage canvas is 200 × 240 px, so upright adult sprites fill most of the
  canvas height — leave a few rows of empty space at the top of the 32×48 grid.
- Baby stage (`stageScale = 0.65`) renders at ~60% of the adult on-screen size.
  Sketch babies at roughly 60% the size of the adult sketch.
