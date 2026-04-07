---
description: Interact with your codotchi virtual pet
---
Call the `gotchi` tool with `action: "$ARGUMENTS"` (use `status` if blank). Valid actions: `status`, `feed`, `pat`, `sleep`, `clean`, `medicine`, `on`, `off`, `new_game` (forward any `name`/`petType` args). Return tool output verbatim.
If `$ARGUMENTS` is `help`: do not call the tool — output a markdown bullet list of all valid `/codotchi` actions with one-line descriptions.
If `$ARGUMENTS` is `status` (or blank): show the art block from tool output if present, then output only `Hunger: X | Happiness: X | Energy: X | Health: X | Weight: X` — no bar graph, no commentary.
