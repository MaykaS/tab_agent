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
- `eventLog` for temporal-order benchmarking when available
- `expected`

Replay-oriented cases can also include:

- `actionHistory`
- `feedbackFixtures`

Generated artifacts:

- `context_benchmark_report.md`
  - comparison report for `recency_only`, `summary_only`, `raw_log_only`, and `hybrid`
- `scenario_taxonomy.md`
  - research-facing mapping from fixture scenarios to the final benchmark taxonomy
- `benchmark_results_schema.md`
  - canonical row schema for benchmark output used by later reports and plots
- `benchmark_results_template.csv`
  - example tabular output shape for future benchmark reruns
- `benchmark_results_current.csv`
  - imported structured rows derived from the current benchmark report and scenario taxonomy
- `benchmark_results_current.md`
  - notes describing what the current imported table covers and what is still missing
- `benchmark_summary_current.md`
  - first aggregate summary by variant and research category
- `generate_benchmark_artifacts.js`
  - regenerates the current structured CSV and aggregate summary from the benchmark sources
- `benchmark_case_studies.md`
  - selected scenarios that explain the strongest current findings in plain language
- `figure_plan.md`
  - the first chart and figure spec for presentation and blog outputs
- `generate_figures.py`
  - generates local SVG visuals from the current structured benchmark data
- `figures/`
  - generated benchmark visuals you can open directly
- `memory_artifact_spec.md`
  - spec for the Markdown memory layer inspired by the professor's "poor person's RL" suggestion
- `prototype_agent_memory.md`
  - a benchmark-derived example of what the memory artifact should look like
- `generate_memory_artifact.py`
  - turns an exported session JSON into a Markdown memory artifact

## How to use manually

1. Read a scenario.
2. Compare the current local policy output to the expected result.
3. Check whether any protected tab was incorrectly selected for sleep.
4. Check whether context wake behaves as expected.
5. Record any mismatch before changing thresholds or features.

## Research taxonomy

The fixture file keeps compact scenario categories such as `sleep`, `safety`, `feedback`, `wake`, and `benchmark`.

For evaluation and presentation work, those fixture categories are mapped into the stable research taxonomy documented in `scenario_taxonomy.md`:

- `safety`
- `routine low-need sleep`
- `frequent/protected preservation`
- `temporal ambiguity`
- `feedback-sensitive`
- `context wake`

This keeps the canonical fixture data intact while giving benchmark reports and future plots a cleaner, publication-ready vocabulary.

## Regenerating artifacts

To regenerate the current structured benchmark artifacts from the source report, scenario file, and taxonomy mapping:

```bash
node agent_test_set/generate_benchmark_artifacts.js
```

This script currently regenerates:

- `benchmark_results_current.csv`
- `benchmark_summary_current.md`

To generate the current local visuals:

```bash
python agent_test_set/generate_figures.py
```

To generate a memory artifact from a real exported session JSON later:

```bash
python agent_test_set/generate_memory_artifact.py <export.json>
```

## What “good” looks like

- low-need tabs are selected for sleep
- high-risk tabs are preserved
- repeated-regret tabs become less likely to sleep
- related slept tabs wake when the user re-enters the same context
- rule baseline and autonomous policy can be compared on the same scenario
