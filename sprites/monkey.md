# Monkey Sprite — Design Sketch

## Spec

| Decision | Choice |
|---|---|
| Grid | 32 × 48 upright |
| Facing | Left (side profile) — requires `SIDE_FACING_UPRIGHT` flip fix in renderer |
| Species vibe | Capuchin |
| Iconic cues | Face patch + curled tail + round side-ears |
| Pose | Arms slightly raised/out |
| Tail size | Long prehensile curl (wrapping upward along right edge) |
| Face | Face patch (colour 2) + nostril dot (colour 3) + eye (colour 1 in face patch) |
| Body shape | Wide shoulders with arm stubs, gradual taper to legs |
| Arms | Full colour 3 (dark), visually separated from body |
| Colour 3 usage | Arms, hands, upper legs, feet |
| Banana | Colour 5 (fixed `#FFD700`), held in forward hand |
| Banana stages | Teen, adult, senior only |

## Colour legend

| Symbol | Index | Colour | Usage |
|---|---|---|---|
| `█` | 1 | primary | body fill |
| `▓` | 2 | secondary | face patch, ear |
| `░` | 3 | accent (primary × 0.70) | arms, hands, upper legs, feet |
| `●` | 5 | `#FFD700` fixed | banana |

## Renderer changes required

1. **Colour 5** — add `5: "#FFD700"` to `colorMap` in `renderSpriteGrid()` (both VS Code + PyCharm sprites.js)
2. **Flip logic** — add `SIDE_FACING_UPRIGHT = { monkey: 1 }` and update the flip condition:
   ```js
   var SIDE_FACING_UPRIGHT = { monkey: 1 };
   var isSideUpright = !!SIDE_FACING_UPRIGHT[spriteType];
   if (isSideUpright ? !facingLeft : (isUpright ? facingLeft : !facingLeft)) {
     // flip canvas
   }
   ```

---

## Baby (~60% scale) — approved

```
32 × 48 upright grid — monkey baby — facing LEFT
Body ends row 36, legs start row 37 ✓, tail nub connected ✓

         00000000001111111111222222222233
         01234567890123456789012345678901
        ┌────────────────────────────────┐
Row  0  │                                │
Row  1  │                                │
Row  2  │                                │
Row  3  │                                │
Row  4  │                                │
Row  5  │                                │
Row  6  │                                │
Row  7  │                                │
Row  8  │                                │
Row  9  │                                │
Row 10  │                                │
Row 11  │                                │
Row 12  │                                │
Row 13  │                                │
Row 14  │                                │
Row 15  │                                │
Row 16  │                                │
Row 17  │                                │
Row 18  │                                │
Row 19  │                                │
Row 20  │                                │
Row 21  │                                │
Row 22  │                                │
Row 23  │                                │
Row 24  │                                │
Row 25  │              ▓▓                │  ← tiny ear
Row 26  │            ▓▓████              │  ← face patch + skull (~5px)
Row 27  │            ▓█░▓██              │  ← eye (█), nostril (░)
Row 28  │            ▓▓▓▓██              │  ← lower face
Row 29  │             ░░████             │  ← stub arm left + body
Row 30  │             ░░████░            │  ← stub arm + rear nub
Row 31  │              ██████            │  ← torso
Row 32  │              ███████           │  ← torso + 1px tail nub (connected) ✓
Row 33  │              ██████            │  ← lower torso
Row 34  │              ██████            │  ← pelvis
Row 35  │              ██████            │  ← hip
Row 36  │               ████             │  ← hip base — last body row ✓
Row 37  │             ░░ ░░              │  ← upper legs (colour 3) — adjacent ✓
Row 38  │             ██ ██              │
Row 39  │             ██ ██              │
Row 40  │             ██ ██              │
Row 41  │                                │  ← gap (animation)
Row 42  │             ██ ██              │
Row 43  │             ██ ██              │
Row 44  │             ██ ██              │
Row 45  │             ██ ██              │
Row 46  │            ░░░ ░░░             │  ← feet (colour 3)
Row 47  │            ░░░ ░░░             │
        └────────────────────────────────┘
Notes: no banana, 1px tail nub at row 32 attached to torso right edge,
       stub arms (2px colour 3), head ~5px wide, ear is single 2px bump
```

