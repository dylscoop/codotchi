# Changelog

## [2.32.1] - 2026-10-26

### Changed

- **Fetch and Tug-of-War play out on the pet's stage** with your actual dog:
  - **Fetch**: throw the ball Left or Right and it flies off that side of the stage. The dog picks a side and runs off after it. Right side, and it trots back with the ball; wrong side, and it comes back empty-handed. One throw decides the game, and the dog trots instead of dashing.
  - **Tug-of-War**: the dog holds a rope that runs to your side of the stage. Each round it either pulls or rests. **Hold** when it pulls and **Pull** when it rests to drag it towards you. The game is scored for the dog: when it wins, your pet gets the winner's happiness.

- The dog's gift on the floor is now a tennis ball instead of a gift box.

## [2.32.0] - 2026-10-26

### Added

- **Dog actions** - every dog now has its own games and habits:
  - **Fetch** replaces Coin Flip: throw the ball Short or Long and guess which bush the dog is waiting behind. Three throws, win with two catches. On a miss it runs over and fetches the ball anyway.
  - **Tug-of-War** replaces Left / Right: Pull when it eases off, ease off when it pulls. Three rounds, win two. Higher or Lower stays the same.
  - Snacks are biscuit bones and meals are a meaty bone.
  - The dog's gift is a ball: "brought you a ball and wants to play fetch! 🎾". Accepting it (Praise) starts a game of Fetch.
  - New pat bubbles ("*tail wags intensify*", "Much code. Very wow.", "Who's a good boy?") and a "*sad whimper*… fine." when a call goes unanswered.
  - A happy dog wags its tail, and an energetic one sometimes chases it.
  - The 5-minute break is a bone chew instead of a nap: the dog stays awake gnawing a big bone that gets smaller as the break runs down. Same timer and rules as the nap.

## [2.30.1] - 2026-10-21

### Changed

- **Lighter on your laptop** - the pet animation now runs at 30 fps (60 fps for a few seconds whenever you interact or the pet reacts) and stops completely while the Codotchi panel is hidden, on the menu screens or after the pet dies. Previously it redrew at your screen's refresh rate all the time.
- **OpenCode** - idle windows write the companion pet's save file every 30 s instead of every 3 s, and only refresh the sidebar when something on it changes.

## [2.30.0] — 2026-10-15

### Added

- **Boss Battle mini-game (dev-mode preview)** - a new choice under Play, shown only with developer mode and the new **Dev Mode Boss Battle** setting on (**Dev Mode Boss Battle Always** makes it playable without an unlocked boss, for testing). Bosses are earned by levelling: one appears when your pet reaches level 3 (Syntax Wraith), 5 (NullPointer Demon), 10 (StackOverflow Behemoth) and every 5 levels after that. The button only shows while a boss is waiting; a loss keeps the boss for a retry. Pets already past level 3 start with one boss.
- **Outguess the boss** - each round you and the boss secretly pick Attack, Guard or Patch, then both are revealed: Attack beats Patch, Patch beats Guard, Guard beats Attack. Each boss has its own habits (and new ones when enraged), shown only through its last 5 stances, and it punishes spamming one stance. Win streaks power up, Patches tire, and overtime from round 12 makes every fight end. Your pet's level and care (health, energy, discipline, happiness) shape the numbers.
- A Boss Battle win gives 40 XP (capped at 40 an hour and 80 a day), counts as a mini-game win and unlocks the **Champion** achievement, which is no longer *Coming soon*.

## [2.29.0] — 2026-10-14

### Added

