/**
 * Codotchi CLI (TUI) plugin for OpenCode 2.
 *
 * Shipped as source: OpenCode compiles .tsx CLI plugins itself, and resolves
 * @opencode/plugin/tui, @opentui/solid and solid-js at runtime. Installed next
 * to the server bundle as ~/.config/opencode/plugins/codotchi/tui.tsx.
 *
 * - sidebar.content       V1 speech bubbles (ASCII art + V1 text, V1 colours)
 * - session.composer.top  one-line cost summary
 * - toasts                pet alerts (evolution, mess, sickness, ...)
 *
 * Data comes from the server plugin's "codotchi" RPC (see CODOTCHI_RPC in
 * src/index.ts — keep both definitions in sync).
 */
import { Plugin } from "@opencode/plugin/tui"
import { createSignal, For, Show } from "solid-js"

const CODOTCHI_RPC = {
  id: "codotchi",
  methods: {
    snapshot: { output: { type: "object" } },
  },
  events: {
    updated: { schema: { type: "object" } },
    alert: {
      schema: {
        type: "object",
        properties: {
          title: { type: "string" },
          message: { type: "string" },
          variant: { type: "string" },
        },
        required: ["message"],
      },
    },
  },
} as const

type Tier = "green" | "yellow" | "red"
type Pet = { ide: string; name: string; stage: string; message: string; emoji: string; lines: string[] }
type Snapshot = {
  enabled: boolean
  tier: Tier
  pets: Pet[]
  today: { costUSD: number; tokens: number; messages: number }
  lastHour: { costUSD: number; tokens: number }
  session: { costUSD: number; tokens: number }
  thresholds: { warn: number; shout: number }
}

const ANSI_FG: Record<string, string> = {
  "30": "#6c7086", "31": "#ff5555", "32": "#50fa7b", "33": "#f1fa8c", "34": "#6b8cff",
  "35": "#ff79c6", "36": "#8be9fd", "37": "#f8f8f2", "90": "#7f849c",
}
const TIER_FG: Record<Tier, string> = { green: "#50fa7b", yellow: "#f1fa8c", red: "#ff5555" }
const TIER_EMOJI: Record<Tier, string> = { green: "🟢", yellow: "🟡", red: "🔴" }

type Segment = { text: string; fg?: string }

/** Split one ANSI-coloured line into coloured segments. */
function parseAnsi(line: string): Segment[] {
  const out: Segment[] = []
  let fg: string | undefined
  let last = 0
  const re = /\x1b\[([0-9;]*)m/g
  let m: RegExpExecArray | null
  while ((m = re.exec(line)) !== null) {
    if (m.index > last) out.push({ text: line.slice(last, m.index), fg })
    for (const code of (m[1] || "0").split(";")) {
      if (code === "0" || code === "39") fg = undefined
      else if (ANSI_FG[code]) fg = ANSI_FG[code]
    }
    last = re.lastIndex
  }
  if (last < line.length) out.push({ text: line.slice(last), fg })
  return out.length > 0 ? out : [{ text: " " }]
}

const usd = (n: number) => `$${(n ?? 0).toFixed(2)}`
const tok = (n: number) => (n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `${Math.round(n / 1_000)}k` : `${n ?? 0}`)

export default Plugin.define({
  id: "codotchi.cli",
  setup(context) {
    const [snap, setSnap] = createSignal<Snapshot | undefined>()
    const rpc = context.client.rpc(CODOTCHI_RPC as any) as any
    const location = () => context.location ?? context.data.location.default()

    const refresh = async () => {
      try {
        setSnap((await rpc.snapshot(undefined, { location: location() })) as Snapshot)
      } catch {
        /* server plugin not ready yet; the next update or poll retries */
      }
    }

    const stopUpdated = rpc.events.on("updated", (event: any) => {
      if (event?.data && Array.isArray(event.data.pets)) setSnap(event.data as Snapshot)
      else void refresh()
    })
    const stopAlert = rpc.events.on("alert", (event: any) => {
      const d = event?.data
      if (!d?.message) return
      context.ui.toast.show({ title: d.title ?? "codotchi", message: d.message, variant: d.variant ?? "info", duration: 6000 })
    })
    const stopIdle = context.data.on("session.idle", () => void refresh())
    const poll = setInterval(() => void refresh(), 60_000)
    void refresh()

    const Bubbles = () => (
      <Show when={snap()?.enabled && (snap()?.pets.length ?? 0) > 0}>
        <box flexDirection="column">
          <For each={snap()!.pets}>
            {(pet) => (
              <box flexDirection="column" marginBottom={1}>
                <For each={pet.lines}>
                  {(line) => (
                    <text>
                      <For each={parseAnsi(line)}>{(seg) => <span style={{ fg: seg.fg }}>{seg.text}</span>}</For>
                    </text>
                  )}
                </For>
              </box>
            )}
          </For>
        </box>
      </Show>
    )

    const CostLine = () => (
      <Show when={snap()}>
        {(s) => (
          <text>
            <span style={{ fg: TIER_FG[s().tier] }}>
              {`${TIER_EMOJI[s().tier]} ${usd(s().today.costUSD)} today · ${tok(s().today.tokens)} tok · ${s().today.messages} msg`}
            </span>
            <span style={{ fg: "#7f849c" }}>
              {`  │  ${usd(s().lastHour.costUSD)}/h  │  session ${usd(s().session.costUSD)}  │  warn ${usd(s().thresholds.warn)} · shout ${usd(s().thresholds.shout)}`}
            </span>
          </text>
        )}
      </Show>
    )

    const unSidebar = context.ui.slot({ append: "sidebar.content", render: () => <Bubbles /> })
    const unComposer = context.ui.slot({ append: "session.composer.top", render: () => <CostLine /> })

    return () => {
      unSidebar()
      unComposer()
      stopUpdated()
      stopAlert()
      stopIdle()
      clearInterval(poll)
    }
  },
})
