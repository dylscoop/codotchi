# Codotchi Sprites Reference

Complete visual design guide for all pixel-art sprites in the Codotchi extension.

---

## Overview

All sprites are defined in `vscode/media/sprites.js` (mirrored verbatim to
`pycharm/src/main/resources/webview/sprites.js`).

To preview all sprites interactively in-IDE, enable developer mode then open the Command Palette (VS Code) or Tools menu (PyCharm) and run **Codotchi: Open Sprite Preview (Dev)**. The preview uses the real `renderSpriteGrid()` function for pixel-accurate output including leg animation, mood-based colour overrides, stage scaling, and weight proportions. The standalone browser version (`vscode/media/sprite_preview.html`) still works via `file://` but the in-IDE panel is the recommended workflow.

One grid size per animal type:

| Type | Grid (cols × rows) | Animals |
|------|--------------------|---------|
| Quadruped | 48 × 32 | cat, rat, ox, tiger, rabbit, horse, goat, dog, pig |
| Snake | 48 × 32 | snake |
| Upright | 32 × 48 | classic, monkey, rooster, dragon |

Each animal has five life stages: `baby`, `child`, `teen`, `adult`, `senior`.

---

## Colour Legend

```
█  = 1  body fill (primary colour)
▓  = 2  secondary  (eyes, snout, markings, nose)
░  = 3  accent     (stripes, comb, ridges — primary darkened ~70%)
   = 0  transparent
```

Special render-time overrides:
- `sick=true` → secondary (▓) renders as `#ff4444`
- `sleeping=true` → secondary (▓) renders as `#888888`

---

## Grid Orientation

**Quadrupeds / Snake**: head faces LEFT (col 0), tail at right (col 47).  
**Upright**: character faces viewer, head at top (row 0), feet at bottom (row 47).

---

## Body Growth Rules

For **quadrupeds**, each stage extends the body rightward:

| Stage  | Body cols (approx) | Width mult |
|--------|--------------------|------------|
| baby   | 0 – 18             | 0.65       |
| child  | 0 – 26             | 0.75       |
| teen   | 0 – 34             | 0.85       |
| adult  | 0 – 42             | 1.00       |
| senior | 0 – 44             | 1.00       |

Head always occupies ~cols 0–11. Front legs at ~cols 4–7; rear legs follow body right edge.

For **uprights**, each stage grows both wider and taller. Body flows directly into legs (no gap):

| Stage  | Body rows    | Lower torso/pelvis rows | Width mult |
|--------|--------------|-------------------------|------------|
| baby   | 28 – 36      | 34 – 36                 | 0.65       |
| child  | 21 – 31      | 27 – 36 (gap rows 32–36 blank for small stages) | 0.75 |
| teen   | 11 – 36      | 22 – 36                 | 0.85       |
| adult  | 8 – 36       | 22 – 36                 | 1.00       |
| senior | 8 – 36       | 22 – 36                 | 1.00       |

The body tapers into a narrow pelvis region (rows ~22–36) that connects directly
to the leg tops at row 37 — no blank rows between body and legs.

---

## Leg Row Reference

- **Quadruped**: leg rows 25–31 (upper leg 25–26, lower leg 27–29, foot 30–31)
- **Upright**: leg rows 37–47 (upper 37–41, lower 42–45, foot 46–47)
- `legRowStart` in renderer: quadruped = **25**, upright = **37**
- Body art for uprights ends at row 36 to connect directly to leg tops at row 37

---

## Weight Effects

| Weight | Quadruped width | Upright width | Upright height |
|--------|----------------|---------------|----------------|
| > 80   | × 1.50         | × 1.40        | × 1.30         |
| > 50   | × 1.30         | × 1.20        | × 1.15         |
| < 17   | × 0.80         | × 0.80        | × 0.80         |
| else   | × 1.00         | × 1.00        | × 1.00         |

---

---

# UPRIGHT SPRITES (32 × 48)

---

## classic

Round blob creature. Two arm-stubs at sides. No ears, no tail.  
Grows wider and taller each stage. Age spots (░) appear at senior.

```
BABY (32×48)  — rows 0–47, cols 0–31
Row 00:                                 
Row 01:                                 
Row 02:                                 
Row 03:                                 
Row 04:                                 
Row 05:                                 
Row 06:                                 
Row 07:                                 
Row 08:                                 
Row 09:                                 
Row 10:                                 
Row 11:                                 
Row 12:          ████████                
Row 13:        ████████████              
Row 14:       ██▓██████▓███             
Row 15:       ██████████████            
Row 16:       ██████████████            
Row 17:        ██████████████           
Row 18:        ████████████             
Row 19:          ████████               
Row 20:                                 
Row 21:                                 
Row 22:                                 
Row 23:                                 
Row 24:                                 
Row 25:                                 
Row 26:                                 
Row 27:                                 
Row 28:                                 
Row 29:                                 
Row 30:                                 
Row 31:                                 
Row 32:                                 
Row 33:                                 
Row 34:                                 
Row 35:                                 
Row 36:                                 
Row 37:                                 
Row 38:                                 
Row 39:                                 
Row 40:                                 
Row 41:                                 
Row 42:                                 
Row 43:                                 
Row 44:                                 
Row 45:                                 
Row 46:                                 
Row 47:                                 
```

The visual grids below use a more compact representation. Each row is shown as a
string of exactly **32** characters (upright) or **48** characters (quadruped/snake).
Column 0 is leftmost. Spaces = transparent.

---

### Compact notation key

```
█ = 1 (body)    ▓ = 2 (secondary)    ░ = 3 (accent)    [space] = 0 (transparent)
```

For readability, each sprite is shown with a pipe `|` border (not part of the grid).

---

## classic  (32 × 48 upright)

Round bubbly creature. Two tiny arm-stubs. Eyes are ▓ pixels in the upper face.
Body tapers into a narrow pelvis that connects directly to two legs. No gap between body and legs.

### baby

```
|                                |  row 0
|                                |  ...
|                                |  row 27
|         ████████               |  row 28
|       ████████████             |  row 29
|      ██▓████████▓██            |  row 30  eyes
|      ██████████████            |  row 31
|      ██████████████            |  row 32
|      ██████████████            |  row 33
|       ████████████             |  row 34
|        ████████████            |  row 35
|          ████████              |  row 36  pelvis → leg tops
|          ████████              |  row 37  left leg
|          ████████              |  row 38
|          ████████              |  row 39
|          ████████              |  row 40
|                                |  row 41
|           ██████               |  row 42  right leg
|           ██████               |  row 43
|           ██████               |  row 44
|           ██████               |  row 45
|           █ █ █                |  row 46  feet
|           █ █ █                |  row 47
```

### child

```
|                                |  row 0
|                                |  ...
|                                |  row 20
|          ██████████            |  row 21
|        ██████████████          |  row 22
|     ████▓██████▓████           |  row 23  eyes + arm stubs
|     ████████████████           |  row 24
|     ████████████████           |  row 25
|     ████████████████           |  row 26
|      ██████████████            |  row 27
|       ████████████             |  row 28
|        ████████████            |  row 29
|         ████████               |  row 30  lower body
|          ████████              |  row 31  pelvis
|                                |  row 32-36
|          ████████              |  row 37  left leg
|          ████████              |  row 38
|          ████████              |  row 39
|          ████████              |  row 40
|                                |  row 41
|           ██████               |  row 42  right leg
|           ██████               |  row 43
|           ██████               |  row 44
|           ██████               |  row 45
|           █ █ █                |  row 46  feet
|           █ █ █                |  row 47
```

### teen

```
|                                |  row 0–10
|          ██████████            |  row 11
|        ██████████████          |  row 12
|       ████████████████         |  row 13
|     ████▓██████▓████████       |  row 14  eyes + arm stubs
|     ████████████████████       |  row 15
|    ██████████████████████      |  row 16
|    ██████████████████████      |  row 17
|     ████████████████████       |  row 18
|      ████████████████          |  row 19
|       ██████████████           |  row 20
|        ████████████            |  row 21
|         ████████               |  row 22  lower torso
|          ████████              |  row 23–36  pelvis narrows
|          ████████              |
|         ████████               |
|          ████████              |  row 37  hips
|          ████████              |  row 38
|           ██████               |  row 39
|           ██████               |  row 40
|                                |  row 41
|           ██████               |  row 42
|           ██████               |  row 43
|           ██████               |  row 44
|          ████████              |  row 45
|          ██    ██              |  row 46  feet
|          ██    ██              |  row 47
```

### adult

```
|                                |  row 0–7
|        ████████████            |  row 8
|       ██████████████           |  row 9
|      ████▓██████▓████          |  row 10  eyes
|      ████████████████          |  row 11
|     ██████████████████         |  row 12
|     ██████████████████         |  row 13
|    ████████████████████        |  row 14
|    ████████████████████        |  row 15
|    ████████████████████        |  row 16
|     ██████████████████         |  row 17
|     ██████████████████         |  row 18
|      ████████████████          |  row 19
|       ██████████████           |  row 20
|        ████████████            |  row 21
|         ████████               |  row 22  lower torso
|          ████████              |  row 23
|           ██████               |  row 24–36  pelvis
|           ██████               |  →  connected to legs
|           ██████               |  row 37  upper leg
|          ████████              |  row 38  hips
|           ██████               |  row 39
|           ██████               |  row 40
|                                |  row 41
|          ████████              |  row 42
|          ████████              |  row 43
|          ████████              |  row 44
|         ██████████             |  row 45
|         ██      ██             |  row 46  feet
|         ██      ██             |  row 47
```

### senior

Same as adult, with age spots (░) at rows 13, 15, 17 across torso. Legs and pelvis identical to adult.

---