- **Levels are in beta and off by default** - turn them on with `codotchi.enableLevels` (PyCharm: Settings → Tools → Codotchi; OpenCode / Claude Code: `"levelsEnabled": true` in `codotchi-config.json`; Claude Desktop: `CODOTCHI_LEVELS=true`). Progress is tracked while they're off.
- **XP, levels and achievements** - coding, committing, answering your pet's calls and winning mini-games earn XP. Care buttons only earn XP when they answer a call. You have a **trainer level** that you keep when a pet dies, and each pet has its own **pet level**. Both show under the pet with an XP bar. Code activity, commits, calls and mini-game wins are capped per hour and per day, so XP can't be farmed.
- **Achievement paths** - click the level line to see achievements split into 🧑‍💻 Coder and 🐾 Keeper tabs (trainer-level milestones in both), each with a progress bar and a "How:" hint. Detective, First Blood, Exterminator and Champion are shown as *Coming soon*. Caretaker is now **On Call** (answer 100 calls).
- **Daily challenges** - three a day per pet (one Coder, one Keeper, one wildcard), reset at local midnight. 25 XP each plus 25 for all three. Finishing all three on consecutive weekdays builds a 🔥 streak; weekends don't break it, and it's lost when the pet dies.
- Unlocks, level-ups and finished challenges get a notification, a speech bubble and (for level-ups) a little hop.

### Fixed

