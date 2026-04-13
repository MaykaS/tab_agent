# Tab Agent Evaluation and Story

## Project Framing

Tab Agent is a browser-only autonomous tab management agent, and this project studies what kinds of context and feedback-derived memory help it make better sleep and wake decisions.

This framing is intentionally both product- and technical-facing:

- product: an agentic tab manager that operates conservatively inside the browser
- technical: an evaluation of context design and lightweight learning for autonomous browser behavior

### Scope Boundaries

This project is intentionally limited to:

- browser-only autonomous tab management
- autonomous `sleep` and `wake`, not autonomous close
- local real-time policy decisions
- advisory OpenAI usage for summaries, explanations, and tuning support
- lightweight feedback-driven improvement rather than full reinforcement learning

This project does not claim:

- full computer-wide memory management
- autonomous close
- cloud LLM control over browser actions
- full RL training infrastructure

## Professor Guidance -> Project Actions

| Professor guidance | What it means | Project action |
| --- | --- | --- |
| Compare what context is good and bad empirically. | Context quality should be a core research question, not a side note. | Benchmark multiple context variants on the same scenario set. |
| Include a raw tab lifecycle log, not just summary features. | Sequence information may matter when summary statistics hide useful order and timing. | Keep raw recent event logs as a first-class context condition. |
| Truncate long logs. | Raw context should stay bounded and practical. | Use a recent-event window rather than full browsing dumps. |
| Do something useful with feedback signals. | Feedback should improve future behavior, not just be collected. | Build a feedback-to-memory loop. |
| Use a "poor person's RL" approach if needed. | Lightweight memory can be enough; full RL is not required. | Summarize repeated patterns into a readable memory artifact that the agent can consult later. |
| Write a blog post once there are numbers and plots. | The work should be structured as a publishable technical story. | Organize results, figures, and case studies so they can drive both the presentation and a later post. |

## Research Questions

### Research Question 1

What kinds of context help a browser tab agent best predict which tabs will be needed in the near term?

### Research Question 2

Can user feedback be turned into lightweight behavioral memory that improves future decisions without full reinforcement learning?

## Claims To Test

- summarized behavioral context should outperform a thin recency-only baseline
- raw event logs should help on temporally ambiguous cases where summary features hide useful sequence information
- hybrid context should provide the strongest overall decision surface
- feedback-derived memory should reduce repeated mistakes on regret-heavy or feedback-sensitive cases
- conservative guardrails should remain necessary for autonomous tab management to feel safe and trustworthy

## Context Variants

### `recency_only`

A thin baseline using limited short-horizon usage cues such as recency and inactivity-style state, without richer behavioral summaries or event-sequence context.

Purpose:
- establish what happens when the agent sees too little context
- provide a simple baseline against richer context surfaces

### `summary_only`

A structured behavioral summary containing compact features such as recency, visit frequency, average revisit interval, feedback history, group patterns, and protection signals, without raw event sequence.

Purpose:
- test whether compact abstractions are sufficient
- measure the value of summarized behavioral context on its own

### `raw_log_only`

A truncated recent tab lifecycle log containing temporal events such as `open`, `activate`, `sleep`, `wake`, `close`, `undo`, `protect`, and explicit feedback, without the higher-level summary abstraction.

Purpose:
- test whether order and timing resolve cases that summary statistics miss
- measure the value of raw sequence as context

### `hybrid`

A combined context surface containing both the structured behavioral summary and a truncated recent raw event log.

Purpose:
- test whether abstraction plus temporal sequence yields the strongest overall context
- support richer explanations and later memory-aware evaluation

## Benchmark Design

The evaluation uses a reusable scenario set in [agent_test_set/scenarios.json](/C:/Users/mayas/OneDrive/Desktop/Projects/tab%20agent/agent_test_set/scenarios.json) and an interpretation layer that organizes those scenarios into stable research categories.

### Scenario Taxonomy

- `safety`
  - guardrail-first cases such as pinned, audible, explicitly protected, or very recently active tabs
- `routine low-need sleep`
  - stale or low-value tabs that should be confidently sleepable
- `frequent/protected preservation`
  - tabs that may look sleepable by inactivity alone but should stay awake because of repeated behavioral importance
- `temporal ambiguity`
  - cases where summary statistics hide the sequence information needed for the right decision
