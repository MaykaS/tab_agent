# Current Benchmark Summary

This summary is derived from [benchmark_results_current.csv](/C:/Users/mayas/OneDrive/Desktop/Projects/tab%20agent/agent_test_set/benchmark_results_current.csv) and is the first research-facing aggregate view of the current benchmark.

It is intentionally limited to the row-level fields available in the imported table:

- exact match
- precision
- recall
- F1
- research category
- context variant

Per-row safety, wake, and feedback-specific counts remain blank in the imported table and should be captured directly in a future richer export.

## Overall By Variant

| Variant | Exact-match | Avg precision | Avg recall | Avg F1 | Notes |
| --- | --- | --- | --- | --- | --- |
| `recency_only` | 9/17 | 0.97 | 0.73 | 0.74 | Useful thin baseline, but clearly weaker on richer behavior and sequence-sensitive cases. |
| `summary_only` | 13/17 | 0.94 | 0.91 | 0.88 | Strong compact abstraction baseline. |
| `raw_log_only` | 17/17 | 1.00 | 1.00 | 1.00 | Best current row-level benchmark performer, especially on sequence-sensitive cases. |
| `hybrid` | 17/17 | 1.00 | 1.00 | 1.00 | Matches raw-log performance in the current imported benchmark. |

## By Research Category

### `safety`

| Variant | Exact-match | Avg precision | Avg recall | Avg F1 |
| --- | --- | --- | --- | --- |
| `recency_only` | 4/4 | 1.00 | 1.00 | 1.00 |
| `summary_only` | 4/4 | 1.00 | 1.00 | 1.00 |
| `raw_log_only` | 4/4 | 1.00 | 1.00 | 1.00 |
| `hybrid` | 4/4 | 1.00 | 1.00 | 1.00 |

Interpretation:
- The current scenario set shows all variants respecting the simple safety cases at the row level.
- This is reassuring for product framing, but it does not replace richer per-row guardrail exports later.

### `routine low-need sleep`

| Variant | Exact-match | Avg precision | Avg recall | Avg F1 |
| --- | --- | --- | --- | --- |
| `recency_only` | 1/3 | 1.00 | 0.72 | 0.82 |
| `summary_only` | 3/3 | 1.00 | 1.00 | 1.00 |
| `raw_log_only` | 3/3 | 1.00 | 1.00 | 1.00 |
| `hybrid` | 3/3 | 1.00 | 1.00 | 1.00 |

Interpretation:
- This is the clearest sign that thin recency-only context leaves value on the table.
- Structured summary context already closes that gap strongly.

### `frequent/protected preservation`

| Variant | Exact-match | Avg precision | Avg recall | Avg F1 |
| --- | --- | --- | --- | --- |
| `recency_only` | 2/2 | 1.00 | 1.00 | 1.00 |
| `summary_only` | 2/2 | 1.00 | 1.00 | 1.00 |
| `raw_log_only` | 2/2 | 1.00 | 1.00 | 1.00 |
| `hybrid` | 2/2 | 1.00 | 1.00 | 1.00 |

Interpretation:
- The imported benchmark suggests all variants handle these preservation scenarios correctly.
- This category will become more informative once richer per-row protection and regret signals are exported.

### `temporal ambiguity`

| Variant | Exact-match | Avg precision | Avg recall | Avg F1 |
| --- | --- | --- | --- | --- |
| `recency_only` | 1/5 | 0.90 | 0.50 | 0.47 |
| `summary_only` | 2/5 | 0.90 | 0.70 | 0.67 |
| `raw_log_only` | 5/5 | 1.00 | 1.00 | 1.00 |
| `hybrid` | 5/5 | 1.00 | 1.00 | 1.00 |

Interpretation:
- This is the strongest professor-aligned finding in the current evidence.
- Raw recent event sequence clearly matters on temporally ambiguous scenarios.
- Summary-only improves over recency-only but does not fully resolve sequence-driven cases.

### `feedback-sensitive`

| Variant | Exact-match | Avg precision | Avg recall | Avg F1 |
| --- | --- | --- | --- | --- |
| `recency_only` | 1/3 | 1.00 | 0.56 | 0.60 |
| `summary_only` | 2/3 | 0.83 | 1.00 | 0.89 |
| `raw_log_only` | 3/3 | 1.00 | 1.00 | 1.00 |
| `hybrid` | 3/3 | 1.00 | 1.00 | 1.00 |

Interpretation:
- Feedback-aware and sequence-aware context appears especially valuable here.
- This category is the natural bridge to the later poor person's RL comparison.

## Current Takeaways

- `recency_only` works as a thin benchmark baseline, but it is clearly weaker on routine low-need sleep and temporal ambiguity.
- `summary_only` is already strong and compact, which supports the value of structured behavioral abstraction.
- `raw_log_only` and `hybrid` perform best in the current imported benchmark, with the biggest visible advantage on temporal ambiguity and feedback-sensitive cases.
- The current imported table is strong enough to support early narrative claims about context quality, but not yet strong enough to support the full safety- and memory-specific story your professor pointed toward.

## What This Enables Next

- an early evidence-backed discussion of context quality
- the first simple variant-by-category plot plan
- selection of case studies for temporal ambiguity and feedback-sensitive scenarios

The next evidence gap is richer row-level export for:

- protected violations
- wake success
- feedback-specific error counts
- later `memory_on` comparison
