"""Unit tests for python/minigames.py.

Covers: happiness_delta_for_result and describe_minigame.
"""

import config
import minigames


# ---------------------------------------------------------------------------
# happiness_delta_for_result
# ---------------------------------------------------------------------------


def test_guess_win_returns_standard_win_boost() -> None:
    """Left/Right Guess win returns MINIGAME_WIN_HAPPINESS_BOOST."""
    delta = minigames.happiness_delta_for_result("guess", "win")
    assert delta == config.MINIGAME_WIN_HAPPINESS_BOOST


def test_guess_lose_returns_lose_boost() -> None:
    """Left/Right Guess lose returns MINIGAME_LOSE_HAPPINESS_BOOST."""
    delta = minigames.happiness_delta_for_result("guess", "lose")
    assert delta == config.MINIGAME_LOSE_HAPPINESS_BOOST


def test_memory_win_returns_memory_win_boost() -> None:
    """Pattern Memory win returns MINIGAME_MEMORY_WIN_HAPPINESS_BOOST."""
    delta = minigames.happiness_delta_for_result("memory", "win")
    assert delta == config.MINIGAME_MEMORY_WIN_HAPPINESS_BOOST


def test_memory_lose_returns_lose_boost() -> None:
    """Pattern Memory lose returns MINIGAME_LOSE_HAPPINESS_BOOST."""
    delta = minigames.happiness_delta_for_result("memory", "lose")
    assert delta == config.MINIGAME_LOSE_HAPPINESS_BOOST


def test_memory_win_is_greater_than_guess_win() -> None:
    """Memory game win gives a bigger boost than Guess win."""
    assert minigames.happiness_delta_for_result(
        "memory", "win"
    ) > minigames.happiness_delta_for_result("guess", "win")


def test_win_is_greater_than_lose_for_all_games() -> None:
    """Winning always yields a higher delta than losing."""
    for game in ("guess", "memory"):
        win_delta = minigames.happiness_delta_for_result(game, "win")
        lose_delta = minigames.happiness_delta_for_result(game, "lose")
        assert win_delta > lose_delta, f"Expected win > lose for game='{game}'"


def test_unknown_game_falls_back_to_lose_bonus() -> None:
    """Unknown game strings fall back to the lose-result bonus."""
    delta = minigames.happiness_delta_for_result("nonexistent", "win")
    assert delta == config.MINIGAME_WIN_HAPPINESS_BOOST


def test_unknown_result_falls_back_to_lose_bonus() -> None:
    """Unknown result strings fall back to the lose bonus."""
    delta = minigames.happiness_delta_for_result("guess", "draw")
    assert delta == config.MINIGAME_LOSE_HAPPINESS_BOOST


# ---------------------------------------------------------------------------
# describe_minigame
# ---------------------------------------------------------------------------


def test_describe_guess() -> None:
    """describe_minigame returns human-readable label for 'guess'."""
    description = minigames.describe_minigame("guess")
    assert description == "Left/Right Guess"


def test_describe_memory() -> None:
    """describe_minigame returns human-readable label for 'memory'."""
    description = minigames.describe_minigame("memory")
    assert description == "Pattern Memory"


def test_describe_unknown_returns_key() -> None:
    """describe_minigame returns the raw key for unknown games."""
    description = minigames.describe_minigame("foobar")
    assert description == "foobar"
