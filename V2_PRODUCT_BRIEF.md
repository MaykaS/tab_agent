# Tab Agent V2 Product Brief

## Product definition

Tab Agent is a **focus-first browser memory agent for knowledge workers**.

Its job is to:

- reduce tab clutter and memory pressure
- protect active work contexts
- act conservatively on the user's behalf
- learn which contexts are safe and which are costly to interrupt

The product promise is:

**Protect focus flow first, save memory second, and restore context when useful.**

## Primary user

Tab Agent V2 is optimized first for **knowledge workers**:

- students
- operators
- PMs
- researchers
- designers
- engineers
- recruiting/job-search users

These users often keep many tabs open across multiple working contexts and need:

- low friction
- quiet assistance
- fewer focus-breaking surprises

## Product wedge

Tab Agent is not trying to be a full browser copilot or a system-wide memory manager.

The v2 wedge is narrower and stronger:

**A browser agent that learns what tab contexts are safe to compress and what contexts should stay protected.**

## Core loop

`observe -> predict -> act -> learn`

### Observe

The agent reads:

- open tabs
- active tab
- cached groups
- recent activations
- raw tab lifecycle events
- URL behavior memory
- group behavior memory
- protected contexts

### Predict

The local policy estimates near-term need using:

- recency
- visit frequency
- revisit interval
- time/day affinity
- group recency
- regret history
- safe-sleep history
- protection history
- recent sequence context

### Act

V2 allows:

- conservative `auto_sleep`
- context-aware `auto_wake`

V2 does not allow:

- autonomous close
- speculative wake spam
- cloud LLM control over real-time browser actions

### Learn

The system learns from:

- undo
- protect
- good/bad feedback
- reopen shortly after sleep
- manual wake after sleep
- repeated safe-sleep outcomes

## Product posture

### 1. Observe, then act

New users start in **observation mode**, not full autonomy.

In observation mode, Tab Agent can:

- group tabs
- identify low-risk sleep candidates
- log "would have slept" suggestions
- collect feedback and outcome signals
- wake context conservatively when confidence is high

Autonomous sleep unlocks only after the trust gate is satisfied.

### 2. Trust-earned autonomy

Autonomy is earned, not assumed.

The system moves from:

- `observing`

to:

- `trusted_autonomy`

only when it has enough history, enough feedback/safe evidence, and no strong negative recent pattern.

### 2.5. Quiet surfaces

The UI should stay concise.

- the popup is an **action surface**
- the Stats page is a **trust surface**
- raw logs and deeper telemetry stay secondary

The user should not need to read paragraphs to understand what the agent is doing.

### 3. Caution-first memory

Tab Agent should learn faster from costly mistakes than from weak positive evidence.

That means memory is used first to:

- avoid repeated regret
- avoid repeated undo
- avoid repeatedly protected contexts

Only after stronger evidence should memory increase confidence in safe sleep patterns.

## Product principles

### Better to miss a sleep than break focus

The product should prefer under-automation to disruptive automation.

### The product should feel quiet

If users constantly think about the agent, the product is failing.

### The product should stay useful without ideal setup

If on-device AI is unavailable, the extension should still group tabs, log feedback, export data, and remain usable.

### OpenAI is advisory only

Local policy owns real-time actions.

OpenAI is used for:

- behavior summaries
- explanation support
- policy-tuning suggestions
- suggested protected contexts

## Why this is agentic

Tab Agent is agentic because it:

- observes browser state continuously
- makes bounded predictions
- takes real actions without requiring user prompts
- records outcomes
- adapts through behavior memory and feedback

It is not just a UI wrapper around manual commands.

## Why this can become a good product

The opportunity is real because:

- tab overload is painful
- generic browser memory rules are not personalized
- users repeatedly revisit contexts that static heuristics cannot distinguish well

The main condition for success is not "more AI."

The main condition is:

**users trust it enough to leave it on.**

## Product risks

### 1. Popup latency

If grouping takes too long, the product feels heavy and fragile.

### 2. Over-aggressive auto-sleep

A few bad sleeps in valuable contexts can destroy trust faster than memory savings can rebuild it.

### 3. Prototype leakage

If the user sees too much internal complexity, the product feels experimental rather than dependable.

### 4. Misplaced memory learning

If memory overgeneralizes from too little evidence, the system becomes overly timid or inconsistently cautious.

## Product success criteria

### Trust

- user leaves the agent enabled
- fewer repeated mistakes over time
- fewer costly sleeps in important contexts

### Utility

- meaningful memory savings over a fixed rule baseline
- useful context wake behavior
- lower manual tab-management burden

### Learning

- feedback changes future behavior
- learned caution areas become visible and defensible
- memory-on evaluation beats memory-off on feedback-sensitive cases

## Relationship to evaluation

Tab Agent V2 should be evaluated across three layers:

### 1. Context quality

Compare:

- `recency_only`
- `summary_only`
- `raw_log_only`
- `hybrid`

### 2. Memory quality

Compare:

- `memory_off`
- `memory_on`

### 3. Product proof

Measure:

- whether users keep it on
- whether repeated mistakes decline
- whether memory savings remain meaningful without trust collapse

## Repo guidance

Use this product brief for:

- product framing
- professor conversations
- blog/post preparation
- portfolio-quality repo storytelling

Use [EVAL_AND_STORY.md](/C:/Users/mayas/OneDrive/Desktop/Projects/tab%20agent/EVAL_AND_STORY.md) for:

- benchmark design
- experiment logic
- metrics
- research findings
