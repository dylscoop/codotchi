package com.codotchi.engine

import kotlin.math.floor
import kotlin.math.min
import kotlin.random.Random

// ---------------------------------------------------------------------------
// Items (v2.38.0): a small inventory filled by friends' gifts, minigame wins
// and achievements, used on the pet or given to a visiting friend.
// Mirrors the Items block of packages/core/src/gameEngine.ts.
// ---------------------------------------------------------------------------

/** One kind of item the pet can own. [kind] is "food", "toy" or "decor". */
data class ItemDef(val id: String, val kind: String, val emoji: String, val name: String)

/** Every item there is. Ids are saved, so never rename one. */
val ITEM_CATALOG: List<ItemDef> = listOf(
    ItemDef("apple",   "food",  "🍎", "apple"),
    ItemDef("cookie",  "food",  "🍪", "cookie"),
    ItemDef("cake",    "food",  "🍰", "slice of cake"),
    ItemDef("fish",    "food",  "🐟", "fish"),
    ItemDef("ball",    "toy",   "⚽", "ball"),
    ItemDef("yarn",    "toy",   "🧶", "ball of yarn"),
    ItemDef("kite",    "toy",   "🪁", "kite"),
    ItemDef("teddy",   "toy",   "🧸", "teddy bear"),
    ItemDef("plant",   "decor", "🪴", "potted plant"),
    ItemDef("flower",  "decor", "🌻", "sunflower"),
    ItemDef("lantern", "decor", "🏮", "lantern"),
    ItemDef("star",    "decor", "⭐", "star lamp"),
)

/** Most items the pet can carry; a new one is lost when the bag is full. */
const val MAX_ITEMS: Int = 12
/** Most decorations on the floor at once; placing another replaces the oldest. */
const val MAX_DECOR: Int = 3
/** Hunger from eating a food item. */
const val ITEM_FOOD_HUNGER: Int = 15
/** Happiness from playing with a toy item. */
const val ITEM_TOY_HAPPINESS: Int = 10
/** Happiness from placing a decoration. */
const val ITEM_DECOR_HAPPINESS: Int = 5
/** Friendship from giving the visiting friend an item, by kind. */
val FRIENDSHIP_PER_GIFT_KIND: Map<String, Int> = mapOf("food" to 12, "toy" to FRIENDSHIP_PER_GIVEN_GIFT, "decor" to 20)
/** Every this-many minigame wins finds an item. */
const val MINIGAME_WINS_PER_ITEM: Int = 4

/** The item with this id, or null. */
fun itemById(id: String): ItemDef? = ITEM_CATALOG.firstOrNull { it.id == id }

/** A random item id. */
fun randomItemId(rand: () -> Double = { Random.nextDouble() }): String =
    ITEM_CATALOG[min(ITEM_CATALOG.size - 1, floor(rand() * ITEM_CATALOG.size).toInt())].id

/** [items] with [id] added, unless the bag is full. */
internal fun withItem(items: List<String>, id: String): List<String> =
    if (items.size < MAX_ITEMS) items + id else items

/** [items] with one [id] taken out. */
internal fun withoutItem(items: List<String>, id: String): List<String> {
    val i = items.indexOf(id)
    return if (i < 0) items else items.take(i) + items.drop(i + 1)
}

/** The item a minigame win finds, when [wins] is a multiple of MINIGAME_WINS_PER_ITEM; null otherwise. */
internal fun minigameItemFor(wins: Int): String? =
    if (wins == 0 || wins % MINIGAME_WINS_PER_ITEM != 0) null
    else ITEM_CATALOG[(wins / MINIGAME_WINS_PER_ITEM - 1) % ITEM_CATALOG.size].id

/** The item an achievement finds: the same one every time for that achievement. */
internal fun achievementItemFor(achievementIndex: Int): String = ITEM_CATALOG[achievementIndex % ITEM_CATALOG.size].id
