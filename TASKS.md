# TASKS.md - Tab Agent Current Roadmap

This file is now the **current roadmap**, not the original build checklist.

The initial MVP and most of the first agentic layer are already complete. The
remaining work is about tightening evaluation, improving the product for real
pilot users, and preparing the final presentation and blog post.

## Current status

Already complete:

- Gemini Nano grouping
- persistent groups
- manual sleep / wake / close
- autonomous sleep
- context wake
- action log
- raw tab lifecycle event log
- undo / protect / good / bad feedback
- adaptive policy summary
- training-example export
- Stats export button
- benchmark docs and figure generation
- personalized memory benchmark

## Active priorities

### 1. Research and evaluation

- [x] Create a canonical evaluation/story doc
- [x] Normalize context variants to:
  - `recency_only`
  - `summary_only`
  - `raw_log_only`
  - `hybrid`
- [x] Define benchmark taxonomy:
  - safety
  - routine low-need sleep
  - frequent/protected preservation
  - temporal ambiguity
  - feedback-sensitive
  - context wake
- [x] Generate benchmark summaries and figures
- [x] Build a personalized memory benchmark
- [x] Run first `memory_off` vs `memory_on` evaluation
- [ ] Expand memory evaluation with additional real users
- [ ] Add clearer aggregate plots for presentation/blog reuse

### 2. Product readiness for pilot users

- [x] Make extension export easy from the Stats page
- [x] Add a short pilot-user flow in the repo docs
- [ ] Make extension install/setup instructions even cleaner for non-technical users
- [ ] Decide whether to add smart regroup suggestions later

### 3. Memory and learning loop

- [x] Generate readable Markdown memory artifacts from exports
- [x] Separate protection memory from sleepability memory
- [ ] Test memory with more real longitudinal data
- [ ] Decide whether the runtime should consult memory directly

Before changing runtime behavior, explain the reason and expected product impact
first.

### 4. Presentation and writing

- [x] Lock the research framing
- [x] Write a presentation-ready findings summary
- [ ] Turn findings into final slides
- [ ] Ask pilot users to run the extension for a week
- [ ] Draft the technical blog post

## Historical note

The original MVP checklist is now outdated because many "future" features were
implemented already. If needed later, the git history is the best source for
the original step-by-step build sequence.
