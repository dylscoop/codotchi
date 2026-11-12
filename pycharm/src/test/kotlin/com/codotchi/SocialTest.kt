package com.codotchi

import com.codotchi.engine.*
import com.google.gson.JsonObject
import com.google.gson.JsonParser
import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.Test
import kotlin.math.floor

/**
 * Social features (v2.36.0): CPU friend visits, friendship, gifts, marriage,
 * the heir egg, the matchmaker and the generation counter.
 * Mirrors vscode/tests/unit/social.test.ts. Where the TS tests stub
 * Math.random, these pass a fixed `rand` to tick() / acceptProposal().
 */
class SocialTest {

    private val noCalls = DEFAULT_GAME_CONFIG.copy(attentionCallsEnabled = false, socialEnabled = true)

    private fun makePet(): PetState =
        createPet("Mittens", "codeling", "neon").copy(stage = "adult", dayTimer = 100.5, ageDays = 100)

    private fun friend(friendship: Int, name: String = "Pixel") =
        FriendPet(name = name, spriteType = "dog", petType = "bytebug", friendship = friendship, visits = 3, lastVisitDay = 100.0)

    private fun fixed(value: Double): () -> Double = { value }

    private fun tickWith(s: PetState, value: Double, config: GameConfig = noCalls, isIdle: Boolean = false) =
        tick(s, isIdle, false, config, fixed(value))

    private fun roundTrip(s: PetState): PetState {
        val p = CodotchiPersistence()
        p.savePetState(s)
        return p.loadPetState()!!
    }

    /** Load a hand-edited save through CodotchiPersistence (the seal doesn't cover social fields). */
    private fun loadEdited(s: PetState, edit: (JsonObject) -> Unit): PetState {
        val p = CodotchiPersistence()
        p.savePetState(s)
        val json = JsonParser.parseString(p.petStateJson).asJsonObject
        edit(json)
        p.petStateJson = json.toString()
        return p.loadPetState()!!
    }

    private val socialKeys = listOf(
        "generation", "friend", "visit", "ticksSinceLastVisit", "partner", "heirEgg",
        "seniorSinceDay", "proposal", "proposalCooldownTicks",
    )

    // ── Save format ──────────────────────────────────────────────────────────

    @Test
    fun `loads a schemaVersion 1 save with empty social fields`() {
        val loaded = loadEdited(makePet().copy(generation = 4, friend = friend(10))) { json ->
            socialKeys.forEach { json.remove(it) }
            json.addProperty("schemaVersion", 1)
        }
        assertEquals(SCHEMA_VERSION, loaded.schemaVersion)
        assertEquals(2, SCHEMA_VERSION)
        assertEquals(1, loaded.generation)
        assertNull(loaded.friend)
        assertNull(loaded.visit)
        assertNull(loaded.partner)
        assertNull(loaded.heirEgg)
        assertNull(loaded.seniorSinceDay)
        assertNull(loaded.proposal)
    }

    @Test
    fun `round-trips every social field`() {
        val s = makePet().copy(
            generation = 3,
            friend = friend(42),
            visit = FriendVisit(ticksLeft = 10, played = true, gifted = false),
            ticksSinceLastVisit = 7,
            partner = PetIdentity("Byte", "cat", "pixelpup"),
            heirEgg = HeirEgg("cat", "codeling"),
            seniorSinceDay = 290.25,
            proposal = Proposal("matchmaker", "Waffle", "dragon", "shellscript"),
            proposalCooldownTicks = 12,
        )
        val r = roundTrip(s)
        assertEquals(s.generation, r.generation)
        assertEquals(s.friend, r.friend)
        assertEquals(s.visit, r.visit)
        assertEquals(s.ticksSinceLastVisit, r.ticksSinceLastVisit)
        assertEquals(s.partner, r.partner)
        assertEquals(s.heirEgg, r.heirEgg)
        assertEquals(s.seniorSinceDay, r.seniorSinceDay)
        assertEquals(s.proposal, r.proposal)
        assertEquals(s.proposalCooldownTicks, r.proposalCooldownTicks)
    }