## monkey  (32 × 48 upright)

Capuchin — side profile facing left. Round ear (▓) on top-left of skull. Lighter face-patch (▓) protrudes left as snout; eye (█ inside patch) and nostril (░) on face patch. Both arms colour 3 (dark), forward arm long with colour-3 hand holding a banana (●, fixed yellow, teen/adult/senior only). Long prehensile tail curls from lower-right torso upward along the right edge. Colour-3 upper legs and feet. Renderer uses `SIDE_FACING_UPRIGHT` flip — behaves like a quadruped (flips when facing right).

### baby

```
|                                |  r0
|                                |  r1
|                                |  r2
|                                |  r3
|                                |  r4
|                                |  r5
|                                |  r6
|                                |  r7
|                                |  r8
|                                |  r9
|                                |  r10
|                                |  r11
|                                |  r12
|                                |  r13
|                                |  r14
|                                |  r15
|                                |  r16
|                                |  r17
|                                |  r18
|                                |  r19
|                                |  r20
|                                |  r21
|                                |  r22
|                                |  r23
|                                |  r24
|             ▌▌                 |  r25  ear
|           ▌▌██                 |  r26  face+skull
|           ▌█░▌██               |  r27  eye nostril
|           ▌▌▌▌██               |  r28  lower face
|            ░░████              |  r29  stub arm + body
|            ░░████░             |  r30  stub arm + rear nub
|             ██████             |  r31  torso
|             ███████            |  r32  torso + tail nub
|             ██████             |  r33  lower torso
|             ██████             |  r34  pelvis
|             ██████             |  r35  hip
|              ███               |  r36  hip base
|            ░ ░                 |  r37  upper legs
|            █ █                 |  r38
|            █ █                 |  r39
|            █ █                 |  r40
|                                |  r41  gap
|            █ █                 |  r42
|            █ █                 |  r43
|            █ █                 |  r44
|            █ █                 |  r45
|           ░░ ░░                |  r46  feet
|           ░░ ░░                |  r47
```

### child

```
|                                |  r0
|                                |  r1
|                                |  r2
|                                |  r3
|                                |  r4
|                                |  r5
|                                |  r6
|                                |  r7
|                                |  r8
|                                |  r9
|                                |  r10
|                                |  r11
|                                |  r12
|                                |  r13
|                                |  r14
|                                |  r15
|                                |  r16
|                                |  r17
|                                |  r18
|             ▌▌                 |  r19  ear
|           ▌▌▌███               |  r20  ear base + skull
|           ▌▌▌████              |  r21  face patch
|           ▌█░▌███              |  r22  eye nostril
|           ▌▌▌▌███              |  r23  lower face
|            ████████            |  r24  jaw/neck
|           ░░░█████             |  r25  shoulder + forward arm
|         ░░░░████████░          |  r26  arm extends + rear stub
|          ░░░████████░          |  r27  arm + rear stub
|           ████████             |  r28  torso
|           █████████████        |  r29  lower torso + tail root
|            ██████████  ██      |  r30  tail adjacent
|            █████████    ██     |  r31  tail curl
|             ████████    █      |  r32  tail tip
|             ████████           |  r33  pelvis
|             ███████            |  r34  narrowing
|              █████             |  r35  hip
|              █████             |  r36  hip base
|            ░░  ░░              |  r37  upper legs
|            ██  ██              |  r38
|            ██  ██              |  r39
|            ██  ██              |  r40
|                                |  r41  gap
|            ██  ██              |  r42
|            ██  ██              |  r43
|            ██  ██              |  r44
|            ██  ██              |  r45
|           ░░░  ░░░             |  r46  feet
|           ░░░  ░░░             |  r47
```

### teen

```
|                                |  r0
|                                |  r1
|                                |  r2
|                                |  r3
|                                |  r4
|                                |  r5
|                                |  r6
|                                |  r7
|                                |  r8
|                                |  r9
|                                |  r10
|                                |  r11
|             ▌▌                 |  r12  ear
|            ▌▌▌▌                |  r13  ear base
|          ████████              |  r14  skull
|         ▌▌▌▌███████            |  r15  face patch
|         ▌█▌░▌███████           |  r16  eye nostril
|         ▌▌▌▌▌███████           |  r17  lower face
|          █████████████         |  r18  jaw/shoulders
|        ░░░░███████████       |  r19  forward arm
|  ●●   ░░░░░███████████░░     |  r20  banana + arm
|   ●░░░░░░░░███████████░░     |  r21  banana curve
|    ░░░░████████████░░        |  r22  arm taper
|        ██████████████          |  r23  torso
|        ████████████████        |  r24  lower torso + tail root
|        ██████████████████      |  r25  tail extends
|         █████████████  ████    |  r26  tail curl
|         █████████████    ███   |  r27  tail ascending
|          ███████████      ██   |  r28  tail tip
|          ███████████           |  r29
|          ██████████            |  r30
|           █████████            |  r31
|           █████████            |  r32
|            ███████             |  r33
|            ███████             |  r34
|             █████              |  r35  hip
|             █████              |  r36  hip base
|          ░░░   ░░░             |  r37  upper legs
|          ███   ███             |  r38
|          ███   ███             |  r39
|          ███   ███             |  r40
|                                |  r41  gap
|          ███   ███             |  r42
|          ███   ███             |  r43
|          ███   ███             |  r44
|          ███   ███             |  r45
|         ░░░░  ░░░░             |  r46  feet
|         ░░░░  ░░░░             |  r47
```

### adult

```
|                                |  r0
|                                |  r1
|                                |  r2
|                                |  r3
|                                |  r4
|                                |  r5
|                                |  r6
|            ▌▌                  |  r7   ear
|           ▌▌▌▌                 |  r8   ear base
|         ████████               |  r9   skull top
|         █████████              |  r10  skull
|   ▌▌▌▌▌████████               |  r11  face patch + snout
|   ▌█▌░▌████████               |  r12  eye nostril
|   ▌▌▌▌▌████████               |  r13  lower face
|         ███████████            |  r14  jaw/neck
|         ███████████            |  r15  upper shoulders
|     ░░░░█████████              |  r16  arm extends left
|   ░░░░░░███████████████          |  r17  long forward arm
| ●●░░░░░░█████████████░░░       |  r18  banana + arm + rear arm
| ●●░░░░░░█████████████░░░       |  r19  banana curve
|   ░░░░████████████████░        |  r20  arms taper
|        ███████████████         |  r21  mid torso
|        ███████████████         |  r22  mid torso
|        █████████████████       |  r23  lower torso + tail root
|        ███████████████████     |  r24  tail extends
|        ████████████  █████     |  r25  tail curling
|        ████████████      ████  |  r26  tail curling up
|         ███████████       ████ |  r27  tail ascending
|         ███████████         ██ |  r28  tail tip
|         ███████████         ██ |  r29
|          ████████          ██  |  r30  tail curls inward
|          ████████        ██    |  r31
|           █████████   ██       |  r32
|           █████████            |  r33  pelvis
|            ██████              |  r34  narrowing
|            ██████              |  r35
|             ████               |  r36  hip base
|          ░░░   ░░░             |  r37  upper legs
|          ███   ███             |  r38
|          ███   ███             |  r39
|          ███   ███             |  r40
|                                |  r41  gap
|          ███   ███             |  r42
|          ███   ███             |  r43
|          ███   ███             |  r44
|          ███   ███             |  r45
|         ░░░░  ░░░░             |  r46  feet
|         ░░░░  ░░░░             |  r47
```

### senior

Identical to adult with colour-3 age spots on torso (rows 15, 16, 18, 20, 22, 34).

```
|                                |  r0
|                                |  r1
|                                |  r2
|                                |  r3
|                                |  r4
|                                |  r5
|                                |  r6
|            ▌▌                  |  r7
|           ▌▌▌▌                 |  r8
|         ████████               |  r9
|         █████████              |  r10
|   ▌▌▌▌▌████████               |  r11
|   ▌█▌░▌████████               |  r12
|   ▌▌▌▌▌████████               |  r13
|         ███████████            |  r14
|         ██░████████            |  r15  age spot
|     ░░░░██░████████              |  r16  arm + age spot
|   ░░░░░░███████████████          |  r17
| ●●░░░░░░██░██████████░░░       |  r18  banana + age spot
| ●●░░░░░░█████████████░░░       |  r19
|   ░░░░████░██████████░        |  r20  age spot
|        ███████████████         |  r21
|        ████░██████████         |  r22  age spot
|        █████████████████       |  r23
|        ███████████████████     |  r24
|        ████████████  █████     |  r25
|        ████████████      ████  |  r26
|         ███████████       ████ |  r27
|         ███████████         ██ |  r28
|         ███████████         ██ |  r29
|          ████████          ██  |  r30
|          ████████        ██    |  r31
|           █████████   ██       |  r32
|           █████████            |  r33
|            ██░███              |  r34  age spot
|            ██████              |  r35
|             ████               |  r36
|          ░░░   ░░░             |  r37
|          ███   ███             |  r38
|          ███   ███             |  r39
|          ███   ███             |  r40
|                                |  r41
|          ███   ███             |  r42
|          ███   ███             |  r43
|          ███   ███             |  r44
|          ███   ███             |  r45
|         ░░░░  ░░░░             |  r46
|         ░░░░  ░░░░             |  r47
```

---

## rooster  (32 × 48 upright, side profile facing left)

Side-profile rooster. Serrated comb (░) on top of head. Pointed beak (▓) facing left. Wattle (░) below beak. Curved tail fan (▓) arcing up from lower rump. Simple stick legs with thin 2px feet.

Colour 1 = body, Colour 2 = beak / eye / tail fan, Colour 3 = comb / wattle / senior age spots.

