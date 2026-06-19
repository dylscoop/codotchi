---
description: Interact with your codotchi virtual pet
---
Run the codotchi action specified by $ARGUMENTS and display the result.

Valid actions: `status` `feed` `pat` `sleep` `wake` `clean` `medicine` `on` `off` `rename <name>` `warnthreshold <amount>` `shoutthreshold <amount>` `help`

If $ARGUMENTS is blank or `status`, show the pet's current art and stats.

If $ARGUMENTS is `help`, output a markdown bullet list of all valid `/codotchi` actions with one-line descriptions — do NOT run the script.

Otherwise, run:
```
!node "${CLAUDE_PLUGIN_ROOT}/scripts/action.mjs" $ARGUMENTS
```

Output the result as plain text exactly as returned — no code fences, no extra commentary.