    @Test
    fun `drops malformed social data instead of crashing`() {
        val r = loadEdited(makePet()) { json ->
            json.add("friend", JsonParser.parseString("""{"name":5}"""))
            json.add("visit", JsonParser.parseString("""{"ticksLeft":5}"""))
            json.add("proposal", JsonParser.parseString("""{"from":"stranger","name":"X","spriteType":"cat","petType":"codeling"}"""))
            json.addProperty("generation", -4)
        }
        assertNull(r.friend)
        assertNull(r.visit, "a visit without a friend is dropped")
        assertNull(r.proposal)
        assertEquals(1, r.generation)
    }

    @Test
    fun `migrates goat sprites in social identities to sheep`() {
        val f = socialFromRaw(mapOf(
            "partner" to mapOf("name" to "B", "spriteType" to "goat", "petType" to "codeling"),
            "heirEgg" to mapOf("spriteType" to "goat", "petType" to "codeling"),
        ))
        assertEquals("sheep", f.partner!!.spriteType)
        assertEquals("sheep", f.heirEgg!!.spriteType)
    }

    @Test
    fun `the webview state carries the social fields with serialiseState keys`() {
        val bare = JsonParser.parseString(petStateJson(makePet())).asJsonObject
        for (k in listOf("friend", "visit", "partner", "heirEgg", "seniorSinceDay", "proposal")) {
            assertTrue(bare.has(k) && bare.get(k).isJsonNull, "$k is null")
        }
        assertEquals(1, bare.get("generation").asInt)
        val s = makePet().copy(
            friend = friend(42),
            visit = FriendVisit(10, played = true, gifted = false),
            proposal = Proposal("friend", "Pixel", "dog", "bytebug"),
        )
        val json = JsonParser.parseString(petStateJson(s)).asJsonObject
        assertEquals(JsonParser.parseString("""{"name":"Pixel","spriteType":"dog","petType":"bytebug","friendship":42,"visits":3,"lastVisitDay":100.0}"""), json.get("friend"))
        assertEquals(JsonParser.parseString("""{"ticksLeft":10,"played":true,"gifted":false,"broughtItem":null,"gameTicks":null}"""), json.get("visit"))
        assertEquals(JsonParser.parseString("""{"from":"friend","name":"Pixel","spriteType":"dog","petType":"bytebug"}"""), json.get("proposal"))
    }

    // ── Friendship levels ────────────────────────────────────────────────────

    @Test
    fun `maps scores to the six levels`() {
        assertEquals("Acquaintance", friendshipLevel(0))
        assertEquals("Buddy", friendshipLevel(15))
        assertEquals("Friend", friendshipLevel(54))
        assertEquals("Good Friend", friendshipLevel(55))
        assertEquals("Best Friend", friendshipLevel(75))
        assertEquals("Partner", friendshipLevel(PARTNER_FRIENDSHIP))
    }

    // ── Visits ───────────────────────────────────────────────────────────────

    @Test
    fun `a first visit makes a friend and unlocks First Friend`() {
        val s = makePet().copy(ticksSinceLastVisit = VISIT_MIN_GAP_TICKS)
        val next = tickWith(s, 0.0)
        assertNotNull(next.friend, "friend created")
        assertNotEquals(s.name, next.friend!!.name)
        assertNotNull(next.visit)
        assertEquals(VISIT_TICKS, next.visit!!.ticksLeft)
        assertTrue("friend_made" in next.events)
        assertTrue("friend_visit_started" in next.events)
        assertTrue("first_friend" in next.trainer.achievements)
        assertEquals(0, next.ticksSinceLastVisit)
    }

