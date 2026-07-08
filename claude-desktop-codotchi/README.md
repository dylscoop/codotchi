# Codotchi for Claude Desktop

A Tamagotchi-style virtual pet that lives inside your **Claude Desktop** chats. It
renders as ASCII art right in the conversation, and you keep it happy by
talking to Claude and caring for it.

## Install

1. Download `codotchi-desktop.mcpb`.
2. In Claude Desktop: **Settings → Extensions → Advanced settings → Install
   Extension…** (or just drag the `.mcpb` onto the Extensions page).
3. Optionally set a pet name / type in the extension's settings.
4. In a chat, say **"show my codotchi"** — the pet's ASCII art appears inline.

Node.js ships inside Claude Desktop, so there's nothing else to install.

## How it works

A local MCP server (bundled into the `.mcpb`) runs the shared Codotchi game
engine and persists an independent pet. Every pet-facing tool returns the pet
rendered as an ASCII text block.

| Tool | What it does |
|------|--------------|
| `codotchi` | Show the pet |
| `codotchi_feed` / `codotchi_pat` / `codotchi_sleep` / `codotchi_clean` / `codotchi_medicine` | Care actions |
| `codotchi_activity` | Registers chat activity → a small reward. Claude is asked (via the server's instructions) to call this ~once per turn as it works |

Ask Claude in chat (e.g. "feed my codotchi") to trigger these tools — there
are no on-screen buttons.

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
npm run build     # typecheck + bundle server (dist/server.mjs)
npm run bundle    # zip into codotchi-desktop.mcpb
npm start         # run the server over stdio (drive it with the MCP Inspector)
```

Smoke-test with the MCP Inspector:

```bash
npx @modelcontextprotocol/inspector node dist/server.mjs
```

### Engine parity

The `gameEngine.ts` and `asciiArt.ts` sources are copied from `claude-codotchi/`;
keep them in sync when the shared engine changes (see the repo's parity skills).
