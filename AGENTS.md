# AGENTS.md - Tab Agent Chrome Extension

## What makes this an agent

Tab Agent is no longer just an AI-assisted popup. In the current direction, it has a real:

- **observe** loop
- **predict** loop
- **act** loop
- **learn** loop

The key distinction is:

- the MVP assistant grouped tabs and waited for the user to act
- the agentic version autonomously sleeps low-need tabs and context-wakes related tabs

This version is intentionally conservative. It is browser-only, explainable, and benchmarkable.

---

## Current agent loop

```text
OBSERVE -> PREDICT -> ACT -> LEARN
   ^                         |
   +-------------------------+
```

### 1. Observe

The agent reads:

- open tabs via `chrome.tabs.query`
- the currently activated tab
- cached tab groups
- asleep state
- visit history
- recent activation sequence
- per-URL and per-group behavior models
- protected contexts

### 2. Predict

The local policy predicts:

- `willNeedInNext15Min`

This prediction is built from:

- recency
- visit frequency
- average revisit interval
- time-of-day affinity
- day-of-week affinity
- recent group activity
- regret history
- safe-sleep history
- protection history

### 3. Act

Allowed autonomous actions:

- `auto_sleep`
- `auto_wake`

The agent should not autonomously:

- close tabs
- wake tabs aggressively based only on time prediction
- manage apps outside the browser

Hard safety rules remain outside the model:

- do not auto-sleep pinned tabs
- do not auto-sleep very recently active tabs
- do not auto-sleep frequent/protected tabs
- do not auto-sleep audible tabs if detectable

### 4. Learn

The agent learns from:

#### Implicit feedback
- reopen within 5 minutes of sleep
- reopen within 15 minutes of sleep
- manual wake shortly after sleep
- undo
- repeated protect behavior

#### Explicit feedback
- `Good`
- `Bad`

Each autonomous action becomes a structured example with:

- features at decision time
- score/confidence
- target tab/group
- explanation
- outcome

---

## OpenAI role

OpenAI is **not** the hot-path controller in this version.

The local browser policy still decides real-time sleep/wake actions.

OpenAI is used for:

- summarizing behavior patterns
- generating human-readable policy summaries
- recommending threshold changes
- suggesting protected contexts

### OpenAI context blocks

1. **Current session context**
- open tab count
- asleep tab count
- active group/context
- recent activation sequence
- current grouped tab snapshot

2. **Behavior summary**
- per-tab/group recency
- frequency
- average revisit interval
- hour/day affinity
- co-activation patterns
- regret/safe/protection counts

3. **Recent autonomous actions**
- action type
- confidence
- reason
- outcome
- feedback

OpenAI output should be structured and advisory:

- summary
- recommendations
- threshold deltas
- suggested protected contexts

---

## Components

### `background.js`
- records tab activations
- updates behavior memory
- runs the periodic agent cycle
- handles context wake

### `agent.js`
- builds tab features
- scores need probability
- selects conservative autonomous sleep candidates
- logs autonomous actions

### `storage.js`
- shared persistent memory layer
- visit history
- session log
- URL and group behavior models
- protected contexts
- agent policy
- action log
- feedback log
- study export builder

### `popup.js`
- manual observe/decide/act loop for grouped tabs
- manual sleep/wake/close controls

### `stats.js`
- estimated memory dashboard
- recent autonomous action feed
- undo / protect / good / bad controls
- OpenAI policy summary trigger
- grouping-quality ratings
- study submission

---

## Repo split

- `tab_agent`
  - extension runtime
  - local policy
  - feedback loop UI
- `tab_agent_web`
  - study backend
  - admin metrics
  - OpenAI summary endpoint

Extension behavior changes belong in `tab_agent`, not only in the web repo.

---

## Storage model

### Behavioral memory

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

### Group memory

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

---

## Benchmark framing

The system should be evaluated as:

- **Baseline A:** fixed rule-based sleep policy
- **Baseline B:** current assistant MVP
- **Experimental:** personalized autonomous agent

The main question is:

> Can a personalized autonomous browser policy save more memory than a fixed rule while causing less interruption?

### Benefit metrics
- estimated memory saved
- autonomous sleep count
- autonomous wake count

### Cost metrics
- reopen/regret count
- undo count
- explicit bad-feedback count

### User metrics
- usefulness
- trust
- willingness to use

---

## Out of scope in this version

- autonomous close
- full system CPU/memory management
- raw page-content understanding
- cloud LLM control over every tab action
