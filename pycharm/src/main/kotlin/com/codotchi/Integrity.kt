package com.codotchi

import com.codotchi.engine.PetState
import com.codotchi.generated.LeaderboardKey
import java.security.MessageDigest
import javax.crypto.Mac
import javax.crypto.spec.SecretKeySpec

/**
 * Integrity.kt — leaderboard integrity: the state-file seal and signed submissions.
 *
 * Mirrors packages/core/src/integrity.ts. Every save seals the fields that decide a
 * leaderboard score (age, identity, life-critical stats). A file whose seal doesn't
 * match was edited by hand, so the pet is marked "tampered" and can no longer be
 * submitted. Leaderboard issues carry an HMAC signature the GitHub workflow checks,
 * so hand-written issues are rejected.
 *
 * The key is generated at build time into generated/LeaderboardKey.kt (gitignored) by
 * build.gradle.kts from CODOTCHI_LEADERBOARD_KEY or the repo-root .leaderboard-key file.
 * With no key, sealing still works (so play is unaffected) but the build can't submit.
 *
 * The canonical strings must stay byte-identical to integrity.ts and the workflows —
 * packages/core/fixtures/integrity-vector.json pins all of them (see IntegrityTest).
 */
object Integrity {

    /** Bumped whenever the sealed field list changes. */
    const val SEAL_VERSION = "codotchi-seal-v1"

    /** Bumped whenever the signed submission fields change (matches schemaVersion 2). */
    const val SIGNATURE_VERSION = "codotchi-lb-v2"

    /** The leaderboard key baked into this build ("" when built without one). */
    val buildKey: String get() = LeaderboardKey.VALUE

    /** True when this build has a leaderboard key and so can submit. */
    fun leaderboardKeyAvailable(key: String = buildKey): Boolean = key.isNotEmpty()

    private fun hmacHex(key: String, message: String): String {
        val mac = Mac.getInstance("HmacSHA256")
        // SecretKeySpec rejects an empty key; HMAC pads keys with zeros, so a single
        // zero byte is equivalent to Node's empty key.
        val keyBytes = key.toByteArray(Charsets.UTF_8).let { if (it.isEmpty()) ByteArray(1) else it }
        mac.init(SecretKeySpec(keyBytes, "HmacSHA256"))
        val digest = mac.doFinal(message.toByteArray(Charsets.UTF_8))
        return digest.joinToString("") { "%02x".format(it) }
    }

    /** Integer form of a stat, so JS and Kotlin print identical strings. */
    private fun fixed(value: Double, scale: Long): String {
        val v = if (value.isFinite()) value else 0.0
        return Math.round(v * scale).toString()
    }

    private fun fixed(value: Long, scale: Long): String = fixed(value.toDouble(), scale)

    /**
     * The canonical text covered by the state seal: identity, age and the stats
     * that keep a pet alive. One field per line, integers only.
     */
    fun sealPayload(state: PetState): String = sealPayload(SealFields.of(state))

    /**
     * The sealed fields as numbers. The TS engine keeps stats fractional while
     * PetState holds Ints, so the shared test vector is checked through this form.
     */
    data class SealFields(
        val spawnedAt: Double,
        val name: String,
        val petType: String,
        val stage: String,
        val alive: Boolean,
        val ticksAlive: Double,
        val dayTimer: Double,
        val hunger: Double,
        val happiness: Double,
        val energy: Double,
        val health: Double,
        val weight: Double,
        val sick: Boolean,
        val careMistakes: Double,
        val lifetimeCareMistakes: Double,
        val devModeEverUsed: Boolean,
        val leaderboardIneligible: String,
    ) {
        companion object {
            fun of(s: PetState) = SealFields(
                spawnedAt = s.spawnedAt.toDouble(), name = s.name, petType = s.petType, stage = s.stage,
                alive = s.alive, ticksAlive = s.ticksAlive.toDouble(), dayTimer = s.dayTimer,
                hunger = s.hunger.toDouble(), happiness = s.happiness.toDouble(), energy = s.energy.toDouble(),
                health = s.health.toDouble(), weight = s.weight.toDouble(), sick = s.sick,
                careMistakes = s.careMistakes, lifetimeCareMistakes = s.lifetimeCareMistakes.toDouble(),
                devModeEverUsed = s.devModeEverUsed, leaderboardIneligible = s.leaderboardIneligible,
            )
        }
    }

