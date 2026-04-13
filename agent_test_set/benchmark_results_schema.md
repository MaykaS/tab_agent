# Benchmark Results Schema

This file defines the canonical row format for benchmark output so later reports, plots, and memory comparisons all use the same evidence shape.

It follows the framing in [EVAL_AND_STORY.md](/C:/Users/mayas/OneDrive/Desktop/Projects/tab%20agent/EVAL_AND_STORY.md) and the scenario taxonomy in [scenario_taxonomy.md](/C:/Users/mayas/OneDrive/Desktop/Projects/tab%20agent/agent_test_set/scenario_taxonomy.md).

## Purpose

The benchmark needs to support three related uses:

- context variant comparison
- category-level analysis
- later `memory_off` vs `memory_on` comparison

The easiest way to keep those aligned is to use one stable row schema for every benchmark run.

## Row Granularity

Emit one row per:

- scenario
- context variant
- memory condition

That means a single scenario may produce multiple rows:

- `recency_only` with `memory_off`
- `summary_only` with `memory_off`
- `raw_log_only` with `memory_off`
- `hybrid` with `memory_off`

And later, where relevant:

- `summary_only` with `memory_on`
- `hybrid` with `memory_on`

## Required Fields

| Field | Type | Meaning |
| --- | --- | --- |
| `scenario_id` | string | Stable scenario identifier from `scenarios.json`. |
| `scenario_name` | string | Human-readable scenario name. |
| `fixture_category` | string | Original compact fixture category such as `sleep`, `safety`, `feedback`, `wake`, or `benchmark`. |
| `research_category` | string | Stable research-facing taxonomy label from `scenario_taxonomy.md`. |
| `variant` | string | One of `recency_only`, `summary_only`, `raw_log_only`, or `hybrid`. |
| `memory_condition` | string | `memory_off` or `memory_on`. Use `memory_off` for the current baseline benchmark unless memory is actively being tested. |
| `expected_sleep_set` | array or serialized list | Expected sleep candidates from the scenario fixture. |
| `predicted_sleep_set` | array or serialized list | The candidate set predicted by the evaluated policy/context condition. |
| `exact_match` | boolean | Whether the predicted sleep set exactly matches the expected sleep set. |
| `precision` | number | Sleep precision for the row. |
| `recall` | number | Sleep recall for the row. |
| `f1` | number | Harmonic mean of precision and recall for the row. |
| `protected_violations` | integer | Count of tabs incorrectly proposed for sleep despite protection or guardrails. |
| `regret_sensitive_errors` | integer | Count of mistakes where regret or negative feedback should have changed the decision. |
| `undo_sensitive_errors` | integer | Count of mistakes that ignore undo-like evidence. |
| `wake_success` | boolean or nullable | Whether wake behavior matched the scenario expectation when the scenario includes a wake target. |
| `notes` | string | Short mismatch notes, caveats, or interpretation hints for later reporting. |

## Optional Fields

These are not required for the first pass, but they are helpful if they are easy to capture later:

- `expected_wake_urls`
- `predicted_wake_urls`
- `expected_protected_tabs`
- `predicted_protected_tabs`
- `summary_rubric`
- `run_timestamp`
- `policy_version`

## Reporting Rules

- `variant` should always use the research-facing names:
  - `recency_only`
  - `summary_only`
  - `raw_log_only`
  - `hybrid`
- `research_category` should always use the six stable categories:
  - `safety`
  - `routine low-need sleep`
  - `frequent/protected preservation`
  - `temporal ambiguity`
  - `feedback-sensitive`
  - `context wake`
- `memory_condition` should be explicit even when memory is not active, so later comparisons do not require a schema change.

## Legacy Import Note

When importing older benchmark reports into this schema, some row-level fields may be unavailable because the source report only exposed them in aggregate or narrative form.

For those legacy imports, it is acceptable to leave these fields blank while keeping the rest of the row stable:

- `protected_violations`
- `regret_sensitive_errors`
- `undo_sensitive_errors`
- `wake_success`

Those gaps should be treated as a signal to improve the next benchmark export, not as values to guess.

## Example Row

```json
{
  "scenario_id": "same_summary_different_sequence_a",
  "scenario_name": "Same Summary, Different Sequence A",
  "fixture_category": "sleep",
  "research_category": "temporal ambiguity",
  "variant": "raw_log_only",
  "memory_condition": "memory_off",
  "expected_sleep_set": ["https://archive.example.com/old-article"],
  "predicted_sleep_set": ["https://archive.example.com/old-article"],
  "exact_match": true,
  "precision": 1.0,
  "recall": 1.0,
  "f1": 1.0,
  "protected_violations": 0,
  "regret_sensitive_errors": 0,
  "undo_sensitive_errors": 0,
  "wake_success": null,
  "notes": "Raw sequence resolved the temporal ambiguity hidden by summary-only context."
}
```

## Storage Guidance

The schema is documentation first. The actual result artifact can later be emitted as:

- JSON
- CSV
- or a derived Markdown table

The key requirement is that the row fields remain stable so plots and reports can be derived consistently.