---

## Child (~75% scale) — approved

```
32 × 48 upright grid — monkey child — facing LEFT
Body ends row 36, legs start row 37 ✓, tail connected at row 29 right edge ✓

         00000000001111111111222222222233
         01234567890123456789012345678901
        ┌────────────────────────────────┐
Row  0  │                                │
Row  1  │                                │
Row  2  │                                │
Row  3  │                                │
Row  4  │                                │
Row  5  │                                │
Row  6  │                                │
Row  7  │                                │
Row  8  │                                │
Row  9  │                                │
Row 10  │                                │
Row 11  │                                │
Row 12  │                                │
Row 13  │                                │
Row 14  │                                │
Row 15  │                                │
Row 16  │                                │
Row 17  │                                │
Row 18  │                                │
Row 19  │              ▓▓                │  ← ear
Row 20  │            ▓▓▓███              │  ← ear base + skull (~7px)
Row 21  │           ▓▓▓█████             │  ← face patch
Row 22  │           ▓█░▓████             │  ← eye, nostril
Row 23  │           ▓▓▓▓████             │  ← lower face
Row 24  │            ████████            │  ← jaw/neck
Row 25  │           ░░░██████            │  ← shoulder + forward arm
Row 26  │         ░░░░████████░          │  ← arm extends + rear stub
Row 27  │          ░░░████████░          │  ← arm + rear stub
Row 28  │           ████████             │  ← torso
Row 29  │           █████████████        │  ← lower torso, tail root at right edge ✓
Row 30  │            ██████████  ██      │  ← body narrows, tail pixel adjacent ✓
Row 31  │            █████████    ██     │  ← tail curling up, connected ✓
Row 32  │             ████████    █      │  ← tail tip
Row 33  │             ████████           │  ← pelvis
Row 34  │             ███████            │  ← narrowing
Row 35  │              █████             │  ← hip
Row 36  │              █████             │  ← hip base — last body row ✓
Row 37  │            ░░  ░░              │  ← upper legs — adjacent ✓
Row 38  │            ██  ██              │
Row 39  │            ██  ██              │
Row 40  │            ██  ██              │
Row 41  │                                │  ← gap
Row 42  │            ██  ██              │
Row 43  │            ██  ██              │
Row 44  │            ██  ██              │
Row 45  │            ██  ██              │
Row 46  │           ░░░  ░░░             │  ← feet
Row 47  │           ░░░  ░░░             │
        └────────────────────────────────┘
Notes: no banana, 3px tail curl (rows 29-32) attached to lower torso,
       arms ~3px with colour-3 tips, head ~7px wide, 2px ear
```

---

## Teen (~85% scale) — approved