Rendered with `SIDE_FACING_UPRIGHT` flip logic (flips when not facing left, same as monkey).

### baby

```
|                                |
|                                |
|                                |
|                                |
|                                |
|                                |
|                                |
|                                |
|                                |
|                                |
|                                |
|                                |
|                                |
|                                |
|                                |
|                                |
|                                |
|                                |
|                                |
|                                |
|         ░░                     |
|        ░░░                     |
|         ░░                     |
|         ████                   |
|         █▓███                  |
|       ▓▓██████                 |
|         ░█████                 |
|         ██████                 |
|         ███████                |
|        ████████                |
|        ████████                |
|        ████████  ▓▓            |
|         ███████▓▓▓▓▓           |
|         ██████▓▓▓▓▓            |
|          █████▓▓▓▓             |
|          █████                 |
|          ████                  |
|          █ █                   |
|          █ █                   |
|          █ █                   |
|          █ █                   |
|          █ █                   |
|          █ █                   |
|          █ █                   |
|          █ █                   |
|          █ █                   |
|         ██ ██                  |
|         ██ ██                  |
```

### child

```
|                                |
|                                |
|                                |
|                                |
|                                |
|                                |
|                                |
|                                |
|                                |
|                                |
|                                |
|                                |
|                                |
|                                |
|                                |
|                                |
|         ░░                     |
|        ░░░░                    |
|         ░░                     |
|         █████                  |
|         ███████                |
|         █▓██████               |
|      ▓▓█████████               |
|         ░████████              |
|         █████████              |
|        ██████████              |
|        ██████████              |
|        ██████████              |
|        ██████████  ▓▓          |
|         █████████▓▓▓▓▓         |
|         ████████▓▓▓▓▓▓▓        |
|          ████████▓▓▓▓          |
|          ████████▓▓▓▓          |
|          ███████               |
|          ██████                |
|          █████                 |
|          ████                  |
|          █ █                   |
|          █ █                   |
|          █ █                   |
|          █ █                   |
|          █ █                   |
|          █ █                   |
|          █ █                   |
|          █ █                   |
|          █ █                   |
|         ██ ██                  |
|         ██ ██                  |
```

### teen

```
|                                |
|                                |
|                                |
|                                |
|                                |
|                                |
|                                |
|                                |
|                                |
|         ░░                     |
|        ░░░░                    |
|         ░░                     |
|         ██████                 |
|        ████████                |
|        █▓███████               |
|      ▓▓███████████             |
|         ░█████████             |
|        ██████████              |
|        ███████████             |
|       ████████████             |
|       ████████████             |
|       ████████████             |
|       ████████████             |
|       ████████████             |
|        ███████████             |
|        ███████████  ▓▓         |
|         ██████████▓▓▓▓▓▓       |
|         █████████▓▓▓▓▓▓▓       |
|          ████████▓▓▓▓▓▓▓       |
|          ████████▓▓▓▓▓         |
|          ████████▓▓▓▓          |
|          ███████               |
|          ███████               |
|          █████                 |
|          █████                 |
|          █████                 |
|          ████                  |
|          █ █                   |
|          █ █                   |
|          █ █                   |
|          █ █                   |
|          █ █                   |
|          █ █                   |
|          █ █                   |
|          █ █                   |
|          █ █                   |
|         ██ ██                  |
|         ██ ██                  |
```

### adult

```
|                                |
|                                |
|                                |
|                                |
|                                |
|                                |
|                                |
|         ░░░                    |
|        ████                    |
|         ░░░                    |
|         ███████                |
|        █████████               |
|        █▓████████              |
|      ▓▓█████████               |
|         ░█████████             |
|        █████████               |
|        ██████████              |
|       ████████████             |
|       █████████████            |
|      █████████████             |
|      █████████████             |
|      █████████████             |
|      █████████████             |
|      █████████████  ▓▓         |
|       ███████████  ▓▓▓▓▓       |
|       ███████████▓▓▓▓▓▓▓       |
|        █████████▓▓▓▓▓▓▓▓       |
|        █████████▓▓▓▓▓▓▓▓       |
|         ████████▓▓▓▓▓▓▓        |
|         ████████▓▓▓▓▓          |
|          ████████▓▓▓▓          |
|          ████████▓▓            |
|          ████████              |
|          ████████              |
|          ███████               |
|          ██████                |
|          ████                  |
|          █ █                   |
|          █ █                   |
|          █ █                   |
|          █ █                   |
|          █ █                   |
|          █ █                   |
|          █ █                   |
|          █ █                   |
|          █ █                   |
|         ██ ██                  |
|         ██ ██                  |
```

### senior

```
|                                |
|                                |
|                                |
|                                |
|                                |
|                                |
|                                |
|         ░░░                    |
|        ████                    |
|         ░░░                    |
|         ███████                |
|        █████████               |
|        █▓████████              |
|      ▓▓█████████               |
|         ░█████████             |
|        █████████               |
|        ██████████              |
|       ████████████             |
|       ████░███████             |
|      █████████████             |
|      █████░███████             |
|      █████████████             |
|      █████░███████             |
|      █████████████  ▓▓         |
|       ███████████  ▓▓▓▓▓       |
|       ███░████████▓▓▓▓▓▓▓      |
|        █████████▓▓▓▓▓▓▓▓       |
|        █████████▓▓▓▓▓▓▓▓       |
|         ████████▓▓▓▓▓▓▓        |
|         ████████▓▓▓▓▓          |
|          ████████▓▓▓▓          |
|          ████████▓▓            |
|          ████████              |
|          ████████              |
|          ███████               |
|          ██████                |
|          ████                  |
|          █ █                   |
|          █ █                   |
|          █ █                   |
|          █ █                   |
|          █ █                   |
|          █ █                   |
|          █ █                   |
|          █ █                   |
|          █ █                   |
|         ██ ██                  |
|         ██ ██                  |
```

---

## dragon  (32 × 48 upright) — redesign pending

Two-legged upright dragon. Wings spread from torso sides (grow wider each stage). Spiky ridge (░) down back. Horns (▓) on head. Tail extends below body (░).

### baby

```
|                                |
|                                |
|                                |
|                                |
|                                |
|                                |
|                                |
|                                |
|                                |
|                                |
|                                |
|                                |
|                                |
|                                |
|                                |
|                                |
|                                |
|                                |
|           ▓████▓               |
|          ██████████            |
|          ████░█████            |
|          ██████████            |
|          ██████████            |
|           ████████             |
|           ██████               |
|                                |
|                                |
|                                |
|                                |
|                                |
|                                |
|                                |
|                                |
|                                |
|                                |
|                                |
|                                |
|                                |
|                                |
|                                |
|                                |
|                                |
|                                |
|                                |
|                                |
|              ░                 |
|             ░░░                |
|              ░                 |
```

### child

```
|                                |
|                                |
|                                |
|                                |
|                                |
|                                |
|                                |
|                                |
|                                |
|                                |
|                                |
|                                |
|                                |
|                                |
|                                |
|                                |
|            ▓████▓              |
|           ████████████         |
|          ██████░██████         |
|          ████████████          |
|       ██ ████████████ ██       |
|       ████████████████████     |
|          ████████████          |
|           ████████             |
|           ████████             |
|            ░░██░░              |
|                                |
|                                |
|                                |
|                                |
|                                |
|                                |
|                                |
|                                |
|                                |
|                                |
|                                |
|                                |
|                                |
|                                |
|                                |
|                                |
|                                |
|                                |
|                                |
|               ░                |
|              ░░░               |
|               ░                |
```

### teen

```
|                                |
|                                |
|                                |
|                                |
|                                |
|                                |
|                                |
|                                |
|                                |
|                                |
|                                |
|            ▓██████▓            |
|           ████████████         |
|          ██████░███████        |
|          ██████████████        |
|     ████ ████████████ ████     |
|    ██████████████████████████  |
|     ████ ████████████ ████     |
|          ██████████████        |
|          ████████████████      |
|           ██████████████       |
|            ░░████████░░        |
|              ████████          |
|               ██████           |
|                                |
|                                |
|                                |
|                                |
|                                |
|                                |
|                                |
|                                |
|                                |
|                                |
|                                |
|                                |
|                                |
|            ████████            |
|           ██████████           |
|            ████████            |
|            ████████            |
|                                |
|              ██████            |
|              ██████            |
|              ██████            |
|             ████████           |
|             ██    ██           |
|             ██    ██           |
```

### adult

```
|                                |
|                                |
|                                |
|                                |
|                                |
|                                |
|                                |
|                                |
|            ▓████████▓          |
|           ████████████         |
|          ████░░████░███        |
|          ████████████████      |
|     ██████████████████████████ |
|    ████████████████████████████|
|    ████████████████████████████|
|     ██████████████████████████ |
|          ████████████████      |
|          ██████████████████    |
|           ████████████████     |
|            ░░░████████░░░      |
|               ████████         |
|               ██████████       |
|                ████████        |
|                 ██████         |
|                                |
|                                |
|                                |
|                                |
|                                |
|                                |
|                                |
|                                |
|                                |
|                                |
|                                |
|                                |
|                                |
|           ██████████████       |
|          ████████████████      |
|           ██████████████       |
|           ██████████████       |
|                                |
|             ████████████       |
|             ████████████       |
|             ████████████       |
|            ██████████████      |
|            ██        ██        |
|            ██        ██        |
```

### senior

