package com.codotchi

import com.codotchi.engine.ROTATION_ANIMALS

/**
 * CustomCharacters.kt — registry of hidden/unlockable custom characters.
 *
 * To add a new custom character:
 *   1-3. Add the art: images in sprites/<spriteType>/ (+ sprite.json with the
 *        palette, "upright" if needed), then node scripts/import_sprites_bulk.js
 *        (see developer_notes/SPRITE_IMPORT.md). The webview files are copied
 *        from vscode/media at build time.
 *   4. Add an entry to [CUSTOM_CHARACTERS] below — no other Kotlin changes needed.
 *   5. Add "<spriteType>" to SpriteType union in vscode/src/gameEngine.ts.
 *   6. Add entry to vscode/src/customCharacters.ts and vscode/media/customCharacters.js.
 */

data class CustomCharacterToasts(
    val patted: String,
    val patRefused: String,
)

/** Replacement text for the "wants a pat" attention call (__Name__ = pet name). */
data class CustomCharacterPatCall(
    /** Notification / bubble when the call fires. */
    val call: String,
    /** Log line when the call is answered. */
    val answered: String,
    /** Log line when the call expires. */
    val expired: String,
    /** Status bar wording, phrased to follow "<name> ". */
    val status: String,
)

data class CustomCharacter(
    /** Sprite type key — must match a DEFS key in sprites.js. */
    val spriteType: String,
    /** Exact passcode the user enters in the Character Passcode setting. */
    val passcode: String,
    /** Default name pre-filled on the setup screen. For Tim, also overrides "Codotchi" (case-insensitive). */
    val defaultName: String,
    /** Name shown for the character type in the info line (null = capitalised spriteType). */
    val characterLabel: String? = null,
    /** Label for the Pat button in the minigame overlay. */
    val patLabel: String,
    /** attention_call_gift notification message (null = use default). */
    val giftMessage: String? = null,
    /** Gifts picked at random per gift call, in place of giftMessage (see GiftItem.kt). */
    val gifts: List<CustomCharacterGift> = listOf(),
    /** Toast notification strings for pat-related events. */
    val patToasts: CustomCharacterToasts,
    /** Speech bubbles shown at random after a successful pat. */
    val patBubbles: List<String>,
    /** Replacement text for the pat attention call (null = "wants a pat!"). */
    val patCall: CustomCharacterPatCall? = null,
    /** What a snack craving asks for, e.g. "a tea"; one is picked at random per craving. */
    val snackCravings: List<String> = listOf(),
    /** Maximum meals allowed per wake cycle (null = use global default of 3). */
    val feedMealMaxPerCycle: Int? = null,
    /** Maximum snacks allowed per wake cycle (null = use global default of 3). */
    val feedSnackMaxPerCycle: Int? = null,
    /** Multiplier applied to hunger boost from each meal and snack (null = 1.0). */
    val feedHungerMult: Double? = null,
    /** Consecutive snacks before the pet gets sick (null = global default of 3). */
    val snackSickThreshold: Int? = null,
    /** Weight gained per meal (null = global default of 2). */
    val feedMealWeightGain: Int? = null,
    /** Weight gained per snack consumed (null = global default of 5). */
    val feedSnackWeightGain: Int? = null,
    /** Weight lost per play session (null = global default of 3). */
    val playWeightLoss: Int? = null,
    /** Speech bubble when an attention call expires unanswered (null = none). */
    val ignoredBubble: String? = null,
    /** Replacement text for the 5-minute break nap (null = the normal nap). */
    val breakNap: CustomCharacterBreakNap? = null,
)

/** One gift a gift call can bring (__Name__ = pet name). */
data class CustomCharacterGift(
    /** Notification / log line when the gift call fires. */
    val message: String,
    /** Speech bubble when you praise to accept this gift (null = the usual praise lines). */
    val praiseBubble: String? = null,
)

/** Replacement text for the break nap (__Name__ = pet name). */
data class CustomCharacterBreakNap(
    /** Log line when the break starts. */
    val started: String,
    /** Log line when you try to wake it early. */
    val noWake: String,
    /** Notification / log line when the break ends. */
    val over: String,
    /** Sleep button label while the break runs ("Chewing 3m"). */
    val button: String,
    /** Weight gained when the break starts (the dog's big bone). */
    val weightGain: Int = 0,
    /** Notification / log line when the 30-minute break call fires (null = the default). */
    val call: String? = null,
    /** Speech bubble while away on the break, one at random (webview only; empty = the sleep lines). */
    val bubbles: List<String> = listOf(),
)

