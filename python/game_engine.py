"""Main game engine: JSON stdin → dispatch → JSON stdout.

This is the only module with side effects (I/O).  All game logic lives in
pet.py, actions.py, evolution.py, and minigames.py.

Protocol (single-line JSON, newline-terminated):
  TypeScript → Python: command object with an ``"action"`` key.
  Python → TypeScript: full state snapshot (Pet.to_dict()) after every action.

Errors are reported as ``{"error": "...", "action": "..."}`` objects so the
TypeScript layer can surface them without crashing.
"""

from __future__ import annotations

import json
import sys
import time
from typing import Any, TextIO

import actions
import config
import minigames
import models
from pet import Pet


# ---------------------------------------------------------------------------
# State container
# ---------------------------------------------------------------------------


class EngineState:
    """Mutable container for the running engine's transient state."""

    def __init__(self) -> None:
        """Initialise with no active pet."""
        self.pet: Pet | None = None
        self.last_code_activity_time: float = 0.0
        self.meals_given_this_cycle: int = 0


# ---------------------------------------------------------------------------
# Dispatch table
# ---------------------------------------------------------------------------


def _handle_new_game(state: EngineState, command: dict[str, Any]) -> dict[str, Any]:
    """Create a brand-new pet from the ``new_game`` command.

    Required keys: ``name``, ``pet_type``.
    Optional key:  ``color`` (defaults to ``models.DEFAULT_COLOUR``).
    """
    name = str(command["name"])
    pet_type = str(command["pet_type"])
    color = str(command.get("color", models.DEFAULT_COLOUR))

    if pet_type not in models.VALID_PET_TYPES:
        return {
            "error": f"Unknown pet_type '{pet_type}'.",
            "action": "new_game",
        }

    state.pet = Pet(name=name, pet_type=pet_type, color=color)
    state.meals_given_this_cycle = 0
    state.last_code_activity_time = 0.0
    return state.pet.to_dict()


def _handle_init(state: EngineState, command: dict[str, Any]) -> dict[str, Any]:
    """Restore a saved pet, applying offline decay.

    Keys: ``state`` (dict or null), ``elapsed_seconds`` (number).
    If ``state`` is null a bare response is returned so TypeScript knows to
    prompt for a new game.
    """
    saved_state = command.get("state")
    elapsed_seconds = float(command.get("elapsed_seconds", 0))

    if saved_state is None:
        return {"alive": None, "action": "init", "needs_new_game": True}

    pet = Pet.from_dict(saved_state)
    pet.apply_offline_decay(elapsed_seconds)
    state.pet = pet
    state.meals_given_this_cycle = 0
    state.last_code_activity_time = 0.0
    return pet.to_dict()


def _handle_tick(state: EngineState, _command: dict[str, Any]) -> dict[str, Any]:
    """Advance the pet by one tick."""
    if state.pet is None:
        return {"error": "No active pet.", "action": "tick"}
    state.pet.tick()
    # Reset per-cycle meal counter when pet falls asleep via tick
    if "fell_asleep" in state.pet.events:
        state.meals_given_this_cycle = 0
    return state.pet.to_dict()


def _handle_feed(state: EngineState, command: dict[str, Any]) -> dict[str, Any]:
    """Feed the pet a meal or a snack."""
    if state.pet is None:
        return {"error": "No active pet.", "action": "feed"}
    feed_type = str(command.get("feed_type", "meal"))
    if feed_type == "meal":
        actions.feed_meal(state.pet, state.meals_given_this_cycle)
        if "fed_meal" in state.pet.events:
            state.meals_given_this_cycle += 1
    elif feed_type == "snack":
        actions.feed_snack(state.pet)
    else:
        return {"error": f"Unknown feed_type '{feed_type}'.", "action": "feed"}
    return state.pet.to_dict()


def _handle_play(state: EngineState, command: dict[str, Any]) -> dict[str, Any]:
    """Handle the play action, including mini-game result deltas."""
    if state.pet is None:
        return {"error": "No active pet.", "action": "play"}

    game = str(command.get("game", "guess"))
    result = str(command.get("result", "win"))

    actions.play(state.pet)
    if "play_refused_no_energy" not in state.pet.events:
        happiness_delta = minigames.happiness_delta_for_result(game, result)
        state.pet.happiness = max(
            config.STAT_MIN,
            min(config.STAT_MAX, state.pet.happiness + happiness_delta),
        )
        state.pet.events.append(f"minigame_{game}_{result}")
    return state.pet.to_dict()