```
32 × 48 upright grid — monkey teen — facing LEFT
Body ends row 36, legs start row 37 ✓, tail connected ✓

         00000000001111111111222222222233
         01234567890123456789012345678901
        ┌────────────────────────────────┐
Row  0  │                                │
Row  1  │                                │
Row  2  │                                │
Row  3  │                                │
Row  4  │                                │
Row  5  │                                │
Row  6  │                                │
Row  7  │                                │
Row  8  │                                │
Row  9  │                                │
Row 10  │                                │
Row 11  │                                │
Row 12  │             ▓▓                 │  ← ear
Row 13  │            ▓▓▓▓                │  ← ear base
Row 14  │          ████████              │  ← skull (~10px)
Row 15  │         ▓▓▓▓███████            │  ← face patch
Row 16  │         ▓█▓░▓███████           │  ← eye, nostril
Row 17  │         ▓▓▓▓▓███████           │  ← lower face
Row 18  │          █████████████         │  ← jaw/shoulders
Row 19  │        ░░░░█████████████       │  ← forward arm
Row 20  │  ●●   ░░░░░█████████████░░     │  ← banana + arm + rear arm
Row 21  │   ●░░░░░░░░█████████████░░     │  ← banana curve
Row 22  │    ░░░░██████████████░░        │  ← arm taper
Row 23  │        ██████████████          │  ← torso
Row 24  │        ████████████████        │  ← lower torso + tail root
Row 25  │        ██████████████████      │  ← tail extends right ✓
Row 26  │         █████████████  ████    │  ← tail curl
Row 27  │         █████████████    ███   │  ← tail ascending
Row 28  │          ███████████      ██   │  ← tail tip
Row 29  │          ███████████           │  ← pelvis
Row 30  │          ██████████            │  ← narrowing
Row 31  │           █████████            │
Row 32  │           █████████            │
Row 33  │            ███████             │
Row 34  │            ███████             │
Row 35  │             █████              │  ← hip
Row 36  │             █████              │  ← hip base — last body row ✓
Row 37  │          ░░░   ░░░             │  ← upper legs — adjacent ✓
Row 38  │          ███   ███             │
Row 39  │          ███   ███             │
Row 40  │          ███   ███             │
Row 41  │                                │  ← gap
Row 42  │          ███   ███             │
Row 43  │          ███   ███             │
Row 44  │          ███   ███             │
Row 45  │          ███   ███             │
Row 46  │         ░░░░  ░░░░             │  ← feet
Row 47  │         ░░░░  ░░░░             │
        └────────────────────────────────┘
Notes: banana appears (small, rows 20-21), ~6px tail curl attached at row 25,
       arms ~4px colour-3, head ~10px wide, 2px ear
```

---

## Adult (100%) — approved

```
32 × 48 upright grid — monkey adult — facing LEFT
Body ends row 36, legs start row 37 ✓, tail connected at row 23 right edge ✓

         00000000001111111111222222222233
         01234567890123456789012345678901
        ┌────────────────────────────────┐
Row  0  │                                │
Row  1  │                                │
Row  2  │                                │
Row  3  │                                │
Row  4  │                                │
Row  5  │                                │
Row  6  │                                │
Row  7  │            ▓▓                  │  ← round ear (colour 2)
Row  8  │           ▓▓▓▓                 │  ← ear base
Row  9  │         ████████               │  ← skull top
Row 10  │        ██████████              │  ← skull
Row 11  │       ▓▓▓▓████████             │  ← face patch / snout protrudes left
Row 12  │       ▓█▓░▓████████            │  ← eye (█ in ▓ patch), nostril (░)
Row 13  │       ▓▓▓▓▓████████            │  ← lower face patch
Row 14  │        ████████████            │  ← jaw / neck
Row 15  │        ████████████            │  ← upper shoulders
Row 16  │      ░░░░██████████            │  ← arm (colour 3) extends left from shoulder
Row 17  │    ░░░░░░██████████████        │  ← long forward arm
Row 18  │  ●●░░░░░░██████████████░░░     │  ← banana (●●) at hand tip + rear arm
Row 19  │   ●●░░░░░██████████████░░░     │  ← banana curve + rear arm
Row 20  │    ░░░░████████████████░░      │  ← arms taper, rear hand
Row 21  │      ██████████████            │  ← mid torso
Row 22  │      ██████████████            │  ← mid torso
Row 23  │      ████████████████          │  ← lower torso + tail root ✓
Row 24  │      ██████████████████        │  ← tail extends right
Row 25  │       ████████████  ████       │  ← tail curling outward
Row 26  │       ████████████    ████     │  ← tail curling upward
Row 27  │        ██████████      ████    │  ← tail ascending
Row 28  │        ██████████        ██    │  ← tail tip top of curl
Row 29  │        ██████████        ██    │
Row 30  │         ████████       ██      │  ← tail curls inward
Row 31  │         ████████     ██        │
Row 32  │          ████████  ██          │
Row 33  │          ████████              │  ← pelvis
Row 34  │           ██████               │  ← narrowing to hips
Row 35  │           ██████               │
Row 36  │            ████                │  ← hip base — last body row ✓
Row 37  │         ░░░   ░░░              │  ← upper legs (colour 3) — adjacent ✓
Row 38  │         ██     ██              │
Row 39  │         ██     ██              │
Row 40  │         ██     ██              │
Row 41  │                                │  ← gap row (animation split)
Row 42  │         ██     ██              │
Row 43  │         ██     ██              │
Row 44  │         ██     ██              │
Row 45  │         ██     ██              │
Row 46  │        ░░░   ░░░               │  ← feet (colour 3)
Row 47  │        ░░░   ░░░               │
        └────────────────────────────────┘
Notes: full banana (rows 18-19), full prehensile tail curl (~10 rows),
       arms ~5px colour-3, head ~12px wide
```