- `feedback-sensitive`
  - cases where recent undo, bad feedback, or regret history should strongly influence behavior
- `context wake`
  - cases where re-entering a context should wake slept sibling tabs

### Benchmark Intent

The benchmark is designed to answer two main questions:

1. Which context surface is best for autonomous tab sleep and wake decisions?
2. Where does lightweight memory appear to help beyond the base heuristic policy?

The benchmark should remain:

- small enough to inspect manually
- broad enough to support claims
- explicit about expected outcomes
- reusable when the policy or memory layer evolves

## Metrics

### Core Decision Metrics

- `exact-match rate`
  - whether the predicted sleep set exactly matches the expected sleep set
- `precision`
  - how often predicted sleep candidates are actually correct
- `recall`
  - how often expected sleep candidates are successfully identified
- `F1`
  - the balance between precision and recall

### Safety and Interruption Metrics

- `protected-tab violations`
  - counts cases where the policy proposes sleeping tabs that should remain protected
- `regret-sensitive errors`
  - counts cases where recent regret or negative feedback should have changed the decision
- `undo-sensitive errors`
  - counts cases where the policy repeats mistakes that undo-like signals already exposed
- `wake success rate`
  - measures whether wake scenarios restore the correct slept siblings when context returns

### Reporting Lens

- category-level performance by scenario type
- interruption risk summaries for presentation- and blog-level storytelling

## Poor Person's RL / Memory Design

The feedback-driven learning loop is intentionally lightweight and interpretable.

Instead of full RL, the system should:

1. log actions and outcomes
2. aggregate repeated signals
3. synthesize stable patterns into memory
4. consult that memory before future suggestions or evaluations

### Memory Pattern Types

- regret patterns
  - repeated undo, bad feedback, quick reopen, or manual wake after sleep
- safe-sleep patterns
  - repeated successful sleeps without negative follow-up
- protection patterns
  - repeated protect behavior or high-risk recurring contexts
- wake patterns
  - recurring cases where context return makes sibling wake useful

### Memory Format

The memory artifact should be human-readable and inspectable, likely as Markdown. It should support reusable patterns at several levels:

- URL
- domain
- group or context
- optional time-pattern hints when clearly useful

### Memory Usage

The memory should serve two roles:

- policy memory
  - conservatively bias future scores and decisions
- agent memory
  - support explanations, summaries, policy-tuning ideas, and protected-context suggestions

Memory should remain advisory. Hard guardrails and local policy constraints still win.

## Evidence Inventory

### Controlled Benchmark Outputs

- canonical scenario set
- benchmark result rows by scenario and variant
- aggregate benchmark comparison table
- category-level comparison table
- benchmark narrative summary

### Canonical Benchmark Result Row

Each benchmark run should emit one row per scenario, per variant, and per memory condition.

Recommended fields:

- `scenario_id`
- `scenario_name`
- `fixture_category`
- `research_category`
- `variant`
- `memory_condition`
- `expected_sleep_set`
- `predicted_sleep_set`
- `exact_match`
- `precision`
- `recall`
- `f1`
- `protected_violations`
- `regret_sensitive_errors`
- `undo_sensitive_errors`
- `wake_success`
- `notes`

This row format is the bridge between the fixture benchmark, later memory evaluation, and final plots.

### Live Telemetry / Admin Outputs

- reward and regret trends
- counts for `undo`, `protect`, `good`, and `bad` signals
- autonomous sleep and wake counts
- policy-training signal summaries

### Memory Experiment Outputs

- memory artifact
- memory generation summary
- `memory_off` vs `memory_on` comparison table
- memory-focused case studies

### Final Public Assets

- one overall context comparison figure
- one safety / interruption comparison figure
- one category-level comparison figure
- one memory before/after figure
- two to four concrete scenario case studies

## Findings

Placeholder for validated findings once the benchmark and memory comparison are rerun with the stabilized terminology and taxonomy.

## Presentation Outline

Placeholder for the final presentation structure once the main results are stable.

Likely arc:

1. problem
2. system loop
3. context question
4. memory question
5. method
6. results
7. takeaways

## Blog Post Outline

Placeholder for the future technical post once the benchmark tables, plots, and memory comparison are finalized.

Likely arc:

1. hook: tab management is a prediction problem
2. system overview
3. context variants
4. benchmark design
5. results
6. poor person's RL / memory
7. lessons and limitations
