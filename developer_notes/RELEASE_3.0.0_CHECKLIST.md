# 3.0.0 release checklist

Everything here must be done before the official **3.0.0** release.
Tick items off as they land.

## READMEs (`vscode/README.md`, `pycharm/README.md`, mirror into `pycharm/src/main/resources/META-INF/plugin.xml`; check root `README.md` too)

- [ ] **Quick-start guide at the top**: install, open the pet panel, hatch, care. Around 5 lines.
- [ ] **Shorten the READMEs a lot**: one line per feature in the Features list, and trim the Actions, Mini-games and Today's Token Cost prose.
- [ ] **Remove Boss Battle** (still a dev-mode preview, not ready): the Play row in the Actions table and the Boss Battle row in the Mini-games table.
- [ ] **Deathless mode section**: a short section of its own. Cover: no death from neglect (health stays at 1 or above), it still gets sick and can die of old age, it's kept off the leaderboard and high score, and you can switch the current pet over from the menu.

## Images and media

- [ ] **Update the header sprites** (`dog_adult_1x.png`, `dragon_adult_1x.png`, `kangaroo_adult_1x.png` at repo root). The dog art changed in v2.37.0.
- [ ] **Update the Preview image** (`Cat_example.png`). *Waiting on a screenshot from the user.*
- [ ] **Demo videos, 10–15 s each**: *user to screen-record*. Suggested clips: hatching, feeding / answering a whim, Today's Token Cost bubble, seasons, Deathless / Afterlife. Embed them in the READMEs as GIF or MP4 once recorded.
