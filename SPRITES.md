# Codotchi Sprites Reference

Current sprite pipeline reference for the v1.2.0 redesigned image-based sprite system.

---

## Overview

The old procedural grid set has been replaced with a generated image pipeline.

Authoring source files live in `sprite_designs/*.json`, one file per sprite type.
These symbolic 16x16 layouts are converted by `scripts/generate-sprites.js` into
real PNG/GIF assets under:

- `vscode/media/sprites/`
- `pycharm/src/main/resources/webview/sprites/`

The webview runtime loads the generated GIFs via:

- `vscode/media/sprite-manifest.js`
- `pycharm/src/main/resources/webview/sprite-manifest.js`

`sprites.js` is now a lightweight image loader / canvas renderer, not the source
of the art itself.

---

## Families

| Family | Types |
|------|---------|
| Upright / mascot | classic, monkey, rooster, dragon |
| Quadruped | cat, rat, ox, tiger, rabbit, horse, goat, dog, pig |
| Serpentine | snake |

Each animal has five life stages:

- `baby`
- `child`
- `teen`
- `adult`
- `senior`

Each non-egg stage generates four animation states:

- `idle`
- `walk`
- `sleep`
- `react`

Egg is generated separately as `egg.gif` / `egg.png`.

---

## Design Symbols

```text
.  = transparent
u  = outline
o  = body main
l  = body light
s  = stripe / accent
e  = eye / pupil
n  = nose / mouth accent
```

These symbols are converted into generated image assets first, then colour-tinted
at runtime in the canvas renderer.

---

## Runtime Notes

- `sprites.js` keeps the canvas rendering path and draws image assets with `drawImage`.
- `sidebar.js` selects `idle`, `walk`, `sleep`, or `react` instead of manipulating
  row offsets with `legFrame`.
- The runtime keeps existing canvas transforms for reactions and facing direction.
- A future refactor can still move to DOM `<img>` elements if desired.

---

## Generated Outputs

Generated review and runtime assets live at:

- `sprite_designs/previews/sprite-sheet-preview.png`
  - Contact sheet of the redesigned adult sprite set.
- `vscode/media/sprites/*.png`
  - First-frame PNG output for each generated sprite state.
- `vscode/media/sprites/*.gif`
  - Animated runtime assets used by the VS Code webview.
- `pycharm/src/main/resources/webview/sprites/*.png`
  - Mirrored first-frame PNG output for the PyCharm webview.
- `pycharm/src/main/resources/webview/sprites/*.gif`
  - Mirrored animated runtime assets for the PyCharm webview.

---

## Source of Truth

If the sprite art needs to change again:

1. Edit the relevant `sprite_designs/*.json` files.
2. Run `npm run generate:sprites` from the repo root.
3. Verify `sprite_designs/previews/sprite-sheet-preview.png`.
4. Rebuild the IDE artifacts so the new generated assets are packaged.
