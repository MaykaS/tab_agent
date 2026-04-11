# Agent Test Set

This folder contains human-readable fixtures for validating the autonomous browser agent before or alongside an automated runner.

## Purpose

The scenarios are designed to test:

- autonomous sleep decisions
- context wake behavior
- safety constraints
- regret/undo handling
- explicit feedback handling
- benchmark comparison against a fixed rule baseline

## Files

- `scenarios.json`
  - canonical scenario fixtures

## Fixture schema

Each scenario includes:

- `id`
- `name`
- `goal`
- `category`
- `currentSession`
- `openTabs`
- `groupedContexts`
- `behaviorSummary`
- `recentActivations`
- `protectedContexts`
- `expected`

Replay-oriented cases can also include:

- `actionHistory`
- `feedbackFixtures`

## How to use manually

1. Read a scenario.
2. Compare the current local policy output to the expected result.
3. Check whether any protected tab was incorrectly selected for sleep.
4. Check whether context wake behaves as expected.
5. Record any mismatch before changing thresholds or features.

## What “good” looks like

- low-need tabs are selected for sleep
- high-risk tabs are preserved
- repeated-regret tabs become less likely to sleep
- related slept tabs wake when the user re-enters the same context
- rule baseline and autonomous policy can be compared on the same scenario