```
|                                |
|                                |
|                                |
|                                |
|                                |
|                                |
|                                |
|                                |
|            ▓████████▓          |
|           ████████████         |
|          ████░░████░███        |
|          ████████████████      |
|     ██████████████████████████ |
|    ████████████████████████████|
|    ████░███████████████░██████ |
|     █████░█████████████░█████  |
|          ████████████████      |
|          ████░████████░████    |
|           ████████████████     |
|            ░░░████████░░░      |
|               ████████         |
|               ██████████       |
|                ████████        |
|                 ██████         |
|                                |
|                                |
|                                |
|                                |
|                                |
|                                |
|                                |
|                                |
|                                |
|                                |
|                                |
|                                |
|                                |
|           ██████████████       |
|          ████████████████      |
|           ██████████████       |
|           ██████████████       |
|                                |
|             ████████████       |
|             ████████████       |
|             ████████████       |
|            ██████████████      |
|            ██        ██        |
|            ██        ██        |
```

---

---

# QUADRUPED SPRITES (48 × 32)

Head at LEFT. Body extends rightward. Legs at rows 25–31.  
Front legs at cols ~4–7; rear legs track body right edge.

---

## cat  (48 × 32 quadruped) — redesigned v1.4.0

**Redesigned v2 — realistic domestic shorthair tabby.**
Two pointy triangular ears on head (left side). Tail arcs up from rump (right side). Muzzle accent (▓), whiskers (colour 4, `-`) on adult/senior. Tabby back stripes (░) on adult/senior. Grey muzzle (░ instead of ▓) on senior. Proportional juvenile shrinks (Rule 9).

Legend: █ 1 body · ▓ 2 muzzle/chest · ░ 3 stripe/shading · - 4 whiskers · · 0 transparent

### baby

```
col: 000000000011111111112222222222333333333344444444
     012345678901234567890123456789012345678901234567
row 00 ················································
row 01 ················································
row 02 ················································
row 03 ················································
row 04 ················································
row 05 ················································
row 06 ················································
row 07 ················································
row 08 ················································
row 09 ················································
row 10 ················································
row 11 ················································
row 12 ················································
row 13 ················································
row 14 ················································
row 15 ················································
row 16 ················································
row 17 ················································
row 18 ················································
row 19 ················································
row 20 ················································
row 21 ················································
row 22 ················································
row 23 ··············██···██···························
row 24 ·············████·████··········████···········
row 25 ·············███████████████████████···········
row 26 ·············▓▓██████░██████████████···········
row 27 ·············▓▓█████████████████████···········
row 28 ··············██████████████████████···········
row 29 ··············██··██·········██··██············
row 30 ··············██··██·········██··██············
row 31 ··············██··██·········██··██············
```

### child

```
col: 000000000011111111112222222222333333333344444444
     012345678901234567890123456789012345678901234567
row 00 ················································
row 01 ················································
row 02 ················································
row 03 ················································
row 04 ················································
row 05 ················································
row 06 ················································
row 07 ················································
row 08 ················································
row 09 ················································
row 10 ················································
row 11 ················································
row 12 ················································
row 13 ················································
row 14 ················································
row 15 ················································
row 16 ················································
row 17 ················································
row 18 ····························█████···············
row 19 ·········██···██···········█████················
row 20 ········████·████·········█████·················
row 21 ·······██████████········█████··················
row 22 ······██████████████████████···················
row 23 ······█████████░█████████████···················
row 24 ·····▓▓█████████████████████····················
row 25 ·····▓▓████████████████████·····················
row 26 ······██████████████████████····················
row 27 ······██████████████████████····················
row 28 ·······██··██········██··██·····················
row 29 ·······██··██········██··██·····················
row 30 ·······██··██········██··██·····················
row 31 ·······██··██········██··██·····················
```

### teen

```
col: 000000000011111111112222222222333333333344444444
     012345678901234567890123456789012345678901234567
row 00 ················································
row 01 ················································
row 02 ················································
row 03 ················································
row 04 ················································
row 05 ················································
row 06 ················································
row 07 ················································
row 08 ················································
row 09 ················································
row 10 ················································
row 11 ················································
row 12 ················································
row 13 ················································
row 14 ················································
row 15 ·································█████··········
row 16 ································█████···········
row 17 ······██····██·················█████············
row 18 ·····████··████···············█████·············
row 19 ····████████████·············█████··············
row 20 ···█████████████████████████████████············
row 21 ··█████████████████░█████████████████···········
row 22 ··▓▓█████████████████████████████████···········
row 23 ··▓▓█████████████░██████████████████············
row 24 -▓█████████████████████████████████·············
row 25 ··█████████████████████████████████·············
row 26 ···███████████████████████████████··············
row 27 ····██··██················██··██················
row 28 ····██··██················██··██················
row 29 ····██··██················██··██················
row 30 ····██··██················██··██················
row 31 ····██··██················██··██················
```

### adult

```
col: 000000000011111111112222222222333333333344444444
     012345678901234567890123456789012345678901234567
row 00 ················································
row 01 ················································
row 02 ················································
row 03 ················································
row 04 ················································
row 05 ················································
row 06 ················································
row 07 ················································
row 08 ················································
row 09 ················································
row 10 ················································
row 11 ················································
row 12 ················································
row 13 ····································█████·······
row 14 ···································██████·······
row 15 ··································██████········
row 16 ·································██████·········
row 17 ······██····██··················██████··········
row 18 ·····████··████················██████···········
row 19 ····████████████··············██████············
row 20 ···█████████████████████████████████████········
row 21 ··██████████████████░████████████████████·······
row 22 ··▓▓████████████████████████████████████▓······
row 23 -▓▓███████████████░█████████████████████▓······
row 24 -▓▓█████████████████████████████░███████·······
row 25 ··█████████████████████████████████████·········
row 26 ···██████████████████████████████████··········
row 27 ····██··██················██··██···············
row 28 ····██··██················██··██···············
row 29 ····██··██················██··██···············
row 30 ····██··██················██··██···············
row 31 ····██··██················██··██···············
```

### senior

