"""Unit tests for python/evolution.py.

Covers: promote_to_senior, check_old_age_death, care_tier_label.
"""

import evolution
import config
from pet import Pet


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def make_adult_pet(**kwargs: object) -> Pet:
    """Return a codeling pet in the adult stage."""
    pet = Pet(name="Senioritas", pet_type="codeling", color="mono")
    pet.stage = "adult"
    for key, value in kwargs.items():
        setattr(pet, key, value)
    return pet


# ---------------------------------------------------------------------------
# promote_to_senior
# ---------------------------------------------------------------------------


def test_promote_to_senior_sets_stage() -> None:
    """promote_to_senior transitions stage to 'senior'."""
    pet = make_adult_pet()
    evolution.promote_to_senior(pet)
    assert pet.stage == "senior"


def test_promote_to_senior_assigns_character() -> None:
    """promote_to_senior assigns a non-empty character string."""
    pet = make_adult_pet()
    evolution.promote_to_senior(pet)
    assert pet.character != ""


def test_promote_to_senior_emits_event() -> None:
    """promote_to_senior appends 'evolved_to_senior' to events."""
    pet = make_adult_pet()
    evolution.promote_to_senior(pet)
    assert "evolved_to_senior" in pet.events


def test_promote_to_senior_resets_ticks_alive() -> None:
    """promote_to_senior resets ticks_alive to 0."""
    pet = make_adult_pet(ticks_alive=999)
    evolution.promote_to_senior(pet)
    assert pet.ticks_alive == 0


def test_promote_to_senior_resets_care_accumulators() -> None:
    """promote_to_senior resets care-score accumulators."""
    pet = make_adult_pet()
    pet.care_score_hunger_sum = 500.0
    pet.care_score_ticks = 10
    evolution.promote_to_senior(pet)
    assert pet.care_score_ticks == 0
    assert pet.care_score_hunger_sum == 0.0


def test_promote_to_senior_raises_on_non_adult() -> None:
    """promote_to_senior raises ValueError when called on a non-adult pet."""
    pet = make_adult_pet()
    pet.stage = "teen"
    try:
        evolution.promote_to_senior(pet)
        assert False, "Expected ValueError"
    except ValueError:
        pass


# ---------------------------------------------------------------------------
# check_old_age_death
# ---------------------------------------------------------------------------


def test_old_age_death_does_not_trigger_for_young_senior() -> None:
    """check_old_age_death has no effect when age_days is below threshold."""
    pet = make_adult_pet()
    pet.stage = "senior"
    pet.age_days = evolution.SENIOR_NATURAL_DEATH_AGE_DAYS - 1
    pet.health = 0
    evolution.check_old_age_death(pet)
    assert pet.alive is True


def test_old_age_death_triggers_when_old_and_health_zero() -> None:
    """check_old_age_death sets alive=False for an old senior with zero health."""
    pet = make_adult_pet()
    pet.stage = "senior"
    pet.age_days = evolution.SENIOR_NATURAL_DEATH_AGE_DAYS
    pet.health = config.HEALTH_DEATH_THRESHOLD
    evolution.check_old_age_death(pet)
    assert pet.alive is False


def test_old_age_death_emits_event() -> None:
    """check_old_age_death appends 'died_of_old_age'."""
    pet = make_adult_pet()
    pet.stage = "senior"
    pet.age_days = evolution.SENIOR_NATURAL_DEATH_AGE_DAYS
    pet.health = config.HEALTH_DEATH_THRESHOLD
    evolution.check_old_age_death(pet)
    assert "died_of_old_age" in pet.events


def test_old_age_death_no_effect_on_non_senior() -> None:
    """check_old_age_death is a no-op for non-senior stages."""
    pet = make_adult_pet()
    pet.stage = "adult"
    pet.age_days = 99
    pet.health = 0
    evolution.check_old_age_death(pet)
    assert pet.alive is True


# ---------------------------------------------------------------------------
# care_tier_label
# ---------------------------------------------------------------------------


def test_care_tier_label_excellent() -> None:
    """care_tier_label returns 'Excellent' for high scores."""
    label = evolution.care_tier_label(config.CARE_SCORE_BEST_TIER_THRESHOLD)
    assert label == "Excellent"


def test_care_tier_label_good() -> None:
    """care_tier_label returns 'Good' for mid-tier scores."""
    label = evolution.care_tier_label(config.CARE_SCORE_MID_TIER_THRESHOLD)
    assert label == "Good"


def test_care_tier_label_poor() -> None:
    """care_tier_label returns 'Poor' for low scores."""
    label = evolution.care_tier_label(0.0)
    assert label == "Poor"
