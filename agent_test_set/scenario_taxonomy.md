# Scenario Taxonomy

This file maps the compact fixture categories in [scenarios.json](/C:/Users/mayas/OneDrive/Desktop/Projects/tab%20agent/agent_test_set/scenarios.json) to the stable research taxonomy used by [EVAL_AND_STORY.md](/C:/Users/mayas/OneDrive/Desktop/Projects/tab%20agent/EVAL_AND_STORY.md) and the benchmark report.

## Research Categories

- `safety`
- `routine low-need sleep`
- `frequent/protected preservation`
- `temporal ambiguity`
- `feedback-sensitive`
- `context wake`

## Scenario Mapping

| Scenario | Fixture category | Research category | Why it belongs there |
| --- | --- | --- | --- |
| `deep_work_cluster` | `sleep` | `routine low-need sleep` | Preserves the active work cluster while sleeping stale reading tabs. |
| `heavy_productivity_cluster` | `sleep` | `frequent/protected preservation` | Tests whether high-frequency productivity tabs stay protected despite inactivity. |
| `research_sprawl` | `sleep` | `routine low-need sleep` | Focuses on confidently sleeping stale research tabs while preserving the main research context. |
| `media_audible_safety` | `safety` | `safety` | Audible tabs must never be auto-slept. |
| `pinned_tab_safety` | `safety` | `safety` | Pinned tabs must remain outside the autonomous sleep candidate set. |
| `recent_activity_safety` | `safety` | `safety` | Very recently active tabs must remain protected. |
| `frequent_tab_protection` | `safety` | `frequent/protected preservation` | Highlights behaviorally important tabs that a naive inactivity rule might sleep. |
| `explicit_protected_context` | `safety` | `safety` | Explicit user protection must dominate policy scoring. |
| `regret_history_tab` | `feedback` | `feedback-sensitive` | Repeated regret history should suppress future sleep decisions. |
| `context_wake_success` | `wake` | `context wake` | Positive sibling-wake case when the user returns to the same context. |
| `context_wake_noop` | `wake` | `context wake` | Wake logic should do nothing when there are no slept siblings to restore. |
| `mixed_safe_sleep_batch` | `sleep` | `routine low-need sleep` | Tests whether multiple clearly stale tabs are safely identified together. |
| `assistant_rule_agent_comparison` | `benchmark` | `feedback-sensitive` | Compares rule and agent behavior in a case with recent negative feedback pressure. |
| `same_summary_different_sequence_a` | `sleep` | `temporal ambiguity` | Raw sequence information distinguishes this case from a similar summary-only state. |
| `same_summary_different_sequence_b` | `sleep` | `temporal ambiguity` | Same summary statistics as another scenario, but different sequence should change the decision. |
| `burst_then_return` | `sleep` | `temporal ambiguity` | A recent return to the main context should outweigh a short side-tab burst. |
| `opened_not_used` | `sleep` | `temporal ambiguity` | Recently opened tabs that were never meaningfully used should not inherit full recency protection. |
| `repeated_open_close_cycle` | `sleep` | `temporal ambiguity` | Sequence instability marks the tab as low-value in a way summary features alone may miss. |
| `feedback_after_sleep_sequence` | `feedback` | `feedback-sensitive` | Recent undo and explicit bad feedback should override older safe-sleep history. |
| `context_switch_with_sibling_wake` | `wake` | `context wake` | Tests whether wake explanations and sibling restore are context-aware after a switch back. |

## Notes

- The fixture categories remain unchanged so existing scenario data and expectations stay stable.
- The research categories are the presentation- and publication-facing grouping for later plots, tables, and case-study selection.
- This mapping intentionally separates simple safety from behaviorally important preservation and temporally ambiguous decision-making.
