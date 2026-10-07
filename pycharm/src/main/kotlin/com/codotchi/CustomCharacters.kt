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
    /** Label for the Pat button in the minigame overlay. */
    val patLabel: String,
    /** attention_call_gift notification message (null = use default). */
    val giftMessage: String? = null,
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
)

val CUSTOM_CHARACTERS: List<CustomCharacter> = listOf(
    CustomCharacter(
        spriteType  = "tim",
        passcode    = "teawtim",
        defaultName  = "Timagotchi",
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
        giftMessage = "Skippy found a souvenir!",
        patToasts   = CustomCharacterToasts(
            patted     = "Skippy had a bounce!",
            patRefused = "Skippy is too tired to bounce!",
        ),
        patBubbles  = listOf(
            "Straight from the pixel bush.",
            "Pouch secured.",
            "Big tail, bigger hops.",
            "That's proper straya.",
        ),
    ),
    CustomCharacter(
        spriteType  = "dog",
        passcode    = "shiba",
        defaultName  = "Codotchi",
        patLabel    = "Pat",
        giftMessage = "__Name__ found a tiny tennis ball!",
        patToasts   = CustomCharacterToasts(
            patted     = "__Name__ enjoyed the attention!",
            patRefused = "__Name__ is too tired for pats!",
        ),
        patBubbles  = listOf(),
    ),
    // ── Add future custom characters here ────────────────────────────────────
    CustomCharacter(
        spriteType   = "cat",
        passcode     = "blackcat",
        defaultName  = "Codotchi",
        patLabel     = "Pat",
        giftMessage  = "__Name__ found a toy mouse!",
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
    ),
    CustomCharacter(
        spriteType   = "roo",
        passcode     = "bounce",
        defaultName  = "Roogotchi",
        patLabel     = "Bounce",
        giftMessage  = "Roogotchi found something in its pouch!",
        patToasts    = CustomCharacterToasts(
            patted     = "Roogotchi had a bounce!",
            patRefused = "Roogotchi is too tired to bounce!",
        ),
        patBubbles   = listOf(
            "Imported straight from a JPEG.",
            "Pouch secured.",
            "550 pixels tall and ready to hop.",
            "Not bad for a photo.",
        ),
    ),
    CustomCharacter(
        spriteType   = "stu",
        passcode     = "rubylovessalmon",
        defaultName  = "Stugotchi",
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
    "dylscoop" to (ROTATION_ANIMALS + listOf("tim", "stu", "roo")),
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
