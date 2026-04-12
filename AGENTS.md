# AGENTS.md - Tab Agent

## Plain definition

Tab Agent is a **browser tab memory-management agent**.

In the current version, it:

- observes browser state
- predicts near-term tab need
- acts autonomously in a limited, conservative way
- remembers outcomes and feedback

This is enough to make it **agentic at the browser-tab level**.

It is **not yet**:

- a full computer-wide memory manager
- a production-hardened autonomous system
- an LLM-controlled browser agent

## Core loop

```text
OBSERVE -> PREDICT -> ACT -> LEARN
   ^                         |
   +-------------------------+
```

## Observe

The agent reads:

- open tabs
- active tab
- cached groups
- asleep state
- visit history
- recent activation sequence
- raw tab lifecycle log
- URL behavior memory
- group behavior memory
- protected contexts

## Predict

The local policy predicts:

- `willNeedInNext15Min`

Main inputs:

- recency
- visit frequency
- average revisit interval
- time-of-day affinity
- day-of-week affinity
- group recency
- regret history
- safe-sleep history
- protection history
- recent open/activate/sleep/wake/close sequence

## Act

### Allowed autonomous actions in v1

- `auto_sleep`
- `auto_wake`

### Not allowed in v1

- autonomous close
- aggressive speculative wake
- app/system memory management outside the browser
- OpenAI directly issuing browser actions

## Learn

The agent learns from:

### Implicit feedback

- reopen within 5 minutes
- reopen within 15 minutes
- manual wake after sleep
- undo
- repeated protect behavior

### Explicit feedback

- `Good`
- `Bad`

Each autonomous action stores:

- features at decision time
- score/confidence
- target tab/group
- explanation
- outcome

The extension also stores a raw event log with:

- `open`
- `activate`
- `sleep`
- `wake`
- `close`
- `undo`
- `protect`
- `good_feedback`
- `bad_feedback`

## OpenAI role

OpenAI is **advisory only**.

The local browser policy remains responsible for real-time decisions.

OpenAI is used for:

- behavior summaries
- explanation support
- policy-tuning suggestions
- suggested protected contexts

### OpenAI input

OpenAI receives structured context, not raw browsing dumps:

1. **Current session**
   - open tab count
   - asleep tab count
   - active context
   - recent activations
2. **Behavior summary**
   - recency
   - frequency
   - revisit interval
   - affinity patterns
   - regret/safe/protect counts
3. **Recent autonomous history**
   - action type
   - confidence
   - explanation
   - outcome
   - feedback
4. **Optional raw event window**
   - truncated recent lifecycle log
   - used in `raw_log_only` and `hybrid` modes

### OpenAI output

- summary
- recommendations
- threshold deltas
- suggested protected contexts

## Repo split

### `tab_agent`

Contains:

- extension runtime
- local policy
- popup
- Stats page
- feedback UI

### `tab_agent_web`

Contains:

- study backend
- admin metrics
- OpenAI summary endpoint

Rule of thumb:

- if browser behavior should change -> edit `tab_agent`
- if storage/admin/OpenAI summary should change -> edit `tab_agent_web`

## Storage model

### URL behavior model

```js
urlModel[url] = {
  activationCount,
  lastActiveAt,
  avgReturnMinutes,
  hourCounts,
  dayCounts,
  regretCount,
  safeSleepCount,
  protectionCount,
  coActivationCounts
}
```

### Group behavior model

```js
groupModel[groupName] = {
  activationCount,
  lastActiveAt,
  hourCounts,
  dayCounts,
  regretCount,
  safeSleepCount,
  protectionCount
}
```

### Action log

```js
{
  id,
  type,
  createdAt,
  confidence,
  score,
  reason,
  features,
  target,
  outcome,
  feedback
}
```

### Feedback log

```js
{
  id,
  timestamp,
  actionId,
  type,
  url,
  groupName
}
```

### Tab event log

```js
{
  id,
  timestamp,
  eventType,
  tabId,
  url,
  normalizedUrl,
  title,
  groupName,
  source
}
```

### Adaptive policy summary

The runtime still uses heuristics, but policy thresholds can now shift slightly per user based on recent:

- regret / undo
- safe sleeps
- protect signals

The exported payload includes:

- `baseAgentPolicy`
- `adaptivePolicySummary`
- effective `agentPolicy`
- `trainingExamples`

## Guardrails

Never auto-sleep:

- pinned tabs
- very recently active tabs
- frequent/protected tabs
- audible tabs if detectable

Also:

- no autonomous close
- no OpenAI direct control of tab actions

## Benchmark framing

Compare:

- **Baseline A:** fixed rule-based sleep policy
- **Baseline B:** assistant MVP
- **Experimental:** personalized autonomous agent

Core question:

> Can a personalized autonomous browser policy save more memory than a fixed rule while causing less interruption?

## Out of scope

- autonomous close
- page-content understanding
- full system CPU/memory management
- cloud LLM control over every tab action
