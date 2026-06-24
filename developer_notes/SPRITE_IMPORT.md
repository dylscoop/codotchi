# Sprite Image Converter

Reference and usage guide for `scripts/import_sprite.js` — the tool that
converts a pixel-art image into a Codotchi `DEFS` grid entry.

---

## Overview

`scripts/import_sprite.js` is a zero-dependency Node.js CLI that takes a
source image, converts it into the indexed-colour row-string format used by
`DEFS` in `sprites.js`, and optionally splices the result directly into the
codebase.

It is a **build-time developer tool only** — it is not shipped in either the
VS Code extension or the PyCharm plugin. Both IDEs share the same
`sprites.js` and `spriteConstants.js` files, so running `--inject` once
updates both IDEs simultaneously.

See [`SPRITES.md`](SPRITES.md) for the full sprite grid reference and colour
legend.

---

## What it does

The converter runs a five-stage pipeline:

1. **Decode** — reads the source image into an in-memory RGBA pixel grid.
2. **Downscale** (if needed) — nearest-neighbour resampling to fit within the
   700 × 550 maximum, preserving the aspect ratio.
3. **Quantize** — maps every pixel to one of four colour indices:
   `0` transparent, `1` primary, `2` secondary, `3` accent.
4. **Generate** — converts the quantized grid into `DEFS` row-strings (one
   string per row, one character per pixel) and emits them to stdout.
5. **Inject** (optional, `--inject`) — splices the `DEFS` block, a
   `SPRITE_GRID_META` entry, and a default `ANIMAL_PALETTES` entry into both
   IDEs' `sprites.js` and `spriteConstants.js`.

---

## Supported formats

| Extension | Format | Decoding method |
|-----------|--------|-----------------|
| `.png` | PNG | Pure-JS decoder — 8-bit RGBA, RGB, greyscale, and indexed (paletted). Non-interlaced only. |
| `.pixil` | Pixilart JSON | Pure-JS decoder. Multi-layer files are supported; layers are flattened bottom-to-top. Use `--frame` to select a frame other than 0. |
| `.jpg` / `.jpeg` | JPEG | Transcoded to PNG via an external converter (see Prerequisites). |
| `.webp` | WebP | Transcoded to PNG via an external converter (see Prerequisites). |

Format is detected from **file content (magic bytes)**, not just the file extension. If a
JPEG is mistakenly named `.png`, the tool detects it, prints a warning, and processes
it correctly as JPEG. Unsupported formats receive a clear error.

### External converter — JPEG and WebP

JPEG and WebP files are transcoded to a temporary PNG in-memory before decoding. The
tool tries the following converters in order, using the first one that works:

1. **ImageMagick v7+** (`magick`) — supports all formats including WebP.
   Install from <https://imagemagick.org>.
2. **PowerShell `System.Drawing`** — built into Windows, no install needed.
   Supports JPEG reliably; WebP requires the optional Windows WebP codec.
3. **ImageMagick legacy** (`convert`) — used only when the found binary is not
   `C:\Windows\System32\convert.exe` (the Windows disk utility, not ImageMagick).
3b. **`dwebp`** (Google libwebp) — **WebP only.** Tiny standalone tool from
   <https://developers.google.com/speed/webp/download>. Skipped for JPEG.
4. **ffmpeg** — install from <https://ffmpeg.org>.
5. **Python + Pillow** — tried via `py` (Windows Launcher) then `python`.
   Requires Pillow: `pip install Pillow`. Works for both JPEG and WebP.

If no converter can handle the format, the tool exits with a clear error listing
install options. On Windows, JPEG works out of the box via PowerShell. For WebP,
install any of: ImageMagick v7+, `dwebp`, ffmpeg, or Python + Pillow.

The temporary PNG is deleted immediately after decoding; no files are left behind.

---

## Prerequisites

- **Node.js 18 or later** (uses the built-in `node:test` runner in the test
  suite; the importer itself works on Node 16+ but 18 is the project standard).
- No `npm install` step — the script uses only Node built-ins (`fs`, `path`,
  `zlib`, `os`, `child_process`).
