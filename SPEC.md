# SPEC.md - Tab Agent

## One-line spec

Tab Agent is a Chrome extension that combines:

- Gemini Nano tab grouping
- local autonomous sleep/wake policy
- feedback-driven learning
- OpenAI-assisted summaries and tuning recommendations

This version is **browser-only**.  
It does **not** yet manage full system CPU or memory.

## Product status

### Assistant layer

Already implemented:

- read open tabs
- group tabs by topic
- cache groups
- manual sleep / wake / close
- frequent-tab protection
- Stats page
- grouping-quality ratings
- study submission

### Agentic layer

Already implemented:

- autonomous sleep
- context wake
- action log
- raw tab event log
- undo
- protect
- explicit good/bad feedback
- local behavior memory
- adaptive policy summary
- training-example export for offline learning
- OpenAI summary generation
- collapsible Stats feeds for autonomous actions and raw events

## Core prediction target

The local policy predicts:

- `willNeedInNext15Min`

## Safety rules

The agent must not auto-sleep:

- pinned tabs
- very recently active tabs
- frequent tabs
- protected tabs or groups
- audible tabs when detectable

The agent must not autonomously:

- close tabs
- aggressively speculative-wake tabs
- manage memory outside the browser

## Feedback model

### Primary signals

- reopen within 5 minutes after auto-sleep
- reopen within 15 minutes after auto-sleep
- undo
- manual wake shortly after sleep
- repeated protect behavior

### Secondary signals

- explicit `Good`
- explicit `Bad`

### Stored learning outputs

- regret count
- safe-sleep count
- protection count
- per-action outcome history

## Data stored or sent

| Data | Location | Purpose |
|------|----------|---------|
| Visit history | `chrome.storage.local` | Recency/frequency learning |
| Cached groups | `chrome.storage.local` | Group persistence and context wake |
| Asleep state | `chrome.storage.local` | UI + wake behavior |
| URL behavior model | `chrome.storage.local` | Per-tab learning state |
| Group behavior model | `chrome.storage.local` | Per-context learning state |
| Agent policy | `chrome.storage.local` | Thresholds and safeguards |
| Agent action log | `chrome.storage.local` | Autonomous action feed |
| Feedback log | `chrome.storage.local` | Undo/regret/protect/good/bad |
| Tab event log | `chrome.storage.local` | Temporal-order context + training data |
| Protected contexts | `chrome.storage.local` | User overrides |
| Study submissions | Neon Postgres | Research/admin analysis |
| OpenAI summaries | local storage + web API | Advisory policy output |

## OpenAI role

OpenAI is **advisory only** in this version.

It does not directly control browser actions.

### OpenAI input

Structured context only:

1. current session context
2. behavior summary
3. recent autonomous action history
4. optional truncated raw event window

Supported context variants:

- `recency_only`
- `summary_only`
- `raw_log_only`
- `hybrid`

### OpenAI output

- summary
- threshold suggestions
- protected-context suggestions
- explanation copy

## Evaluation framing

### Baseline A

Static rule-based tab management:

- fixed inactivity threshold
- no personalization

### Baseline B

Assistant MVP:

- AI grouping
- manual execution

### Experimental

Personalized autonomous agent:

- local prediction
- autonomous sleep
- context wake
- feedback loop

## Success metrics

- estimated memory saved
- autonomous sleep count
- autonomous wake count
- reopen/regret count
- undo rate
- explicit bad-feedback rate
- usefulness
- trust
- willingness to use

## Test-set expectations

The extension repo includes `agent_test_set/`.

The reusable test set must cover:

- sleep decisions
- context wake decisions
- hard safety constraints
- regret outcomes
- explicit feedback outcomes
- rule vs assistant vs agent comparison cases
- temporal-order context ambiguity cases
- summary vs raw vs hybrid context comparisons

The current evaluation split is:

- fixed benchmark for context variants
- personalized benchmark for feedback-derived memory

## Acceptance criteria

- extension runs from an unpacked folder
- popup still supports manual grouping and group actions
- background worker runs a periodic autonomous cycle
- protected/frequent/recent tabs are not auto-slept
- activating a related tab can wake slept siblings
- Stats page shows autonomous actions and feedback controls
- Stats page exposes the raw tab event log without overwhelming the layout
- undo / protect / good / bad are stored and surfaced
- study submissions include autonomous metrics and baseline comparison data
- exported payload includes `tabEventLog`, `recentTabEvents`, `adaptivePolicySummary`, and `trainingExamples`
- website stores and displays autonomous telemetry
- OpenAI summary endpoint returns structured output or safe fallback

## Known limitations

- memory values are estimated on Chrome stable
- v1 policy is intentionally conservative
- OpenAI is advisory, not the controller
- full computer memory management is future scope