---

## Senior (= adult + age spots) — approved

```
32 × 48 upright grid — monkey senior — facing LEFT
Identical to adult with colour-3 (░) age spots on torso per Rule 6

         00000000001111111111222222222233
         01234567890123456789012345678901
        ┌────────────────────────────────┐
Row  0  │                                │
Row  1  │                                │
Row  2  │                                │
Row  3  │                                │
Row  4  │                                │
Row  5  │                                │
Row  6  │                                │
Row  7  │            ▓▓                  │
Row  8  │           ▓▓▓▓                 │
Row  9  │         ████████               │
Row 10  │        ██████████              │
Row 11  │       ▓▓▓▓████████             │
Row 12  │       ▓█▓░▓████████            │
Row 13  │       ▓▓▓▓▓████████            │
Row 14  │        ████████████            │
Row 15  │        ██░█████████            │  ← age spot upper torso
Row 16  │      ░░░░███░███████           │  ← arm + age spot
Row 17  │    ░░░░░░██████████████        │
Row 18  │  ●●░░░░░░██░█████████████░░░   │  ← banana + age spot mid-torso
Row 19  │   ●●░░░░░██████████████░░░     │
Row 20  │    ░░░░████░███████████░░      │  ← age spot lower torso
Row 21  │      ██████████████            │
Row 22  │      ████░█████████            │  ← age spot
Row 23  │      ████████████████          │
Row 24  │      ██████████████████        │
Row 25  │       ████████████  ████       │
Row 26  │       ████████████    ████     │
Row 27  │        ██████████      ████    │
Row 28  │        ██████████        ██    │
Row 29  │        ██████████        ██    │
Row 30  │         ████████       ██      │
Row 31  │         ████████     ██        │
Row 32  │          ████████  ██          │
Row 33  │          ████████              │
Row 34  │           ██░███               │  ← age spot pelvis
Row 35  │           ██████               │
Row 36  │            ████                │  ← hip base ✓
Row 37  │         ░░░   ░░░              │  ← upper legs ✓
Row 38  │         ██     ██              │
Row 39  │         ██     ██              │
Row 40  │         ██     ██              │
Row 41  │                                │
Row 42  │         ██     ██              │
Row 43  │         ██     ██              │
Row 44  │         ██     ██              │
Row 45  │         ██     ██              │
Row 46  │        ░░░   ░░░               │  ← feet
Row 47  │        ░░░   ░░░               │
        └────────────────────────────────┘
Notes: identical to adult, 5 colour-3 age spots at rows 15, 16, 18, 20, 22, 34
```

---

## Stage scaling summary

| Stage | Head width | Arms | Tail | Banana | Age spots |
|---|---|---|---|---|---|
| Baby | ~5px | 2px stubs (colour 3) | 1px nub at row 32 | — | — |
| Child | ~7px | 3px (colour 3) | 3px curl rows 29–32 | — | — |
| Teen | ~10px | 4px (colour 3) | 6px curl rows 25–28 | Small rows 20–21 | — |
| Adult | ~12px | 5px (colour 3) | Full ~10px curl rows 23–32 | Full rows 18–19 | — |
| Senior | ~12px | = adult | = adult | = adult | 5 spots on torso |