    @Test
    fun `no visit before the gap, while idle, for babies, or with social off`() {
        val ready = makePet().copy(ticksSinceLastVisit = VISIT_MIN_GAP_TICKS)
        assertNull(tickWith(makePet().copy(ticksSinceLastVisit = 10), 0.0).visit)
        assertNull(tickWith(ready, 0.0, isIdle = true).visit)
        assertNull(tickWith(ready.copy(stage = "baby", dayTimer = 3.5, ageDays = 3), 0.0).visit)
        assertNull(tickWith(ready, 0.0, noCalls.copy(socialEnabled = false)).visit)
    }

    @Test
    fun `dev mode brings the friend devModeAgingMultiplier times faster`() {
        assertEquals(Pair(1200, 0.001), visitPacing(noCalls))
        val dev = noCalls.copy(devMode = true, devModeAgingMultiplier = 10.0)
        assertEquals(120, visitPacing(dev).first)
        assertEquals(0.01, visitPacing(dev).second, 1e-12)
        assertEquals(1.0, visitPacing(dev.copy(devModeAgingMultiplier = 5000.0)).second)
        assertNotNull(tickWith(makePet().copy(ticksSinceLastVisit = 120), 0.005, dev).visit)
        assertNull(tickWith(makePet().copy(ticksSinceLastVisit = 118), 0.005, dev).visit)
        assertNull(tickWith(makePet().copy(ticksSinceLastVisit = VISIT_MIN_GAP_TICKS), 0.005).visit)
    }

    @Test
    fun `social is a dev-mode preview - the default config starts no visits`() {
        val ready = makePet().copy(ticksSinceLastVisit = VISIT_MIN_GAP_TICKS)
        assertNull(tickWith(ready, 0.0, DEFAULT_GAME_CONFIG.copy(attentionCallsEnabled = false)).visit)
    }

    @Test
    fun `a visit ends after VISIT_TICKS, or at once when the pet falls asleep`() {
        var s = makePet().copy(friend = friend(10), visit = FriendVisit(2, played = false, gifted = false))
        s = tickWith(s, 0.5)
        assertEquals(1, s.visit!!.ticksLeft)
        s = tickWith(s, 0.5)
        assertNull(s.visit)
        assertTrue("friend_visit_ended" in s.events)

        val asleep = makePet().copy(
            friend = friend(10), visit = FriendVisit(30, played = false, gifted = false), sleeping = true, energy = 10,
        )
        assertNull(tickWith(asleep, 0.5).visit)
    }

    @Test
    fun `turning social off ends an ongoing visit`() {
        val s = makePet().copy(friend = friend(10), visit = FriendVisit(30, played = false, gifted = false))
        val next = tick(s, false, false, noCalls.copy(socialEnabled = false))
        assertNull(next.visit)
        assertTrue("friend_visit_ended" in next.events)
    }

    @Test
    fun `friendship decays on a game-day boundary without a visit`() {
        val s = makePet().copy(friend = friend(30), dayTimer = 100.99999, ageDays = 100, ticksAlive = 2)
        val next = tickWith(s, 0.5)
        assertTrue(floor(next.dayTimer) > 100, "crossed a day")
        assertEquals(30 - FRIENDSHIP_DECAY_PER_DAY, next.friend!!.friendship)
    }

    // ── Several friends ──────────────────────────────────────────────────────

    private val alwaysVisit = noCalls.copy(devMode = true, devModeAgingMultiplier = 1000.0)

    @Test
    fun `pickVisitor leaves room for someone new, otherwise weighted by friendship`() {
        assertNull(pickVisitor(emptyList(), 0.0))
        val two = listOf(friend(0, "A"), friend(90, "B"))
        assertNull(pickVisitor(two, 1 - NEW_FRIEND_CHANCE))
        assertEquals("A", pickVisitor(two, 0.0)!!.name)
        assertEquals("B", pickVisitor(two, 0.5)!!.name)
        val full = listOf(friend(0, "A"), friend(0, "B"), friend(0, "C"))
        assertEquals(MAX_FRIENDS, full.size)
        assertEquals("C", pickVisitor(full, 0.99)!!.name)
    }

