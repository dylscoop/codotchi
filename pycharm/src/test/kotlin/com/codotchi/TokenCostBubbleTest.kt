package com.codotchi

import org.junit.jupiter.api.Assertions.*
import org.junit.jupiter.api.Test

/** Unit tests for TokenCostBubble.kt — mirrors vscode/tests/unit/tokenCostBubble.test.ts. */
class TokenCostBubbleTest {

    @Test
    fun `marks the token-cost bubble as a usage report`() {
        assertEquals(
            """{"type":"showBubble","text":"Claude: $1.20","kind":"usage"}""",
            tokenCostBubblePayload("Claude: $1.20"),
        )
    }

    @Test
    fun `escapes quotes and backslashes`() {
        assertEquals(
            """{"type":"showBubble","text":"a \"b\" c\\d","kind":"usage"}""",
            tokenCostBubblePayload("a \"b\" c\\d"),
        )
    }
}
