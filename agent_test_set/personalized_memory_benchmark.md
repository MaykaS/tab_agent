# Personalized Memory Benchmark

This benchmark is separate from the main fixed scenario benchmark.

That separation is intentional.

## Why it exists

The fixed benchmark is the right tool for evaluating:

- context representation
- `recency_only` vs `summary_only` vs `raw_log_only` vs `hybrid`
- broad behavior across stable scenario categories

But it is not the right tool for evaluating personalized memory from a real user export.

When we tried to apply the first real memory artifact to the fixed synthetic benchmark, the result was `0/20` useful scenarios. That does **not** mean the memory is useless. It means the memory was learned from one user's real contexts, while the synthetic benchmark mostly used unrelated example URLs and domains.

So the memory question needs its own benchmark:

- based on real exported contexts
- focused on repeated-risk, repeated-protect, mixed, and wake patterns
- designed to test whether `memory_on` helps in the places where learned memory should matter

## Current source

This first personalized benchmark is derived from:

- [real_export.json](/C:/Users/mayas/OneDrive/Desktop/Projects/tab%20agent/agent_test_set/real_export.json)
- [real_export.memory.md](/C:/Users/mayas/OneDrive/Desktop/Projects/tab%20agent/agent_test_set/real_export.memory.md)

## Current personalized scenario set

The JSON fixture is here:

- [personalized_memory_benchmark.json](/C:/Users/mayas/OneDrive/Desktop/Projects/tab%20agent/agent_test_set/personalized_memory_benchmark.json)

It currently covers:

- Outlook as a guardrail-first protected context
- Vercel admin/deployment tabs as repeated-risk dev contexts
- Notion workspace as a mixed context
- LinkedIn profile as a mixed context
- Career and Notion wake-return scenarios
- known safe reference tabs with positive sleep history

## How it should be used

Use this benchmark for:

- `memory_off` vs `memory_on`
- checking whether synthesized memory helps the *same user* it was learned from
- showing that memory evaluation must be personalized

Do **not** use this benchmark as the main cross-context benchmark for the whole project.

## Project framing

The clean final framing is:

- fixed benchmark = context evaluation
- personalized benchmark = memory evaluation

That split is more faithful to how personalized agent memory actually works.
