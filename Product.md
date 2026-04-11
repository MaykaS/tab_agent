# Tab Agent - Product Document

## Product vision

Tab Agent is evolving from a smart tab assistant into a **personalized browser memory-management agent**.

The long-term vision is broader than tabs: computers should not manage memory with static heuristics alone. They should learn how each person works and proactively allocate resources with minimal interruption.

The current product wedge is the browser.

---

## Problem

Today, browser memory management is mostly generic and rule-based.

That creates two failures:

1. **Performance failure**
- too many open tabs consume memory
- users experience slowdowns and reloads

2. **Cognitive failure**
- users constantly decide what to close, keep, reopen, or protect
- manual memory management interrupts work

Static rules do not understand:

- what the user is likely to need next
- which tabs belong to the same working context
- which tabs are repeatedly revisited
- which decisions the user regrets

---

## Product thesis

The right solution is not just grouping tabs.

The right solution is a **context-aware agent** that:

- observes usage patterns
- predicts near-term need
- acts conservatively on the user’s behalf
- improves through feedback

That creates a data flywheel:

`usage -> behavioral data -> better policy -> better UX -> more usage`

---

## Product progression

### Stage 1 - Assistant MVP

Delivered:

- Gemini Nano tab grouping
- persistent groups
- manual sleep/wake/close
- frequent-tab protection
- Stats page
- grouping-quality ratings
- study submission

This version is intelligent, but not autonomous.

### Stage 2 - Agentic browser version

Current direction:

- autonomous sleep
- context wake
- action explanations
- undo
- protect/unprotect
- implicit + explicit feedback loop
- OpenAI-assisted policy summaries

This is the first true agent version because it closes the loop:

`observe -> predict -> act -> learn`

This stage is still implemented through the browser wedge:

- extension logic lives in `tab_agent`
- storage, admin analysis, and OpenAI summaries live in `tab_agent_web`

### Stage 3 - Broader memory-management platform

Longer term:

- browser plus app-level context
- broader compute/memory coordination
- system-wide personalization

---

## Why this is different

Most tab or memory tools are:

- rule-based
- manual
- non-personalized

Tab Agent’s differentiation is:

- **personalization**
- **autonomy**
- **feedback-driven improvement**
- **explainability**

The core contribution is not “using an LLM.”

The core contribution is:

- a learned policy
- behavior memory
- conservative autonomous action
- a measurable tradeoff between saved memory and interruption cost

---

## OpenAI role

OpenAI is not the hot-path action engine in this version.

The browser agent still decides locally in real time.

OpenAI is used to:

- summarize behavior
- explain actions
- recommend threshold changes
- identify contexts that should be protected

This keeps the product:

- faster
- more private
- more benchmarkable
- easier to trust

---

## Benchmark framing

The product should be compared against:

- **Baseline A:** fixed rule policy
- **Baseline B:** assistant MVP
- **Experimental:** autonomous personalized agent

The goal is not just lower memory.

The goal is:

> maximize memory saved while minimizing user interruption

### Benefit
- estimated memory saved
- autonomous sleep count
- lower open-tab memory footprint

### Cost
- reopen within 5 / 15 minutes
- undo rate
- manual wake soon after sleep
- explicit bad-feedback rate

### User outcome
- trust
- usefulness
- willingness to use

---

## Near-term build target

By the end of next week, the target product is:

- a working Chrome browser agent
- with conservative autonomous sleep
- context wake
- action feed
- feedback loop
- OpenAI-assisted policy summary
- admin comparison against a fixed-rule baseline

This is enough to demonstrate a real data flywheel and a meaningful step from assistant to agent.
