# gotchi

A virtual Tamagotchi-style pet that lives inside your IDE and reacts to your
coding activity. Available for both VS Code and JetBrains IDEs.

## What is it?

gotchi is a pixel-art virtual pet inspired by the original
[Tamagotchi](https://en.wikipedia.org/wiki/Tamagotchi). Your pet hatches from
an egg, grows through several life stages, and eventually reaches its final
evolved form — but only if you take care of it. Feed it, play with it, put it
to sleep, and keep its environment clean. Neglect it and it gets sick. Leave it
sick long enough and it dies.

Your coding activity matters too: every file you save makes your pet a little
happier.

## Platforms

| IDE | Package | Install |
| --- | ------- | ------- |
| VS Code | `vscode/` | `.vsix` from [Releases](https://github.com/dylscoop/vscode_gotchi/releases) |
| JetBrains (PyCharm, IntelliJ, etc.) | `pycharm/` | `.zip` from [Releases](https://github.com/dylscoop/vscode_gotchi/releases) |

Both extensions share the same game engine logic and the same webview UI
(`sidebar.html` / `sidebar.css` / `sidebar.js`).

## Quick install

### VS Code

1. Download `vscode-gotchi-0.2.2.vsix` from the Releases page.
2. In VS Code: **Extensions** (`Ctrl+Shift+X`) → **⋯** → **Install from VSIX…**
3. Select the file and reload.

Or from the terminal:

```bash
code --install-extension vscode-gotchi-0.2.2.vsix
```

### JetBrains

1. Download `pycharm-gotchi-0.2.2.zip` from the Releases page.
   Do **not** unzip it.
2. In your IDE: **Settings → Plugins → ⚙ → Install Plugin from Disk…**
3. Select the `.zip` file and restart the IDE.

For full usage instructions see the individual READMEs:

- [vscode/README.md](vscode/README.md)
- [pycharm/README.md](pycharm/README.md)

## Repository layout

```text
gotchi/
├── vscode/                  VS Code extension (TypeScript)
│   ├── src/                 Extension host + game engine
│   ├── media/               Webview UI (HTML / CSS / JS)
│   └── README.md
├── pycharm/                 JetBrains plugin (Kotlin + Gradle)
│   ├── src/main/kotlin/     Plugin source
│   ├── src/main/resources/  plugin.xml + shared webview files
│   └── README.md
├── archive/                 Snapshots of previous versions
├── VERSIONS.md              Changelog
└── BUGFIXES.md              Bug fix log
```

## Building from source

### VS Code extension

Requires Node.js ≥ 18.

```bash
cd vscode
npm install
npx vsce package
# produces vscode-gotchi-0.2.2.vsix
```

### JetBrains plugin

Requires JDK 17+.

```bash
cd pycharm

# macOS / Linux
./gradlew buildPlugin

# Windows
gradlew.bat buildPlugin

# produces pycharm/build/distributions/pycharm-gotchi-0.2.2.zip
```

## Version history

See [VERSIONS.md](VERSIONS.md) for the full changelog.

Current release: **v0.2.2**

---

> "Grow your best pet by writing your best code."