val CUSTOM_CHARACTERS: List<CustomCharacter> = listOf(
    CustomCharacter(
        spriteType  = "tim",
        passcode    = "teawtim",
        defaultName  = "Timagotchi",
        characterLabel = "Timagotchi",
        patLabel    = "Go for a Run",
        giftMessage = "Timagotchi wants a tea break!",
        patToasts   = CustomCharacterToasts(
            patted     = "Timagotchi went for a run!",
            patRefused = "Timagotchi doesn't have enough energy for a run!",
        ),
        patBubbles  = listOf(
            "That was a great run!",
            "5K done. Now where's my tea?",
            "Legs are burning but the mind is clear.",
            "That counts as cardio.",
        ),
        patCall     = CustomCharacterPatCall(
            call     = "__Name__ wants to go for a run!",
            answered = "You took __Name__ for a run.",
            expired  = "__Name__ wanted a run and was ignored.",
            status   = "wants to go for a run!",
        ),
        snackCravings = listOf("a tea"),
    ),
    CustomCharacter(
        spriteType  = "kangaroo",
        passcode    = "straya",
        defaultName  = "Skippy",
        patLabel    = "Bounce",
        gifts       = listOf(
            CustomCharacterGift("__Name__ found a beer in its pouch!"),
            CustomCharacterGift("__Name__ brought you some Tim Tams!", praiseBubble = "These are better than Penguins!"),
        ),
        patToasts   = CustomCharacterToasts(
            patted     = "__Name__: Cya later!",
            patRefused = "__Name__: I'm exhausted, mate.",
        ),
        patBubbles  = listOf(
            "Good on ya, mate!",
            "She'll be right.",
            "Fair dinkum, what a bounce!",
        ),
        patCall     = CustomCharacterPatCall(
            call     = "__Name__'s keen as for a bounce!",
            answered = "You took __Name__ for a bounce.",
            expired  = "__Name__ wanted a bounce. Thanks for that, champ.",
            status   = "is keen as for a bounce!",
        ),
        ignoredBubble = "Yeah, nah… fair enough.",
        breakNap    = CustomCharacterBreakNap(
            call    = "__Name__ wants smoko! You've been coding for 30 minutes.",
            started = "__Name__ needs to get a Bunnings snag 🌭",
            noWake  = "Oi! __Name__'s on smoko!",
            over    = "Smoko's over. Back to it, __Name__!",
            button  = "Smoko",
            bubbles = listOf("Gone for smoko 🚬", "Off to Bunnings for a snag 🌭"),
        ),
    ),
    CustomCharacter(
        spriteType  = "dog",
        passcode    = "shiba",
        defaultName  = "Codotchi",
        patLabel    = "Pat",
        giftMessage = "__Name__ brought you a ball and wants to play fetch! 🎾",
        patToasts   = CustomCharacterToasts(
            patted     = "__Name__ enjoyed the attention!",
            patRefused = "__Name__ is too tired for pats!",
        ),
        patBubbles  = listOf(
            "*tail wags intensify*",
            "Much code. Very wow.",
            "Who's a good boy?",
        ),
        ignoredBubble = "*sad whimper*… fine.",
        breakNap    = CustomCharacterBreakNap(
            started = "__Name__ is busy with a big bone 🦴",
            noWake  = "__Name__ won't give up the bone yet!",
            over    = "__Name__ finished the bone. Back to work!",
            button  = "Chewing",
            weightGain = 5,
        ),
    ),
    // ── Add future custom characters here ────────────────────────────────────
    CustomCharacter(
        spriteType   = "cat",
        passcode     = "blackcat",
        defaultName  = "Codotchi",
        patLabel     = "Pat",
        gifts        = listOf(
            CustomCharacterGift("__Name__ left a mouse at your feet. You're welcome.", praiseBubble = "Don't say I never get you anything.", kind = "mouse"),
            CustomCharacterGift("__Name__ caught a mouse for you!",                     praiseBubble = "I am a mighty hunter.",               kind = "mouse"),
            CustomCharacterGift("__Name__ brought you a bird!",                         praiseBubble = "Took me all morning.",                kind = "bird"),
            CustomCharacterGift("__Name__ proudly presents a bird!",                    praiseBubble = "Fresh from the garden.",              kind = "bird"),
        ),
        patToasts    = CustomCharacterToasts(
            patted     = "__Name__ purred!",
            patRefused = "__Name__ is too tired for cuddles!",
        ),
        patBubbles   = listOf(
            "Purrrr.",
            "Don't stop.",
            "I will knock that off the desk.",
            "Fine. You may pet me.",
        ),
        patCall      = CustomCharacterPatCall(
            call     = "__Name__ demands chin scratches.",
            answered = "You gave __Name__ chin scratches.",
            expired  = "__Name__ demanded chin scratches and was ignored.",
            status   = "demands chin scratches.",
        ),
        snackCravings = listOf("some tuna", "a saucer of milk"),
        ignoredBubble = "Hmph. Fine.",
        breakNap     = CustomCharacterBreakNap(
            call    = "__Name__ wants a catnap! You've been coding for 30 minutes.",
            started = "__Name__ curled up in a sunbeam for a catnap ☀️",
            noWake  = "__Name__ is catnapping. Do not disturb.",
            over    = "__Name__ stretched and woke from the catnap. Back to work!",
            button  = "Catnap",
            bubbles = listOf("Zzz… sunbeam…", "Do not disturb."),
        ),
    ),
    CustomCharacter(
        spriteType   = "stu",
        passcode     = "rubylovessalmon",
        defaultName  = "Stugotchi",
        characterLabel = "Stugotchi",
        patLabel     = "Collect Stickers",
        giftMessage  = "Stugotchi wants a pint!",
        patToasts    = CustomCharacterToasts(
            patted     = "Stugotchi collected some stickers!",
            patRefused = "Stugotchi doesn't have enough energy to collect stickers!",
        ),
        patBubbles   = listOf(
            "That's going in the binder.",
            "No, you cannot have that one.",
            "Scotland sticker. Rarest of them all.",
            "Thanks for fuelling the addiction.",
        ),
        patCall      = CustomCharacterPatCall(
            call     = "__Name__ wants to collect stickers!",
            answered = "You helped __Name__ collect stickers.",
            expired  = "__Name__ wanted stickers and was ignored.",
            status   = "wants to collect stickers!",
        ),
        snackCravings = listOf("a pint", "some salmon"),
        feedMealMaxPerCycle  = 10,
        feedSnackMaxPerCycle = 10,
        feedHungerMult       = 0.25,
        snackSickThreshold   = 5,
        feedMealWeightGain   = 1,
        feedSnackWeightGain  = 2,
        playWeightLoss       = 5,
    ),
)