- **For JPEG/WebP:** an external converter must be available. On Windows,
  JPEG works without any install (PowerShell `System.Drawing` is built in).
  For WebP, install any of: ImageMagick v7+, `dwebp`, ffmpeg, or Python + Pillow
  (see Supported formats above).

---

## Usage

```sh
node scripts/import_sprite.js <file> <spriteType> <stage> [options]
```

| Argument | Description |
|----------|-------------|
| `<file>` | Path to the source image (`.png` or `.pixil`). |
| `<spriteType>` | Identifier for the sprite type, e.g. `kangaroo`. Must match the key used in `DEFS`, `SPRITE_GRID_META`, and `ANIMAL_PALETTES`. |
| `<stage>` | Life stage: `baby`, `child`, `teen`, `adult`, or `senior`. |

### Options

| Flag | Default | Description |
|------|---------|-------------|
| `--frame <N>` | `0` | `.pixil` only — which frame to decode. |
| `--leg-row <N>` | `floor(rows × 0.78)` | Row index where the leg zone begins. Used for walk animation and belly-sag. |
| `--primary <#hex>` | auto | Source colour to map to index 1 (body fill). |
| `--secondary <#hex>` | auto | Source colour to map to index 2 (eyes / markings). |
| `--accent <#hex>` | auto | Source colour to map to index 3 (stripes / accent). |
| `--threshold <0–255>` | `128` | Alpha value below which a pixel is treated as transparent. |
| `--transparent <#hex>` | off | Source colour to key out as transparent before quantization (useful for JPEGs with white backgrounds). |
| `--transparent-distance <N>` | `2500` | Squared RGB-distance tolerance for `--transparent`; larger values remove more near-background pixels. |
| `--crop-transparent` | off | Trim the transparent border after applying alpha / `--transparent`, before max-size scaling. |
| `--preview` | off | Print an ASCII art preview of the quantized grid to stderr. |
| `--inject` | off | Splice the output directly into both IDEs' `sprites.js` and `spriteConstants.js`. |

---

## Colour mapping

### Auto-detect (no palette flags)

When no `--primary/--secondary/--accent` flags are given, the converter counts
the frequency of every non-transparent colour, takes the **three most
frequent**, and ranks them by luminance:

- Highest luminance → index 1 (primary / body fill)
- Mid luminance → index 2 (secondary / eyes)
- Lowest luminance → index 3 (accent / markings)

Auto-detected colours are printed to stderr so you can verify or override them.

### Explicit palette

When one or more palette flags are given, each visible pixel is mapped to the
**nearest provided colour** by Euclidean RGB distance. Any pixel with no
close match defaults to index 1. Omitting a flag simply means no pixel will
ever be quantized to that index.

---

## Worked examples

### Preview before committing

Check how the quantization looks without writing anything:

```sh
node scripts/import_sprite.js downloaded_sprites/pixilart-drawing.png mysprite adult --preview
```

### Explicit palette, single stage

```sh
node scripts/import_sprite.js source.png mysprite adult \
  --primary "#8b6914" --secondary "#4a3728" --accent "#5c4a1e"
```

The `DEFS` entry is printed to stdout. Redirect to a file or pipe to a
reviewer before injecting.

### JPEG with white background removal

JPEGs do not have alpha, so a flat white background imports as opaque pixels
unless you key it out first:

```sh
node scripts/import_sprite.js downloaded_sprites/kangaroo.jpg roo adult \
  --transparent "#ffffff" --transparent-distance 2500 --crop-transparent --preview
```

`--transparent` runs before colour auto-detection, so the background will not
be counted as the most frequent colour. `--crop-transparent` then trims the
empty border so the grid metadata matches the visible sprite rather than the
original canvas size.

### Full inject flow (all stages)

Run once per life stage, using `--inject` each time:

```sh
node scripts/import_sprite.js source.png mysprite baby   --inject
node scripts/import_sprite.js source.png mysprite child  --inject
node scripts/import_sprite.js source.png mysprite teen   --inject
node scripts/import_sprite.js source.png mysprite adult  --inject
node scripts/import_sprite.js source.png mysprite senior --inject
```

