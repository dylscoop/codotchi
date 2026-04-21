---
description: Interact with your codotchi virtual pet
---
Map the `show` argument to a `gotchi` tool action using the table below, then follow the output rules.

| show | action to call | output rule |
|---|---|---|
| (blank) or `status` | `on` | Show art block from tool output if present, then output only `Hunger: X | Happiness: X | Energy: X | Health: X | Weight: X` — no bar graph, no commentary |
| `show` | `on` | Output the tool result as plain text, exactly as returned — no code fences, no extra commentary |
| `hide` | `off` | Output the tool result as plain text, exactly as returned — no code fences, no extra commentary |
| `help` | (do not call tool) | Output a markdown bullet list of all valid `/codotchi` actions with one-line descriptions |
| anything else | pass through verbatim (forward any `name`/`petType` args) | Output the tool result as plain text, exactly as returned — no code fences, no extra commentary |