    /** Canonical seal text for [f] — see [sealPayload] (PetState). */
    fun sealPayload(f: SealFields): String = listOf(
        SEAL_VERSION,
        fixed(f.spawnedAt, 1),
        f.name,
        f.petType,
        f.stage,
        if (f.alive) "1" else "0",
        fixed(f.ticksAlive, 1),
        fixed(f.dayTimer, 1_000_000),
        fixed(f.hunger, 1000),
        fixed(f.happiness, 1000),
        fixed(f.energy, 1000),
        fixed(f.health, 1000),
        fixed(f.weight, 1000),
        if (f.sick) "1" else "0",
        fixed(f.careMistakes, 1),
        fixed(f.lifetimeCareMistakes, 1),
        if (f.devModeEverUsed) "1" else "0",
        f.leaderboardIneligible,
    ).joinToString("\n")

    /** Seal for raw seal fields (hex HMAC-SHA256). */
    fun sealFields(f: SealFields, key: String = buildKey): String = hmacHex(key, sealPayload(f))

    /** Seal for a pet state (hex HMAC-SHA256). */
    fun sealState(state: PetState, key: String = buildKey): String = hmacHex(key, sealPayload(state))

    /** Constant-time compare of two hex strings. */
    private fun hexEquals(a: String, b: String): Boolean =
        a.length == b.length && MessageDigest.isEqual(a.toByteArray(Charsets.UTF_8), b.toByteArray(Charsets.UTF_8))

    /**
     * Check a loaded state against its stored seal and return the state to use.
     * A missing seal (save from before seals existed) marks the pet "unverified";
     * a wrong seal marks it "tampered". Either mark is permanent. The pet keeps
     * playing — it just can't be submitted.
     */
    fun verifySeal(state: PetState, seal: String?, key: String = buildKey): PetState {
        if (state.leaderboardIneligible == "tampered") return state
        if (seal.isNullOrEmpty()) {
            return if (state.leaderboardIneligible == "") state.copy(leaderboardIneligible = "unverified") else state
        }
        if (hexEquals(seal, sealState(state, key))) return state
        return state.copy(leaderboardIneligible = "tampered")
    }

    /** Why this pet can't be submitted right now, or null when it can. */
    fun leaderboardBlockedReason(state: PetState, devModeActive: Boolean, key: String = buildKey): String? {
        if (!leaderboardKeyAvailable(key)) {
            return "This build of Codotchi can't submit to the leaderboard."
        }
        if (devModeActive || state.devModeEverUsed) {
            return "This pet has lived in dev mode, so it can't go on the leaderboard."
        }
        if (state.leaderboardIneligible == "tampered") {
            return "This pet's save file was edited outside Codotchi, so it can't go on the leaderboard."
        }
        // "unverified" (a save from before seals existed) is still allowed: those pets
        // were hatched by a real client before 2.27, and every submission is signed.
        return null
    }

    /** Fields covered by a leaderboard submission signature. */
    data class SignedSubmission(
        /** "score" for a death submission, "live" for a live update. */
        val kind: String,
        val githubUsername: String,
        val petName: String,
        val ageDays: Double,
        val stage: String,
        val petType: String,
        val spawnedAt: Long,
        /** diedAt for "score", updatedAt for "live". */
        val at: Long,
        val petRunId: String,
        val clientVersion: String,
    )

    /** Canonical text covered by a submission signature. The username is lower-cased. */
    fun submissionPayload(s: SignedSubmission): String = listOf(
        SIGNATURE_VERSION,
        s.kind,
        s.githubUsername.lowercase(),
        s.petName,
        fixed(s.ageDays, 1),
        s.stage,
        s.petType,
        fixed(s.spawnedAt, 1),
        fixed(s.at, 1),
        s.petRunId,
        s.clientVersion,
    ).joinToString("\n")

    /** Signature (hex HMAC-SHA256) for a leaderboard submission. */
    fun signSubmission(s: SignedSubmission, key: String = buildKey): String = hmacHex(key, submissionPayload(s))
}
