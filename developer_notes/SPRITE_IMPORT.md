# Sprite Import Pipeline

Reference and usage guide for the bulk sprite pipeline: source images in
`sprites/<species>/` become `vscode/media/sprites.generated.js`, which both
IDEs load.

---

## Overview

| Script | Purpose |
|--------|---------|
| `scripts/import_sprites_bulk.js` | Imports **every** `sprites/<species>/` folder and rewrites `vscode/media/sprites.generated.js` from scratch. `--check` fails if the file is out of date (CI runs it). |
| `scripts/import_sprite.js` | Converts **one** image and prints a `DEFS` entry, grid size and palette for review. It doesn't edit any file. |
| `scripts/lib/spriteImport.js` | Shared decode / background removal / crop / resample / quantise / pad code, plus a PNG encoder. |
| `scripts/validate_sprites.js` | Loads the real webview data (`spriteConstants.js` → `sprites.generated.js` → `sprites.js`) and checks every species. CI runs it. |
| `scripts/export_sprite_pngs.js` | One-off: writes grids that already exist in the webview data out as a `sprites/<species>/` folder (used to move dog, cat, dragon and roo out of `sprites.js`). |

These are **build-time developer tools only**. They don't ship in the VS Code
extension or the PyCharm plugin. Both IDEs load the same files from
`vscode/media` (PyCharm copies them at build time), so one run updates both.

The source images in `sprites/` are the source of truth. Never edit
`sprites.generated.js` by hand.

See [`SPRITES.md`](SPRITES.md) for the grid format and colour legend.

---

## Adding or updating a species

1. Create `sprites/<species>/`. The folder name is the `spriteType`: lower-case
   letters, digits or `_`.
2. Add one image per stage: `baby.png`, `child.png`, `teen.png`, `adult.png`,
   `senior.png`. You can use `.jpg`, `.webp` or `.pixil` instead of `.png`.
   - Quadrupeds must face **left**. Set `"flip": true` if the art faces right.
   - Optional mood art uses the name `<stage>_<mood>`, e.g. `adult_sleeping.png`.
3. Optionally add a `sprite.json` (see below), for example to pin the palette.
4. Run:

   ```sh
   node scripts/import_sprites_bulk.js
   node scripts/validate_sprites.js
   ```

   The import prints each species' grid size and palette, and warns about any
   missing stage. A species with missing stages uses its adult grid at those
   stages; with no adult grid it is drawn as the classic pet.
5. Register a new species by hand (the generator only warns about mismatches
   between these files and `sprite.json`):
   - Rotation pool: add it to `ROTATION_ANIMALS` in `packages/core/src/gameEngine.ts`
     (run `node scripts/sync-core.mjs`) and `pycharm/.../engine/GameEngine.kt`.
   - Unlockable character: add it to `vscode/media/customCharacters.js`,
     `vscode/src/customCharacters.ts` and
     `pycharm/src/main/kotlin/com/codotchi/CustomCharacters.kt`.
   - Terminal plugins: add a `SPRITE_HEAD` entry in `packages/core/src/asciiArt.ts`
     and an emoji in `claude-codotchi/scripts/emoji.mjs`.
6. Check the **Sprite Preview** in developer mode: open the Command Palette
   (VS Code) or the Tools menu (PyCharm) and run **Codotchi: Open Sprite
   Preview (Dev)**.
7. Commit the source images, `sprite.json` and the regenerated
   `sprites.generated.js` together.

### `sprite.json`

Every field is optional.

| Field | Default | Meaning |
|-------|---------|---------|
| `palette` | auto | `{ primary, secondary, accent }`: exact source colours for indices 1 / 2 / 3. Each pixel maps to the nearest one. |
| `background` | `#1a1a1a` | Canvas background behind the pet. |
| `transparent` | auto | Source colour to treat as transparent. When this is unset, a fully-opaque image with four matching corners has that corner colour removed. |
| `transparentDistance` | `2500` | Squared-RGB tolerance for `transparent`. |
| `threshold` | `128` | Alpha below which a pixel is transparent. |
| `crop` | `true` | Trim each stage's transparent border before sizing. |
| `anchor` | `"centre"` | Where narrower stages sit on the shared grid: `"centre"` or `"left"`. They are always bottom-aligned. |
| `flip` | `false` | Mirror every stage. |
| `legRowStart` | `floor(rows × 0.78)` | First leg-zone row **of the output grid** (used for the walk animation and belly sag). |
| `upright` | `false` | Portrait species; added to `UPRIGHT_TYPES`. |
| `inRotation`, `passcode`, `defaultName` | — | Checked against `ROTATION_ANIMALS` and `customCharacters.js`; a mismatch prints a warning. |

---

## What the bulk import does

For each species folder:

1. **Decode** every stage into RGBA (formats below).
2. **Remove the background**: the `transparent` colour, or the automatic
   corner check. Then **crop** the transparent border unless `crop` is
   `false`.
