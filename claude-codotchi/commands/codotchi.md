---
description: Interact with your codotchi virtual pet
---
Run the codotchi action specified by $ARGUMENTS and display the result.

Valid actions: `status` `feed` `pat` `sleep` `wake` `clean` `medicine` `on` `off` `rename <name>` `warnthreshold <amount>` `shoutthreshold <amount>` `orangethreshold <amount>` `redthreshold <amount>` `levels` `speechinterval <seconds|off>` `help`

If $ARGUMENTS is blank, run `!node "${CLAUDE_PLUGIN_ROOT}/scripts/action.mjs"` to get the pet's current art and stats, then output the following action list below it:

```
Actions:
- /codotchi status       — Show pet art and full stats
- /codotchi feed         — Give a meal (max 3 per wake cycle)
- /codotchi pat          — Pat the pet for a happiness boost
- /codotchi sleep        — Put the pet to sleep (3× faster energy regen)
- /codotchi wake         — Wake the pet up
- /codotchi clean        — Remove droppings
- /codotchi medicine     — Give medicine (3 doses to cure sickness)
- /codotchi on           — Enable ASCII art in the statusline
- /codotchi off          — Show plain text stats in the statusline
- /codotchi rename <name> — Rename your pet
- /codotchi levels               — Show current 🟢/🟠/🔴 usage thresholds
- /codotchi orangethreshold <n>  — Set 🟠 orange threshold in USD (default: $30)
- /codotchi redthreshold <n>     — Set 🔴 red threshold in USD (default: $50)
- /codotchi speechinterval <s>   — Pet speaks every <s> seconds during coding (or "off")
- /codotchi warnthreshold <n>    — Alias for orangethreshold
- /codotchi shoutthreshold <n>   — Alias for redthreshold
- /codotchi help         — Show this action list
```

If $ARGUMENTS is `status`, run `!node "${CLAUDE_PLUGIN_ROOT}/scripts/action.mjs" status` and show the output only (no action list).

If $ARGUMENTS is `help`, output only the action list above — do NOT run the script.

Otherwise, run:
```
!node "${CLAUDE_PLUGIN_ROOT}/scripts/action.mjs" $ARGUMENTS
```

Output the result as plain text exactly as returned — no code fences, no extra commentary.
