# Figure Plan

This file defines the first chart set for Tab Agent's context benchmark, based on the current imported evidence.

It is designed to support:

- the final presentation
- a future technical blog post
- later implementation in `tab_agent_web` if we decide to surface these figures on the site

## Visibility Note

These figures are **not automatically visible on the public site yet**.

Right now they live as figure specifications in this repo. To make them visible on the site or admin dashboard later, we would need a separate change in the `tab_agent_web` repo.

For now, you can see the underlying evidence in:

- [benchmark_summary_current.md](/C:/Users/mayas/OneDrive/Desktop/Projects/tab%20agent/agent_test_set/benchmark_summary_current.md)
- [benchmark_case_studies.md](/C:/Users/mayas/OneDrive/Desktop/Projects/tab%20agent/agent_test_set/benchmark_case_studies.md)
- [benchmark_results_current.csv](/C:/Users/mayas/OneDrive/Desktop/Projects/tab%20agent/agent_test_set/benchmark_results_current.csv)

## Figure 1: Overall Context Comparison

### Purpose

Show the top-line context benchmark result across:

- `recency_only`
- `summary_only`
- `raw_log_only`
- `hybrid`

### Chart Type

Bar chart

### Metric

- exact-match rate

### Data Source

- [benchmark_summary_current.md](/C:/Users/mayas/OneDrive/Desktop/Projects/tab%20agent/agent_test_set/benchmark_summary_current.md:16)

### Caption Idea

"Raw log-aware and hybrid context variants outperform thinner baselines on the current benchmark."

## Figure 2: Category-Level Context Comparison

### Purpose

Show where different context types help most, especially on the professor-aligned question of context quality.

### Chart Type

Grouped bar chart

### Metric

- exact-match rate by research category

### Categories

- `safety`
- `routine low-need sleep`
- `frequent/protected preservation`
- `temporal ambiguity`
- `feedback-sensitive`

### Data Source

- [benchmark_summary_current.md](/C:/Users/mayas/OneDrive/Desktop/Projects/tab%20agent/agent_test_set/benchmark_summary_current.md:25)

### Caption Idea

"Raw recent event sequence matters most on temporally ambiguous and feedback-sensitive scenarios, while summary-only context is already strong on routine low-need sleep."

## Figure 3: Temporal Ambiguity Walkthrough

### Purpose

Show one concrete example of why raw logs matter.

### Format

Small timeline or annotated scenario walkthrough rather than a traditional chart.

### Recommended Scenario

- `same_summary_different_sequence_a`

### Data Source

- scenario definition: [scenarios.json](/C:/Users/mayas/OneDrive/Desktop/Projects/tab%20agent/agent_test_set/scenarios.json:365)
- benchmark outcome: [context_benchmark_report.md](/C:/Users/mayas/OneDrive/Desktop/Projects/tab%20agent/agent_test_set/context_benchmark_report.md:105)
- explanation: [benchmark_case_studies.md](/C:/Users/mayas/OneDrive/Desktop/Projects/tab%20agent/agent_test_set/benchmark_case_studies.md:29)

### Caption Idea

"The event sequence reveals that one tab belongs to a fresh work burst while the other is truly stale; summary statistics alone miss that distinction."

## Figure 4: Feedback-Sensitive Walkthrough

### Purpose

Bridge the current benchmark to the future poor person's RL / memory experiment.

### Format

Annotated scenario walkthrough

### Recommended Scenario

- `feedback_after_sleep_sequence`

### Data Source

- scenario definition: [scenarios.json](/C:/Users/mayas/OneDrive/Desktop/Projects/tab%20agent/agent_test_set/scenarios.json:537)
- benchmark outcome: [context_benchmark_report.md](/C:/Users/mayas/OneDrive/Desktop/Projects/tab%20agent/agent_test_set/context_benchmark_report.md:140)
- explanation: [benchmark_case_studies.md](/C:/Users/mayas/OneDrive/Desktop/Projects/tab%20agent/agent_test_set/benchmark_case_studies.md:65)

### Caption Idea

"Recent undo and bad feedback should change future behavior; this scenario motivates the later memory-enabled comparison."

## Figure 5: Memory Before/After

### Purpose

Reserve a figure slot for the later poor person's RL experiment.

### Status

Not ready yet

### Planned Comparison

- `memory_off`
- `memory_on`

### Planned Focus

- feedback-sensitive cases
- repeated-regret cases
- reduction in repeated mistakes

## Recommended First Visual Set

For now, the cleanest first figure set is:

1. overall context comparison
2. category-level context comparison
3. temporal ambiguity walkthrough
4. feedback-sensitive walkthrough

This keeps the story tightly aligned with your professor's guidance:

- what context is good
- what context is bad
- when raw sequence helps
- how feedback will later become memory