```
col: 000000000011111111112222222222333333333344444444
     012345678901234567890123456789012345678901234567
row 00 ················································
row 01 ················································
row 02 ················································
row 03 ················································
row 04 ················································
row 05 ················································
row 06 ················································
row 07 ················································
row 08 ················································
row 09 ················································
row 10 ················································
row 11 ················································
row 12 ················································
row 13 ················································
row 14 ····································███·········
row 15 ···································█████········
row 16 ··································█████·········
row 17 ······██····██···················█████··········
row 18 ·····████··████·················█████···········
row 19 ····████████████···············█████············
row 20 ···█████████████████████████████████████········
row 21 ··██████████████████░████████████████████·······
row 22 ··░░████████████████████████████████████········
row 23 -░░███████████████░█████████████████████········
row 24 -░░█████████████████████████████░███████·······
row 25 ··█████████████████████████████████████·········
row 26 ···██████████████████████████████████··········
row 27 ····██··██················██··██···············
row 28 ····██··██················██··██···············
row 29 ····██··██················██··██···············
row 30 ····██··██················██··██···············
row 31 ····██··██················██··██···············
```
|   ██ ██                                        |
|   ██ ██                                        |
|  ████████                                      |
|  ████▓███                                      |
|  █████████                                     |
|  █████████                                     |
|  ████████                                      |
|  ████████                                      |
|  ██████                                        |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
```

### child

```
|   ██  ██                                       |
|   ██  ██                                       |
|  ████████████                                  |
|  ████▓███▓███                                  |
|  █████████████                                 |
|  █████████████                                 |
|  █████████████                                 |
|  ████████████                                  |
|   ██████████                                   |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|    ████                                        |
|    ████                                        |
|    ████                                        |
|    ████                                        |
|    ████                                        |
|    ████                                        |
|   ██  ██                                       |
```

### teen

```
|   ██  ██                                       |
|   ██  ██                                       |
|  ████████████████████                          |
|  ████▓██████████▓████                          |
|  ███████████████████████                       |
|  ███████████████████████                       |
|  ██████████████████████                        |
|  ██████████████████████               ████     |
|  ████████████████████████             █████    |
|  ████████████████████████              ████    |
|                                         ██     |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|    ████           ████████                     |
|    ████           ████████                     |
|    ████           ████████                     |
|    ████           ████████                     |
|    ████           ████████                     |
|    ████           ████████                     |
|   ██  ██         ██      ██                    |
```

### adult

```
|   ██  ██                                       |
|   ██  ██                                       |
|  ████████████████████████████████              |
|  ████▓██████████████████████▓████              |
|  █████████████████████████████████             |
|  █████████████████████████████████             |
|  █████████████████████████████████             |
|  █████████████████████████████████      ████   |
|  ████████████████████████████████████   █████  |
|  ████████████████████████████████████   ████   |
|  ██████████████████████████████████      ███   |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|    ████               ████████████             |
|    ████               ████████████             |
|    ████               ████████████             |
|    ████               ████████████             |
|    ████               ████████████             |
|    ████               ████████████             |
|   ██  ██             ██          ██            |
```

### senior

```
|   ██  ██                                       |
|   ██  ██                                       |
|  ████████████████████████████████              |
|  ████▓██████████████████████▓████              |
|  █████████████████████████████████             |
|  ████░███████████████████████░████             |
|  █████████████████████████████████             |
|  ████░███████████████████████░████      ████   |
|  ████████████████████████████████████   █████  |
|  ████████████████████████████████████   ████   |
|  ██████████████████████████████████      ███   |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|    ████               ████████████             |
|    ████               ████████████             |
|    ████               ████████████             |
|    ████               ████████████             |
|    ████               ████████████             |
|    ████               ████████████             |
|   ██  ██             ██          ██            |
```

---

## rat  (48 × 32 quadruped) — redesigned v1.4.0

**Redesigned v2 — realistic proportions.**
Long low-slung elongated body. Pointed snout (▓ nose tip + ▓ eye). Two rounded ears (░-outlined) sitting on top of head. Long bald ░-coloured tail curving down-right from body right edge. Whiskers (colour 4) on adult and senior only. Belly shaded with ░ accent. Chibi proportions on baby/child (larger head, shorter body, stubby legs). Senior = adult + ░ age spots on torso.

### baby

```
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|             ░░ ░░                              |
|          ░██░░██░███████░                      |
|          ░█▓░████████████░                     |
|         ▓█▓░██████████████░░                   |
|         ██░████████████████░░░                 |
|          ░░░████████████░░░█░                  |
|            ░░░████████░░░░░░░                  |
|               ░███████░      ░░                |
|               ░███████░         ░              |
|               ░███████░          ░             |
|               ░█   █░                          |
|               ░█   █░                          |
|               ░█   █░                          |
|               ░█   █░                          |
|               ░█   █░                          |
|               ░█   █░                          |
|               ░█   █░                          |
```

### child

```
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|             ░░ ░░                              |
|          ░░██░░██░████████░                    |
|          ░█▓░█████████████████░                |
|         ▓█▓░███████████████████░░              |
|         ██░█████████████████████░░░            |
|          ░░████████████████████████░░          |
|            ░░████████████░░░████░░             |
|              ░░██████████░   ░░░               |
|               ░██████████░     ░░░             |
|               ░██████████░        ░            |
|               ░██████████░         ░           |
|               ░██░   ░██░                      |
|               ░██░   ░██░                      |
|               ░██░   ░██░                      |
|               ░██░   ░██░                      |
|               ░██░   ░██░                      |
|               ░██░   ░██░                      |
|               ░██░   ░██░                      |
```

### teen

```
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|         ░░  ░░                                 |
|         ░██░░██░████████████████░              |
|         ░█▓░█████████████████████░             |
|         ▓█▓░███████████████████████░           |
|         ██░█████████████████████████░          |
|          ░░███████████████████████████░░       |
|            ░░████████████████████████████░░    |
|              ░░████████████████████████░       |
|                ░████████████████████████░░░    |
|                 ░░██████████████████████░      |
|                   ░░████████████████████░      |
|                     ░░███████████████████░     |
|                       ░███████████████████░    |
|                       ░███████████████████░    |
|                       ░███████████████████░    |
|                       ░███████████████████░    |
|                       ░███████████████████░    |
|                       ░██░         ░███░░      |
|                       ░██░         ░███░░      |
|                       ░██░         ░███░░      |
|                       ░██░         ░███░░      |
|                       ░██░         ░███░░      |
|                       ░██░         ░███░░      |
|                       ░██░         ░███░░      |
```

### adult

```
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|      ░░  ░░                                    |
|      ░██░░██░████████████████████░             |
|      ░█▓░███████████████████████████░          |
|      ▓█▓░█████████████████████████████░        |
|      ██░███████████████████████████████░       |
|    ──██░█████████████████████████████████░░    |
|    ──██░███████████████████████████████████░   |
|      ▓█░█████████████████████████████████████░ |
|       ░░█████████████████████████████████████░░|
|         ░░████████████████████████████████████░|
|           ░░██████████████████████████████████░|
|             ░░██████████████████████████░░     |
|               ░░████████████████████████░      |
|                 ░░██████████████████████░      |
|                   ░░████████████████████░      |
|                   ░░████████████████████░      |
|                   ░░████████████████████░      |
|                   ░░████████████████████░      |
|                   ░░████████████████████░      |
|                   ░███░         ░████░░        |
|                   ░███░         ░████░░        |
|                   ░███░         ░████░░        |
|                   ░███░         ░████░░        |
|                   ░███░         ░████░░        |
|                   ░███░         ░████░░        |
|                   ░███░         ░████░░        |
```

### senior

Identical to adult with ░ age spots added to torso rows 11–15.

```
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|      ░░  ░░                                    |
|      ░██░░██░████████████████████░             |
|      ░█▓░███████████████████████████░          |
|      ▓█▓░█████████████████████████████░        |
|      ██░███████████████████████████████░       |
|    ──██░███░█████████████████████████████░░    |
|    ──██░███████████████░███████████████████░   |
|      ▓█░███████████████████░█████████████████░ |
|       ░░█████████████████████░███████████████░░|
|         ░░████████████████████░███████████████░|
|           ░░██████████████████████████████████░|
|             ░░██████████████████████████░░     |
|               ░░████████████████████████░      |
|                 ░░██████████████████████░      |
|                   ░░████████████████████░      |
|                   ░░████████████████████░      |
|                   ░░████████████████████░      |
|                   ░░████████████████████░      |
|                   ░░████████████████████░      |
|                   ░███░         ░████░░        |
|                   ░███░         ░████░░        |
|                   ░███░         ░████░░        |
|                   ░███░         ░████░░        |
|                   ░███░         ░████░░        |
|                   ░███░         ░████░░        |
|                   ░███░         ░████░░        |
```

---

## ox  (48 × 32 quadruped) — redesign pending

Wide curved horns (▓) at top-left of head. Heavy wide body. Broad short head. Short stump tail at right. Large muscular legs.

### baby

```
| ▓  ▓                                           |
| ████████                                       |
| ████████                                       |
| ██▓█████                                       |
| ████████                                       |
| ████████                                       |
| ████████                                       |
|  ██████                                        |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
```

### child

```
| ▓  ▓                                           |
| ████████████                                   |
| ████████████                                   |
| ██▓█████████                                   |
| █████████████                                  |
| █████████████                                  |
| █████████████                                  |
|  ███████████                                   |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|   ██████                                       |
|   ██████                                       |
|   ██████                                       |
|   ██████                                       |
|   ████                                         |
|   ████                                         |
|  ████████                                      |
```

### teen

```
| ▓  ▓                                           |
| ████████████████████████                       |
| ████████████████████████                       |
| ██▓███████████████████████                     |
| ███████████████████████████                    |
| ███████████████████████████                    |
| ███████████████████████████                    |
|  █████████████████████████        ██           |
|                                   ██           |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|   ██████           ██████████                  |
|   ██████           ██████████                  |
|   ██████           ██████████                  |
|   ██████           ██████████                  |
|   ████             ████████                    |
|   ████             ████████                    |
|  ████████         ████████████                 |
```

### adult

```
| ▓  ▓                                           |
| █████████████████████████████████████          |
| █████████████████████████████████████          |
| ██▓██████████████████████████████████          |
| ███████████████████████████████████████        |
| ███████████████████████████████████████        |
| ███████████████████████████████████████        |
|  █████████████████████████████████████        ██|
|                                               ██|
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|   ██████                   ██████████████      |
|   ██████                   ██████████████      |
|   ██████                   ██████████████      |
|   ██████                   ██████████████      |
|   ████                     ██████████          |
|   ████                     ██████████          |
|  ████████                 ████████████████     |
```

### senior

```
| ▓  ▓                                           |
| █████████████████████████████████████          |
| █████████████████████████████████████          |
| ██▓██████████████████████████████████          |
| ████░███████████████████████████░████          |
| ████████████████████████████████████           |
| ████░███████████████████████████░████          |
|  █████████████████████████████████████        ██|
|                                               ██|
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|   ██████                   ██████████████      |
|   ██████                   ██████████████      |
|   ██████                   ██████████████      |
|   ██████                   ██████████████      |
|   ████                     ██████████          |
|   ████                     ██████████          |
|  ████████                 ████████████████     |
```

---

## tiger  (48 × 32 quadruped) — redesign pending

Round ears. Three vertical stripe marks across body (░). Round eyes (▓). Slightly longer body than cat. Short thick tail.

### baby

```
|  ███ ███                                       |
|  ███████                                       |
|  ████████                                      |
|  ████▓████                                     |
|  ████████                                      |
|  ████████                                      |
|  ███████                                       |
|   █████                                        |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
```

### child

```
|  ███ ███                                       |
|  ████████████                                  |
|  ████████████                                  |
|  ████▓██████▓                                  |
|  ██░████████░██                                |
|  ████████████                                  |
|  ████████████                                  |
|  ████████████                                  |
|   ██████████                                   |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|    ████                                        |
|    ████                                        |
|    ████                                        |
|    ████                                        |
|    ████                                        |
|    ████                                        |
|   ██  ██                                       |
```

### teen

```
|  ███ ███                                       |
|  ████████████████████████                      |
|  ████████████████████████                      |
|  ████▓████████████████▓██                      |
|  ██░█████████████████████░██                   |
|  █████░████████████████░████                   |
|  ████████████████████████████                  |
|  ████████████████████████████      ████        |
|   ████████████████████████████     █████       |
|                                     ████       |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|    ████           ████████                     |
|    ████           ████████                     |
|    ████           ████████                     |
|    ████           ████████                     |
|    ████           ████████                     |
|    ████           ████████                     |
|   ██  ██         ██      ██                    |
```

### adult

```
|  ███ ███                                       |
|  ████████████████████████████████████          |
|  ████████████████████████████████████          |
|  ████▓████████████████████████████▓██          |
|  ██░█████████████████████████████████░██       |
|  █████░████████████████████████████░████       |
|  █████████░████████████████████████████        |
|  ████████████████████████████████████████  ████|
|   ████████████████████████████████████████ █████|
|                                            ████|
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|    ████                   ████████████         |
|    ████                   ████████████         |
|    ████                   ████████████         |
|    ████                   ████████████         |
|    ████                   ████████████         |
|    ████                   ████████████         |
|   ██  ██                 ██          ██        |
```

### senior

```
|  ███ ███                                       |
|  ████████████████████████████████████          |
|  ████████████████████████████████████          |
|  ████▓████████████████████████████▓██          |
|  ██░█████████████████████████████████░██       |
|  █████░████████████████████████████░████       |
|  █████████░████████████████████████████        |
|  ██████████████░████████████░████████████  ████|
|   ████████████████████████████████████████ █████|
|                                            ████|
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|    ████                   ████████████         |
|    ████                   ████████████         |
|    ████                   ████████████         |
|    ████                   ████████████         |
|    ████                   ████████████         |
|    ████                   ████████████         |
|   ██  ██                 ██          ██        |
```

---

## rabbit  (48 × 32 quadruped) — redesigned v1.4.0

Tall ears: two long columns rising 4 rows above the head. Cotton-ball tail nub (▓) at right. Short round body. Big round eyes (▓).

### baby

```
| ██  ██                                         |
| ██  ██                                         |
| ██  ██                                         |
| ██  ██                                         |
|  ██████                                        |
|  ████▓██                                       |
|  ████████                                      |
|  ████████                                      |
|  ████████                                      |
|   ██████                                       |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
```

### child

```
| ██  ██                                         |
| ██  ██                                         |
| ██  ██                                         |
| ██  ██                                         |
|  ████████████                                  |
|  █████▓██████                                  |
|  █████████████                                 |
|  █████████████              ▓▓                 |
|  █████████████              ▓▓                 |
|   ███████████                                  |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|   ██████                                       |
|   ██████                                       |
|   ██████                                       |
|   ██████                                       |
|   ████                                         |
|   ████                                         |
|  ████████                                      |
```

### teen

```
| ██  ██                                         |
| ██  ██                                         |
| ██  ██                                         |
| ██  ██                                         |
|  █████████████████████                         |
|  ██████▓███████████████                        |
|  ████████████████████████                      |
|  ████████████████████████          ▓▓          |
|  ████████████████████████          ▓▓          |
|   ██████████████████████                       |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|   ██████          ████████                     |
|   ██████          ████████                     |
|   ██████          ████████                     |
|   ██████          ████████                     |
|   ████            ██████                       |
|   ████            ██████                       |
|  ████████        ██████████                    |
```

### adult

```
| ██  ██                                         |
| ██  ██                                         |
| ██  ██                                         |
| ██  ██                                         |
|  █████████████████████████████████             |
|  ██████▓█████████████████████████████          |
|  ████████████████████████████████████          |
|  ████████████████████████████████████    ▓▓▓   |
|  ████████████████████████████████████    ▓▓▓   |
|   ████████████████████████████████████   ▓▓    |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|   ██████                  ████████████         |
|   ██████                  ████████████         |
|   ██████                  ████████████         |
|   ██████                  ████████████         |
|   ████                    ████████             |
|   ████                    ████████             |
|  ████████                ████████████          |
```

### senior

```
| ██  ██                                         |
| ██  ██                                         |
| ██  ██                                         |
| ██  ██                                         |
|  █████████████████████████████████             |
|  ██████▓█████████████████████████████          |
|  █████░███████████████████████████████         |
|  ████████░█████████████████████████████  ▓▓▓   |
|  ████████████████████████████████████    ▓▓▓   |
|   ████████████████████████████████████   ▓▓    |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|   ██████                  ████████████         |
|   ██████                  ████████████         |
|   ██████                  ████████████         |
|   ██████                  ████████████         |
|   ████                    ████████             |
|   ████                    ████████             |
|  ████████                ████████████          |
```

---

## horse  (48 × 32 quadruped) — redesign pending

Mane (▓) on top of head. Long flowing tail (▓) at far right. Longest body of all quadrupeds. Slim legs. Slightly taller head.

### baby

```
|  ▓                                             |
|  █████                                         |
|  █████                                         |
|  ████▓                                         |
|  ██████                                        |
|  ██████                                        |
|  █████                                         |
|   ████                                         |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
```

### child

```
|  ▓▓                                            |
|  ██████                                        |
|  ████████████                                  |
|  ████▓███████                                  |
|  ████████████████          ▓▓▓                 |
|  ████████████████          ▓▓▓                 |
|  ████████████████          ▓▓                  |
|   ██████████████                               |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|   ████            ████                         |
|   ████            ████                         |
|   ████            ████                         |
|   ████            ████                         |
|   ████            ████                         |
|   ████            ████                         |
|   ████            ████                         |
```

### teen

```
|  ▓▓                                            |
|  ██████                                        |
|  █████████████████████████                     |
|  ████▓██████████████████████                   |
|  █████████████████████████████      ▓▓▓▓       |
|  █████████████████████████████      ▓▓▓▓       |
|  █████████████████████████████      ▓▓▓        |
|   ███████████████████████████                  |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|   ████           ████████                      |
|   ████           ████████                      |
|   ████           ████████                      |
|   ████           ████████                      |
|   ████           ████████                      |
|   ████           ████████                      |
|   ████           ████████                      |
```

### adult

```
|  ▓▓▓                                           |
|  ██████                                        |
|  ████████████████████████████████████████      |
|  █████▓███████████████████████████████████     |
|  ████████████████████████████████████████  ▓▓▓▓▓|
|  ████████████████████████████████████████  ▓▓▓▓▓|
|  ████████████████████████████████████████  ▓▓▓▓ |
|   ██████████████████████████████████████        |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|   ████                    ████████             |
|   ████                    ████████             |
|   ████                    ████████             |
|   ████                    ████████             |
|   ████                    ████████             |
|   ████                    ████████             |
|   ████                    ████████             |
```

### senior

```
|  ▓▓▓                                           |
|  ██████                                        |
|  ████████████████████████████████████████      |
|  █████▓███████████████████████████████████     |
|  ████░██████████████████████████████████   ▓▓▓▓▓|
|  ████████░██████████████████████████████   ▓▓▓▓▓|
|  ████████████░██████████████████████████   ▓▓▓▓ |
|   ██████████████████████████████████████        |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|   ████                    ████████             |
|   ████                    ████████             |
|   ████                    ████████             |
|   ████                    ████████             |
|   ████                    ████████             |
|   ████                    ████████             |
|   ████                    ████████             |
```

---

## sheep  (48 × 32 quadruped) — redesigned v1.4.0

**Redesigned v6 — domestic Suffolk sheep, faces left.**
Distinct black face (░) sticking out left of white wool fleece (█). Scalloped/bumpy fleece top edge. Small floppy ear (▓) on top of head. Eye (▓) + muzzle (▓). Fluffy tail nub (█) on right rump. 2 thin ░-coloured legs. No colour 4.
Senior = adult + ░ age spots on fleece (Rule 6). Proportional juvenile shrinks (Rule 9).

Legend: █ 1 fleece/body · ▓ 2 eye/muzzle/ear · ░ 3 face/legs/age-spots · · 0 transparent

### baby

```
col: 000000000011111111112222222222333333333344444444
     012345678901234567890123456789012345678901234567
