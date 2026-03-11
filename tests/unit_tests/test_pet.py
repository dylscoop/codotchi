"""Unit tests for python/pet.py.

Covers: stat clamping, tick decay, starvation damage, sickness via poops,
evolution stage transitions, care-score accumulation, serialisation round-trip,
offline decay cap.
"""

import config
from pet import Pet


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


def make_pet(**kwargs: object) -> Pet:
    """Create a default codeling pet with optional stat overrides."""
    defaults: dict[str, object] = {
        "name": "Testy",
        "pet_type": "codeling",
        "color": "neon",
        "hunger": 50,
        "happiness": 50,
        "energy": 100,
        "health": 100,
    }
    defaults.update(kwargs)
    pet = Pet(
        name=str(defaults["name"]),
        pet_type=str(defaults["pet_type"]),
        color=str(defaults["color"]),
    )
    for key, value in defaults.items():
        if key not in {"name", "pet_type", "color"}:
            setattr(pet, key, value)
    return pet


# ---------------------------------------------------------------------------
# Stat boundaries
# ---------------------------------------------------------------------------


def test_hunger_does_not_go_below_zero() -> None:
    """Hunger stat is clamped to STAT_MIN on decay."""
    pet = make_pet(hunger=1)
    # Tick enough times to drain hunger to zero
    for _ in range(10):
        pet.tick()
    assert pet.hunger == config.STAT_MIN


def test_energy_does_not_exceed_max_while_sleeping() -> None:
    """Energy regeneration is clamped to STAT_MAX."""
    pet = make_pet(energy=99)
    pet.sleeping = True
    pet.tick()
    assert pet.energy == config.STAT_MAX


# ---------------------------------------------------------------------------
# Per-tick decay
# ---------------------------------------------------------------------------


def test_hunger_decays_each_tick() -> None:
    """Hunger decreases by at least 1 per tick when awake."""
    pet = make_pet(hunger=80)
    initial_hunger = pet.hunger
    pet.tick()
    assert pet.hunger < initial_hunger


def test_happiness_decays_each_tick() -> None:
    """Happiness decreases by at least 1 per tick when awake."""
    pet = make_pet(happiness=80)
    initial_happiness = pet.happiness
    pet.tick()
    assert pet.happiness < initial_happiness


def test_hunger_does_not_decay_while_sleeping() -> None:
    """Hunger is frozen while the pet is asleep."""
    pet = make_pet(hunger=50)
    pet.sleeping = True
    pet.tick()
    assert pet.hunger == 50


# ---------------------------------------------------------------------------
# Starvation
# ---------------------------------------------------------------------------


def test_starvation_damage_begins_after_threshold_ticks() -> None:
    """Health drops after HUNGER_ZERO_TICKS_BEFORE_RISK consecutive zero-hunger ticks."""
    pet = make_pet(hunger=0, health=100)
    # Tick up to threshold without damage
    for _ in range(config.HUNGER_ZERO_TICKS_BEFORE_RISK - 1):
        pet.tick()
    health_before = pet.health
    pet.tick()  # This tick should trigger damage
    assert pet.health < health_before


def test_no_starvation_damage_before_threshold() -> None:
    """Health is unaffected before the starvation threshold is reached."""
    pet = make_pet(hunger=0, health=100)
    for _ in range(config.HUNGER_ZERO_TICKS_BEFORE_RISK - 1):
        pet.tick()
    assert pet.health == 100


# ---------------------------------------------------------------------------
# Sickness via poop accumulation
# ---------------------------------------------------------------------------


def test_pet_becomes_sick_after_too_many_poops() -> None:
    """Pet becomes sick when uncleaned poops reach the threshold."""
    pet = make_pet()
    pet.poops = config.MAX_UNCLEANED_POOPS_BEFORE_SICK
    pet.tick()
    assert pet.sick is True


def test_sick_event_emitted() -> None:
    """A 'became_sick' event is appended when sickness triggers."""
    pet = make_pet()
    pet.poops = config.MAX_UNCLEANED_POOPS_BEFORE_SICK
    pet.tick()
    assert "became_sick" in pet.events


# ---------------------------------------------------------------------------
# Death
# ---------------------------------------------------------------------------


def test_pet_dies_when_health_reaches_zero() -> None:
    """Pet is marked not alive when health reaches zero."""
    pet = make_pet(health=1, hunger=0)
    pet.hunger_zero_ticks = config.HUNGER_ZERO_TICKS_BEFORE_RISK
    # Force health to zero in one tick
    pet.tick()
    assert pet.alive is False or pet.health == 0


