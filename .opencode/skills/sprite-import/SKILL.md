---
name: sprite-import
description: Use when importing downloaded pixel-art/image sprites into Codotchi with scripts/import_sprite.js, especially WebP/JPG/PNG sources, background removal, spriteConstants metadata, Sprite Preview, or custom character passcodes.
---

# Sprite Import

Use this skill whenever a user asks to import a downloaded sprite image into
Codotchi, including requests like "import this image", "add this sprite",
"use this downloaded sprite", or "hide this behind a character code".

This skill complements `sprite-drawing`: use `sprite-drawing` for hand-authored
pixel grids and rule checks, and this skill for the importer workflow.

## Core Rules

- Always try the exact user-specified source image first.
- Do not force imported sprites into 48 x 32 unless the user explicitly asks for a fixed classic grid.
- Imported image sprites may legitimately have large grids such as 550 x 550; preserve the real dimensions in `SPRITE_GRID_META`.
- Never use broad global white background keying for animals with white or cream body areas.
- Prefer edge-connected background masking when the subject has white/cream fur, feathers, wool, belly markings, or highlights.
- Run imports sequentially when using `--inject`; parallel injection into the same files can lose stages or corrupt insertion points.
- Verify all five stages exist after injection: `baby`, `child`, `teen`, `adult`, `senior`.
- Keep VS Code and PyCharm mirrors in sync.
- Update docs and version notes in the same change.

## Source Selection

1. Use the filename the user named if it exists.
2. If the file is WebP and import fails because no converter is installed, report that fact and use a derived PNG or fallback image only when available.
3. If using a fallback JPG with watermark/footer content, crop or mask it before importing.
4. Keep derived source files in `downloaded_sprites/` with clear names such as `<sprite>-cropped.png` or `<sprite>-masked.png`.

## Background Removal

Avoid this for white/cream animals:

```powershell
node scripts/import_sprite.js source.png shiba adult --transparent "#ffffff" --transparent-distance 12000
```

Why: global near-white keying deletes the animal's white fur, chest, belly, or
markings. Those pixels become transparent and render as the dark canvas
background.

Preferred approach for white/cream subjects:

1. Create a masked PNG where only near-white pixels connected to image edges are transparent.
2. Import the masked PNG without `--transparent`.
3. Map retained white/cream subject pixels with `--secondary`.

Recommended importer shape:

```powershell
node scripts/import_sprite.js downloaded_sprites/shiba-masked.png dog adult `
  --crop-transparent `
  --leg-row 385 `
  --primary "#f2994a" `
  --secondary "#f2eadf" `
  --accent "#5b2f1f" `
  --preview
```

Then inject sequentially for every stage:

```powershell
node scripts/import_sprite.js downloaded_sprites/shiba-masked.png dog baby --crop-transparent --leg-row 385 --primary "#f2994a" --secondary "#f2eadf" --accent "#5b2f1f" --inject
node scripts/import_sprite.js downloaded_sprites/shiba-masked.png dog child --crop-transparent --leg-row 385 --primary "#f2994a" --secondary "#f2eadf" --accent "#5b2f1f" --inject
node scripts/import_sprite.js downloaded_sprites/shiba-masked.png dog teen --crop-transparent --leg-row 385 --primary "#f2994a" --secondary "#f2eadf" --accent "#5b2f1f" --inject
node scripts/import_sprite.js downloaded_sprites/shiba-masked.png dog adult --crop-transparent --leg-row 385 --primary "#f2994a" --secondary "#f2eadf" --accent "#5b2f1f" --inject
node scripts/import_sprite.js downloaded_sprites/shiba-masked.png dog senior --crop-transparent --leg-row 385 --primary "#f2994a" --secondary "#f2eadf" --accent "#5b2f1f" --inject
```

## Target Sprite Type

- Ask or infer the intended `spriteType` before injecting.
- If the user says "call it shiba", use `shiba` as the sprite type.
- If the user says "change the type to dog" or "replace dog", import into `dog` and remove standalone `shiba` metadata/blocks.
- If the user wants a passcode, custom-character passcode and sprite type are separate concepts: a `shiba` passcode can map to `spriteType: "dog"`.

## Files To Update

Importer `--inject` updates:

- `vscode/media/sprites.js`
- `pycharm/src/main/resources/webview/sprites.js`
- `vscode/media/spriteConstants.js`
- `pycharm/src/main/resources/webview/spriteConstants.js`

If adding a passcode, update all registries:

- `vscode/src/customCharacters.ts`
- `vscode/media/customCharacters.js`
- `pycharm/src/main/kotlin/com/codotchi/CustomCharacters.kt`
- `pycharm/src/main/resources/webview/customCharacters.js`

If adding a new non-existing sprite type that the host state may store, update:

- `vscode/src/gameEngine.ts` `SpriteType` union
- any mirrored OpenCode game engine type union when relevant

If only mapping a passcode to an existing sprite type, do not add a new
`SpriteType` union member.

## Post-Import Checks

Search for stage presence in both sprite files:

```powershell
# Expect five matches per IDE for the target type.
```

Then run:

```powershell
node scripts/validate_sprites.js
```

For feature verification, also run:

```powershell
# from vscode/
npm test
npx tsc --noEmit

# from pycharm/
$env:JAVA_HOME = 'C:\Program Files\JetBrains\PyCharm 2025.2.3\jbr'
& '.\gradlew.bat' unitTest --no-configuration-cache
```

Run `git diff --check` before finalizing.

## Documentation

Update the relevant markdown docs:

- `developer_notes/SPRITES.md` palette/grid table and sprite section.
- `developer_notes/sprites/<sprite>.md` with source, preprocessing, palette, and checklist.
- `developer_notes/DEV_NOTES.md` custom-character passcode table when adding a code.
- `developer_notes/VERSIONS.md` rows for every changed file and updated constants.

Document any derived image source and why it exists, especially if WebP could
not be decoded locally or masking was needed to preserve white subject pixels.

## Pitfalls From The Shiba Import

- WebP may fail without ImageMagick, ffmpeg, or Windows WebP codec.
- Global `--transparent-distance 12000` deleted the Shiba's white front fur.
- Edge-connected background masking fixed the white-fur issue.
- Parallel `--inject` calls into `sprites.js` caused lost stages and insertion-point errors.
- Importer may append `DEFS["type"]["stage"]` blocks instead of replacing object-style built-in definitions; verify which definition wins before shipping.
- `SPRITE_GRID_META` line formatting can be damaged by line-ending mismatches; inspect constants after injection.
