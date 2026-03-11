---
description: "Python coding conventions and guidelines"
applyTo: "**/*.py"
---

# Python Coding Conventions

## Python Instructions

- Write clear and concise comments for each function.
- Ensure functions have descriptive names and include type hints.
- Provide docstrings following PEP 257 conventions.
- Prefer built-in generic types for annotations (e.g., `list[str]`, `dict[str, int]`) over the `typing` module equivalents.
- Break down complex functions into smaller, more manageable functions.

## General Instructions

- Always prioritize readability and clarity.
- For algorithm-related code, include explanations of the approach used.
- Write code with good maintainability practices, including comments on why certain design decisions were made.
- Handle edge cases and write clear exception handling.
- For libraries or external dependencies, mention their usage and purpose in comments.
- Use consistent naming conventions and follow language-specific best practices.
- Write concise, efficient, and idiomatic code that is also easily understandable.
- Prefer pure functions where possible.
- Test folder structure should match source code e.g. unit tests for `python/pet.py` should be in `tests/unit_tests/test_pet.py`.

## Code Style and Formatting

- Follow the **PEP 8** style guide for Python.
- Maintain proper indentation (use 4 spaces for each level of indentation).
- Ensure lines do not exceed 79 characters.
- Place function and class docstrings immediately after the `def` or `class` keyword.
- Use blank lines to separate functions, classes, and code blocks where appropriate.
- Use descriptive variable names e.g. `hunger_decay_per_tick` rather than `h_decay`: do not abbreviate.
- When naming variables that hold physical or domain quantities, include the unit or dimension in the name where it aids clarity e.g. `radius_metres` rather than `radius`.

## Edge Cases and Testing

- Always include test cases for critical paths of the application.
- Account for common edge cases like empty inputs, invalid data types, and large datasets.
- Include comments for edge cases and the expected behavior in those cases.
- Write unit tests for functions and document them with docstrings explaining the test cases.

## Example of Proper Documentation

```python
def calculate_circle_area(radius: float) -> float:
    """
    Calculate the area of a circle given the radius.

    Args:
        radius (float): radius of the circle.

    Returns:
        float: the area of the circle.
    """
    import math
    return math.pi * radius ** 2
```
