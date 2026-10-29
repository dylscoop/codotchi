package com.codotchi

import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.Test

/** Unit tests for AttentionNotification.kt — mirrors vscode/tests/unit/attentionNotification.test.ts. */
class AttentionNotificationTest {

    @Test
    fun `maps plain attention-call events to their type`() {
        assertEquals("hunger", attentionCallTypeForEvent("attention_call_hunger"))
        assertEquals("low_energy", attentionCallTypeForEvent("attention_call_low_energy"))
        assertEquals("critical_health", attentionCallTypeForEvent("attention_call_critical_health"))
        assertEquals("break", attentionCallTypeForEvent("attention_call_break"))
    }

    @Test
    fun `maps both craving events to craving`() {
        assertEquals("craving", attentionCallTypeForEvent("attention_call_craving_meal"))
        assertEquals("craving", attentionCallTypeForEvent("attention_call_craving_snack"))
    }

    @Test
    fun `ignores expiry events and non-attention events`() {
        assertNull(attentionCallTypeForEvent("attention_call_expired_hunger"))
        assertNull(attentionCallTypeForEvent("break_nap_over"))
        assertNull(attentionCallTypeForEvent("died_of_old_age"))
    }

    @Test
    fun `keeps the notification while its call is still active`() {
        assertFalse(shouldDismissAttention("pat", "pat"))
    }

    @Test
    fun `dismisses once the call is answered, expires or is replaced`() {
        assertTrue(shouldDismissAttention("pat", null))
        assertTrue(shouldDismissAttention("pat", "hunger"))
    }

    @Test
    fun `does nothing when no notification is shown`() {
        assertFalse(shouldDismissAttention(null, null))
        assertFalse(shouldDismissAttention(null, "hunger"))
    }
}
