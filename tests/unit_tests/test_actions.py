"""Unit tests for python/actions.py.

Covers every action function: feed_meal, feed_snack, play, sleep, wake,
clean, give_medicine, scold, praise, apply_code_activity.
"""

import config
import actions
from pet import Pet


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def make_pet(**kwargs: object) -> Pet:
    """Create a default codeling pet with optional overrides."""
    pet = Pet(name="Testy", pet_type="codeling", color="neon")
    for key, value in kwargs.items():
        setattr(pet, key, value)
    return pet


# ---------------------------------------------------------------------------
# feed_meal
# ---------------------------------------------------------------------------


def test_feed_meal_increases_hunger() -> None:
    """feed_meal raises hunger by FEED_MEAL_HUNGER_BOOST."""
    pet = make_pet(hunger=30)
    actions.feed_meal(pet, meals_given_this_cycle=0)
    assert pet.hunger == 30 + config.FEED_MEAL_HUNGER_BOOST


def test_feed_meal_increases_weight() -> None:
    """feed_meal raises weight by FEED_MEAL_WEIGHT_GAIN."""
    pet = make_pet(weight=5)
    actions.feed_meal(pet, meals_given_this_cycle=0)
    assert pet.weight == 5 + config.FEED_MEAL_WEIGHT_GAIN


def test_feed_meal_refused_at_cycle_cap() -> None:
    """feed_meal is a no-op and emits meal_refused at the cycle cap."""
    pet = make_pet(hunger=30)
    actions.feed_meal(pet, meals_given_this_cycle=config.FEED_MEAL_MAX_PER_CYCLE)
    assert pet.hunger == 30
    assert "meal_refused" in pet.events


def test_feed_meal_resets_consecutive_snacks() -> None:
    """feed_meal clears the consecutive snack counter."""
    pet = make_pet(consecutive_snacks=2)
    actions.feed_meal(pet, meals_given_this_cycle=0)
    assert pet.consecutive_snacks == 0


def test_feed_meal_hunger_clamped_to_max() -> None:
    """Hunger does not exceed STAT_MAX after a meal."""
    pet = make_pet(hunger=95)
    actions.feed_meal(pet, meals_given_this_cycle=0)
    assert pet.hunger <= config.STAT_MAX


# ---------------------------------------------------------------------------
# feed_snack
# ---------------------------------------------------------------------------


def test_feed_snack_increases_happiness() -> None:
    """feed_snack raises happiness by FEED_SNACK_HAPPINESS_BOOST."""
    pet = make_pet(happiness=30)
    actions.feed_snack(pet)
    assert pet.happiness == 30 + config.FEED_SNACK_HAPPINESS_BOOST


def test_feed_snack_increases_weight() -> None:
    """feed_snack raises weight by FEED_SNACK_WEIGHT_GAIN."""
    pet = make_pet(weight=5)
    actions.feed_snack(pet)
    assert pet.weight == 5 + config.FEED_SNACK_WEIGHT_GAIN


def test_feed_snack_increments_consecutive_snacks() -> None:
    """Consecutive snack counter increases with each snack."""
    pet = make_pet(consecutive_snacks=0)
    actions.feed_snack(pet)
    assert pet.consecutive_snacks == 1


def test_feed_snack_triggers_sickness_at_threshold() -> None:
    """Pet becomes sick after MAX_CONSECUTIVE_SNACKS_BEFORE_SICK snacks in a row."""
    pet = make_pet(consecutive_snacks=config.MAX_CONSECUTIVE_SNACKS_BEFORE_SICK - 1)
    actions.feed_snack(pet)
    assert pet.sick is True
    assert "became_sick" in pet.events


def test_feed_snack_does_not_double_sick() -> None:
    """Sickness is not re-applied if the pet is already sick."""
    pet = make_pet(consecutive_snacks=config.MAX_CONSECUTIVE_SNACKS_BEFORE_SICK - 1)
    pet.sick = True
    actions.feed_snack(pet)
    assert "became_sick" not in pet.events


# ---------------------------------------------------------------------------
# play
# ---------------------------------------------------------------------------


def test_play_increases_happiness() -> None:
    """play raises happiness by PLAY_HAPPINESS_BOOST."""
    pet = make_pet(happiness=30, energy=50)
    actions.play(pet)
    assert pet.happiness == 30 + config.PLAY_HAPPINESS_BOOST


def test_play_costs_energy() -> None:
    """play reduces energy by PLAY_ENERGY_COST."""
    pet = make_pet(energy=50)
    actions.play(pet)
    assert pet.energy == 50 - config.PLAY_ENERGY_COST


def test_play_reduces_weight() -> None:
    """play reduces weight by PLAY_WEIGHT_LOSS."""
    pet = make_pet(weight=10, energy=50)
    actions.play(pet)
    assert pet.weight == 10 - config.PLAY_WEIGHT_LOSS


def test_play_refused_when_energy_zero() -> None:
    """play emits play_refused_no_energy when energy is zero."""
    pet = make_pet(energy=0, happiness=30)
    actions.play(pet)
    assert pet.happiness == 30
    assert "play_refused_no_energy" in pet.events