    @Test
    fun `a new friend visits and the old friend moves to otherFriends`() {
        val s = makePet().copy(friend = friend(40), ticksSinceLastVisit = VISIT_MIN_GAP_TICKS)
        val next = tickWith(s, 0.99, alwaysVisit)
        assertNotNull(next.visit)
        assertTrue("friend_made" in next.events)
        assertNotEquals("Pixel", next.friend!!.name)
        assertEquals(next.dayTimer, next.friend!!.lastVisitDay)
        assertEquals(listOf("Pixel"), next.otherFriends.map { it.name })
    }

    @Test
    fun `an old friend visits again and becomes the current friend`() {
        val s = makePet().copy(friend = friend(10), otherFriends = listOf(friend(60, "Mochi")),
            ticksSinceLastVisit = VISIT_MIN_GAP_TICKS)
        val next = tickWith(s, 0.5, alwaysVisit)
        assertEquals("Mochi", next.friend!!.name)
        assertEquals(4, next.friend!!.visits)
        assertEquals(listOf("Pixel"), next.otherFriends.map { it.name })
        assertFalse("friend_made" in next.events)
    }

    @Test
    fun `other friends decay and drift away at 0 after FRIEND_DRIFT_DAYS`() {
        val gone = friend(1, "Byte").copy(lastVisitDay = 100.5 - FRIEND_DRIFT_DAYS)
        val s = makePet().copy(friend = friend(30), otherFriends = listOf(friend(5, "Mochi"), gone),
            dayTimer = 100.99999, ageDays = 100, ticksAlive = 2)
        val next = tickWith(s, 0.5)
        assertEquals(listOf("Mochi" to 4), next.otherFriends.map { it.name to it.friendship })
        assertTrue("friend_drifted_away" in next.events)
    }

    @Test
    fun `the current friend drifts away and the next friend takes its place`() {
        val s = makePet().copy(friend = friend(1).copy(lastVisitDay = 90.0), otherFriends = listOf(friend(20, "Mochi")),
            dayTimer = 100.99999, ageDays = 100, ticksAlive = 2)
        val next = tickWith(s, 0.5)
        assertEquals("Mochi", next.friend!!.name)
        assertTrue(next.otherFriends.isEmpty())
    }

    @Test
    fun `a partner never drifts away`() {
        val s = makePet().copy(friend = friend(30), otherFriends = listOf(friend(0, "Byte").copy(lastVisitDay = 0.0)),
            partner = PetIdentity("Byte", "dog", "bytebug"), dayTimer = 100.99999, ageDays = 100, ticksAlive = 2)
        assertEquals(listOf("Byte"), tickWith(s, 0.5).otherFriends.map { it.name })
    }

    @Test
    fun `other friends survive a save, capped and without duplicates`() {
        val s = makePet().copy(friend = friend(42), otherFriends = listOf(friend(10, "Mochi"), friend(0, "Byte")))
        assertEquals(s.otherFriends, roundTrip(s).otherFriends)
        val loaded = loadEdited(makePet().copy(friend = friend(5))) { json ->
            val arr = com.google.gson.JsonArray()
            listOf("Pixel", "Mochi", "Mochi", "Byte", "Waffle").forEach { n ->
                arr.add(JsonObject().apply {
                    addProperty("name", n); addProperty("spriteType", "dog"); addProperty("petType", "bytebug")
                    addProperty("friendship", 1); addProperty("visits", 1)
                })
            }
            json.add("otherFriends", arr)
        }
        assertEquals(listOf("Mochi", "Byte"), loaded.otherFriends.map { it.name })
    }

    // ── Playing and gifts ────────────────────────────────────────────────────

    private fun visiting(friendship: Int, items: List<String> = listOf("ball")) =
        makePet().copy(friend = friend(friendship), visit = FriendVisit(30, played = false, gifted = false), items = items)

    // ── Play together is a minigame ─────────────────────────────────────────

