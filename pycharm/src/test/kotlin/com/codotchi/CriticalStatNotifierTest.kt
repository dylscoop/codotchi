package com.codotchi

import com.codotchi.CriticalStatNotifier.CRITICAL_STAT_NOTIFY_REPEAT_MS
import com.codotchi.engine.*
import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.Test

/** Mirrors vscode/tests/unit/criticalStatNotifier.test.ts. */
class CriticalStatNotifierTest {

    private val t0 = 1_000_000L

    private fun pet(hunger: Int = 60, happiness: Int = 60, energy: Int = 60, health: Int = 60, discipline: Int = 60, alive: Boolean = true) =
        createPet("Pip", "codeling", "neon").copy(
            hunger = hunger, happiness = happiness, energy = energy, health = health, discipline = discipline, alive = alive,
        )

    @Test
    fun `stays quiet until hunger, happiness or energy hits 0`() {
        assertNull(CriticalStatNotifier.evaluate(pet(hunger = 1, happiness = 1, energy = 1), emptyMap(), t0).message)
        assertEquals("Pip needs you — hunger 0", CriticalStatNotifier.evaluate(pet(hunger = 0), emptyMap(), t0).message)
        assertEquals("Pip needs you — happiness 0", CriticalStatNotifier.evaluate(pet(happiness = 0), emptyMap(), t0).message)
        assertEquals("Pip needs you — energy 0", CriticalStatNotifier.evaluate(pet(energy = 0), emptyMap(), t0).message)
    }

    @Test
    fun `alerts when health drops below 25`() {
        assertNull(CriticalStatNotifier.evaluate(pet(health = 25), emptyMap(), t0).message)
        val r = CriticalStatNotifier.evaluate(pet(health = 24), emptyMap(), t0)
        assertEquals("Pip needs you — health 24", r.message)
        assertEquals(mapOf("health" to t0), r.tracker)
    }

    @Test
    fun `repeats only after 15 minutes while the stat stays critical`() {
        val low = pet(energy = 0)
        val first = CriticalStatNotifier.evaluate(low, emptyMap(), t0)
        val soon = CriticalStatNotifier.evaluate(low, first.tracker, t0 + CRITICAL_STAT_NOTIFY_REPEAT_MS - 1)
        assertNull(soon.message)
        assertEquals(mapOf("energy" to t0), soon.tracker)
        assertNotNull(CriticalStatNotifier.evaluate(low, soon.tracker, t0 + CRITICAL_STAT_NOTIFY_REPEAT_MS).message)
    }

    @Test
    fun `forgets a stat that recovers so the next drop notifies straight away`() {
        val first = CriticalStatNotifier.evaluate(pet(health = 10), emptyMap(), t0)
        val recovered = CriticalStatNotifier.evaluate(pet(), first.tracker, t0 + 1000)
        assertTrue(recovered.tracker.isEmpty())
        assertNotNull(CriticalStatNotifier.evaluate(pet(health = 10), recovered.tracker, t0 + 2000).message)
    }

    @Test
    fun `lists every critical stat in one message and restarts all their timers`() {
        val first = CriticalStatNotifier.evaluate(pet(hunger = 0), emptyMap(), t0)
        val both = CriticalStatNotifier.evaluate(pet(hunger = 0, health = 18), first.tracker, t0 + 1000)
        assertEquals("Pip needs you — hunger 0, health 18", both.message)
        assertEquals(mapOf("hunger" to t0 + 1000, "health" to t0 + 1000), both.tracker)
    }

    @Test
    fun `ignores discipline and dead pets`() {
        assertNull(CriticalStatNotifier.evaluate(pet(discipline = 0), emptyMap(), t0).message)
        val dead = CriticalStatNotifier.evaluate(pet(health = 0, alive = false), mapOf("health" to t0), t0)
        assertNull(dead.message)
        assertTrue(dead.tracker.isEmpty())
    }

    // ── osNotificationCommand ─────────────────────────────────────────────

    private val body = "Bob\"; rm -rf ~; echo \""

    @Test
    fun `passes title and body as env vars and keeps them out of scripts`() {
        for (os in listOf("Windows 11", "Mac OS X")) {
            val cmd = CriticalStatNotifier.osNotificationCommand(os, "Codotchi", body)!!
            assertEquals(mapOf("CODOTCHI_TITLE" to "Codotchi", "CODOTCHI_BODY" to body), cmd.env)
            assertFalse(cmd.command.joinToString(" ").contains(body), "$os: body leaked into the script")
        }
    }

    @Test
    fun `uses a PowerShell toast on Windows, osascript on macOS and notify-send on Linux`() {
        val win = CriticalStatNotifier.osNotificationCommand("Windows 11", "Codotchi", body)!!
        assertEquals("powershell.exe", win.command.first())
        assertTrue(win.command.last().contains("ToastNotificationManager"))
        assertTrue(win.command.last().contains("\$env:CODOTCHI_BODY"))
        assertEquals("osascript", CriticalStatNotifier.osNotificationCommand("Mac OS X", "Codotchi", body)!!.command.first())
        assertEquals(listOf("notify-send", "--app-name=Codotchi", "Codotchi", body),
            CriticalStatNotifier.osNotificationCommand("Linux", "Codotchi", body)!!.command)
        assertNull(CriticalStatNotifier.osNotificationCommand("SunOS", "Codotchi", body))
    }

    @Test
    fun `Windows toast script matches the VS Code one`() {
        val ts = java.io.File("../vscode/src/criticalStatNotifier.ts").readText()
        val script = CriticalStatNotifier.osNotificationCommand("Windows 11", "t", "b")!!.command.last()
        for (part in script.split("; ")) {
            val tsPart = part.replace("{1AC14E77-02E7-4E5D-B744-2EB1AE5198B7}\\WindowsPowerShell\\v1.0\\powershell.exe", "\${WINDOWS_TOAST_APP_ID}")
            assertTrue(ts.contains(tsPart), "VS Code script is missing: $tsPart")
        }
    }
}