def test_dead_pet_does_not_tick() -> None:
    """A dead pet's stats do not change after the fatal tick."""
    pet = make_pet(health=0)
    pet.alive = False
    snapshot = pet.to_dict()
    pet.tick()
    assert pet.to_dict() == snapshot


# ---------------------------------------------------------------------------
# Stage progression
# ---------------------------------------------------------------------------


def test_pet_evolves_from_egg_to_baby() -> None:
    """Pet transitions from egg to baby after EGG_DURATION_TICKS ticks."""
    pet = make_pet()
    pet.stage = "egg"
    pet.ticks_alive = 0
    for _ in range(config.EGG_DURATION_TICKS):
        pet.tick()
    assert pet.stage == "baby"


def test_evolved_to_baby_event_emitted() -> None:
    """An 'evolved_to_baby' event appears when transitioning from egg."""
    pet = make_pet()
    pet.stage = "egg"
    pet.ticks_alive = config.EGG_DURATION_TICKS - 1
    pet.tick()
    assert "evolved_to_baby" in pet.events


def test_ticks_alive_resets_on_evolution() -> None:
    """ticks_alive resets to 0 when the pet evolves."""
    pet = make_pet()
    pet.stage = "egg"
    pet.ticks_alive = config.EGG_DURATION_TICKS - 1
    pet.tick()
    assert pet.ticks_alive == 0


# ---------------------------------------------------------------------------
# Care score
# ---------------------------------------------------------------------------


def test_care_score_is_neutral_before_any_ticks() -> None:
    """care_score returns 0.5 when no ticks have been accumulated."""
    pet = make_pet()
    assert pet.care_score == 0.5


def test_care_score_is_within_bounds() -> None:
    """care_score stays in [0.0, 1.0] after several ticks."""
    pet = make_pet(hunger=80, happiness=80)
    for _ in range(10):
        pet.tick()
    assert 0.0 <= pet.care_score <= 1.0


# ---------------------------------------------------------------------------
# Serialisation round-trip
# ---------------------------------------------------------------------------


def test_round_trip_preserves_stats() -> None:
    """Pet.from_dict(pet.to_dict()) returns an identical stat snapshot."""
    pet = make_pet(hunger=42, happiness=77, discipline=33)
    restored = Pet.from_dict(pet.to_dict())
    assert restored.hunger == 42
    assert restored.happiness == 77
    assert restored.discipline == 33
    assert restored.name == pet.name
    assert restored.pet_type == pet.pet_type


def test_round_trip_preserves_booleans() -> None:
    """Boolean fields survive serialisation."""
    pet = make_pet()
    pet.sick = True
    pet.sleeping = True
    restored = Pet.from_dict(pet.to_dict())
    assert restored.sick is True
    assert restored.sleeping is True


# ---------------------------------------------------------------------------
# Offline decay
# ---------------------------------------------------------------------------


def test_offline_decay_reduces_hunger() -> None:
    """apply_offline_decay reduces hunger proportional to elapsed time."""
    pet = make_pet(hunger=100)
    pet.apply_offline_decay(elapsed_seconds=300)
    assert pet.hunger < 100


def test_offline_decay_capped_at_max_fraction() -> None:
    """Offline decay never reduces a stat by more than OFFLINE_DECAY_MAX_FRACTION."""
    pet = make_pet(hunger=100, happiness=100)
    # Simulate a very long offline period
    pet.apply_offline_decay(elapsed_seconds=10_000_000)
    min_allowed_hunger = 100 - int(100 * config.OFFLINE_DECAY_MAX_FRACTION)
    assert pet.hunger >= min_allowed_hunger


def test_offline_decay_does_not_affect_dead_pet() -> None:
    """apply_offline_decay has no effect on a dead pet."""
    pet = make_pet(hunger=50)
    pet.alive = False
    pet.apply_offline_decay(elapsed_seconds=3600)
    assert pet.hunger == 50


# ---------------------------------------------------------------------------
# Mood property
# ---------------------------------------------------------------------------


def test_mood_is_sleeping_when_sleeping() -> None:
    """Mood returns 'sleeping' regardless of other stats when asleep."""
    pet = make_pet(happiness=0, health=0)
    pet.sleeping = True
    assert pet.mood == "sleeping"


def test_mood_is_happy_when_stats_are_high() -> None:
    """Mood returns 'happy' when hunger and happiness are both healthy."""
    pet = make_pet(hunger=80, happiness=80, health=80)
    assert pet.mood == "happy"