    @Test
    fun `friendship follows the minigame result, a loss gives half the happiness`() {
        val base = visiting(20).copy(happiness = 50)
        val win = playWithFriend(base, "win")
        assertEquals(20 + FRIENDSHIP_PER_PLAY_RESULT.getValue("win"), win.friend!!.friendship)
        assertTrue("friend_game_win" in win.events)
        val lose = playWithFriend(base, "lose")
        assertEquals(20 + FRIENDSHIP_PER_PLAY_RESULT.getValue("lose"), lose.friend!!.friendship)
        assertEquals(55, lose.happiness)
        assertTrue("friend_game_draw" in playWithFriend(base, "push").events)
        assertEquals(20 + FRIENDSHIP_PER_PLAY_RESULT.getValue("draw"), playWithFriend(base).friend!!.friendship)
    }

    @Test
    fun `a friend game pauses the visit timer, and playing clears it`() {
        var s = startFriendGame(visiting(20))
        assertEquals(FRIEND_GAME_PAUSE_TICKS, s.visit!!.gameTicks)
        s = tickWith(s, 0.5)
        assertEquals(30, s.visit!!.ticksLeft)
        assertEquals(FRIEND_GAME_PAUSE_TICKS - 1, roundTrip(s).visit!!.gameTicks)
        val played = playWithFriend(s, "win")
        assertNull(played.visit!!.gameTicks)
        assertEquals(29, tickWith(played, 0.5).visit!!.ticksLeft)
        var abandoned = startFriendGame(visiting(20))
        repeat(FRIEND_GAME_PAUSE_TICKS + 1) { abandoned = tickWith(abandoned, 0.5) }
        assertEquals(29, abandoned.visit!!.ticksLeft)
    }

    // ── Items ────────────────────────────────────────────────────────────────

    @Test
    fun `giving an item removes it, and friendship depends on its kind`() {
        val food = giveFriendGift(visiting(20, listOf("apple", "plant")), "apple")
        assertEquals(20 + FRIENDSHIP_PER_GIFT_KIND.getValue("food"), food.friend!!.friendship)
        assertEquals(listOf("plant"), food.items)
        assertTrue("friend_gift_item_apple" in food.events)
        val decor = giveFriendGift(visiting(20, listOf("apple", "plant")), "plant")
        assertEquals(20 + FRIENDSHIP_PER_GIFT_KIND.getValue("decor"), decor.friend!!.friendship)
        assertEquals(visiting(20).hunger, decor.hunger)
        assertEquals(listOf("cake"), giveFriendGift(visiting(20, listOf("kite", "cake"))).items)
    }

    @Test
    fun `a gift is refused with no items, or an item the pet doesn't own`() {
        assertEquals(listOf("friend_gift_refused"), giveFriendGift(visiting(20, emptyList())).events)
        assertEquals(listOf("friend_gift_refused"), giveFriendGift(visiting(20, listOf("apple")), "kite").events)
    }

    @Test
    fun `a visiting friend can bring an item, added to the bag`() {
        val s = makePet().copy(friend = friend(20), ticksSinceLastVisit = VISIT_MIN_GAP_TICKS)
        val next = tickWith(s, 0.0)
        assertTrue("friend_gift_received" in next.events)
        assertEquals(listOf(ITEM_CATALOG[0].id), next.items)
        assertEquals(ITEM_CATALOG[0].id, next.visit!!.broughtItem)
    }

    @Test
    fun `useItem feeds, cheers up, or decorates the floor`() {
        val base = makePet().copy(hunger = 50, happiness = 50, items = listOf("fish", "yarn", "plant", "flower", "lantern", "star"))
        val ate = useItem(base, "fish")
        assertEquals(50 + ITEM_FOOD_HUNGER, ate.hunger)
        assertFalse("fish" in ate.items)
        assertEquals(50 + ITEM_TOY_HAPPINESS, useItem(base, "yarn").happiness)
        var s = base
        for (d in listOf("plant", "flower", "lantern", "star")) s = useItem(s, d)
        assertEquals(listOf("flower", "lantern", "star"), s.decor)
        assertEquals(listOf("item_refused"), useItem(base, "apple").events)
        assertEquals(listOf("item_refused"), useItem(base.copy(sleeping = true), "fish").events)
    }

