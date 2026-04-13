# Prototype Agent Memory

This is a **benchmark-derived prototype** of Tab Agent's "poor person's RL" memory artifact.

It is not generated from live user session exports yet. Instead, it shows the shape and tone of the memory layer using the strongest current benchmark findings.

Sources:

- [benchmark_summary_current.md](/C:/Users/mayas/OneDrive/Desktop/Projects/tab%20agent/agent_test_set/benchmark_summary_current.md)
- [benchmark_case_studies.md](/C:/Users/mayas/OneDrive/Desktop/Projects/tab%20agent/agent_test_set/benchmark_case_studies.md)
- [memory_artifact_spec.md](/C:/Users/mayas/OneDrive/Desktop/Projects/tab%20agent/agent_test_set/memory_artifact_spec.md)

## Overview

- Raw recent event sequence is especially useful on temporally ambiguous scenarios.
- Structured summary context is already strong on routine low-need sleep cases.
- Feedback-sensitive cases show clear value from recent undo and bad-feedback history.

## High-Regret Patterns

- Hiring candidate-profile tabs can become high regret after recent undo and bad-feedback signals.
- Design-heavy work tabs with repeated regret history should be treated conservatively even when inactivity alone makes them look sleepable.
- Tabs that were recently reopened or explicitly undone should not be treated as low-risk sleep candidates in the same short horizon.

## Safe-Sleep Patterns

- Stale reading and low-value research tabs are often safe to sleep once the active work cluster has clearly moved on.
- Burst reference tabs often become low-risk once the user returns to the primary working document.
- Opened-but-not-used tabs can be sleep-safe even if they are recent, as long as the event sequence shows they never entered the active workflow.

## Protection Patterns

- Explicitly protected groups should dominate local scoring and remain hard stops for autonomous sleep.
- Frequently revisited productivity contexts should be treated conservatively even when they look stale by inactivity alone.
- Repeated protect or regret signals around the same group should raise the effective protection level for that context.

## Wake Patterns

- Returning to an active work context often justifies waking slept sibling tabs from the same group.
- Context wake is most useful when the user re-enters a clearly named working cluster rather than a one-off tab.
- Wake behavior should remain scoped to the matching context and avoid speculative restoration outside the active workflow.

## Suggested Policy Notes

- Be more conservative on tabs that recently triggered undo, bad feedback, or repeated regret.
- Treat recent event sequence as especially important when summary statistics do not clearly separate active and stale tabs.
- Use compact summary context as the default decision surface, but keep raw recent logs available for ambiguous cases and explanations.
- When the user returns to a known work context, consider sibling wake only within that same cluster.

## Why This Matters

This prototype turns the professor's suggestion into something concrete:

- logs and feedback become memory
- memory becomes readable guidance
- guidance can later influence benchmarking, explanations, and policy behavior

The next step after this prototype is generating the same kind of memory file from real exported session data.