# ---------------------------------------------------------------------------
# sleep / wake
# ---------------------------------------------------------------------------


def test_sleep_sets_sleeping_flag() -> None:
    """sleep puts the pet to sleep."""
    pet = make_pet()
    actions.sleep(pet)
    assert pet.sleeping is True


def test_sleep_emits_fell_asleep() -> None:
    """sleep emits 'fell_asleep' event."""
    pet = make_pet()
    actions.sleep(pet)
    assert "fell_asleep" in pet.events


def test_sleep_no_op_when_already_sleeping() -> None:
    """sleep emits 'already_sleeping' when called on sleeping pet."""
    pet = make_pet()
    pet.sleeping = True
    actions.sleep(pet)
    assert "already_sleeping" in pet.events


def test_wake_clears_sleeping_flag() -> None:
    """wake wakes the pet up."""
    pet = make_pet()
    pet.sleeping = True
    actions.wake(pet)
    assert pet.sleeping is False


def test_wake_increments_age_days() -> None:
    """wake increments age_days."""
    pet = make_pet()
    pet.sleeping = True
    pet.age_days = 3
    actions.wake(pet)
    assert pet.age_days == 4


def test_wake_no_op_when_awake() -> None:
    """wake emits 'already_awake' when called on an awake pet."""
    pet = make_pet()
    actions.wake(pet)
    assert "already_awake" in pet.events


# ---------------------------------------------------------------------------
# clean
# ---------------------------------------------------------------------------


def test_clean_removes_poops() -> None:
    """clean resets poops to zero."""
    pet = make_pet(poops=3)
    actions.clean(pet)
    assert pet.poops == 0


def test_clean_emits_cleaned() -> None:
    """clean emits 'cleaned' event."""
    pet = make_pet(poops=2)
    actions.clean(pet)
    assert "cleaned" in pet.events


def test_clean_no_op_when_already_clean() -> None:
    """clean emits 'already_clean' when poops == 0."""
    pet = make_pet(poops=0)
    actions.clean(pet)
    assert "already_clean" in pet.events


# ---------------------------------------------------------------------------
# give_medicine
# ---------------------------------------------------------------------------


def test_medicine_increases_health() -> None:
    """give_medicine raises health when pet is sick."""
    pet = make_pet(health=50, sick=True)
    actions.give_medicine(pet)
    assert pet.health > 50


def test_medicine_cures_after_required_doses() -> None:
    """Pet is cured after MEDICINE_DOSES_TO_CURE doses."""
    pet = make_pet(sick=True, medicine_doses_given=config.MEDICINE_DOSES_TO_CURE - 1)
    actions.give_medicine(pet)
    assert pet.sick is False
    assert "cured" in pet.events


def test_medicine_no_op_when_healthy() -> None:
    """give_medicine has no effect on a healthy pet."""
    pet = make_pet(health=100, sick=False)
    actions.give_medicine(pet)
    assert "medicine_not_needed" in pet.events


# ---------------------------------------------------------------------------
# scold / praise
# ---------------------------------------------------------------------------


def test_scold_increases_discipline() -> None:
    """scold increases discipline by DISCIPLINE_BOOST_PER_ACTION."""
    pet = make_pet(discipline=30)
    actions.scold(pet)
    assert pet.discipline == 30 + config.DISCIPLINE_BOOST_PER_ACTION


def test_praise_increases_discipline() -> None:
    """praise increases discipline by DISCIPLINE_BOOST_PER_ACTION."""
    pet = make_pet(discipline=30)
    actions.praise(pet)
    assert pet.discipline == 30 + config.DISCIPLINE_BOOST_PER_ACTION


def test_discipline_clamped_to_max() -> None:
    """Discipline does not exceed STAT_MAX after praise."""
    pet = make_pet(discipline=98)
    actions.praise(pet)
    assert pet.discipline <= config.STAT_MAX


# ---------------------------------------------------------------------------
# apply_code_activity
# ---------------------------------------------------------------------------


def test_code_activity_increases_happiness() -> None:
    """apply_code_activity boosts happiness by CODE_ACTIVITY_HAPPINESS_BOOST."""
    pet = make_pet(happiness=40)
    actions.apply_code_activity(pet)
    assert pet.happiness == 40 + config.CODE_ACTIVITY_HAPPINESS_BOOST


def test_code_activity_increases_discipline() -> None:
    """apply_code_activity boosts discipline by CODE_ACTIVITY_DISCIPLINE_BOOST."""
    pet = make_pet(discipline=40)
    actions.apply_code_activity(pet)
    assert pet.discipline == 40 + config.CODE_ACTIVITY_DISCIPLINE_BOOST


def test_code_activity_emits_event() -> None:
    """apply_code_activity emits 'code_activity_rewarded'."""
    pet = make_pet()
    actions.apply_code_activity(pet)
    assert "code_activity_rewarded" in pet.events
