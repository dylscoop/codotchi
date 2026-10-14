---
description: Interact with your codotchi virtual pet
---
Map the `show` argument to a `codotchi` tool action using the table below, then follow the output rules.

| show | action to call | output rule |
|---|---|---|
| (blank) or `status` | `status` | Show art block from tool output if present, then output only `Hunger: X | Happiness: X | Energy: X | Health: X | Weight: X` — no bar graph, no commentary |
| `show` | `on` | Output the tool result as plain text, exactly as returned — no code fences, no extra commentary. If the result is "ASCII art is already enabled." do not add anything else. |
| `hide` | `off` | Output the tool result as plain text, exactly as returned — no code fences, no extra commentary |
| `warnthreshold <amount>` | `warnthreshold` with value=amount | Output the tool result as plain text, exactly as returned |
| `shoutthreshold <amount>` | `shoutthreshold` with value=amount | Output the tool result as plain text, exactly as returned |
| `help` | (do not call tool) | Output a markdown bullet list of all valid `/codotchi` actions with one-line descriptions. Say that `feed`, `snack`, `play`, `pat`, `sleep`/`wake`, `clean`, `medicine`, `rename` and `new_game` act on the OpenCode pet only and have no effect on VS Code or PyCharm pets. Include: `warnthreshold <amount>` — set the daily USD cost at which the pet speaks in a warning tone (default 30 USD); `shoutthreshold <amount>` — set the daily USD cost at which the pet shouts in ALL CAPS (default 50 USD) |
| anything else | pass through verbatim (forward any `name`/`petType` args) | Output the tool result as plain text, exactly as returned — no code fences, no extra commentary |
