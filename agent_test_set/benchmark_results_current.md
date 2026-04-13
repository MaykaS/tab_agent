# Current Structured Benchmark Import

This file explains the scope and limitations of [benchmark_results_current.csv](/C:/Users/mayas/OneDrive/Desktop/Projects/tab%20agent/agent_test_set/benchmark_results_current.csv).

## What it is

`benchmark_results_current.csv` is the first structured results artifact derived from the current:

- fixture scenarios in [scenarios.json](/C:/Users/mayas/OneDrive/Desktop/Projects/tab%20agent/agent_test_set/scenarios.json)
- research taxonomy in [scenario_taxonomy.md](/C:/Users/mayas/OneDrive/Desktop/Projects/tab%20agent/agent_test_set/scenario_taxonomy.md)
- narrative benchmark output in [context_benchmark_report.md](/C:/Users/mayas/OneDrive/Desktop/Projects/tab%20agent/agent_test_set/context_benchmark_report.md)

## What it covers

- 17 benchmarked scenarios from the current report
- 4 context variants per scenario:
  - `recency_only`
  - `summary_only`
  - `raw_log_only`
  - `hybrid`
- `memory_off` only

This makes the imported table usable for:

- category-level grouping
- plot preparation
- later comparison against a future `memory_on` rerun

## What is intentionally missing

Some fields in the canonical schema are blank in this import because the current benchmark report does not expose them per row:

- `protected_violations`
- `regret_sensitive_errors`
- `undo_sensitive_errors`
- `wake_success`

That gap is expected for this first pass. It does not mean the schema is wrong; it means the next benchmark export should capture those fields directly.

## Why this matters

This file turns the current benchmark into something structured enough to support the professor-aligned workflow:

- benchmark context variants empirically
- compare categories cleanly
- prepare plots and tables
- leave room for a later poor person's RL comparison