/** Passcodes that randomly select one spriteType from a pool instead of a fixed character. */
val CUSTOM_CHARACTER_POOLS: Map<String, List<String>> = mapOf(
    "dylscoop" to (ROTATION_ANIMALS + listOf("tim", "stu")),
)

/** Look up a custom character by passcode. Returns null if not found. */
fun getCustomCharacterByPasscode(passcode: String): CustomCharacter? {
    val pool = CUSTOM_CHARACTER_POOLS[passcode]
    if (!pool.isNullOrEmpty()) {
        val pick = pool[(Math.random() * pool.size).toInt()]
        // Pool members without a dedicated CUSTOM_CHARACTERS entry (plain rotation
        // animals) still need their spriteType forced — synthesize a vanilla
        // character matching the default fallback text used everywhere else.
        val character = CUSTOM_CHARACTERS.firstOrNull { it.spriteType == pick } ?: CustomCharacter(
            spriteType  = pick,
            passcode    = passcode,
            defaultName = "Codotchi",
            patLabel    = "Pat",
            patToasts   = CustomCharacterToasts(
                patted     = "__Name__ was patted!",
                patRefused = "__Name__ doesn't have enough energy to be patted!",
            ),
            patBubbles  = listOf(),
        )
        // Pool passcodes always use the plain "Codotchi" default name, regardless
        // of the picked character's own defaultName (e.g. Timagotchi, Stugotchi).
        return character.copy(defaultName = "Codotchi")
    }
    return CUSTOM_CHARACTERS.firstOrNull { it.passcode == passcode }
}

/** Look up a custom character by spriteType. Returns null if not found. */
fun getCustomCharacterBySpriteType(spriteType: String): CustomCharacter? =
    CUSTOM_CHARACTERS.firstOrNull { it.spriteType == spriteType }
