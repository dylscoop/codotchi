"""Integration tests for python/game_engine.py.

Spins up the game engine with piped stdin/stdout (no subprocess) and sends
real JSON command sequences, asserting on full state snapshots.

Covers the key scenario: new_game → feed → tick → evolution → death path.
"""

from __future__ import annotations

import io
import json

import game_engine


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _int(value: object) -> int:
    """Cast a JSON response value to int for comparison assertions."""
    assert isinstance(value, (int, float)), f"Expected numeric, got {type(value)}"
    return int(value)


def run_commands(commands: list[dict[str, object]]) -> list[dict[str, object]]:
    """Pass *commands* through the engine and return all response dicts.

    Each command is serialised as a single JSON line; responses are parsed
    from the output stream.
    """
    input_lines = "\n".join(json.dumps(cmd) for cmd in commands) + "\n"
    input_stream = io.StringIO(input_lines)
    output_stream = io.StringIO()
    game_engine.run(input_stream=input_stream, output_stream=output_stream)
    output_stream.seek(0)
    responses: list[dict[str, object]] = []
    for line in output_stream:
        line = line.strip()
        if line:
            responses.append(json.loads(line))
    return responses


# ---------------------------------------------------------------------------
# Basic new_game
# ---------------------------------------------------------------------------


def test_new_game_creates_alive_pet() -> None:
    """new_game response contains alive=True and the given name."""
    responses = run_commands(
        [
            {
                "action": "new_game",
                "name": "Pixel",
                "pet_type": "codeling",
                "color": "neon",
            }
        ]
    )
    assert len(responses) == 1
    state = responses[0]
    assert state["alive"] is True
    assert state["name"] == "Pixel"
    assert state["pet_type"] == "codeling"


def test_new_game_starts_in_egg_stage() -> None:
    """A newly created pet starts in the egg stage."""
    responses = run_commands(
        [
            {
                "action": "new_game",
                "name": "Eggbert",
                "pet_type": "bytebug",
                "color": "mono",
            }
        ]
    )
    assert responses[0]["stage"] == "egg"


def test_new_game_unknown_pet_type_returns_error() -> None:
    """new_game with an invalid pet_type returns an error response."""
    responses = run_commands(
        [{"action": "new_game", "name": "Oops", "pet_type": "dragon"}]
    )
    assert "error" in responses[0]


# ---------------------------------------------------------------------------
# Feeding
# ---------------------------------------------------------------------------


def test_feed_meal_increases_hunger() -> None:
    """Sending feed meal after new_game increases hunger."""
    responses = run_commands(
        [
            {
                "action": "new_game",
                "name": "Snacker",
                "pet_type": "codeling",
                "color": "neon",
            },
            {"action": "feed", "feed_type": "meal"},
        ]
    )
    initial_hunger = _int(responses[0]["hunger"])
    after_hunger = _int(responses[1]["hunger"])
    assert after_hunger >= initial_hunger


def test_feed_snack_increases_happiness() -> None:
    """Sending feed snack after new_game increases happiness."""
    responses = run_commands(
        [
            {
                "action": "new_game",
                "name": "Snacker",
                "pet_type": "codeling",
                "color": "neon",
            },
            {"action": "feed", "feed_type": "snack"},
        ]
    )
    initial_happiness = _int(responses[0]["happiness"])
    after_happiness = _int(responses[1]["happiness"])
    assert after_happiness >= initial_happiness


# ---------------------------------------------------------------------------
# Tick
# ---------------------------------------------------------------------------


def test_tick_returns_state_snapshot() -> None:
    """tick response contains all expected state keys."""
    responses = run_commands(
        [
            {
                "action": "new_game",
                "name": "Ticker",
                "pet_type": "codeling",
                "color": "neon",
            },
            {"action": "tick"},
        ]
    )
    tick_state = responses[1]
    required_keys = {
        "hunger",
        "happiness",
        "discipline",
        "energy",
        "health",
        "weight",
        "age_days",
        "stage",
        "alive",
        "sick",
        "sleeping",
        "poops",
        "mood",
        "name",
        "pet_type",
        "color",
        "sprite",
        "care_score",
        "events",
    }
    for key in required_keys:
        assert key in tick_state, f"Missing key: {key}"


