"""All tunable constants for the vscode_gotchi game engine.

Centralising every magic number here means the rest of the codebase
never contains bare literals for decay rates, thresholds, or timings.
"""

# ---------------------------------------------------------------------------
# Tick timing
# ---------------------------------------------------------------------------

TICK_INTERVAL_SECONDS: int = 5
"""How many real-world seconds elapse between each game tick."""

TICKS_PER_MINUTE: int = 60 // TICK_INTERVAL_SECONDS
TICKS_PER_HOUR: int = 60 * TICKS_PER_MINUTE
TICKS_PER_DAY: int = 24 * TICKS_PER_HOUR

# ---------------------------------------------------------------------------
# Stage durations (in ticks)
# ---------------------------------------------------------------------------

EGG_DURATION_TICKS: int = 2 * TICKS_PER_MINUTE
BABY_DURATION_TICKS: int = 10 * TICKS_PER_MINUTE
CHILD_DURATION_TICKS: int = 1 * TICKS_PER_HOUR
TEEN_DURATION_TICKS: int = 3 * TICKS_PER_HOUR

# ---------------------------------------------------------------------------
# Stat boundaries
# ---------------------------------------------------------------------------

STAT_MIN: int = 0
STAT_MAX: int = 100

WEIGHT_MIN: int = 1
WEIGHT_MAX: int = 99

# ---------------------------------------------------------------------------
# Base decay rates per tick (applied to all pet types unless overridden)
# ---------------------------------------------------------------------------

HUNGER_DECAY_PER_TICK: int = 1
HAPPINESS_DECAY_PER_TICK: int = 1
ENERGY_REGEN_PER_TICK_SLEEPING: int = 3
ENERGY_DECAY_PER_TICK_AWAKE: int = 0  # energy only drains via play

# ---------------------------------------------------------------------------
# Danger thresholds
# ---------------------------------------------------------------------------

HUNGER_CRITICAL_THRESHOLD: int = 10
HAPPINESS_CRITICAL_THRESHOLD: int = 10
HEALTH_DEATH_THRESHOLD: int = 0
HUNGER_ZERO_TICKS_BEFORE_RISK: int = 3
"""Consecutive ticks at hunger == 0 before health starts dropping."""

CRITICAL_HEALTH_DAMAGE_PER_TICK: int = 5
"""Health lost per tick when starving or happiness-critical."""

# ---------------------------------------------------------------------------
# Sickness triggers
# ---------------------------------------------------------------------------

MAX_CONSECUTIVE_SNACKS_BEFORE_SICK: int = 3
MAX_UNCLEANED_POOPS_BEFORE_SICK: int = 3
POOP_TICKS_INTERVAL: int = 20 * TICKS_PER_MINUTE
"""Roughly how many ticks between droppings."""

# ---------------------------------------------------------------------------
# Action effect magnitudes
# ---------------------------------------------------------------------------

FEED_MEAL_HUNGER_BOOST: int = 20
FEED_MEAL_WEIGHT_GAIN: int = 1
FEED_MEAL_MAX_PER_CYCLE: int = 4

FEED_SNACK_HAPPINESS_BOOST: int = 10
FEED_SNACK_WEIGHT_GAIN: int = 2

PLAY_HAPPINESS_BOOST: int = 15
PLAY_ENERGY_COST: int = 10
PLAY_WEIGHT_LOSS: int = 1

MEDICINE_HEALTH_BOOST: int = 20
MEDICINE_DOSES_TO_CURE: int = 3

DISCIPLINE_BOOST_PER_ACTION: int = 10

CODE_ACTIVITY_HAPPINESS_BOOST: int = 5
CODE_ACTIVITY_DISCIPLINE_BOOST: int = 2
CODE_ACTIVITY_THROTTLE_SECONDS: int = 30

# ---------------------------------------------------------------------------
# Mini-game stat deltas
# ---------------------------------------------------------------------------

MINIGAME_WIN_HAPPINESS_BOOST: int = 15
MINIGAME_LOSE_HAPPINESS_BOOST: int = 5
MINIGAME_MEMORY_WIN_HAPPINESS_BOOST: int = 20

# ---------------------------------------------------------------------------
# Evolution / care-score weights
# ---------------------------------------------------------------------------

CARE_SCORE_HUNGER_WEIGHT: float = 0.30
CARE_SCORE_HAPPINESS_WEIGHT: float = 0.25
CARE_SCORE_DISCIPLINE_WEIGHT: float = 0.20
CARE_SCORE_CLEANLINESS_WEIGHT: float = 0.15
CARE_SCORE_HEALTH_WEIGHT: float = 0.10

CARE_SCORE_BEST_TIER_THRESHOLD: float = 0.80
CARE_SCORE_MID_TIER_THRESHOLD: float = 0.55

# ---------------------------------------------------------------------------
# Offline decay cap
# ---------------------------------------------------------------------------

OFFLINE_DECAY_MAX_FRACTION: float = 0.60
"""Maximum fraction of any stat that can be lost while the extension is off."""