3. **Size** the stages together:
   - One scale factor is applied to every stage, so the largest stage fits the
     192 × 128 cap and the stages keep their relative sizes.
   - The species' grid is the size of its largest scaled stage.
   - The renderer draws every species at a fixed body width, so a smaller stage
     image draws smaller inside that width.
4. **Quantise** every stage against **one palette**. The palette comes from
   `sprite.json`, or from the three most frequent colours across all stages,
   ranked by luminance: brightest → 1 primary, mid → 2 secondary, darkest → 3
   accent.
5. **Flip** if asked, then **pad** each stage onto the shared grid with
   transparent cells (bottom-aligned, horizontal position from `anchor`).
6. **Write** `sprites.generated.js`. Species are in name order and the output
   is deterministic. The file contains:
   - `window.GENERATED_SPRITE_DEFS`: `sprites.js` merges it into `DEFS` before
     building `window.SPRITES`.
   - `SPRITE_GRID_META` and palette entries, merged into the objects from
     `spriteConstants.js` with `Object.assign`.
   - `UPRIGHT_TYPES` entries for upright species.

Load order (sidebar and sprite preview, both IDEs):
`spriteConstants.js` → `sprites.generated.js` → `sprites.js`.

Hand-drawn species (classic, sheep, snake, kangaroo, tim, stu) still live in
`sprites.js` and `spriteConstants.js`. To move one over, run
`node scripts/export_sprite_pngs.js <species>` and then delete its `DEFS`,
meta and palette entries.

---

## Supported formats

| Extension | Format | Decoding method |
|-----------|--------|-----------------|
| `.png` | PNG | Pure-JS decoder: 8-bit RGBA, RGB, greyscale, and indexed (paletted). Non-interlaced only. |
| `.pixil` | Pixilart JSON | Pure-JS decoder. Layers are flattened bottom-to-top. The single-image CLI's `--frame` picks a frame other than 0. |
| `.jpg` / `.jpeg` | JPEG | Transcoded to PNG with an external converter. |
| `.webp` | WebP | Transcoded to PNG with an external converter. |

The format is detected from the **file content (magic bytes)**. A JPEG named
`.png` is handled as JPEG, with a warning.

### External converter (JPEG and WebP)

The tools try these in order and use the first that works:

1. **ImageMagick v7+** (`magick`)
2. **PowerShell `System.Drawing`**: built into Windows. Reliable for JPEG; WebP
   needs the Windows WebP codec.
3. **ImageMagick legacy** (`convert`), but not `C:\Windows\System32\convert.exe`
4. **`dwebp`**: WebP only
5. **ffmpeg**
6. **Python + Pillow** (`py`, then `python`)

The converter lookup uses `where.exe`, so JPEG/WebP import only works on
Windows. On Linux or macOS, convert to PNG first. PNG and `.pixil` work
everywhere.

---

## Single-image CLI

```sh
node scripts/import_sprite.js <file> <spriteType> <stage> [options]
```

It prints the `DEFS` entry, grid size and palette to stdout. Use it to try out
options before putting an image in `sprites/`. The old `--inject` option has
been removed (BUGFIX-179).

| Flag | Default | Description |
|------|---------|-------------|
| `--frame <N>` | `0` | `.pixil` only: which frame to decode. |
| `--leg-row <N>` | `floor(rows × 0.78)` | Leg-zone start row. |
| `--primary` / `--secondary` / `--accent <#hex>` | auto | Exact source colours for indices 1 / 2 / 3. |
| `--threshold <0–255>` | `128` | Alpha below which a pixel is transparent. |
| `--transparent <#hex>` | auto | Source colour to treat as transparent. |
| `--transparent-distance <N>` | `2500` | Squared-RGB tolerance for `--transparent`. |
| `--crop-transparent` | off | Trim the transparent border. |
| `--flip` | off | Mirror the grid. |
| `--preview` | off | Print an ASCII preview. |

`scripts/import_sprite.ps1` (or double-click `import_sprite.bat`) prompts for
each option and runs the CLI once per stage.

---

## Limitations and gotchas

| Limitation | Detail |
|------------|--------|
| Maximum grid size | 192 columns × 128 rows (`MAX_COLS` / `MAX_ROWS` in `scripts/lib/spriteImport.js`). Larger stages are scaled down with nearest-neighbour sampling. |
| Single-colour images | A fully-opaque image with matching corners loses that colour as "background". Give the art a transparent background, or set `transparent` to a colour that isn't used. |
| Interlaced PNGs unsupported | Re-export as non-interlaced PNG. |
| Gold cells | Indices 4 / 5 (gold) can't come from an image, because the palette has 3 colours. |
| High-density grids | When a grid is denser than its on-screen box (`cellWExact < 1`), the renderer draws through an offscreen canvas. This is expected for large imported grids. |
| Colour quantisation | Works well for flat pixel art with 3–4 colours. Photos and gradients give poor results. |