row 00 ················································
row 01 ················································
row 02 ················································
row 03 ················································
row 04 ················································
row 05 ················································
row 06 ················································
row 07 ················································
row 08 ················································
row 09 ················································
row 10 ················································
row 11 ················································
row 12 ················································
row 13 ················································
row 14 ················································
row 15 ················································
row 16 ················································
row 17 ················································
row 18 ················································
row 19 ················································
row 20 ················································
row 21 ················································
row 22 ··············░░█·██·██···················
row 23 ·············░░░░░░░███████·······█········
row 24 ·············▓░░░░░░████████···············
row 25 ·············░░░░░░░████████···············
row 26 ·············░░░░░░░████████···············
row 27 ···············░░░░░████████···············
row 28 ···············░░░░░████████···············
row 29 ···············░░░··████··██···············
row 30 ···············░░░··████··██···············
row 31 ···············░░░··████··██···············
```

### child

```
col: 000000000011111111112222222222333333333344444444
     012345678901234567890123456789012345678901234567
row 00 ················································
row 01 ················································
row 02 ················································
row 03 ················································
row 04 ················································
row 05 ················································
row 06 ················································
row 07 ················································
row 08 ················································
row 09 ················································
row 10 ················································
row 11 ················································
row 12 ················································
row 13 ················································
row 14 ················································
row 15 ················································
row 16 ················································
row 17 ················································
row 18 ················································
row 19 ··············░░█·██·██·██···················
row 20 ·············▓░░░░░░█████████·····██·········
row 21 ·············░░░░░░░███████████···············
row 22 ·············▓░░░░░░███░░░██████··············
row 23 ·············░░░░░░░████████████··············
row 24 ···············░░░░░████████████··············
row 25 ···············░░░░████████████···············
row 26 ···············░░░░████████████···············
row 27 ···············░░░░███████████················
row 28 ···············░░░░███████████················
row 29 ···············░░··█████···················
row 30 ···············░░··█████···················
row 31 ···············░░··█████···················
```

### teen

```
col: 000000000011111111112222222222333333333344444444
     012345678901234567890123456789012345678901234567
row 00 ················································
row 01 ················································
row 02 ················································
row 03 ················································
row 04 ················································
row 05 ················································
row 06 ················································
row 07 ················································
row 08 ················································
row 09 ················································
row 10 ················································
row 11 ················································
row 12 ················································
row 13 ················································
row 14 ················································
row 15 ················································
row 16 ················································
row 17 ··············░░█·██·██·██·██···············
row 18 ·············▓▓░░░░░███████████··████·······
row 19 ·············░░░░░░░█████████████············
row 20 ·············▓░░░░░░██░░███████████··········
row 21 ·············░░░░░░░█████████████████········
row 22 ·············░░░░░░░███████░░░████████·······
row 23 ··············░░░░░░████████████████·········
row 24 ··············░░░░░█████████████████·········
row 25 ··············░░░░░█████████████████·········
row 26 ··············░░░░░████████████·············
row 27 ···············░░░░█████████████············
row 28 ···············░░░··████████████············
row 29 ···············░░···█████·················
row 30 ···············░░···█████·················
row 31 ···············░░···█████·················
```

### adult

```
col: 000000000011111111112222222222333333333344444444
     012345678901234567890123456789012345678901234567
