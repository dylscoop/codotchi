Sprite design drafts for the v1.2.0 GIF-based sprite overhaul.

This folder captures per-animal, per-stage pixel layouts in a small fixed grid
so that both humans and tooling can agree on the intended art before we wire
it into the runtime renderer / GIF generator.

Grids are defined in JSON as arrays of strings, one string per row.
Each character is a symbol, not a final colour:

- `.` = transparent
- `o` = body main
- `l` = body light (muzzle / belly)
- `s` = stripe / accent
- `e` = eye / pupil
- `n` = nose / mouth accent
- `u` = outline (near-black in the final art)

Colour themes (neon, pastel, mono, ocean, custom) will be applied later via
the runtime renderer; these drafts only capture structure and proportions.
