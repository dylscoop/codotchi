# /gotchi

Interact with your gotchi virtual pet companion.

## Usage

- `/gotchi` — show status (equivalent to `/gotchi status`)
- `/gotchi feed` — give your pet a meal
- `/gotchi snack` — give your pet a snack
- `/gotchi play` — play with your pet
- `/gotchi pat` — gently pat your pet
- `/gotchi sleep` — put your pet to sleep
- `/gotchi wake` — wake your pet up
- `/gotchi clean` — clean up droppings
- `/gotchi medicine` — give medicine to cure sickness
- `/gotchi new_game name=<name> petType=<type>` — start a fresh pet

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