row 00 ················································
row 01 ················································
row 02 ················································
row 03 ················································
row 04 ················································
row 05 ················································
row 06 ················································
row 07 ················································
row 08 ················································
row 09 ················································
row 10 ················································
row 11 ················································
row 12 ················································
row 13 ················································
row 14 ················································
row 15 ················································
row 16 ··············░░█·██·██·██·██·██·············
row 17 ·············▓▓░░░░░███████████████··████····
row 18 ·············░░░░░░░████████████████···········
row 19 ·············▓░░░░░░█████░░░████████████······
row 20 ·············░░░░░░░█████████████████████·····
row 21 ·············░░░░░░░███████████░░░████████·····
row 22 ·············░░░░░░░███████████████████········
row 23 ··············░░░░░░██████████████████·········
row 24 ··············░░░░░█████████████████···········
row 25 ··············░░░░░████████████████············
row 26 ··············░░░░░███████████████·············
row 27 ···············░░░░██████████████··············
row 28 ···············░░░··████████████··············
row 29 ···············░░···█████·····················
row 30 ···············░░···█████·····················
row 31 ···············░░···█████·····················
```

### senior

```
col: 000000000011111111112222222222333333333344444444
     012345678901234567890123456789012345678901234567
row 00 ················································
row 01 ················································
row 02 ················································
row 03 ················································
row 04 ················································
row 05 ················································
row 06 ················································
row 07 ················································
row 08 ················································
row 09 ················································
row 10 ················································
row 11 ················································
row 12 ················································
row 13 ················································
row 14 ················································
row 15 ················································
row 16 ··············░░█·██·██·██·██·██·············
row 17 ·············▓▓░░░░░███████████████··████····
row 18 ·············░░░░░░░████████████████···········
row 19 ·············▓░░░░░░█████░░░████████████······
row 20 ·············░░░░░░░████████████░████████·····
row 21 ·············░░░░░░░███████████░░░████████·····
row 22 ·············░░░░░░░███████████████████········
row 23 ··············░░░░░░██░████████████████········
row 24 ··············░░░░░█████████████████···········
row 25 ··············░░░░░████████████████············
row 26 ··············░░░░░███████████████·············
row 27 ···············░░░░██████░████···················
row 28 ···············░░░··████████████··············
row 29 ···············░░···█████·····················
row 30 ···············░░···█████·····················
row 31 ···············░░···█████·····················
```

---

## dog  (48 × 32 quadruped) — redesigned v1.4.0

**Redesigned v2 — Shiba Inu, faces left. Tamagotchi pixel-art style.**
Two narrow-set prick ears (▓ inner urajiro). Small hook curl tail arcing from upper-right rump. Tapered muzzle protrudes left 2 pixels. Single eye pixel (▓). Small cream belly patch (▓). 2 visible legs (front + back side-profile). Senior = adult + colour-3 muzzle-graying spots on snout (Rule 6). Proportional juvenile shrinks (Rule 9).

Legend: █ 1 red-orange body · ▓ 2 cream (ear interior, eye, belly) · ░ 3 senior muzzle graying · · 0 transparent

### baby

```
col: 000000000011111111112222222222333333333344444444
     012345678901234567890123456789012345678901234567
row 00 ················································
row 01 ················································
row 02 ················································
row 03 ················································
row 04 ················································
row 05 ················································
row 06 ················································
row 07 ················································
row 08 ················································
row 09 ················································
row 10 ················································
row 11 ················································
row 12 ················································
row 13 ················································
row 14 ················································
row 15 ················································
row 16 ················█··█···························
row 17 ················▓·▓····██··················
row 18 ···············████████·█···················
row 19 ··············██████████··················
row 20 ··············██████████··················
row 21 ··············██████████··················
row 22 ··············██▓█████████··················
row 23 ··············██████████··················
row 24 ··············██▓▓███████··················
row 25 ··············██·····██·····················
row 26 ··············██·····██·····················
row 27 ··············██·····██·····················
row 28 ··············██·····██·····················
row 29 ··············██·····██·····················
row 30 ··············██·····██·····················
row 31 ··············██·····██·····················
```

### child

```
col: 000000000011111111112222222222333333333344444444
     012345678901234567890123456789012345678901234567
row 00 ················································
row 01 ················································
row 02 ················································
row 03 ················································
row 04 ················································
row 05 ················································
row 06 ················································
row 07 ················································
row 08 ················································
row 09 ················································
row 10 ················································
row 11 ················································
row 12 ················································
row 13 ················································
row 14 ···············█··█···························
row 15 ···············▓··▓····███···················
row 16 ···············████████·█·█···················
row 17 ··············████████████·····················
row 18 ··············████████████·····················
row 19 ··············████████████·····················
row 20 ··············██▓█████████·····················
row 21 ··············████████████·····················
row 22 ··············████████████·····················
row 23 ··············██▓▓████████·····················
row 24 ··············██▓▓████████·····················
row 25 ··············███·····███·····················
row 26 ··············███·····███·····················
row 27 ··············███·····███·····················
row 28 ··············███·····███·····················
row 29 ··············███·····███·····················
row 30 ··············███·····███·····················
row 31 ··············███·····███·····················
```

### teen

```
col: 000000000011111111112222222222333333333344444444
     012345678901234567890123456789012345678901234567
row 00 ················································
row 01 ················································
row 02 ················································
row 03 ················································
row 04 ················································
row 05 ················································
row 06 ················································
row 07 ················································
row 08 ················································
row 09 ················································
row 10 ················································
row 11 ················································
row 12 ··············█··█···························
row 13 ··············▓··▓····███··················
row 14 ··············████████·█·█··················
row 15 ···········████████████·█···················
row 16 ···········████████████·····················
row 17 ···········████████████·····················
row 18 ···········████████████·····················
row 19 ···········██▓█████████·····················
row 20 ···········████████████·····················
row 21 ···········████████████·····················
row 22 ···········██▓▓▓███████·····················
row 23 ···········██▓▓▓███████·····················
row 24 ···········████████████·····················
row 25 ···········███·······███·····················
row 26 ···········███·······███·····················
row 27 ···········███·······███·····················
row 28 ···········███·······███·····················
row 29 ···········███·······███·····················
row 30 ···········███·······███·····················
row 31 ···········███·······███·····················
```

### adult

```
col: 000000000011111111112222222222333333333344444444
     012345678901234567890123456789012345678901234567
row 00 ················································
row 01 ················································
row 02 ················································
row 03 ················································
row 04 ················································
row 05 ················································
row 06 ················································
row 07 ················································
row 08 ················································
row 09 ················································
row 10 ················································
row 11 ················································
row 12 ················································
row 13 ··············█···█··························
row 14 ··············▓···▓·····███·················
row 15 ············████████████████████████········
row 16 ············████████████████████████········
row 17 ··········██▓█████████████████████████······
row 18 ··········████████████████████████████······
row 19 ············████████████████████████········
row 20 ············████████████████████████········
row 21 ············████████████████████████········
row 22 ············████████████████████████········
row 23 ············██████▓▓▓▓█████████████·········
row 24 ············██████▓▓▓▓█████████████·········
row 25 ·············██·············██··············
row 26 ·············██·············██··············
row 27 ·············██·············██··············
row 28 ·············██·············██··············
row 29 ·············██·············██··············
row 30 ·············██·············██··············
row 31 ·············██·············██··············
```

### senior

```
col: 000000000011111111112222222222333333333344444444
     012345678901234567890123456789012345678901234567
row 00 ················································
row 01 ················································
row 02 ················································
row 03 ················································
row 04 ················································
row 05 ················································
row 06 ················································
row 07 ················································
row 08 ················································
row 09 ················································
row 10 ················································
row 11 ················································
row 12 ················································
row 13 ··············█···█··························
row 14 ··············▓···▓·····███·················
row 15 ············████████████████████████········
row 16 ············████████████████████████········
row 17 ··········░░▓█████████████████████████······
row 18 ··········░░████████████████████████████····
row 19 ············████████████████████████········
row 20 ············████████████████████████········
row 21 ············████████████████████████········
row 22 ············████████████████████████········
row 23 ············██████▓▓▓▓█████████████·········
row 24 ············██████▓▓▓▓█████████████·········
row 25 ·············██·············██··············
row 26 ·············██·············██··············
row 27 ·············██·············██··············
row 28 ·············██·············██··············
row 29 ·············██·············██··············
row 30 ·············██·············██··············
row 31 ·············██·············██··············
```

---

## pig  (48 × 32 quadruped) — redesigned v1.4.0

**Redesigned v2 — realistic domestic pig.**
Tall barrel body. Small floppy ears drooping forward (2 rows, colour 1+2). Flat snout disc (▓) at left tip with 2 nostril dots (░). Corkscrew curl tail on upper rump. 2 visible legs (1 front + 1 back), 3-row trotters with ░ hooves. Senior = adult + 3 ░ age spots (Rule 6). No colour 4.

Legend: █ 1 body · ▓ 2 snout/inner-ear · ░ 3 nostril/hoof/age-spots · · 0 transparent

### baby

```
col: 000000000011111111112222222222333333333344444444
     012345678901234567890123456789012345678901234567
