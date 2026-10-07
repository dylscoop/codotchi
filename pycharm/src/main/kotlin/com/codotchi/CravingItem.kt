package com.codotchi

import com.codotchi.engine.PetState

/**
 * CravingItem.kt — which item a custom character's snack craving asks for.
 * Mirrors vscode/src/cravingItem.ts.
 *
 * Characters with `snackCravings` (Tim: a tea; Stu: a pint or some salmon) name
 * a specific snack instead of "a snack". The pick is random per craving and
 * memoised here, so the notification, the status bar and the webview (which
 * spawns the matching floor item) all name the same thing. A restart mid-craving re-rolls.
 */

private var currentCravingItem: String? = null

/** The craved item for the active snack craving, or null when there is none. */
@Synchronized
fun cravingItemFor(state: PetState, rand: () -> Double = Math::random): String? {
    val items = getCustomCharacterBySpriteType(state.spriteType)?.snackCravings.orEmpty()
    if (state.activeAttentionCall != "craving" || state.cravingFood != "snack" || items.isEmpty()) {
        currentCravingItem = null
        return null
    }
    val current = currentCravingItem
    if (current != null && current in items) return current
    return items[(rand() * items.size).toInt().coerceIn(0, items.size - 1)].also { currentCravingItem = it }
}
