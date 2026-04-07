# /codotchi

Interact with your codotchi virtual pet companion.

## Usage

- `/codotchi` — show status (equivalent to `/codotchi status`)
- `/codotchi feed` — give your pet a meal
- `/codotchi pat` — gently pat your pet
- `/codotchi sleep` — put your pet to sleep
- `/codotchi clean` — clean up droppings
- `/codotchi medicine` — give medicine to cure sickness
- `/codotchi on` — enable ASCII art display in the tool details panel
- `/codotchi off` — disable ASCII art (plain text stats only)

## Instructions

When this command is invoked, call the `gotchi` tool with the appropriate
`action` argument based on what the user typed:

- No argument or `status` → `action: "status"`
- `feed`     → `action: "feed"`
- `pat`      → `action: "pat"`
- `sleep`    → `action: "sleep"`
- `clean`    → `action: "clean"`
- `medicine` → `action: "medicine"`
- `on`       → `action: "on"`
- `off`      → `action: "off"`

Return the tool result verbatim — do not add commentary or extra text.