    @Test
    fun `every MINIGAME_WINS_PER_ITEM minigame wins finds an item`() {
        var s = makePet()
        var found = 0
        repeat(MINIGAME_WINS_PER_ITEM * 2) {
            s = applyMinigameResult(s, "left_right", "win")
            found += s.events.count { it.startsWith("item_found_") }
        }
        assertTrue(found >= 2)
        assertTrue(s.items.size >= 2)
    }

    @Test
    fun `items and decor survive a save, unknown ids dropped`() {
        val s = makePet().copy(items = listOf("apple", "teddy"), decor = listOf("plant"))
        val r = roundTrip(s)
        assertEquals(listOf("apple", "teddy"), r.items)
        assertEquals(listOf("plant"), r.decor)
        val loaded = loadEdited(s) { json ->
            json.add("items", JsonParser.parseString("""["apple","laser-sword",7]"""))
            json.add("decor", JsonParser.parseString("""["apple","plant"]"""))
        }
        assertEquals(listOf("apple"), loaded.items)
        assertEquals(listOf("plant"), loaded.decor)
    }

    @Test
    fun `play together raises friendship once per visit`() {
        val s = playWithFriend(visiting(20))
        assertTrue("friend_played" in s.events)
        assertEquals(30, s.friend!!.friendship)
        assertTrue(s.visit!!.played)
        assertEquals(1, s.trainer.counters["friendPlays"])
        val again = playWithFriend(s)
        assertEquals(listOf("friend_play_refused"), again.events)
        assertEquals(30, again.friend!!.friendship)
    }

    @Test
    fun `gift and play are refused with no visit`() {
        assertEquals(listOf("friend_play_refused"), playWithFriend(makePet()).events)
        assertEquals(listOf("friend_gift_refused"), giveFriendGift(makePet().copy(friend = friend(5))).events)
    }

    @Test
    fun `goodbye ends the visit early, and is refused with no visit`() {
        val s = sayGoodbyeToFriend(visiting(20))
        assertEquals(null, s.visit)
        assertEquals(listOf("friend_waved_goodbye", "friend_visit_ended"), s.events)
        assertEquals(20, s.friend!!.friendship)
        assertEquals(listOf("friend_goodbye_refused"), sayGoodbyeToFriend(makePet()).events)
    }

    @Test
    fun `a gift that reaches Best Friend unlocks Best Buds`() {
        val s = giveFriendGift(visiting(70))
        assertEquals(85, s.friend!!.friendship)
        assertTrue("best_friends" in s.events)
        assertTrue("best_buds" in s.trainer.achievements)
        assertEquals(1, s.trainer.counters["giftsGiven"])
        assertEquals(listOf("friend_gift_refused"), giveFriendGift(s).events)
    }

    // ── Marriage, heir egg and generations ───────────────────────────────────

    @Test
    fun `the friend proposes at Partner level to an adult`() {
        val s = makePet().copy(friend = friend(PARTNER_FRIENDSHIP), ticksSinceLastVisit = VISIT_MIN_GAP_TICKS)
        val next = tickWith(s, 0.0)
        assertTrue("proposal_received" in next.events)
        assertEquals("friend", next.proposal!!.from)
        assertEquals("Pixel", next.proposal!!.name)
    }

    @Test
    fun `no proposal for a teen, even at Partner level`() {
        val s = makePet().copy(
            stage = "teen", dayTimer = 50.5, ageDays = 50, friend = friend(PARTNER_FRIENDSHIP),
            ticksSinceLastVisit = VISIT_MIN_GAP_TICKS,
        )
        assertNull(tickWith(s, 0.0).proposal)
    }