- **OpenCode spend was under-reported for GitHub Copilot Claude models** - OpenCode prices Copilot cache writes at $0, so a heavy day could show ~$34 instead of ~$80. The OpenCode plugin now works out each reply's cost from its tokens at [GitHub's published Copilot rates](https://docs.github.com/en/copilot/reference/copilot-billing/models-and-pricing). Rates can be overridden with `"pricing"` in `codotchi-config.json`.

## [2.28.0] — 2026-10-13

- Removed the sponsor section from the extension page.

## [2.27.4] — 2026-10-09

### Fixed

- **Break reminder** — the 30-minute timer no longer restarts when you go idle or ignore the reminder. It only restarts once you actually take the break (praise the call). An ignored reminder comes back every few minutes.

## [2.27.3] — 2026-10-07

### Fixed

- **Leaderboard death time** — a pet's death time is now saved when it dies. Reopening the IDE no longer re-submits a dead pet with a later death time, which made it look like it had lived for weeks.

## [2.27.2] — 2026-10-07

### Changed

- **Tim and Stu** — toasts, gift messages, the info line under the pet and the status bar tooltip now call them Timagotchi and Stugotchi.

### Fixed

- **Push live progress** — pets hatched before 2.27 can push live progress and go on the leaderboard again. When a pet can't (dev mode, an edited save), the button now says why instead of doing nothing.
- **Notifications** — a pet's call (a craving, a pat, a poop) no longer pops up two or three times when you toggle or push live progress.

## [2.27.1] — 2026-10-07

### Changed

- **Tim and Stu** — Tim now asks to go for a run instead of a pat, and actually jogs a lap of the stage. Stu asks to collect stickers and opens a sticker binder or a fresh pack. When they crave a snack they say what they want: a tea for Tim, a pint or some salmon for Stu. Stu also plays a round of Blackjack instead of Coin Flip.
- **Break reminder** — the reminder now just says it's time for a break.

### Fixed

- **Tim and Stu off-centre** — both were drawn left of centre and jumped sideways every time they turned around.
- **Stu's snacks** — with three snacks already on the floor, a fourth was silently lost instead of being thrown away with a message in the log.

## [2.27.0] — 2026-10-07

### Changed

- **Fair leaderboard** — only scores sent by the Codotchi plugin are accepted now; hand-written GitHub issues are turned away. A pet that ever ran in dev mode, or whose save file was edited outside Codotchi, can't be submitted or pushed live, even after dev mode is turned off. The sidebar greys out the buttons and says why. Pets hatched before this version can't be submitted either, but your next one can. Older scores stay on the board marked *legacy*.

## [2.26.3] — 2026-10-05

### Fixed

- **Leaderboard rank** — the Claude Code status line, PyCharm and OpenCode now show the same rank and pet count as the leaderboard page. They were counting live pets that hadn't pushed for up to 30 days (the page hides them after 48 hours), guessing how much older those pets had grown, and sometimes counting your own pet twice. VS Code already matched the page; it now also recognises your own pet when another IDE pushed it.

## [2.26.2] — 2026-10-05

### Fixed

- **Status bar ⚠** — the warning now clears when you answer the call. In AI mode, two open windows (for example VS Code and VSCodium) each kept their own copy of the pet, and the copy that hadn't been answered came back. Now only one window keeps the pet going and the others follow it. Whichever window you use takes over.

## [2.26.1] — 2026-10-02

### Fixed

- **Sunrise** — the scenic sunrise now lasts the whole dawn stage: the sky turns orange by 7:30, stays that way until 9:00, then turns golden and finishes at 10:00, just like the legacy background.

## [2.26.0] — 2026-10-02

### Changed

- **Sickness** — a sick pet won't eat, snack or play: Feed, Snack and Play are greyed out until it's cured, and the Medicine button counts the doses left.
- **Break naps** — the nap now lasts 5 minutes and can't be cut short; the Sleep button shows the minutes left. Energy recharges during the nap while every other stat stays frozen, and your pet keeps aging.

### Added

- **Status bar ⚠** — a ⚠ appears next to your pet in the status bar while it has an attention call, and the tooltip says what it wants. `codotchi.statusBarEnabled` hides the status bar item.

## [2.25.5] — 2026-10-02

### Changed

- **Sunrise** — mornings now start with a warm sunrise that mirrors the sunset, and the scenic sky follows the same times of day as the legacy background: dawn 7–10, morning 10–13, afternoon 13–16, sunset 16–19, dusk 19–22 and night from 22. The sun rises at 7 and sets at 7 pm.
- **Snacks and poos** — bigger and outlined, so they stand out on every background.
- **Autumn** — a single pumpkin, off to the side, so the middle of the stage stays clear.

## [2.25.4] — 2026-10-01

### Changed

- **Break naps** — when you praise your pet to answer a break reminder, it naps for 3 minutes. During the nap its stats are frozen (no hunger, happiness or energy changes) but it keeps aging, and it wakes up on its own when the time is up. Waking it yourself ends the nap early.
- **Meals** — a meal now fills 15 hunger instead of 20.
- **Legacy background** — `codotchi.backgroundStyle`: set it to Legacy to bring back the original look from before 2.25 (a flat time-of-day tint, a ground strip and a few seasonal props). Scenic stays the default, and both follow your Background season choice.
- **Settings** — the main settings are now under **Codotchi › General**, and the developer-mode settings are in their own **Codotchi › Developer** group instead of the main list.
- **Preview screenshot** — the README and marketplace listing now show a cat Codotchi in the winter scene.

## [2.25.1] — 2026-10-01

### Added

- **Seasonal scenes** — the background is redrawn as pixel art with trees and props for each season: blossom trees, tulips and daisies in spring; leafy trees, sunflowers, a picnic blanket and a beach ball in summer; orange and half-bare trees, falling leaves, pumpkins and toadstools in autumn; and a snowman, a snowy pine with fairy lights and icicles in winter.
- **Weather and visitors** — now and then a spring shower passes (followed by a rainbow), snow falls in winter, and birds, butterflies, bees or fireflies drift by.
- **Background opacity** — `codotchi.backgroundOpacity`: Subtle, Medium (default, lightly softened) or Vivid, so your pet stands out against the scene. Vivid is full strength.
- **Background animations** — `codotchi.backgroundAnimations`: turn off the moving clouds, lights, weather and critters for a still scene (reduced motion does this too).
- **Background preview (developer mode)** — the Sprite Preview panel can show any season at any hour and canvas size.

### Changed

- **Brighter mornings** — mornings are a soft pastel sky instead of a dusky blue, and the sky now blends smoothly through the day, with a gentle gradient so your pet stays easy to see. From 4 pm the sky warms into golden hour and sunset. The sun climbs and sets in an arc, and stars twinkle at night.

## [2.24.3] — 2026-10-01

### Fixed

- **Patting hand** — the hand that pats your pet is half the size, so it no longer towers over small pets.
- **Room above the head** — every pet now has a little space between its head and the sleep / sick indicator and speech bubble above it.
- **AI usage device** — the phone, tablet or laptop sits a little further from your pet so it no longer overlaps it.

### Changed

- **Meals** — your pet takes twice as long to eat a meal, staying at its bowl for a second bite.
- **Fewer attention calls** — the random calls (cleaning, misbehaviour, gifts, play, pats and cravings) come about half as often at every Attention Call Rate setting. Calls for real needs like hunger or sickness are unchanged.

## [2.24.2] — 2026-10-01

### Added

- **Break reminders** — after 30 minutes of coding, your pet reminds you to take a break. Praise it to answer: it's happier for it and naps while you rest. Skipping it does no harm, and stepping away from the IDE counts as a break.

### Fixed

- **Classic pet** — now centred where it stands, with no empty space above it. It walks right up to both walls, and its speech bubble, z's and hearts sit right above its head.
- **Speech bubble** — while your pet sleeps or is being patted, the bubble sits above the floating z's and hearts so you can see both.

## [2.24.1] — 2026-10-01

### Changed

- **Lighter download** — the pet art is stored more compactly, so the extension is smaller and the roo is quicker to draw. The roo is drawn from a smaller grid, so its outline may look very slightly different.
- **New sprite pipeline (for contributors)** — sprites are now built from images in `sprites/<species>/` with one command (`node scripts/import_sprites_bulk.js`), which opens the door to the remaining zodiac animals and new species.

## [2.24.0] — 2026-10-01

### Added

- **Pat animations** — patting your pet now shows a hand patting its head and floating hearts, and every pet reacts its own way: the dog wags and hops, the cat arches and purrs, the sheep puffs up its fleece, the snake coils and sways, the kangaroos hop, the dragon loops with puffs of smoke, Tim and Stu lean in and blush, and the classic pet squishes.
- **AI usage on a device** — when you ask for Today's Token Cost, your pet pulls out a phone, tablet or laptop (depending on the pet) with a little live chart. It fades away together with the speech bubble.

### Changed

- **Play menu** — the "Play or Pat" heading at the top of the menu is gone.

## [2.23.0] — 2026-10-01

### Added

- **Desktop alerts** — when hunger, happiness or energy hits 0, or health drops below 25, you get a desktop notification, even with the IDE minimised. It repeats every 15 minutes while the stat stays low. Turn it off with `codotchi.osNotifications`.

### Changed

- **Tidier settings** — settings are grouped: general options first, then AI mode, display (stage height, token cost sources, background, font size), idle timers and the leaderboard. Developer-mode settings moved to their own **Developer** section.

### Fixed

- **Sleeping pet** — the blanket and pillow that showed as a blue and a white box are gone; a sleeping pet just dozes.
- **Eating** — your pet now stops to eat its meal, so the bowl stays put instead of sliding along with it. Snacks no longer show a plate.
- **PyCharm desktop alerts** — now show as a real Windows / macOS / Linux notification, not only inside the IDE. The notification button now reads "Open Codotchi".

## [2.22.2] — 2026-10-01

### Changed

- **Pixel-art mini-games** — Left / Right now has wooden doors that swing open to show your pet, Higher or Lower shows its number on a scoreboard card, and Coin Flip tosses a spinning coin. Everything matches the pet's pixel style.

### Fixed

- **Snack messages** — "You satisfied … craving" and the pet's thank-you bubble now appear once the pet has eaten the snack, not when you drop it.
- **Left / Right doors** — the door outlines and the face behind the door now show in the right colours.
- **Stepping away** — a pet that is starving, miserable or exhausted now holds steady while you're away, instead of sliding further and losing health the moment you come back.

## [2.22.1] — 2026-10-01

### Added

- **Moods you can see** — a happy pet sparkles and bounces, a sad pet droops and sheds a tear, a sleeping pet tucks in under a blanket with drifting z's, and an eating pet chomps from a bowl (or a snack plate) with crumbs flying. The pet artwork itself is unchanged.

### Changed

- **Stage heights** — the stage height options are now Compact 150 px, Normal 180 px (the default), Tall 210 px and Extra tall 240 px. Your chosen option keeps its name.

## [2.22.0] — 2026-09-30

### Added

- **Hatching egg** — as it gets close to hatching, the egg rocks harder, cracks, and then bursts open to reveal your baby pet.
- **Farewell animation** — when a pet dies it floats gently upwards under a halo before the game-over screen appears.
- **Claude Code status line** — when your pet needs something (food, medicine, a pat, a game…), the Claude Code status line now shows it with a ⚠ and the command that answers it.

## [2.21.3] — 2026-09-30

### Fixed

- **No more invisible pets** — a pet whose creature has no artwork yet (rat, ox, tiger, rabbit, horse, monkey, rooster, pig) is now drawn as the classic Codotchi instead of nothing. New pets no longer hatch as rooster or tiger in Claude Code, OpenCode or Claude Desktop.
- **Medicine description** — the help text now says three doses cure sickness and that medicine doesn't restore health.
- **Claude Code / OpenCode sheep** — sheep pets get their own face and emoji; kangaroo, Roo, Tim and Stu get one too.

### Changed

- **Smaller download** — archived sprite files are no longer packaged into the extension.

## [2.21.2] — 2026-09-30

### Added

- **Stage height setting** — choose Compact, Normal, Tall or Extra tall for the pet stage (`codotchi.stageHeight`). PyCharm's pixel box is now the same dropdown.
- **Whim speech** — when you answer a play, pat or craving call, your pet thanks you with one of several new lines (in the IDEs, OpenCode and Claude Code).

### Fixed

- **Settings descriptions** — the idle threshold now states the right idle decay rate, and the pet size options no longer list outdated pixel grids.

## [2.21.1] — 2026-09-30

### Changed

- **More time to answer calls** — the Needy, Standard and Chilled response windows are now 4, 10 and 20 minutes (were 2, 5 and 10).
- **Fewer random calls** — every call rate setting now spawns random calls about 1.5× less often. Medium and Slow are still 1.5× and 2× slower than Fast.

## [2.21.0] — 2026-09-30

### Fixed

- **"Threw the snack away" with several windows open** — when more than one IDE window was open, the other windows said your pet threw the snack away after it ate it. They now stay quiet.
- **Attention call expiry now matches the setting** — Needy, Standard and Chilled calls now last 2, 5 and 10 minutes as labelled. Before, they expired in half that time.
- **Time away no longer builds up calls** — time spent away doesn't make calls more likely when you come back, and misbehaviour and gift calls no longer appear while you're away.

## [2.20.18] — 2026-09-29

### Added

- **Little whims** — every now and then your pet just wants to play a game, get a pat, or have a meal or a snack, even when it isn't hungry or sad. Answer in time and it's happy; ignore it and its health suffers. The Attention Call Rate and Expiry settings apply to these too.
- Terminal plugins: `/codotchi play` and `/codotchi snack` (Claude Code, OpenCode), and play / snack tools in Claude Desktop.

### Fixed

- **Same call rate in VS Code and PyCharm** — after a call, the pet now waits 5 minutes of active time before repeating it in both IDEs. Previously VS Code repeated calls about twice as often, and time spent away counted towards the wait.
- **Answered call after a mini-game** — finishing a mini-game to answer a call now shows the "answered" message, which was previously lost.

## [2.20.17] — 2026-09-28

### Changed

- **Safe while you're away** — your pet no longer loses health while you're idle or away from the IDE, and a senior pet can't die of old age while you're gone. It still gets hungry and bored (slowly), so there's something to do when you're back.
- **More forgiving mess** — your pet tolerates more droppings before getting sick, and only gets sick if they're left for a while, so cleaning up in time prevents it. Ignoring a "clean up" call counts as a care mistake rather than always making the pet sick.

## [2.20.16] — 2026-09-25

### Fixed

- **Pet stuck walking right** — narrowing the sidebar while a snack was on the floor could leave the snack out of reach, so the pet pushed against the right wall forever. Snacks now stay inside the visible area.

## [2.20.15] — 2026-09-25

### Fixed

- **GitHub leaderboard sign-in re-prompts when it expires** — if GitHub rejects your saved sign-in, codotchi asks VS Code for a fresh one (Submit / Delete / Sign in) instead of failing with `GitHub API error: 401`. Background live pushes show a one-off **Sign in** notification, and the sidebar shows **Sign in to GitHub again**. Sign-in errors are now shown with a **Retry** button instead of being swallowed.
- **Copilot quota** — the Today’s Token Cost bubble now says when the Copilot GitHub sign-in has expired.

## [2.21.0] — 2026-08-10

### Added

- **Leaderboard pet-name confirmation** — clicking "Submit to Leaderboard" now prompts you to type your pet's name before submitting, preventing automated or accidental submissions.
- **Stage-first leaderboard ranking** — the public leaderboard and in-sidebar rank now sort by stage (senior → egg) first, then by ageDays within each stage.

### Changed

- **Live ages shown as-submitted** — live leaderboard entries now display the age at the time of the last push from the IDE, with no extrapolation based on elapsed time.

### Security

- **Stage-age consistency validation** — the server now rejects submissions where the reported stage and ageDays are physically inconsistent (e.g. `stage: "egg"` with `ageDays: 500`).
- **Timestamp sanity checks** — `spawnedAt` and `diedAt` in the future or older than 3 years are rejected.

## [2.20.5] — 2026-08-06

### Fixed

- **Live leaderboard upsert** — live score pushes now use a stable per-IDE-installation ID (`vscode.env.machineId` / `PermanentInstallationID`) instead of `spawnedAt`, so repeat pushes correctly replace the previous entry rather than accumulating duplicates.
- **PyCharm death submission** — leaderboard submissions from PyCharm now POST directly to the GitHub API from the IDE; the browser URL (which users could edit before submitting) is no longer used.
- **Live entry cleanup** — when a user submits their death score or requests a deletion, their live entry in `live.json` is now automatically removed by the GitHub Actions workflow.

## [2.20.4] — 2026-08-05

### Added

- **Leaderboard sign-in button** — a "Sign in to GitHub" button and signed-in status label now appear in the sidebar when your pet is alive, making it clear whether you're authenticated for leaderboard pushes.
- **Sign in to GitHub (Leaderboard)** section added to PyCharm Settings > Tools > Codotchi with sign-in and sign-out buttons.

### Fixed

- **Live leaderboard pet uniqueness** — multiple pets from the same GitHub account (VS Code + PyCharm, or two windows) are now tracked as separate entries in `live.json` instead of overwriting each other.
- **Real-time live rank** — live leaderboard rank now extrapolates current age from the last push timestamp, so scores stay accurate between syncs. Push interval also reduced from 60 min to 15 min.

## [2.15.2] — 2026-07-08

### Changed

- Enabled `codotchi.aiMode` by default so AI agent edits (document changes, cursor movement, tab switches) no longer keep the idle timer perpetually reset — pets now decay naturally when you're idle, regardless of agent activity.

## [2.15.1] — 2026-06-26

### Changed

- Reworked the dog sprite with a new beige/tan palette and resized grid to match the cat sprite.
- Scaled down cat and dog renders at medium size (0.85x, was 1.0x).

## [2.15.0] — 2026-06-25

### Removed

- Trimmed the pet rotation to cat, dog, snake, sheep, classic, kangaroo, and dragon (removed rooster and tiger).

## [2.14.1] — 2026-06-25

### Changed

- Updated sprite showcase in README to feature dog, dragon, and kangaroo.

## [2.14.0]

### Added

- Dragon sprite added to the pet rotation — a fiery new companion you can hatch.
