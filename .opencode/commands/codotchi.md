# /codotchi

Interact with your codotchi virtual pet companion.

## Instructions

When this command is invoked, call the `gotchi` tool with the appropriate
`action` argument based on what the user typed:

- No argument or `status` → call `action: "status"`, then output **only** a
  single stats line extracted from the tool result in this exact format:
  `Hunger: X | Happiness: X | Energy: X | Health: X | Weight: X`
  where X is the numeric value. Include the ASCII art block (the sprite +
  speech bubble) if it is present in the tool output, but strip the bar graph
  section entirely. Do not add commentary.
- `feed`     → `action: "feed"`
- `pat`      → `action: "pat"`
- `sleep`    → `action: "sleep"`
- `clean`    → `action: "clean"`
- `medicine` → `action: "medicine"`
- `on`       → `action: "on"`
- `off`      → `action: "off"`
- `new_game` → `action: "new_game"` (pass along any `name` and `petType` args)
- `help`     → do NOT call the gotchi tool; instead output exactly this:

**Usage:**
- `/codotchi` — show status
- `/codotchi feed` — give your pet a meal
- `/codotchi pat` — gently pat your pet
- `/codotchi sleep` — put your pet to sleep
- `/codotchi clean` — clean up droppings
- `/codotchi medicine` — give medicine to cure sickness
- `/codotchi on` — enable ASCII art display
- `/codotchi off` — disable ASCII art (plain text stats only)
- `/codotchi new_game` — start a new pet (optional `name=<name> petType=<type>`)
- `/codotchi help` — show this help message

For all actions except `status` and `help`, return the tool result verbatim —
do not add commentary or extra text.
