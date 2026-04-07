# /codotchi

Interact with your codotchi virtual pet companion.

## Usage

- `/codotchi` — show status (equivalent to `/codotchi status`)
- `/codotchi feed` — give your pet a meal
- `/codotchi snack` — give your pet a snack
- `/codotchi play` — play with your pet
- `/codotchi pat` — gently pat your pet
- `/codotchi sleep` — put your pet to sleep
- `/codotchi wake` — wake your pet up
- `/codotchi clean` — clean up droppings
- `/codotchi medicine` — give medicine to cure sickness
- `/codotchi new_game name=<name> petType=<type>` — start a fresh pet

## Instructions

When this command is invoked, call the `gotchi` tool with the appropriate
`action` argument based on what the user typed:

- No argument or `status` → `action: "status"`
- `feed`     → `action: "feed"`
- `snack`    → `action: "snack"`
- `play`     → `action: "play"`
- `pat`      → `action: "pat"`
- `sleep`    → `action: "sleep"`
- `wake`     → `action: "wake"`
- `clean`    → `action: "clean"`
- `medicine` → `action: "medicine"`
- `new_game` → `action: "new_game"`, plus optional `name` and `petType` from user arguments

Return the tool result verbatim — do not add commentary or extra text.
The tool already writes ASCII art to the terminal directly.