    @Test
    fun `accepting marries the pet without an heir egg (offspring on the backlog)`() {
        val s = makePet().copy(friend = friend(95), proposal = Proposal("friend", "Pixel", "dog", "bytebug"))
        val m = acceptProposal(s, fixed(0.9))
        assertTrue("married" in m.events)
        assertEquals(PetIdentity("Pixel", "dog", "bytebug"), m.partner)
        assertNull(m.heirEgg)
        assertNull(m.proposal)
        assertTrue("tied_the_knot" in m.trainer.achievements)
        assertEquals(listOf("proposal_refused"), acceptProposal(m).events)
    }

    @Test
    fun `declining sets a cooldown that blocks the next offer`() {
        val s = declineProposal(makePet().copy(proposal = Proposal("friend", "Pixel", "dog", "bytebug")))
        assertNull(s.proposal)
        assertEquals(PROPOSAL_DECLINE_COOLDOWN_TICKS, s.proposalCooldownTicks)
        val t = tickWith(s.copy(friend = friend(95), ticksSinceLastVisit = VISIT_MIN_GAP_TICKS), 0.0)
        assertNull(t.proposal)
    }

    @Test
    fun `the matchmaker arrives after MATCHMAKER_SENIOR_DAYS single senior days`() {
        val base = makePet().copy(stage = "senior", dayTimer = 300.5, ageDays = 300)
        val early = tickWith(base.copy(seniorSinceDay = 299.0), 0.5)
        assertNull(early.proposal)
        val due = tickWith(base.copy(seniorSinceDay = 300.5 - MATCHMAKER_SENIOR_DAYS), 0.5)
        assertTrue("matchmaker_arrived" in due.events)
        assertEquals("matchmaker", due.proposal!!.from)
        val married = tickWith(base.copy(seniorSinceDay = 0.0, partner = PetIdentity("B", "cat", "codeling")), 0.5)
        assertNull(married.proposal)
    }

    @Test
    fun `records when the pet became a senior`() {
        val s = tickWith(makePet().copy(stage = "senior", dayTimer = 300.5, ageDays = 300), 0.5)
        assertTrue(s.seniorSinceDay != null && s.seniorSinceDay!! >= 300.5)
    }

    @Test
    fun `hatching the heir starts the next generation`() {
        val parent = makePet().copy(generation = 2, heirEgg = HeirEgg("dragon", "pixelpup"), alive = false)
        val heir = hatchHeir(parent, "Mittens II")!!
        assertEquals(3, heir.generation)
        assertEquals("egg", heir.stage)
        assertEquals("dragon", heir.spriteType)
        assertEquals("pixelpup", heir.petType)
        assertEquals("Mittens II", heir.name)
        assertNull(heir.heirEgg)
        assertEquals(1, heir.trainer.counters["heirs"])
        assertNull(hatchHeir(makePet(), "X"), "no egg, no heir")
    }

    @Test
    fun `a fresh egg is generation 1`() {
        assertEquals(1, createPet("A", "codeling", "neon").generation)
    }

    @Test
    fun `progression has the social XP sources, caps and achievements`() {
        assertEquals(10, XP_AMOUNTS["befriend"])
        assertEquals(25, XP_AMOUNTS["best_friend"])
        assertEquals(5, XP_AMOUNTS["friend_play"])
        assertEquals(5, XP_AMOUNTS["friend_gift"])
        assertEquals(50, XP_AMOUNTS["marriage"])
        assertEquals(30, XP_AMOUNTS["heir"])
        assertEquals(10, XP_DAILY_CAPS["friend_play"])
        assertEquals(10, XP_DAILY_CAPS["friend_gift"])
        val ids = ACHIEVEMENTS.map { it.id }
        assertEquals(
            listOf("survivor", "first_friend", "best_buds", "tied_the_knot", "dynasty", "champion"),
            ids.subList(ids.indexOf("survivor"), ids.indexOf("champion") + 1),
        )
    }
}