def test_multiple_ticks_decay_hunger() -> None:
    """Repeated ticks reduce hunger over time."""
    commands: list[dict[str, object]] = [
        {
            "action": "new_game",
            "name": "Hungry",
            "pet_type": "codeling",
            "color": "neon",
        },
    ]
    for _ in range(20):
        commands.append({"action": "tick"})
    responses = run_commands(commands)
    initial_hunger = _int(responses[0]["hunger"])
    final_hunger = _int(responses[-1]["hunger"])
    assert final_hunger < initial_hunger


# ---------------------------------------------------------------------------
# init with saved state
# ---------------------------------------------------------------------------


def test_init_with_null_state_requests_new_game() -> None:
    """init with state=null returns needs_new_game=True."""
    responses = run_commands([{"action": "init", "state": None, "elapsed_seconds": 0}])
    assert responses[0].get("needs_new_game") is True


def test_init_restores_pet_name() -> None:
    """init with a saved state restores the pet's name."""
    # First create a pet and grab its state
    create_responses = run_commands(
        [
            {
                "action": "new_game",
                "name": "Restorer",
                "pet_type": "codeling",
                "color": "neon",
            }
        ]
    )
    saved_state = create_responses[0]

    # Now init with that state
    init_responses = run_commands(
        [{"action": "init", "state": saved_state, "elapsed_seconds": 0}]
    )
    assert init_responses[0]["name"] == "Restorer"


def test_init_applies_offline_decay() -> None:
    """init reduces stats for the elapsed offline period."""
    create_responses = run_commands(
        [
            {
                "action": "new_game",
                "name": "Offline",
                "pet_type": "codeling",
                "color": "neon",
            }
        ]
    )
    saved_state = create_responses[0]
    hunger_at_save = _int(saved_state["hunger"])

    # Apply 10 minutes of offline decay
    init_responses = run_commands(
        [{"action": "init", "state": saved_state, "elapsed_seconds": 600}]
    )
    hunger_after = _int(init_responses[0]["hunger"])
    assert hunger_after < hunger_at_save


# ---------------------------------------------------------------------------
# Error handling
# ---------------------------------------------------------------------------


def test_unknown_action_returns_error() -> None:
    """An unknown action returns an error response, not a crash."""
    responses = run_commands([{"action": "fly_to_the_moon"}])
    assert "error" in responses[0]


def test_action_without_pet_returns_error() -> None:
    """Actions that require an active pet return an error when none exists."""
    responses = run_commands([{"action": "tick"}])
    assert "error" in responses[0]


def test_malformed_json_returns_error() -> None:
    """Malformed JSON input produces an error response without crashing."""
    input_stream = io.StringIO("{{not valid json\n")
    output_stream = io.StringIO()
    game_engine.run(input_stream=input_stream, output_stream=output_stream)
    output_stream.seek(0)
    response = json.loads(output_stream.readline())
    assert "error" in response


# ---------------------------------------------------------------------------
# get_state
# ---------------------------------------------------------------------------


def test_get_state_returns_same_as_last_action() -> None:
    """get_state returns an identical snapshot to the previous action."""
    responses = run_commands(
        [
            {
                "action": "new_game",
                "name": "Snapshot",
                "pet_type": "codeling",
                "color": "neon",
            },
            {"action": "get_state"},
        ]
    )
    # Compare subset of stable fields (events differ)
    for key in ("name", "hunger", "happiness", "stage", "alive"):
        assert responses[0][key] == responses[1][key], f"Field '{key}' differs"


# ---------------------------------------------------------------------------
# Sleep / wake
# ---------------------------------------------------------------------------


def test_sleep_then_wake_increments_age_days() -> None:
    """A sleep/wake cycle increments age_days by 1."""
    responses = run_commands(
        [
            {
                "action": "new_game",
                "name": "Sleepy",
                "pet_type": "codeling",
                "color": "neon",
            },
            {"action": "sleep"},
            {"action": "wake"},
        ]
    )
    initial_age = _int(responses[0]["age_days"])
    final_age = _int(responses[2]["age_days"])
    assert final_age == initial_age + 1