row 00 ················································
row 01 ················································
row 02 ················································
row 03 ················································
row 04 ················································
row 05 ················································
row 06 ················································
row 07 ················································
row 08 ················································
row 09 ················································
row 10 ················································
row 11 ················································
row 12 ················································
row 13 ················································
row 14 ················································
row 15 ················································
row 16 ················································
row 17 ················································
row 18 ················································
row 19 ················································
row 20 ················································
row 21 ··············██···██···························
row 22 ··············▓█···▓█·············██············
row 23 ············████████████████████████············
row 24 ···········▓▓█████████████████████·············
row 25 ···········▓░█████████████████████·············
row 26 ···········▓▓█████████████████████·············
row 27 ············████████████████████████············
row 28 ············████████████████████████············
row 29 ············███············████████············
row 30 ············███············████████············
row 31 ············░██············░███████············
```

### child

```
col: 000000000011111111112222222222333333333344444444
     012345678901234567890123456789012345678901234567
row 00 ················································
row 01 ················································
row 02 ················································
row 03 ················································
row 04 ················································
row 05 ················································
row 06 ················································
row 07 ················································
row 08 ················································
row 09 ················································
row 10 ················································
row 11 ················································
row 12 ················································
row 13 ················································
row 14 ················································
row 15 ················································
row 16 ················································
row 17 ················································
row 18 ················································
row 19 ··············██···██···························
row 20 ··············▓█···▓█·················██········
row 21 ·············███████████████████████████········
row 22 ············▓▓████████████████████████·········
row 23 ············▓░████████████████████████·········
row 24 ············▓▓████████████████████████·········
row 25 ·············█████████████████████████·········
row 26 ·············█████████████████████████·········
row 27 ·············████████████████████████··········
row 28 ·············████████████████████████··········
row 29 ·············███·············█████████··········
row 30 ·············███·············█████████··········
row 31 ·············░██·············░████████··········
```

### teen

```
col: 000000000011111111112222222222333333333344444444
     012345678901234567890123456789012345678901234567
row 00 ················································
row 01 ················································
row 02 ················································
row 03 ················································
row 04 ················································
row 05 ················································
row 06 ················································
row 07 ················································
row 08 ················································
row 09 ················································
row 10 ················································
row 11 ················································
row 12 ················································
row 13 ················································
row 14 ················································
row 15 ················································
row 16 ················································
row 17 ················································
row 18 ·············██···██····························
row 19 ·············▓█···▓█·················██·········
row 20 ············██████████████████████████·········
row 21 ···········▓▓█████████████████████████·········
row 22 ···········▓░█████████████████████████·········
row 23 ···········▓▓█████████████████████████·········
row 24 ···········██████████████████████████··········
row 25 ···········██████████████████████████··········
row 26 ···········██████████████████████████··········
row 27 ···········██████████████████████████··········
row 28 ···········██████████████████████████··········
row 29 ···········███·············█████████···········
row 30 ···········███·············█████████···········
row 31 ···········░██·············░████████···········
```

### adult

```
col: 000000000011111111112222222222333333333344444444
     012345678901234567890123456789012345678901234567
row 00 ················································
row 01 ················································
row 02 ················································
row 03 ················································
row 04 ················································
row 05 ················································
row 06 ················································
row 07 ················································
row 08 ················································
row 09 ················································
row 10 ················································
row 11 ················································
row 12 ················································
row 13 ················································
row 14 ················································
row 15 ················································
row 16 ················································
row 17 ·········██·····██······························
row 18 ·········▓█·····▓█·················███··········
row 19 ·········█████████████████████████████·········
row 20 ········▓▓██████████████████████████············
row 21 ········▓░██████████████████████████············
row 22 ········▓▓███████████████████████████···········
row 23 ········██████████████████████████████··········
row 24 ········██████████████████████████████··········
row 25 ········██████████████████████████████··········
row 26 ········█████████████████████████████···········
row 27 ········█████████████████████████████···········
row 28 ········█████████████████████████████···········
row 29 ········███···················████████··········
row 30 ········███···················████████··········
row 31 ········░██···················░███████··········
```

### senior

```
col: 000000000011111111112222222222333333333344444444
     012345678901234567890123456789012345678901234567
row 00 ················································
row 01 ················································
row 02 ················································
row 03 ················································
row 04 ················································
row 05 ················································
row 06 ················································
row 07 ················································
row 08 ················································
row 09 ················································
row 10 ················································
row 11 ················································
row 12 ················································
row 13 ················································
row 14 ················································
row 15 ················································
row 16 ················································
row 17 ·········██·····██······························
row 18 ·········▓█·····▓█·················███··········
row 19 ·········█████████████████████████████·········
row 20 ········▓▓██████████████████████████············
row 21 ········▓░██████████████████████████············
row 22 ········▓▓███████████████░██████████···········  ← age spot
row 23 ········██████████████████████████████··········
row 24 ········████████████████░████████████··········  ← age spot
row 25 ········██████████████████████████████··········
row 26 ········█████████████████████████████···········
row 27 ········████████████████████░█████████··········  ← age spot
row 28 ········█████████████████████████████···········
row 29 ········███···················████████··········
row 30 ········███···················████████··········
row 31 ········░██···················░███████··········
```

---

---

# SNAKE SPRITE (48 × 32)

No legs — leg rows are blank. S-curve body. Tongue (▓▓) at left. Tapers to tip at right.

---

## snake  (48 × 32)

### baby

```
|  ▓▓                                            |
| ████                                           |
| █████                                          |
| ████                                           |
|  █████                                         |
|   ████                                         |
|   ███                                          |
|    ██                                          |
|     █                                          |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
```

### child

```
|  ▓▓                                            |
| ██████                                         |
| ████████████                                   |
| ████████████                                   |
|  ████████████                                  |
|   ████████████                                 |
|    ████████████                                |
|     ██████████                                 |
|      ████████                                  |
|       ██████                                   |
|        ████                                    |
|         ██                                     |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
```

### teen

```
|  ▓▓                                            |
| ████████                                       |
| ██████████████████████                         |
| ██████████████████████                         |
| ██████████████████████                         |
|  ██████████████████████                        |
|   ████████████████████████                     |
|    ████████████████████████                    |
|     ██████████████████████                     |
|      ████████████████████                      |
|       ██████████████████                       |
|        ████████████████                        |
|         ██████████████                         |
|          ████████████                          |
|           ██████████                           |
|            ████████                            |
|             ██████                             |
|              ████                              |
|               ██                               |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
```

### adult

```
|  ▓▓                                            |
| ████████                                       |
| ████████████████████████████████               |
| ████████████████████████████████               |
| ████████████████████████████████               |
|  ████████████████████████████████              |
|   █████████████████████████████████            |
|   ████████████████████████████████████         |
|    ████████████████████████████████████        |
|     ██████████████████████████████████         |
|      ████████████████████████████████          |
|       ██████████████████████████████           |
|        ████████████████████████████            |
|         ██████████████████████████             |
|          ████████████████████████              |
|           ██████████████████████               |
|            ████████████████████                |
|             ██████████████████                 |
|              ████████████████                  |
|               ██████████████                   |
|                ████████████                    |
|                 ██████████                     |
|                  ████████                      |
|                   ██████                       |
|                    ████                        |
|                     ██                         |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
```

### senior

```
|  ▓▓                                            |
| ████████                                       |
| ████████████████████████████████               |
| ████░███████████████████████████               |
| ████████████████████████████████               |
|  ████░██████████████████████████               |
|   █████████████████████████████████            |
|   ████░███████████████████████████████         |
|    ████████████████████████████████████        |
|     ██████████████████████████████████         |
|      ████████████████████████████████          |
|       ██████████████████████████████           |
|        ████████████████████████████            |
|         ██████████████████████████             |
|          ████████████████████████              |
|           ██████████████████████               |
|            ████████████████████                |
|             ██████████████████                 |
|              ████████████████                  |
|               ██████████████                   |
|                ████████████                    |
|                 ██████████                     |
|                  ████████                      |
|                   ██████                       |
|                    ████                        |
|                     ██                         |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
|                                                |
```

---

---

# Bug Fixes & Renderer Changes

The following bugs exist in v1.0.2 `sprites.js` and must be fixed in this redesign:

## Bug 1 — legRowStart wrong

**Current:** `legRowStart = 14` (small), `30` (large)  
**Fix:** Remove DEFS/DEFS_LG split entirely. One grid per animal. `legRowStart = 25` for quadrupeds, `37` for uprights.

## Bug 2 — accent colour hardcoded to secondary

**Current (line ~3997):** `var accent = palette.secondary;`  
**Fix:** `var accent = darkenHex(primary, 0.70);` — placed after the `darkenHex` helper definition.

## Bug 3 — baby sprites too small / cramped

**Fix:** Redesign grids at 48×32 / 32×48 with baby stage filling ~cols 0–18 (quad) or rows 18–24 (upright) for adequate visual mass.

## Bug 4 — BASE_SIZE too small

**Current:** `BASE_SIZE = 24`  
**Fix:** `BASE_SIZE = 96` — at 48-col grid this gives 2px cells at baby scale.

## Bug 5 — STAGE_SCALES too small

**Current:** `baby=0.45, child=0.55, teen=0.70, adult=0.85, senior=0.90`  
**Fix:** `baby=0.65, child=0.75, teen=0.85, adult=1.00, senior=1.00`

## Bug 6 — STAGE_BODY_HEIGHT_MULTS wrong for orientation

**Current:** All animals use same height mults  
**Fix:**
- Quadrupeds: `{baby:0.55, child:0.60, teen:0.65, adult:0.67, senior:0.67}` (native landscape)
- Uprights: `{baby:0.80, child:0.90, teen:1.10, adult:1.50, senior:1.50}` (native portrait)

---

# File Locations

```
vscode/media/sprites.js                              ← source of truth (sprites + renderer)
pycharm/src/main/resources/webview/sprites.js        ← exact copy (updated after every sprites.js change)
SPRITES.md                                           ← this file
```
