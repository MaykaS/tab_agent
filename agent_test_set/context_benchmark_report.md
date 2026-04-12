# Context Benchmark Report

Generated from the current fixture set with deterministic context ablations.

## Comparison table

| Variant | Exact-match | Precision | Recall | F1 | Protected violations | Regret-handling notes | Summary rubric |
| --- | --- | --- | --- | --- | --- | --- | --- |
| minimal | 9/17 | 0.97 | 0.73 | 0.74 | 1 | No negative replay fixture; Preserved recent negative-feedback targets | 6.35/8 |
| summary_only | 13/17 | 0.94 | 0.91 | 0.88 | 2 | No negative replay fixture; Still proposes a negative-feedback target | 6.35/8 |
| raw_log_only | 17/17 | 1.00 | 1.00 | 1.00 | 0 | No negative replay fixture; Still proposes a negative-feedback target; Preserved recent negative-feedback targets | 6.24/8 |
| hybrid | 17/17 | 1.00 | 1.00 | 1.00 | 0 | No negative replay fixture; Still proposes a negative-feedback target; Preserved recent negative-feedback targets | 6.00/8 |

## Conclusions

- Local policy winner: **raw_log_only**. Raw event sequence adds the most value on temporal ambiguity cases while summary context remains a strong low-complexity baseline.
- LLM analysis winner: **summary_only**. Hybrid context adds sequence awareness without requiring the runtime policy to depend on raw logs.
- Raw logs are worth keeping for benchmarking and explanations, but they do not yet justify replacing summarized behavior as the main decision surface.

## Per-scenario notes

### deep_work_cluster

- `minimal`: predicted ["https://news.example.com/story","https://wikipedia.org/wiki/Test"] | exact=true | precision=1.00 | recall=1.00 | rubric=7/8 | No negative replay fixture
- `summary_only`: predicted ["https://news.example.com/story","https://wikipedia.org/wiki/Test"] | exact=true | precision=1.00 | recall=1.00 | rubric=7/8 | No negative replay fixture
- `raw_log_only`: predicted ["https://news.example.com/story","https://wikipedia.org/wiki/Test"] | exact=true | precision=1.00 | recall=1.00 | rubric=6/8 | No negative replay fixture
- `hybrid`: predicted ["https://news.example.com/story","https://wikipedia.org/wiki/Test"] | exact=true | precision=1.00 | recall=1.00 | rubric=7/8 | No negative replay fixture

### heavy_productivity_cluster

- `minimal`: predicted [] | exact=true | precision=1.00 | recall=1.00 | rubric=7/8 | No negative replay fixture
- `summary_only`: predicted [] | exact=true | precision=1.00 | recall=1.00 | rubric=7/8 | No negative replay fixture
- `raw_log_only`: predicted [] | exact=true | precision=1.00 | recall=1.00 | rubric=7/8 | No negative replay fixture
- `hybrid`: predicted [] | exact=true | precision=1.00 | recall=1.00 | rubric=7/8 | No negative replay fixture

### research_sprawl

- `minimal`: predicted ["https://arxiv.org/abs/2","https://arxiv.org/abs/3"] | exact=false | precision=1.00 | recall=0.67 | rubric=6/8 | No negative replay fixture
- `summary_only`: predicted ["https://arxiv.org/abs/1","https://arxiv.org/abs/2","https://arxiv.org/abs/3"] | exact=true | precision=1.00 | recall=1.00 | rubric=6/8 | No negative replay fixture
- `raw_log_only`: predicted ["https://arxiv.org/abs/1","https://arxiv.org/abs/2","https://arxiv.org/abs/3"] | exact=true | precision=1.00 | recall=1.00 | rubric=6/8 | No negative replay fixture
- `hybrid`: predicted ["https://arxiv.org/abs/1","https://arxiv.org/abs/2","https://arxiv.org/abs/3"] | exact=true | precision=1.00 | recall=1.00 | rubric=5/8 | No negative replay fixture

### media_audible_safety

- `minimal`: predicted [] | exact=true | precision=1.00 | recall=1.00 | rubric=6/8 | No negative replay fixture
- `summary_only`: predicted [] | exact=true | precision=1.00 | recall=1.00 | rubric=6/8 | No negative replay fixture
- `raw_log_only`: predicted [] | exact=true | precision=1.00 | recall=1.00 | rubric=6/8 | No negative replay fixture
- `hybrid`: predicted [] | exact=true | precision=1.00 | recall=1.00 | rubric=6/8 | No negative replay fixture

### pinned_tab_safety

