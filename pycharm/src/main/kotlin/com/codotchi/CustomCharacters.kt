package com.codotchi

/**
 * CustomCharacters.kt — registry of hidden/unlockable custom characters.
 *
 * To add a new custom character:
 *   1. Add DEFS["<spriteType>"] to sprites.js (and vscode mirror).
 *   2. Add palette entry to spriteConstants.js (and vscode mirror).
 *   3. Add "<spriteType>" to UPRIGHT_TYPES in spriteConstants.js if upright grid.
 *   4. Add an entry to [CUSTOM_CHARACTERS] below — no other Kotlin changes needed.
 *   5. Add "<spriteType>" to SpriteType union in vscode/src/gameEngine.ts.
 *   6. Add entry to vscode/src/customCharacters.ts and vscode/media/customCharacters.js.
 */

data class CustomCharacterToasts(
    val patted: String,
    val patRefused: String,
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
    /** Minigame overlay title — replaces the default "Play or Pat". */
    val mgTitle: String,
    /** attention_call_gift notification message (null = use default). */
    val giftMessage: String? = null,
    /** Toast notification strings for pat-related events. */
    val patToasts: CustomCharacterToasts,
    /** Speech bubbles shown at random after a successful pat. */
    val patBubbles: List<String>,
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
        mgTitle     = "Play or Go for a Run",
        giftMessage = "Tim wants a tea break!",
        patToasts   = CustomCharacterToasts(
            patted     = "Tim went for a run!",
            patRefused = "Tim doesn't have enough energy for a run!",
        ),
        patBubbles  = listOf(
            "That was a great run!",
            "5K done. Now where's my tea?",
            "Legs are burning but the mind is clear.",
            "That counts as cardio.",
        ),
    ),
    CustomCharacter(
        spriteType  = "kangaroo",
        passcode    = "straya",
        defaultName  = "Kangagotchi",
        patLabel    = "Bounce",
        mgTitle     = "Play or Bounce",
        giftMessage = "Kangagotchi found a souvenir!",
        patToasts   = CustomCharacterToasts(
            patted     = "Kangagotchi had a bounce!",
            patRefused = "Kangagotchi is too tired to bounce!",
        ),
        patBubbles  = listOf(
            "Straight from the pixel bush.",
            "Pouch secured.",
            "Big tail, bigger hops.",
            "That's proper straya.",
        ),
    ),
    CustomCharacter(
        spriteType  = "testsprite",
        passcode    = "pixel",
        defaultName  = "Pixel",
        patLabel    = "Pat",
        mgTitle     = "Play or Pat",
        patToasts   = CustomCharacterToasts(
            patted     = "Pixel enjoyed the attention!",
            patRefused = "Pixel is too tired for that right now!",
        ),
        patBubbles  = listOf(
            "...",
            "beep.",
            "I am rendered.",
            "700 columns wide and loving it.",
        ),
    ),
    // ── Add future custom characters here ────────────────────────────────────
    CustomCharacter(
        spriteType   = "stu",
        passcode     = "rubylovessalmon",
        defaultName  = "Stugotchi",
        patLabel     = "Collect Stickers",
        mgTitle      = "Play or Collect Stickers",
        giftMessage  = "Stu wants a pint!",
        patToasts    = CustomCharacterToasts(
            patted     = "Stu collected some stickers!",
            patRefused = "Stu doesn't have enough energy to collect stickers!",
        ),
        patBubbles   = listOf(
            "That's going in the binder.",
            "No, you cannot have that one.",
            "Scotland sticker. Rarest of them all.",
            "Thanks for fuelling the addiction.",
        ),
        feedMealMaxPerCycle  = 10,
        feedSnackMaxPerCycle = 10,
        feedHungerMult       = 0.25,
        snackSickThreshold   = 5,
        feedMealWeightGain   = 1,
        feedSnackWeightGain  = 2,
        playWeightLoss       = 5,
    ),
)

/** Look up a custom character by passcode. Returns null if not found. */
fun getCustomCharacterByPasscode(passcode: String): CustomCharacter? =
    CUSTOM_CHARACTERS.firstOrNull { it.passcode == passcode }

/** Look up a custom character by spriteType. Returns null if not found. */
fun getCustomCharacterBySpriteType(spriteType: String): CustomCharacter? =
    CUSTOM_CHARACTERS.firstOrNull { it.spriteType == spriteType }
