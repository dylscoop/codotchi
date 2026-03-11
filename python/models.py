"""Pet type definitions, evolution character trees, and colour palettes.

All data here is read-only at runtime. Nothing in this module mutates state.
"""

from dataclasses import dataclass

import config


# ---------------------------------------------------------------------------
# Colour palettes
# ---------------------------------------------------------------------------

COLOUR_PALETTES: dict[str, dict[str, str]] = {
    "neon": {
        "primary": "#39ff14",
        "secondary": "#ff00ff",
        "background": "#0d0d0d",
    },
    "pastel": {
        "primary": "#ffb3c1",
        "secondary": "#b5ead7",
        "background": "#fdf6ec",
    },
    "mono": {
        "primary": "#e0e0e0",
        "secondary": "#888888",
        "background": "#1a1a1a",
    },
    "ocean": {
        "primary": "#00cfff",
        "secondary": "#004e7c",
        "background": "#001f3f",
    },
}

DEFAULT_COLOUR: str = "neon"


# ---------------------------------------------------------------------------
# Per-type stat modifiers
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class PetTypeModifiers:
    """Multipliers and overrides applied on top of base config constants.

    All multiplier fields default to 1.0 (no change).  A value of 1.5 means
    the stat decays 50 % faster than the base rate.
    """

    hunger_decay_multiplier: float = 1.0
    happiness_decay_multiplier: float = 1.0
    base_health: int = 100
    energy_regen_multiplier: float = 1.0


PET_TYPE_MODIFIERS: dict[str, PetTypeModifiers] = {
    "codeling": PetTypeModifiers(),
    "bytebug": PetTypeModifiers(
        hunger_decay_multiplier=1.5,
        energy_regen_multiplier=1.2,
    ),
    "pixelpup": PetTypeModifiers(
        happiness_decay_multiplier=1.5,
    ),
    "shellscript": PetTypeModifiers(
        base_health=120,
        hunger_decay_multiplier=0.8,
    ),
}

VALID_PET_TYPES: tuple[str, ...] = tuple(PET_TYPE_MODIFIERS.keys())


# ---------------------------------------------------------------------------
# Life-stage ordering
# ---------------------------------------------------------------------------

STAGE_ORDER: list[str] = [
    "egg",
    "baby",
    "child",
    "teen",
    "adult",
    "senior",
]


def stage_index(stage: str) -> int:
    """Return the ordinal position of *stage* in the life-cycle sequence.

    Raises ValueError for unknown stage names.
    """
    return STAGE_ORDER.index(stage)


# ---------------------------------------------------------------------------
# Evolution character trees
# ---------------------------------------------------------------------------
# Each pet_type has a mapping from stage → tier → character name.
# Tiers: "best", "mid", "low" — selected by care_score at evolution time.


