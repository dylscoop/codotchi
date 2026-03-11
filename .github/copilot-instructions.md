# Copilot Instructions

## Purpose

Intended audience: AI agents and developers. Provides context to allow agents to contribute more effectively. This is intended to supplement the [readme](../README.md), not replace it. Where the two conflict, this document takes precedence for agent behaviour.

## Project Overview

Restaurant Reviewer is a FastAPI web application that:

- Scrapes Google Maps reviews via a headless Playwright browser
- Stores restaurants and reviews in SQLite
- Re-rates restaurants using a configurable recency-decay and keyword/location weighting algorithm
- Exposes results via a REST API

## Validation Workflow

For tooling, validation workflow, and definition of done, see [Copilot Agent Instructions](./agents.md).

## Testing

### Unit Tests

Location: `tests/unit_tests`

Unit tests cover individual functions and classes in isolation:

- `test_scoring.py` — 23 tests for the recency decay and keyword/location weighting algorithm
- `test_database.py` — 11 tests for `RestaurantRepository` and `ReviewRepository` using in-memory SQLite

### Integration Tests

Location: `tests/integration_tests`

Integration tests exercise the FastAPI app end-to-end via `TestClient`. They override the database dependencies with an in-memory SQLite connection and mock the `PlaywrightScraper` where scraping behaviour needs to be tested without network access.

## Design Patterns: Encourage and Discourage

### Patterns to Encourage

- Pure Functions: Favour pure, stateless functions for core logic. This improves testability, predictability, and ease of refactoring.
- Separation of Concerns: Keep data loading, business logic, and output generation in separate modules/functions.
- Configuration-Driven Design: Use configuration and schemas to control behaviour rather than hardcoding logic.
- Dependency Injection: Pass dependencies (e.g. data sources, config) explicitly to functions/classes to improve modularity and testability.
- Clear Interfaces: Define and document clear interfaces for modules and functions, especially those expected to be extended.
- Fail Fast: Validate inputs early and fail with clear, actionable error messages.

### Patterns to Discourage

- Tight Coupling: Avoid code that tightly couples modules or relies on global state, as this makes testing and extension difficult.
- Hidden Side Effects: Avoid functions that modify global state or have side effects not obvious from their signature.
- Hardcoding: Do not hardcode business rules, file paths, or logic — use configuration and schemas instead.
- Over-Mocking in Tests: Avoid excessive mocking in unit tests; prefer refactoring code to make it more testable.
- Monolithic Functions: Break up large, monolithic functions into smaller, focused units.
