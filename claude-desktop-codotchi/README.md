# Codotchi for Claude Desktop

A Tamagotchi-style virtual pet that lives inside your **Claude Desktop** chats. It
renders as an animated pixel companion (an [MCP App](https://modelcontextprotocol.io/extensions/apps/overview))
right in the conversation — the same pet sprites as the Codotchi VS Code
extension — and you keep it happy by talking to Claude and caring for it.

## Install

1. Download `codotchi-desktop.mcpb`.
2. In Claude Desktop: **Settings → Extensions → Advanced settings → Install
   Extension…** (or just drag the `.mcpb` onto the Extensions page).
3. Optionally set a pet name / type / reduced-motion in the extension's settings.
4. In a chat, say **"show my codotchi"** — the pet appears inline.

Node.js ships inside Claude Desktop, so there's nothing else to install.

## How it works

A local MCP server (bundled into the `.mcpb`) runs the shared Codotchi game
engine and persists an independent pet. Pet-facing tools return a `ui://codotchi/pet`
MCP App resource — a sandboxed iframe running the pixel-art canvas renderer.

| Tool | What it does |
|------|--------------|
| `codotchi` | Show the pet widget |
| `codotchi_feed` / `codotchi_pat` / `codotchi_sleep` / `codotchi_clean` / `codotchi_medicine` | Care actions |
| `codotchi_tick` | Advance the sim one tick (the widget self-polls this to stay live) |
| `codotchi_activity` | Registers chat activity → a small reward. Claude is asked (via the server's instructions) to call this ~once per turn as it works |

The widget also has **Feed/Pat/Sleep/Clean/Medicine buttons** that call these
tools directly.

### Rewards & the speech bubble

Because a Claude Desktop MCP server only runs when one of its tools is called —
and the host does **not** expose the conversation's real token/cost usage to
servers — the pet is driven by:

- **Care actions** (feed/pat/…) — the main rewards.
- **`codotchi_activity`** — a small "you talked to me!" reward each turn (throttled).
- **Offline decay** — time between interactions decays hunger/happiness (aging is
  frozen while nothing is running), exactly like the IDE integrations when the
  editor is closed.

The speech bubble shows a **session activity proxy** — real, reliable numbers
like `12 msgs today · 5 treats!` — not fabricated token counts.

### State

Stored independently of the IDE pets:

- Windows: `%APPDATA%\codotchi\claude-desktop\{state,session}.json`
- macOS/Linux: `~/.config/codotchi/claude-desktop/{state,session}.json`

## Develop

```bash
npm install
npm run build     # typecheck + bundle server (dist/server.mjs) + assemble UI resource (dist/ui/index.html)
npm run bundle    # zip into codotchi-desktop.mcpb
npm start         # run the server over stdio (drive it with the MCP Inspector)
```

Smoke-test with the MCP Inspector:

```bash
npx @modelcontextprotocol/inspector node dist/server.mjs
```

### Sprite parity

The widget reuses the browser-native renderer and sprite data shared with the
Claude Code panel (`claude-codotchi/panel/`), which mirrors the Codotchi VS Code
sprites — so the Desktop pet is visually identical to the VS Code sidebar pet.
The `gameEngine.ts` and `asciiArt.ts` sources are copied from `claude-codotchi/`;
keep them in sync when the shared engine changes (see the repo's parity skills).
