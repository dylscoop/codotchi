"""Pure action functions for the vscode_gotchi game engine.

Every function in this module takes a Pet and returns a modified copy (or
modifies the passed-in pet in place and returns it).  All business rules live
here; game_engine.py is responsible only for dispatch and I/O.

Design principle: no side effects beyond mutating the pet that is explicitly
passed in.  No global state, no I/O.
"""

import config
from pet import Pet


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _clamp_stat(value: int) -> int:
    """Clamp a standard 0–100 stat."""
    return max(config.STAT_MIN, min(config.STAT_MAX, value))


def _clamp_weight(value: int) -> int:
    """Clamp weight to the valid range."""
    return max(config.WEIGHT_MIN, min(config.WEIGHT_MAX, value))


# ---------------------------------------------------------------------------
# Feeding
# ---------------------------------------------------------------------------


def feed_meal(pet: Pet, meals_given_this_cycle: int) -> Pet:
    """Give the pet a meal.

    Raises no error if the cycle cap is exceeded; the extra meal is a no-op
    and an ``"meal_refused"`` event is appended instead.

    Args:
        pet: The pet to feed.
        meals_given_this_cycle: How many meals have already been given this
            in-game cycle (resets when the pet falls asleep).

    Returns:
        The same pet object, mutated.
    """
    pet.events = []
    if meals_given_this_cycle >= config.FEED_MEAL_MAX_PER_CYCLE:
        pet.events.append("meal_refused")
        return pet

    pet.hunger = _clamp_stat(pet.hunger + config.FEED_MEAL_HUNGER_BOOST)
    pet.weight = _clamp_weight(pet.weight + config.FEED_MEAL_WEIGHT_GAIN)
    pet.consecutive_snacks = 0
    pet.events.append("fed_meal")
    return pet


def feed_snack(pet: Pet) -> Pet:
    """Give the pet a snack.

    Three or more snacks in a row trigger sickness.

    Args:
        pet: The pet to give a snack to.

    Returns:
        The same pet object, mutated.
    """
    pet.events = []
    pet.happiness = _clamp_stat(pet.happiness + config.FEED_SNACK_HAPPINESS_BOOST)
    pet.weight = _clamp_weight(pet.weight + config.FEED_SNACK_WEIGHT_GAIN)
    pet.consecutive_snacks += 1

    if pet.consecutive_snacks >= config.MAX_CONSECUTIVE_SNACKS_BEFORE_SICK:
        if not pet.sick:
            pet.sick = True
            pet.events.append("became_sick")

    pet.events.append("fed_snack")
    return pet


# ---------------------------------------------------------------------------
# Play
# ---------------------------------------------------------------------------


def play(pet: Pet) -> Pet:
    """Initiate a play session (stat deltas only; mini-game result handled
    separately by minigames.py).

    Energy must be above zero; if the pet has no energy the action is refused.

    Args:
        pet: The pet to play with.

    Returns:
        The same pet object, mutated.
    """
    pet.events = []
    if pet.energy <= 0:
        pet.events.append("play_refused_no_energy")
        return pet

    pet.happiness = _clamp_stat(pet.happiness + config.PLAY_HAPPINESS_BOOST)
    pet.energy = _clamp_stat(pet.energy - config.PLAY_ENERGY_COST)
    pet.weight = _clamp_weight(pet.weight - config.PLAY_WEIGHT_LOSS)
    pet.consecutive_snacks = 0
    pet.events.append("played")
    return pet


# ---------------------------------------------------------------------------
# Sleep / wake
# ---------------------------------------------------------------------------


def sleep(pet: Pet) -> Pet:
    """Put the pet to sleep.

    If the pet is already sleeping the call is a no-op.

    Args:
        pet: The pet to put to sleep.

    Returns:
        The same pet object, mutated.
    """
    pet.events = []
    if pet.sleeping:
        pet.events.append("already_sleeping")
        return pet
    pet.sleeping = True
    pet.events.append("fell_asleep")
    return pet


def wake(pet: Pet) -> Pet:
    """Wake the pet up.

    Increments age_days.  If the pet is not sleeping the call is a no-op.

    Args:
        pet: The pet to wake up.

    Returns:
        The same pet object, mutated.
    """
    pet.events = []
    if not pet.sleeping:
        pet.events.append("already_awake")
        return pet
    pet.sleeping = False
    pet.age_days += 1
    pet.events.append("woke_up")
    return pet


# ---------------------------------------------------------------------------
# Hygiene
# ---------------------------------------------------------------------------


def clean(pet: Pet) -> Pet:
    """Remove all droppings.

    If poops == 0 the call is a no-op.

    Args:
        pet: The pet whose environment to clean.

    Returns:
        The same pet object, mutated.
    """
    pet.events = []
    if pet.poops == 0:
        pet.events.append("already_clean")
        return pet
    pet.poops = 0
    pet.ticks_since_last_poop = 0
    pet.events.append("cleaned")
    return pet


# ---------------------------------------------------------------------------
# Medicine
# ---------------------------------------------------------------------------


def give_medicine(pet: Pet) -> Pet:
    """Administer one dose of medicine.

    After ``config.MEDICINE_DOSES_TO_CURE`` consecutive doses the pet is
    cured.  Giving medicine to a healthy pet has no effect.

    Args:
        pet: The pet to treat.

    Returns:
        The same pet object, mutated.
    """
    pet.events = []
    if not pet.sick:
        pet.events.append("medicine_not_needed")
        return pet

    pet.health = _clamp_stat(pet.health + config.MEDICINE_HEALTH_BOOST)
    pet.medicine_doses_given += 1
    pet.events.append("medicine_given")

    if pet.medicine_doses_given >= config.MEDICINE_DOSES_TO_CURE:
        pet.sick = False
        pet.medicine_doses_given = 0
        pet.events.append("cured")

    return pet


# ---------------------------------------------------------------------------
# Discipline
# ---------------------------------------------------------------------------


def scold(pet: Pet) -> Pet:
    """Scold the pet to raise discipline.

    Args:
        pet: The pet to scold.

    Returns:
        The same pet object, mutated.
    """
    pet.events = []
    pet.discipline = _clamp_stat(pet.discipline + config.DISCIPLINE_BOOST_PER_ACTION)
    pet.events.append("scolded")
    return pet


def praise(pet: Pet) -> Pet:
    """Praise the pet to raise discipline.

    Args:
        pet: The pet to praise.

    Returns:
        The same pet object, mutated.
    """
    pet.events = []
    pet.discipline = _clamp_stat(pet.discipline + config.DISCIPLINE_BOOST_PER_ACTION)
    pet.events.append("praised")
    return pet


# ---------------------------------------------------------------------------
# Coding activity reward
# ---------------------------------------------------------------------------


def apply_code_activity(pet: Pet) -> Pet:
    """Apply the code-activity happiness and discipline boost.

    Throttling is enforced by the caller (game_engine.py); this function
    unconditionally applies the deltas.

    Args:
        pet: The pet to reward.

    Returns:
        The same pet object, mutated.
    """
    pet.events = []
    pet.happiness = _clamp_stat(pet.happiness + config.CODE_ACTIVITY_HAPPINESS_BOOST)
    pet.discipline = _clamp_stat(pet.discipline + config.CODE_ACTIVITY_DISCIPLINE_BOOST)
    pet.events.append("code_activity_rewarded")
    return pet
