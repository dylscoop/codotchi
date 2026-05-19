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
    /** Name auto-assigned on hatch, overriding the user's chosen name. */
    val forcedName: String,
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
)

val CUSTOM_CHARACTERS: List<CustomCharacter> = listOf(
    CustomCharacter(
        spriteType  = "tim",
        passcode    = "teawtim",
        forcedName  = "Timagotchi",
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
    // ── Add future custom characters here ────────────────────────────────────
)

/** Look up a custom character by passcode. Returns null if not found. */
fun getCustomCharacterByPasscode(passcode: String): CustomCharacter? =
    CUSTOM_CHARACTERS.firstOrNull { it.passcode == passcode }

/** Look up a custom character by spriteType. Returns null if not found. */
fun getCustomCharacterBySpriteType(spriteType: String): CustomCharacter? =
    CUSTOM_CHARACTERS.firstOrNull { it.spriteType == spriteType }
