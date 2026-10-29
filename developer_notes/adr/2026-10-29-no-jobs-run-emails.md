# ADR: Gate job for issue-triggered leaderboard workflows

**Date:** 2026-10-29
**Status:** Accepted

## Context

`process-leaderboard.yml`, `process-leaderboard-live.yml` and `process-leaderboard-delete.yml` all run on `issues: opened`. GitHub can't filter issue events by title before a run starts, so each workflow picks its issues with a job-level `if:` on the title. Every issue starts all three runs. In the two that don't match, the only job is skipped, and GitHub emails the repo owner "No jobs were run".

## Options

1. Add an always-running `route` job to each workflow and make the real job depend on it (`needs: route`).
2. Merge the three workflows into one dispatcher. This is a bigger refactor and would merge their separate `concurrency` groups.
3. Change notification settings only. This isn't reliable because all-skipped runs still send the email.

## Decision

Option 1. The `route` job has `permissions: {}` and a single echo step. Non-matching runs now end as a success, which sends no email when Actions notifications are set to failed workflows only.

## Consequences

- About 5 seconds of runner time per workflow per issue.
- The per-workflow concurrency groups are unchanged. Non-matching runs hold their group only briefly.
