# Skill: sprite-sketching

## When to apply this skill

Apply this skill any time the user wants to **design or redesign a sprite** before
writing pixel data. This skill governs the design conversation and sketch workflow.
It works alongside the `sprite-drawing` skill (which governs pixel-level rules).

---

## Mandatory workflow — follow every step in order

### Step 1 — Research

Before asking any questions, gather:

1. The current sprite pixel data for all 5 stages (from `vscode/media/sprites.js`)
2. The grid type: **upright** (32×48) or **quadruped** (48×32)
   - Uprights: `classic`, `monkey`, `rooster`, `dragon`
   - All others: quadruped
3. Whether the animal has a tail (see Rule 8 in `sprite-drawing` skill)
4. What the current SPRITES.md entry says about the animal

### Step 2 — Ask design questions using the question tool

Use **the OpenCode question tool** (not plain text questions) for all ambiguous
design choices. Always ask as a batch — one `question` tool call with multiple
questions. Cover all of the following that are relevant:

| Topic | Options to offer |
|---|---|
| Pose | Standing / arms raised / action pose / etc. |
| Iconic silhouette cues | Offer 4–5 options, let user pick up to 3 |
| Tail size | Small / medium / large / none |
| Face detail | Simple / face patch / face patch + nostrils |
| Body shape | Plain oval / wide shoulders / tapered / etc. |
| Colour 3 usage | Hands+feet / belly shading / markings / senior-only |
| Species vibe | Offer 3–4 specific options relevant to the animal |
| Special props | Any iconic item the animal could hold or wear |

Always **recommend** one option per question (mark it `(Recommended)`) and put
it first in the options list.

### Step 3 — Clarify special cases interactively

If the user picks an option that has downstream implications (e.g. "always yellow"
for a prop colour, or "side profile" for an upright animal), flag the implication
immediately and ask follow-up questions using the question tool before sketching.

### Step 4 — Sketch the adult stage first

Draw the adult in an ASCII grid using this notation:

| Symbol | Colour index | Meaning |
|---|---|---|
| `█` | 1 | primary / body fill |
| `▓` | 2 | secondary / face patch / ear |
| `░` | 3 | accent / dark extremities / markings |
| `●` | 5 | fixed prop colour (e.g. banana yellow) |
| ` ` | 0 | transparent |

Format:
```
32 × 48 upright grid — [animal] adult — facing [LEFT/RIGHT/VIEWER]

         00000000001111111111222222222233
         01234567890123456789012345678901
        ┌────────────────────────────────┐
Row  0  │                                │
...
Row 47  │                                │
        └────────────────────────────────┘
```

Annotate key rows with `← label` comments.

Always verify the sketch against these rules before showing it:
- [ ] Feet in last 1–2 rows (Rule 1)
- [ ] Body last non-zero row is directly above first leg pixel — no blank rows (Rule 2)
- [ ] Tail pixels connect to body with no gap (Rule 8)
- [ ] Colour 3 used for exactly one purpose (Rule 10)

### Step 5 — Wait for explicit user confirmation

**Do not write a single pixel or save any file until the user explicitly confirms
the adult sketch.** Accepted confirmations: "yes", "looks good", "go ahead",
"proceed", "save it".

If the user requests changes, revise and re-show. Repeat until confirmed.

### Step 6 — Sketch remaining stages

Once the adult is confirmed, sketch **baby → child → teen → senior** in order,
applying Rule 9 scaling:

| Stage | Scale target |
|---|---|
| Teen | ~85% adult width AND height |
| Child | ~75% adult width AND height |
| Baby | ~60% adult width AND height |
| Senior | = adult + colour-3 age spots only (Rule 6) |

Show all remaining stages in one message. Check each against Rules 1, 2, 8.

Wait for user confirmation before proceeding.

### Step 7 — Save to `sprites/<animal>.md`

On confirmation of all stages, save the complete sketch document to:

```
sprites/<animal>.md
```

at the **project root** (not inside `.opencode/skills/`).

The file must include:
- Spec table (all design decisions)
- Colour legend
- Renderer changes required (if any)
- All 5 stage ASCII grids with annotations
- Stage scaling summary table

Commit with: `docs: add <animal> redesign sketch to sprites/<animal>.md`

### Step 8 — Hand off to implementation

After saving, tell the user:
- The sketch is saved and committed
- The next step is pixel data implementation
- List any renderer changes needed (new colour indices, flip logic, etc.)

Do not begin implementation automatically — wait for the user to say "proceed"
or "implement".

---

## Grid reference (for sketching)

```
Upright (32 cols × 48 rows) — head/face visible
  Rows 0–7:   empty (reserved for tall ears, props above head)
  Rows 8–10:  head top / ears / horns
  Rows 11–22: face, shoulders, upper torso
  Rows 23–36: lower torso, pelvis — must end AT row 36
  Rows 37–47: legs — start AT row 37, feet in rows 46–47

Quadruped (48 cols × 32 rows) — head faces LEFT
  Rows 0–7:   empty / features above body
  Rows 8–10:  head
  Rows 11–24: torso
  Rows 25–31: legs — feet in rows 30–31
```

---

## Do not skip to pixel data

This skill exists precisely to separate the **design conversation** from the
**implementation**. Never convert a sketch to pixel string arrays until:

1. All 5 stages are sketched
2. The user has confirmed all stages
3. The sketch is saved to `sprites/<animal>.md`
4. The user has explicitly said to proceed with implementation
