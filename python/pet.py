"""Pet dataclass: stats, per-tick decay, evolution gating, serialisation.

This module is the single source of truth for the in-memory pet state.
All mutation happens here; callers receive updated Pet instances.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Any

import config
import models


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _clamp(value: int, minimum: int, maximum: int) -> int:
    """Return *value* clamped to the closed interval [*minimum*, *maximum*]."""
    return max(minimum, min(maximum, value))


def _clamp_stat(value: int) -> int:
    """Clamp a standard 0-100 stat."""
    return _clamp(value, config.STAT_MIN, config.STAT_MAX)


# ---------------------------------------------------------------------------
# Pet dataclass
# ---------------------------------------------------------------------------


@dataclass
class Pet:
    """Full in-memory state for a single pet.

    All integer stats are in the range [0, 100] unless documented otherwise.
    """

    # Identity
    name: str
    pet_type: str
    color: str

    # Core stats
    hunger: int = 50
    happiness: int = 50
    discipline: int = 50
    energy: int = 100
    health: int = 100
    weight: int = 5
    age_days: int = 0

    # Life-cycle
    stage: str = "egg"
    character: str = ""
    alive: bool = True
    sick: bool = False
    sleeping: bool = False

    # Bookkeeping
    ticks_alive: int = 0
    poops: int = 0
    ticks_since_last_poop: int = 0
    consecutive_snacks: int = 0
    hunger_zero_ticks: int = 0
    medicine_doses_given: int = 0

    # Care-quality accumulators (running averages)
    care_score_hunger_sum: float = 0.0
    care_score_happiness_sum: float = 0.0
    care_score_health_sum: float = 0.0
    care_score_ticks: int = 0

    # Events emitted during the last tick (cleared each tick)
    events: list[str] = field(default_factory=list)

    # ---------------------------------------------------------------------------
    # Derived properties
    # ---------------------------------------------------------------------------

    @property
    def mood(self) -> str:
        """Current mood label derived from stats."""
        return models.mood_from_stats(
            self.hunger,
            self.happiness,
            self.health,
            self.sleeping,
        )

    @property
    def sprite(self) -> str:
        """Sprite key for the current stage and mood."""
        return f"{self.stage}_{self.mood}"

    @property
    def care_score(self) -> float:
        """Weighted care quality score in the range 0.0–1.0.

        Returns 0.5 (neutral) if no ticks have been accumulated yet.
        """
        if self.care_score_ticks == 0:
            return 0.5
        average_hunger = self.care_score_hunger_sum / self.care_score_ticks
        average_happiness = self.care_score_happiness_sum / self.care_score_ticks
        average_health = self.care_score_health_sum / self.care_score_ticks

        # Cleanliness proxy: penalise uncleaned poops
        cleanliness_normalised = _clamp_stat(100 - self.poops * 20) / config.STAT_MAX

        return (
            config.CARE_SCORE_HUNGER_WEIGHT * (average_hunger / config.STAT_MAX)
            + config.CARE_SCORE_HAPPINESS_WEIGHT * (average_happiness / config.STAT_MAX)
            + config.CARE_SCORE_DISCIPLINE_WEIGHT * (self.discipline / config.STAT_MAX)
            + config.CARE_SCORE_CLEANLINESS_WEIGHT * cleanliness_normalised
            + config.CARE_SCORE_HEALTH_WEIGHT * (average_health / config.STAT_MAX)
        )

    # ---------------------------------------------------------------------------
    # Tick
    # ---------------------------------------------------------------------------

    def tick(self) -> None:
        """Advance game state by one tick.

        Applies decay, sickness checks, death checks, and accumulates
        care-score history.  Appends event strings to ``self.events``.
        """
        if not self.alive:
            return

        self.events = []
        self.ticks_alive += 1

        modifiers = models.PET_TYPE_MODIFIERS[self.pet_type]

        # --- Stat decay ---
        if not self.sleeping:
            hunger_decay = math.ceil(
                config.HUNGER_DECAY_PER_TICK * modifiers.hunger_decay_multiplier
            )
            happiness_decay = math.ceil(
                config.HAPPINESS_DECAY_PER_TICK * modifiers.happiness_decay_multiplier
            )
            self.hunger = _clamp_stat(self.hunger - hunger_decay)
            self.happiness = _clamp_stat(self.happiness - happiness_decay)
        else:
            energy_regen = math.ceil(
                config.ENERGY_REGEN_PER_TICK_SLEEPING
                * modifiers.energy_regen_multiplier
            )
            self.energy = _clamp_stat(self.energy + energy_regen)

        # --- Poop accumulation ---
        if not self.sleeping:
            self.ticks_since_last_poop += 1
            if self.ticks_since_last_poop >= config.POOP_TICKS_INTERVAL:
                self.poops += 1
                self.ticks_since_last_poop = 0
                self.events.append("pooped")

        # --- Sickness from dirty environment ---
        if self.poops >= config.MAX_UNCLEANED_POOPS_BEFORE_SICK and not self.sick:
            self.sick = True
            self.events.append("became_sick")

        # --- Starvation damage ---
        if self.hunger == config.STAT_MIN:
            self.hunger_zero_ticks += 1
        else:
            self.hunger_zero_ticks = 0

        if self.hunger_zero_ticks >= config.HUNGER_ZERO_TICKS_BEFORE_RISK:
            self.health = _clamp_stat(
                self.health - config.CRITICAL_HEALTH_DAMAGE_PER_TICK
            )
            self.events.append("starvation_damage")

        # --- Happiness-critical health drain ---
        if self.happiness == config.STAT_MIN and not self.sleeping:
            self.health = _clamp_stat(
                self.health - config.CRITICAL_HEALTH_DAMAGE_PER_TICK
            )
            self.events.append("unhappiness_damage")

        # --- Sickness health drain ---
        if self.sick:
            self.health = _clamp_stat(
                self.health - config.CRITICAL_HEALTH_DAMAGE_PER_TICK
            )

        # --- Death check ---
        if self.health <= config.HEALTH_DEATH_THRESHOLD:
            self.alive = False
            self.events.append("died")
            return

        # --- Care-score accumulation ---
        self.care_score_hunger_sum += self.hunger
        self.care_score_happiness_sum += self.happiness
        self.care_score_health_sum += self.health
        self.care_score_ticks += 1

        # --- Stage progression ---
        self._check_stage_progression()

    # ---------------------------------------------------------------------------
    # Stage progression
    # ---------------------------------------------------------------------------

    def _check_stage_progression(self) -> None:
        """Promote the pet to the next life stage if duration has elapsed."""
        stage_duration_map: dict[str, int] = {
            "egg": config.EGG_DURATION_TICKS,
            "baby": config.BABY_DURATION_TICKS,
            "child": config.CHILD_DURATION_TICKS,
            "teen": config.TEEN_DURATION_TICKS,
        }
        if self.stage not in stage_duration_map:
            return
        if self.ticks_alive < stage_duration_map[self.stage]:
            return

        next_stage_map: dict[str, str] = {
            "egg": "baby",
            "baby": "child",
            "child": "teen",
            "teen": "adult",
        }
        next_stage = next_stage_map[self.stage]
        self._evolve_to(next_stage)

    def _evolve_to(self, next_stage: str) -> None:
        """Transition the pet to *next_stage* and assign a character."""
        old_stage = self.stage
        self.stage = next_stage

        if next_stage != "egg":
            self.character = models.character_for_stage(
                self.pet_type, next_stage, self.care_score
            )

        # Reset ticks so the next stage duration is measured fresh.
        self.ticks_alive = 0
        self.events.append(f"evolved_to_{next_stage}")

        # Reset care accumulators for the new stage window.
        self.care_score_hunger_sum = 0.0
        self.care_score_happiness_sum = 0.0
        self.care_score_health_sum = 0.0
        self.care_score_ticks = 0

        _ = old_stage  # suppress unused warning

    # ---------------------------------------------------------------------------
    # Serialisation
    # ---------------------------------------------------------------------------

    def to_dict(self) -> dict[str, object]:
        """Return a JSON-serialisable snapshot of the full pet state."""
        return {
            "hunger": self.hunger,
            "happiness": self.happiness,
            "discipline": self.discipline,
            "energy": self.energy,
            "health": self.health,
            "weight": self.weight,
            "age_days": self.age_days,
            "stage": self.stage,
            "character": self.character,
            "alive": self.alive,
            "sick": self.sick,
            "sleeping": self.sleeping,
            "poops": self.poops,
            "mood": self.mood,
            "name": self.name,
            "pet_type": self.pet_type,
            "color": self.color,
            "sprite": self.sprite,
            "care_score": round(self.care_score, 4),
            "events": list(self.events),
            # Persistence fields (not displayed in UI)
            "ticks_alive": self.ticks_alive,
            "ticks_since_last_poop": self.ticks_since_last_poop,
            "consecutive_snacks": self.consecutive_snacks,
            "hunger_zero_ticks": self.hunger_zero_ticks,
            "medicine_doses_given": self.medicine_doses_given,
            "care_score_hunger_sum": self.care_score_hunger_sum,
            "care_score_happiness_sum": self.care_score_happiness_sum,
            "care_score_health_sum": self.care_score_health_sum,
            "care_score_ticks": self.care_score_ticks,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "Pet":
        """Reconstruct a Pet from a previously serialised dict.

        Unknown keys are silently ignored so older snapshots remain loadable
        after the schema gains new fields.
        """
        pet = cls(
            name=str(data["name"]),
            pet_type=str(data["pet_type"]),
            color=str(data.get("color", models.DEFAULT_COLOUR)),
        )
        int_fields: list[str] = [
            "hunger",
            "happiness",
            "discipline",
            "energy",
            "health",
            "weight",
            "age_days",
            "ticks_alive",
            "poops",
            "ticks_since_last_poop",
            "consecutive_snacks",
            "hunger_zero_ticks",
            "medicine_doses_given",
            "care_score_ticks",
        ]
        for field_name in int_fields:
            if field_name in data:
                raw_value = data[field_name]
                setattr(pet, field_name, int(raw_value))

        float_fields: list[str] = [
            "care_score_hunger_sum",
            "care_score_happiness_sum",
            "care_score_health_sum",
        ]
        for field_name in float_fields:
            if field_name in data:
                raw_value = data[field_name]
                setattr(pet, field_name, float(raw_value))

        bool_fields: list[str] = ["alive", "sick", "sleeping"]
        for field_name in bool_fields:
            if field_name in data:
                setattr(pet, field_name, bool(data[field_name]))

        if "stage" in data:
            pet.stage = str(data["stage"])
        if "character" in data:
            pet.character = str(data["character"])

        return pet

    # ---------------------------------------------------------------------------
    # Offline decay
    # ---------------------------------------------------------------------------

    def apply_offline_decay(self, elapsed_seconds: float) -> None:
        """Decay stats for time elapsed while the extension was closed.

        The maximum total decay is capped at
        ``config.OFFLINE_DECAY_MAX_FRACTION`` of each stat's current value
        to prevent a pet from dying while the developer is asleep.
        """
        if elapsed_seconds <= 0 or not self.alive:
            return

        elapsed_ticks = elapsed_seconds / config.TICK_INTERVAL_SECONDS
        modifiers = models.PET_TYPE_MODIFIERS[self.pet_type]

        hunger_decay_total = math.ceil(
            elapsed_ticks
            * config.HUNGER_DECAY_PER_TICK
            * modifiers.hunger_decay_multiplier
        )
        happiness_decay_total = math.ceil(
            elapsed_ticks
            * config.HAPPINESS_DECAY_PER_TICK
            * modifiers.happiness_decay_multiplier
        )

        max_hunger_loss = math.floor(self.hunger * config.OFFLINE_DECAY_MAX_FRACTION)
        max_happiness_loss = math.floor(
            self.happiness * config.OFFLINE_DECAY_MAX_FRACTION
        )

        self.hunger = _clamp_stat(
            self.hunger - min(hunger_decay_total, max_hunger_loss)
        )
        self.happiness = _clamp_stat(
            self.happiness - min(happiness_decay_total, max_happiness_loss)
        )
