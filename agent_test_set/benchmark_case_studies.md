# Benchmark Case Studies

This file pulls out a few high-signal scenarios from the current benchmark so the evidence is easier to read than scanning raw tables alone.

Use it alongside:

- [benchmark_summary_current.md](/C:/Users/mayas/OneDrive/Desktop/Projects/tab%20agent/agent_test_set/benchmark_summary_current.md)
- [context_benchmark_report.md](/C:/Users/mayas/OneDrive/Desktop/Projects/tab%20agent/agent_test_set/context_benchmark_report.md)
- [scenarios.json](/C:/Users/mayas/OneDrive/Desktop/Projects/tab%20agent/agent_test_set/scenarios.json)

## 1. Summary Beats Thin Context

### `research_sprawl`

Why this case matters:
- It shows that `recency_only` leaves useful value on the table even in a relatively straightforward low-need sleep case.
- It supports the claim that structured behavioral summaries are already a strong improvement over a thin baseline.

What the scenario expects:
- keep the main search and primary doc awake
- sleep the three stale paper tabs

What happened:
- `recency_only` missed one expected sleep candidate
- `summary_only`, `raw_log_only`, and `hybrid` all matched the expected sleep set

Where to see it:
- Scenario definition: [scenarios.json](/C:/Users/mayas/OneDrive/Desktop/Projects/tab%20agent/agent_test_set/scenarios.json:84)
- Per-scenario benchmark notes: [context_benchmark_report.md](/C:/Users/mayas/OneDrive/Desktop/Projects/tab%20agent/agent_test_set/context_benchmark_report.md:42)

Takeaway:
- You do not need raw logs for every case. In many routine low-need sleep situations, structured behavioral summaries are already enough.

## 2. Raw Logs Resolve Temporal Ambiguity

### `same_summary_different_sequence_a`

Why this case matters:
- This is one of the clearest professor-aligned scenarios in the whole benchmark.
- The summary statistics look similar enough that `recency_only` and `summary_only` both make the wrong call.
- The event sequence reveals that one tab belongs to a fresh work burst while the other is truly stale.

What the scenario expects:
- preserve the fresh brief
- sleep only the older article

What happened:
- `recency_only` and `summary_only` both tried to sleep too much
- `raw_log_only` and `hybrid` got the exact expected result

Where to see it:
- Scenario definition with event log: [scenarios.json](/C:/Users/mayas/OneDrive/Desktop/Projects/tab%20agent/agent_test_set/scenarios.json:365)
- Per-scenario benchmark notes: [context_benchmark_report.md](/C:/Users/mayas/OneDrive/Desktop/Projects/tab%20agent/agent_test_set/context_benchmark_report.md:105)
- Category-level result: [benchmark_summary_current.md](/C:/Users/mayas/OneDrive/Desktop/Projects/tab%20agent/agent_test_set/benchmark_summary_current.md:66)

Takeaway:
- Raw recent event sequence matters when summary features hide the difference between "recently relevant" and "recently present."

## 3. Sequence Helps On Untouched Tabs

### `opened_not_used`

Why this case matters:
- It shows that a recently opened tab should not automatically inherit full protection if it was never meaningfully used.
- This is another good example of why order and action type matter, not just summary counts.

What the scenario expects:
- keep the active plan tab awake
- sleep both the archive tab and the newly opened but unused tab

What happened:
- `recency_only` and `summary_only` protected too much
- `raw_log_only` and `hybrid` correctly identified that the newly opened tab was not actually part of the active workflow

Where to see it:
- Scenario definition with event log: [scenarios.json](/C:/Users/mayas/OneDrive/Desktop/Projects/tab%20agent/agent_test_set/scenarios.json:471)
- Per-scenario benchmark notes: [context_benchmark_report.md](/C:/Users/mayas/OneDrive/Desktop/Projects/tab%20agent/agent_test_set/context_benchmark_report.md:126)

Takeaway:
- Raw logs help the agent distinguish "opened" from "actually used," which is important for realistic browser workflows.

## 4. Feedback-Sensitive Context Needs More Than Summary Alone

### `feedback_after_sleep_sequence`

Why this case matters:
- This is the best bridge between the current benchmark and the later poor person's RL / memory work.
- The scenario includes undo and explicit bad feedback after a previous sleep, which should make the agent more cautious about the same target.

What the scenario expects:
- protect the candidate profile because it recently caused regret
- sleep only the reference note

What happened:
- `recency_only` was too conservative and failed to sleep the remaining low-need tab
- `summary_only` still proposed sleeping the regret-heavy target
- `raw_log_only` and `hybrid` matched the expected result

Where to see it:
- Scenario definition with feedback events: [scenarios.json](/C:/Users/mayas/OneDrive/Desktop/Projects/tab%20agent/agent_test_set/scenarios.json:537)
- Per-scenario benchmark notes: [context_benchmark_report.md](/C:/Users/mayas/OneDrive/Desktop/Projects/tab%20agent/agent_test_set/context_benchmark_report.md:140)
- Category-level result: [benchmark_summary_current.md](/C:/Users/mayas/OneDrive/Desktop/Projects/tab%20agent/agent_test_set/benchmark_summary_current.md:80)

Takeaway:
- Recent negative feedback is exactly the kind of signal that should feed the future memory layer.
- This case gives us a clean motivation for the next poor person's RL step.
