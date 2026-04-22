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

## Adult (approved sketch)

```
32 × 48 upright grid — monkey adult — facing LEFT

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
Row 23  │      ████████████████          │  ← lower torso + tail root
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
Row 36  │            ████                │  ← hip base
Row 37  │         ░░░   ░░░              │  ← upper legs (colour 3)
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
```

## Stage scaling plan

| Stage | Scale | Head rows | Body width | Arm length | Tail | Banana | Legs |
|---|---|---|---|---|---|---|---|
| Baby | ~60% | 3 rows | ~8px | 2px stubs, no hand detail | 1–2px nub | No | 2px wide, 2 rows short |
| Child | ~75% | 4 rows | ~10px | 3px, colour-3 tips | 3–4px curl | No | 2px wide |
| Teen | ~85% | 5 rows | ~14px | 4px, colour-3 hands | ~6px curl | Yes (small) | 2px wide |
| Adult | 100% | 6 rows | ~16px | 5px, colour-3 hands | ~9px full curl | Yes | 2px wide |
| Senior | 100% | = Adult | = Adult | = Adult | = Adult | Yes | = Adult + colour-3 age spots on torso |

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