def _handle_sleep(state: EngineState, _command: dict[str, Any]) -> dict[str, Any]:
    """Put the pet to sleep."""
    if state.pet is None:
        return {"error": "No active pet.", "action": "sleep"}
    actions.sleep(state.pet)
    state.meals_given_this_cycle = 0
    return state.pet.to_dict()


def _handle_wake(state: EngineState, _command: dict[str, Any]) -> dict[str, Any]:
    """Wake the pet up."""
    if state.pet is None:
        return {"error": "No active pet.", "action": "wake"}
    actions.wake(state.pet)
    return state.pet.to_dict()


def _handle_clean(state: EngineState, _command: dict[str, Any]) -> dict[str, Any]:
    """Clean up droppings."""
    if state.pet is None:
        return {"error": "No active pet.", "action": "clean"}
    actions.clean(state.pet)
    return state.pet.to_dict()


def _handle_medicine(state: EngineState, _command: dict[str, Any]) -> dict[str, Any]:
    """Administer medicine."""
    if state.pet is None:
        return {"error": "No active pet.", "action": "medicine"}
    actions.give_medicine(state.pet)
    return state.pet.to_dict()


def _handle_scold(state: EngineState, _command: dict[str, Any]) -> dict[str, Any]:
    """Scold the pet."""
    if state.pet is None:
        return {"error": "No active pet.", "action": "scold"}
    actions.scold(state.pet)
    return state.pet.to_dict()


def _handle_praise(state: EngineState, _command: dict[str, Any]) -> dict[str, Any]:
    """Praise the pet."""
    if state.pet is None:
        return {"error": "No active pet.", "action": "praise"}
    actions.praise(state.pet)
    return state.pet.to_dict()


def _handle_code_activity(
    state: EngineState, _command: dict[str, Any]
) -> dict[str, Any]:
    """Apply code-activity reward, respecting the throttle window."""
    if state.pet is None:
        return {"error": "No active pet.", "action": "code_activity"}

    now = time.monotonic()
    seconds_since_last = now - state.last_code_activity_time
    if seconds_since_last < config.CODE_ACTIVITY_THROTTLE_SECONDS:
        state.pet.events = ["code_activity_throttled"]
        return state.pet.to_dict()

    state.last_code_activity_time = now
    actions.apply_code_activity(state.pet)
    return state.pet.to_dict()


def _handle_get_state(state: EngineState, _command: dict[str, Any]) -> dict[str, Any]:
    """Return the current pet state without mutation."""
    if state.pet is None:
        return {"error": "No active pet.", "action": "get_state"}
    return state.pet.to_dict()


_DISPATCH: dict[
    str,
    Any,
] = {
    "new_game": _handle_new_game,
    "init": _handle_init,
    "tick": _handle_tick,
    "feed": _handle_feed,
    "play": _handle_play,
    "sleep": _handle_sleep,
    "wake": _handle_wake,
    "clean": _handle_clean,
    "medicine": _handle_medicine,
    "scold": _handle_scold,
    "praise": _handle_praise,
    "code_activity": _handle_code_activity,
    "get_state": _handle_get_state,
}


# ---------------------------------------------------------------------------
# Main loop
# ---------------------------------------------------------------------------


def run(
    input_stream: TextIO = sys.stdin,
    output_stream: TextIO = sys.stdout,
) -> None:
    """Read JSON commands from *input_stream* and write responses to
    *output_stream*.

    The loop exits cleanly when *input_stream* is exhausted (EOF).
    Each response is flushed immediately so the TypeScript layer does not
    need to buffer.

    Args:
        input_stream:  Newline-delimited JSON command source.
        output_stream: Newline-delimited JSON response sink.
    """
    state = EngineState()

    for raw_line in input_stream:
        raw_line = raw_line.strip()
        if not raw_line:
            continue
        try:
            command: dict[str, Any] = json.loads(raw_line)
        except json.JSONDecodeError as parse_error:
            response: dict[str, Any] = {
                "error": f"JSON parse error: {parse_error}",
                "raw": raw_line,
            }
            output_stream.write(json.dumps(response) + "\n")
            output_stream.flush()
            continue

        action = str(command.get("action", ""))
        handler = _DISPATCH.get(action)
        if handler is None:
            response = {
                "error": f"Unknown action '{action}'.",
                "action": action,
            }
        else:
            try:
                response = handler(state, command)
            except Exception as dispatch_error:
                response = {
                    "error": str(dispatch_error),
                    "action": action,
                }

        output_stream.write(json.dumps(response) + "\n")
        output_stream.flush()


def main() -> None:
    """Entry point when the module is executed directly."""
    run()


if __name__ == "__main__":
    main()