- `minimal`: predicted [] | exact=true | precision=1.00 | recall=1.00 | rubric=6/8 | No negative replay fixture
- `summary_only`: predicted [] | exact=true | precision=1.00 | recall=1.00 | rubric=6/8 | No negative replay fixture
- `raw_log_only`: predicted [] | exact=true | precision=1.00 | recall=1.00 | rubric=6/8 | No negative replay fixture
- `hybrid`: predicted [] | exact=true | precision=1.00 | recall=1.00 | rubric=6/8 | No negative replay fixture

### recent_activity_safety

- `minimal`: predicted [] | exact=true | precision=1.00 | recall=1.00 | rubric=6/8 | No negative replay fixture
- `summary_only`: predicted [] | exact=true | precision=1.00 | recall=1.00 | rubric=6/8 | No negative replay fixture
- `raw_log_only`: predicted [] | exact=true | precision=1.00 | recall=1.00 | rubric=6/8 | No negative replay fixture
- `hybrid`: predicted [] | exact=true | precision=1.00 | recall=1.00 | rubric=6/8 | No negative replay fixture

### frequent_tab_protection

- `minimal`: predicted [] | exact=true | precision=1.00 | recall=1.00 | rubric=6/8 | No negative replay fixture
- `summary_only`: predicted [] | exact=true | precision=1.00 | recall=1.00 | rubric=6/8 | No negative replay fixture
- `raw_log_only`: predicted [] | exact=true | precision=1.00 | recall=1.00 | rubric=6/8 | No negative replay fixture
- `hybrid`: predicted [] | exact=true | precision=1.00 | recall=1.00 | rubric=6/8 | No negative replay fixture

### explicit_protected_context

- `minimal`: predicted [] | exact=true | precision=1.00 | recall=1.00 | rubric=7/8 | No negative replay fixture
- `summary_only`: predicted [] | exact=true | precision=1.00 | recall=1.00 | rubric=7/8 | No negative replay fixture
- `raw_log_only`: predicted [] | exact=true | precision=1.00 | recall=1.00 | rubric=7/8 | No negative replay fixture
- `hybrid`: predicted [] | exact=true | precision=1.00 | recall=1.00 | rubric=7/8 | No negative replay fixture

### regret_history_tab

- `minimal`: predicted [] | exact=true | precision=1.00 | recall=1.00 | rubric=7/8 | No negative replay fixture
- `summary_only`: predicted [] | exact=true | precision=1.00 | recall=1.00 | rubric=7/8 | No negative replay fixture
- `raw_log_only`: predicted [] | exact=true | precision=1.00 | recall=1.00 | rubric=6/8 | No negative replay fixture
- `hybrid`: predicted [] | exact=true | precision=1.00 | recall=1.00 | rubric=7/8 | No negative replay fixture

### mixed_safe_sleep_batch

- `minimal`: predicted ["https://food.example.com/recipe","https://shop.example.com/item"] | exact=false | precision=1.00 | recall=0.50 | rubric=7/8 | No negative replay fixture
- `summary_only`: predicted ["https://example.com/ref1","https://example.com/ref2","https://food.example.com/recipe","https://shop.example.com/item"] | exact=true | precision=1.00 | recall=1.00 | rubric=7/8 | No negative replay fixture
- `raw_log_only`: predicted ["https://example.com/ref1","https://example.com/ref2","https://food.example.com/recipe","https://shop.example.com/item"] | exact=true | precision=1.00 | recall=1.00 | rubric=7/8 | No negative replay fixture
- `hybrid`: predicted ["https://example.com/ref1","https://example.com/ref2","https://food.example.com/recipe","https://shop.example.com/item"] | exact=true | precision=1.00 | recall=1.00 | rubric=5/8 | No negative replay fixture

### assistant_rule_agent_comparison

- `minimal`: predicted ["https://news.example.com/market","https://travel.example.com/"] | exact=false | precision=1.00 | recall=0.67 | rubric=6/8 | Preserved recent negative-feedback targets
- `summary_only`: predicted ["https://docs.example.com/case","https://news.example.com/market","https://travel.example.com/"] | exact=true | precision=1.00 | recall=1.00 | rubric=6/8 | Still proposes a negative-feedback target
- `raw_log_only`: predicted ["https://docs.example.com/case","https://news.example.com/market","https://travel.example.com/"] | exact=true | precision=1.00 | recall=1.00 | rubric=6/8 | Still proposes a negative-feedback target
- `hybrid`: predicted ["https://docs.example.com/case","https://news.example.com/market","https://travel.example.com/"] | exact=true | precision=1.00 | recall=1.00 | rubric=6/8 | Still proposes a negative-feedback target

### same_summary_different_sequence_a

