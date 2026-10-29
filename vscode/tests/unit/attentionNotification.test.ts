/**
 * attentionNotification.test.ts
 *
 * Unit tests for src/attentionNotification.ts — mapping attention-call events
 * to call types and deciding when a shown notification should close itself.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { attentionCallTypeForEvent, shouldDismissAttention } from "../../src/attentionNotification";

describe("attentionCallTypeForEvent", () => {
  it("maps plain attention-call events to their type", () => {
    assert.equal(attentionCallTypeForEvent("attention_call_hunger"), "hunger");
    assert.equal(attentionCallTypeForEvent("attention_call_low_energy"), "low_energy");
    assert.equal(attentionCallTypeForEvent("attention_call_critical_health"), "critical_health");
    assert.equal(attentionCallTypeForEvent("attention_call_break"), "break");
  });

  it("maps both craving events to craving", () => {
    assert.equal(attentionCallTypeForEvent("attention_call_craving_meal"), "craving");
    assert.equal(attentionCallTypeForEvent("attention_call_craving_snack"), "craving");
  });

  it("ignores expiry events and non-attention events", () => {
    assert.equal(attentionCallTypeForEvent("attention_call_expired_hunger"), null);
    assert.equal(attentionCallTypeForEvent("break_nap_over"), null);
    assert.equal(attentionCallTypeForEvent("died_of_old_age"), null);
  });
});

describe("shouldDismissAttention", () => {
  it("keeps the notification while its call is still active", () => {
    assert.equal(shouldDismissAttention("pat", "pat"), false);
  });

  it("dismisses once the call is answered or expires", () => {
    assert.equal(shouldDismissAttention("pat", null), true);
  });

  it("dismisses when a different call replaces it", () => {
    assert.equal(shouldDismissAttention("pat", "hunger"), true);
  });

  it("does nothing when no notification is shown", () => {
    assert.equal(shouldDismissAttention(null, null), false);
    assert.equal(shouldDismissAttention(null, "hunger"), false);
  });
});
