"""Mini-game result → stat delta processing.

Both mini-games run entirely in the webview JS.  When a result comes in the
TypeScript layer sends a ``play`` command with ``game`` and ``result`` fields.
This module converts those into happiness deltas.

Design: pure functions only — no I/O, no global state.
"""

import config


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def happiness_delta_for_result(game: str, result: str) -> int:
    """Return the happiness delta for a mini-game outcome.

    Args:
        game:   ``"guess"`` (Left/Right Guess) or ``"memory"``
                (Pattern Memory).
        result: ``"win"`` or ``"lose"``.

    Returns:
        A positive integer to add to the pet's happiness stat.
        Unknown game or result strings fall back to the lose bonus so the
        pet always receives some reward for participating.
    """
    if game == "memory" and result == "win":
        return config.MINIGAME_MEMORY_WIN_HAPPINESS_BOOST
    if result == "win":
        return config.MINIGAME_WIN_HAPPINESS_BOOST
    return config.MINIGAME_LOSE_HAPPINESS_BOOST


def describe_minigame(game: str) -> str:
    """Return a short human-readable description of *game*.

    Used in event log messages; falls back to the raw game key for unknown
    values.

    Args:
        game: Mini-game identifier string.

    Returns:
        A human-readable description string.
    """
    descriptions: dict[str, str] = {
        "guess": "Left/Right Guess",
        "memory": "Pattern Memory",
    }
    return descriptions.get(game, game)