- `minimal`: predicted ["https://archive.example.com/old-article","https://briefs.example.com/fresh-brief"] | exact=false | precision=0.50 | recall=1.00 | rubric=6/8 | No negative replay fixture
- `summary_only`: predicted ["https://archive.example.com/old-article","https://briefs.example.com/fresh-brief"] | exact=false | precision=0.50 | recall=1.00 | rubric=6/8 | No negative replay fixture
- `raw_log_only`: predicted ["https://archive.example.com/old-article"] | exact=true | precision=1.00 | recall=1.00 | rubric=6/8 | No negative replay fixture
- `hybrid`: predicted ["https://archive.example.com/old-article"] | exact=true | precision=1.00 | recall=1.00 | rubric=6/8 | No negative replay fixture

### same_summary_different_sequence_b

- `minimal`: predicted ["https://archive.example.com/old-article-b","https://briefs.example.com/stale-brief"] | exact=true | precision=1.00 | recall=1.00 | rubric=6/8 | No negative replay fixture
- `summary_only`: predicted ["https://archive.example.com/old-article-b","https://briefs.example.com/stale-brief"] | exact=true | precision=1.00 | recall=1.00 | rubric=6/8 | No negative replay fixture
- `raw_log_only`: predicted ["https://archive.example.com/old-article-b","https://briefs.example.com/stale-brief"] | exact=true | precision=1.00 | recall=1.00 | rubric=6/8 | No negative replay fixture
- `hybrid`: predicted ["https://archive.example.com/old-article-b","https://briefs.example.com/stale-brief"] | exact=true | precision=1.00 | recall=1.00 | rubric=5/8 | No negative replay fixture

### burst_then_return

- `minimal`: predicted [] | exact=false | precision=1.00 | recall=0.00 | rubric=6/8 | No negative replay fixture
- `summary_only`: predicted ["https://burst.example.com/ref1","https://burst.example.com/ref2","https://burst.example.com/ref3"] | exact=true | precision=1.00 | recall=1.00 | rubric=6/8 | No negative replay fixture
- `raw_log_only`: predicted ["https://burst.example.com/ref1","https://burst.example.com/ref2","https://burst.example.com/ref3"] | exact=true | precision=1.00 | recall=1.00 | rubric=6/8 | No negative replay fixture
- `hybrid`: predicted ["https://burst.example.com/ref1","https://burst.example.com/ref2","https://burst.example.com/ref3"] | exact=true | precision=1.00 | recall=1.00 | rubric=5/8 | No negative replay fixture

### opened_not_used

- `minimal`: predicted ["https://archive.example.com/unused"] | exact=false | precision=1.00 | recall=0.50 | rubric=6/8 | No negative replay fixture
- `summary_only`: predicted ["https://archive.example.com/unused"] | exact=false | precision=1.00 | recall=0.50 | rubric=6/8 | No negative replay fixture
- `raw_log_only`: predicted ["https://archive.example.com/unused","https://unused.example.com/new"] | exact=true | precision=1.00 | recall=1.00 | rubric=6/8 | No negative replay fixture
- `hybrid`: predicted ["https://archive.example.com/unused","https://unused.example.com/new"] | exact=true | precision=1.00 | recall=1.00 | rubric=5/8 | No negative replay fixture

### repeated_open_close_cycle

- `minimal`: predicted [] | exact=false | precision=1.00 | recall=0.00 | rubric=6/8 | No negative replay fixture
- `summary_only`: predicted [] | exact=false | precision=1.00 | recall=0.00 | rubric=6/8 | No negative replay fixture
- `raw_log_only`: predicted ["https://notes.example.com/release"] | exact=true | precision=1.00 | recall=1.00 | rubric=6/8 | No negative replay fixture
- `hybrid`: predicted ["https://notes.example.com/release"] | exact=true | precision=1.00 | recall=1.00 | rubric=6/8 | No negative replay fixture

### feedback_after_sleep_sequence

- `minimal`: predicted [] | exact=false | precision=1.00 | recall=0.00 | rubric=7/8 | Preserved recent negative-feedback targets
- `summary_only`: predicted ["https://notes.example.com/reference","https://people.example.com/candidate"] | exact=false | precision=0.50 | recall=1.00 | rubric=7/8 | Still proposes a negative-feedback target
- `raw_log_only`: predicted ["https://notes.example.com/reference"] | exact=true | precision=1.00 | recall=1.00 | rubric=7/8 | Preserved recent negative-feedback targets
- `hybrid`: predicted ["https://notes.example.com/reference"] | exact=true | precision=1.00 | recall=1.00 | rubric=7/8 | Preserved recent negative-feedback targets

## Notes

- Scenario count: 17
- Existing scenarios without explicit event logs use a synthesized event sequence derived from their summary state.
- Summary rubric is an automatic heuristic proxy to support quick iteration; final presentation scores can still be manually checked.
