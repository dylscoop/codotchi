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
