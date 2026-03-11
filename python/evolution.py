"""Senior-stage transition and old-age death helpers.

Separated from pet.py so that the more complex end-of-life rules can be
tested in isolation without constructing full tick sequences.
"""

import config
import models
from pet import Pet


# ---------------------------------------------------------------------------
# Senior promotion
# ---------------------------------------------------------------------------


def promote_to_senior(pet: Pet) -> Pet:
    """Transition an adult pet to the senior stage.

    The character is re-evaluated using the current care score.  Care
    accumulators are reset for the final life window.

    Args:
        pet: An adult pet (stage == ``"adult"``).

    Returns:
        The same pet object, mutated.

    Raises:
        ValueError: If *pet.stage* is not ``"adult"``.
    """
    if pet.stage != "adult":
        raise ValueError(
            f"promote_to_senior called on a pet in stage '{pet.stage}'; "
            "expected 'adult'."
        )

    pet.events = []
    pet.stage = "senior"
    pet.character = models.character_for_stage(pet.pet_type, "senior", pet.care_score)
    pet.ticks_alive = 0
    pet.care_score_hunger_sum = 0.0
    pet.care_score_happiness_sum = 0.0
    pet.care_score_health_sum = 0.0
    pet.care_score_ticks = 0
    pet.events.append("evolved_to_senior")
    return pet


# ---------------------------------------------------------------------------
# Old-age natural death
# ---------------------------------------------------------------------------

SENIOR_NATURAL_DEATH_AGE_DAYS: int = 20
"""Age in real-world days at which a senior pet may die of old age."""


def check_old_age_death(pet: Pet) -> Pet:
    """Apply natural end-of-life if the pet has reached old age.

    A senior pet with ``age_days >= SENIOR_NATURAL_DEATH_AGE_DAYS`` has a
    probability-based chance of dying each tick.  Rather than using random
    numbers (which make testing awkward), we use a deterministic rule:
    the pet dies when health drops to or below the death threshold AND the
    pet is senior and old.  The caller is responsible for regular health
    decay; this function only sets ``alive = False`` and emits the event.

    Args:
        pet: The pet to check.

    Returns:
        The same pet object, potentially mutated.
    """
    pet.events = []
    if pet.stage != "senior":
        return pet
    if pet.age_days < SENIOR_NATURAL_DEATH_AGE_DAYS:
        return pet
    if pet.health <= config.HEALTH_DEATH_THRESHOLD:
        pet.alive = False
        pet.events.append("died_of_old_age")
    return pet


# ---------------------------------------------------------------------------
# Care-score report helpers
# ---------------------------------------------------------------------------


def care_tier_label(care_score: float) -> str:
    """Return a human-readable tier label for the given *care_score*.

    Returns one of ``"Excellent"``, ``"Good"``, or ``"Poor"``.
    """
    tier = models.tier_from_care_score(care_score)
    return {"best": "Excellent", "mid": "Good", "low": "Poor"}[tier]