EVOLUTION_CHARACTERS: dict[str, dict[str, dict[str, str]]] = {
    "codeling": {
        "baby": {
            "best": "codeling_baby_a",
            "mid": "codeling_baby_b",
            "low": "codeling_baby_c",
        },  # noqa: E241
        "child": {
            "best": "codeling_child_a",
            "mid": "codeling_child_b",
            "low": "codeling_child_c",
        },  # noqa: E241
        "teen": {
            "best": "codeling_teen_a",
            "mid": "codeling_teen_b",
            "low": "codeling_teen_c",
        },  # noqa: E241
        "adult": {
            "best": "codeling_adult_a",
            "mid": "codeling_adult_b",
            "low": "codeling_adult_c",
        },  # noqa: E241
        "senior": {
            "best": "codeling_senior_a",
            "mid": "codeling_senior_b",
            "low": "codeling_senior_c",
        },  # noqa: E241,E231
    },
    "bytebug": {
        "baby": {
            "best": "bytebug_baby_a",
            "mid": "bytebug_baby_b",
            "low": "bytebug_baby_c",
        },  # noqa: E241
        "child": {
            "best": "bytebug_child_a",
            "mid": "bytebug_child_b",
            "low": "bytebug_child_c",
        },  # noqa: E241
        "teen": {
            "best": "bytebug_teen_a",
            "mid": "bytebug_teen_b",
            "low": "bytebug_teen_c",
        },  # noqa: E241
        "adult": {
            "best": "bytebug_adult_a",
            "mid": "bytebug_adult_b",
            "low": "bytebug_adult_c",
        },  # noqa: E241
        "senior": {
            "best": "bytebug_senior_a",
            "mid": "bytebug_senior_b",
            "low": "bytebug_senior_c",
        },  # noqa: E241,E231
    },
    "pixelpup": {
        "baby": {
            "best": "pixelpup_baby_a",
            "mid": "pixelpup_baby_b",
            "low": "pixelpup_baby_c",
        },  # noqa: E241
        "child": {
            "best": "pixelpup_child_a",
            "mid": "pixelpup_child_b",
            "low": "pixelpup_child_c",
        },  # noqa: E241
        "teen": {
            "best": "pixelpup_teen_a",
            "mid": "pixelpup_teen_b",
            "low": "pixelpup_teen_c",
        },  # noqa: E241
        "adult": {
            "best": "pixelpup_adult_a",
            "mid": "pixelpup_adult_b",
            "low": "pixelpup_adult_c",
        },  # noqa: E241
        "senior": {
            "best": "pixelpup_senior_a",
            "mid": "pixelpup_senior_b",
            "low": "pixelpup_senior_c",
        },  # noqa: E241,E231
    },
    "shellscript": {
        "baby": {
            "best": "shellscript_baby_a",
            "mid": "shellscript_baby_b",
            "low": "shellscript_baby_c",
        },  # noqa: E241
        "child": {
            "best": "shellscript_child_a",
            "mid": "shellscript_child_b",
            "low": "shellscript_child_c",
        },  # noqa: E241
        "teen": {
            "best": "shellscript_teen_a",
            "mid": "shellscript_teen_b",
            "low": "shellscript_teen_c",
        },  # noqa: E241
        "adult": {
            "best": "shellscript_adult_a",
            "mid": "shellscript_adult_b",
            "low": "shellscript_adult_c",
        },  # noqa: E241
        "senior": {
            "best": "shellscript_senior_a",
            "mid": "shellscript_senior_b",
            "low": "shellscript_senior_c",
        },  # noqa: E241,E231
    },
}


def tier_from_care_score(care_score: float) -> str:
    """Return the evolution tier string for the given *care_score*.

    Returns one of ``"best"``, ``"mid"``, or ``"low"``.
    """
    if care_score >= config.CARE_SCORE_BEST_TIER_THRESHOLD:
        return "best"
    if care_score >= config.CARE_SCORE_MID_TIER_THRESHOLD:
        return "mid"
    return "low"


def character_for_stage(
    pet_type: str,
    stage: str,
    care_score: float,
) -> str:
    """Resolve the character name for *pet_type* at *stage* given *care_score*.

    Raises KeyError if *pet_type* or *stage* is unknown.
    """
    tier = tier_from_care_score(care_score)
    return EVOLUTION_CHARACTERS[pet_type][stage][tier]


# ---------------------------------------------------------------------------
# Mood derivation
# ---------------------------------------------------------------------------


def mood_from_stats(
    hunger: int,
    happiness: int,
    health: int,
    sleeping: bool,
) -> str:
    """Derive a mood label from current stats.

    Returns one of: ``"sleeping"``, ``"sick"``, ``"sad"``,
    ``"neutral"``, ``"happy"``.
    """
    if sleeping:
        return "sleeping"
    if health < 30:
        return "sick"
    if hunger < config.HUNGER_CRITICAL_THRESHOLD:
        return "sad"
    if happiness < config.HAPPINESS_CRITICAL_THRESHOLD:
        return "sad"
    if happiness >= 70 and hunger >= 50:
        return "happy"
    return "neutral"