`--inject` is idempotent for `SPRITE_GRID_META` and `ANIMAL_PALETTES` — it
skips re-adding entries that already exist. Re-running it for a stage replaces
the existing `DEFS` block for that stage.

---

## What `--inject` writes

For each target file (`vscode/media/sprites.js`,
`pycharm/src/main/resources/webview/sprites.js`, and both matching
`spriteConstants.js` files):

| What is written | Where |
|-----------------|-------|
| `DEFS["spriteType"]["stage"] = [...]` | Before the `window.SPRITES` exports section in `sprites.js` |
| `spriteType: { cols, rows, legRowStart }` | Inside the `SPRITE_GRID_META` object in `spriteConstants.js` |
| `spriteType: { primary, secondary, accent, background }` | At the top of `ANIMAL_PALETTES` in `spriteConstants.js` (default neutral greys — **update manually**) |

The `ANIMAL_PALETTES` entry uses placeholder grey values. Always replace them
with the correct hex colours for the new sprite after injecting. See the
palette table in [`SPRITES.md`](SPRITES.md) for examples.

---

## After injecting: verification checklist

1. **Validate row widths:**

   ```sh
   node scripts/validate_sprites.js
   ```

   All rows must be valid (exit 0) before committing.

2. **Update `ANIMAL_PALETTES`** — replace the default grey placeholder with
   the real primary, secondary, accent, and background colours in both
   `spriteConstants.js` files.

3. **Register for unlock** — add the new `spriteType` to:
   - `vscode/media/customCharacters.js`
   - `vscode/src/customCharacters.ts`
   - `pycharm/src/main/kotlin/com/codotchi/CustomCharacters.kt`

   See the comment at the top of `customCharacters.js` for the required
   format.

4. **Add all five stages** — `--inject` only writes the stage you specify.
   Import and inject `baby`, `child`, `teen`, `adult`, and `senior`
   separately. A sprite type with missing stages will fall back to `adult` at
   runtime but will look wrong at other ages.

5. **Check the Sprite Preview** — enable developer mode, open the Command
   Palette (VS Code) or Tools menu (PyCharm), run **Codotchi: Open Sprite
   Preview (Dev)**, and verify all five stages render correctly.

---

## Limitations and gotchas

| Limitation | Detail |
|------------|--------|
| Maximum grid size | 700 columns × 550 rows. Larger images are scaled down (aspect preserved). |
| JPEG backgrounds | JPEGs are fully opaque. Use `--transparent "#ffffff" --transparent-distance N --crop-transparent` for flat white backgrounds before importing. |
| WebP requires a converter | PowerShell `System.Drawing` does not support WebP unless the Windows WebP codec is installed. Install ImageMagick v7+, `dwebp`, ffmpeg, or Python + Pillow for reliable WebP support. |
| Interlaced PNGs unsupported | The PNG decoder rejects interlaced files. Re-export as non-interlaced (progressive) PNG. |
| Brittle injection markers | `--inject` finds insertion points by searching for exact string patterns in `sprites.js` and `spriteConstants.js`. Reformatting those files can break injection. |
| High-density grids | When a grid is denser than the on-screen bounding box (`cellWExact < 1`), the renderer switches to an offscreen canvas path. This is expected behaviour for very large imported grids. See `sprites.js` line 4141 for the v2 offscreen path. |
| Colour quantization accuracy | The auto-detect and nearest-RGB approaches work well for flat pixel art with 3–4 colours. Photographic or gradient-heavy images will produce poor results. |

---

## Related tools

| Script | Purpose |
|--------|---------|
| `scripts/gen_sprites.js` | Procedurally generates the built-in animal `DEFS` (not file import). |
| `scripts/inject_sprites.js` | Splices `gen_sprites.js` output into `sprites.js`. |
| `scripts/validate_sprites.js` | Verifies that every row string in `sprites.js` has the correct width for its `spriteType` per `SPRITE_GRID_META`. |
| `vscode/media/sprite_preview.html` | Standalone browser gallery for all sprites. |
