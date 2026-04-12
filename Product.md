# Tab Agent - Product Document

## Product vision

Tab Agent is moving from a smart tab assistant to a **personalized browser memory-management agent**.

The long-term vision is broader than tabs:

> computers should not manage memory with static heuristics alone; they should learn how each person works and proactively allocate resources with minimal interruption.

The current wedge is the browser.

## The problem

Today, browser memory management is mostly generic and rule-based.

That creates two problems:

### 1. Performance problem

- too many open tabs consume memory
- users experience slowdowns and reloads

### 2. Cognitive problem

- users constantly decide what to close, keep, reopen, or protect
- manual memory management interrupts work

Static rules do not understand:

- what the user is likely to need next
- which tabs belong to the same working context
- which tabs are repeatedly revisited
- which actions the user later regrets

## Product thesis

The right product is not just "tab grouping."

The right product is a **context-aware agent** that:

- observes usage patterns
- predicts near-term need
- acts conservatively on the user's behalf
- improves through feedback

This creates a data flywheel:

`usage -> behavioral data -> better policy -> better UX -> more usage`

## Product progression

### Stage 1 - Assistant MVP

Delivered:

- Gemini Nano grouping
- persistent groups
- manual sleep/wake/close
- frequent-tab protection
- Stats page
- grouping-quality ratings
- study submission

This version is intelligent, but not autonomous.

### Stage 2 - Agentic browser version

Current product:

- autonomous sleep
- context wake
- action explanations
- raw tab lifecycle logging
- undo
- protect/unprotect
- implicit + explicit feedback loop
- adaptive thresholding from recent outcomes
- training-example export for offline policy learning
- OpenAI-assisted policy summaries

This is the first true agent version because it closes the loop:

`observe -> predict -> act -> learn`

Repo split for this stage:

- `tab_agent` = extension runtime and local policy
- `tab_agent_web` = storage, admin analysis, and OpenAI summaries

### Stage 3 - Broader memory-management platform

Longer term:

- browser plus app-level context
- broader compute/memory coordination
- system-wide personalization

## Why this is different

Most tab or memory tools are:

- rule-based
- manual
- non-personalized

Tab Agent is different because of:

- **personalization**
- **autonomy**
- **feedback-driven improvement**
- **explainability**

The core contribution is **not** "we used an LLM."

The real contribution is:

- a learned policy
- behavior memory
- conservative autonomous action
- a measurable tradeoff between saved memory and interruption cost

In the current version, the runtime policy is still mostly heuristic, but the product now exports the data needed for:

- offline policy training
- threshold tuning
- future reranking / classifier experiments

## OpenAI role

OpenAI is not the hot-path controller.

The browser agent still decides locally in real time.

OpenAI is used to:

- summarize behavior
- explain actions
- recommend threshold changes
- identify contexts that should be protected

The summary layer can benchmark three context formulations:

- summarized behavior only
- raw recent event log only
- hybrid context

This keeps the product:

- faster
- more private
- more benchmarkable
- easier to trust

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

## Near-term target

The near-term target is:

- a working Chrome browser agent
- conservative autonomous sleep
- context wake
- action feed
- feedback loop
- OpenAI-assisted policy summary
- admin comparison against a fixed-rule baseline

That is enough to demonstrate:

- a real data flywheel
- a real step from assistant to agent
- a credible wedge into broader memory-management software

The next product-learning step is:

- keep hard guardrails fixed
- use exported action/outcome/event data for offline learning
- then add small, safe personalized threshold updates before any broader post-training loop
