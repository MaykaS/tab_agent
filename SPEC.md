# SPEC.md - Tab Agent Chrome Extension

## Overview

Tab Agent is a Chrome extension that combines:

- local on-device tab grouping with Gemini Nano
- conservative autonomous tab management
- feedback-driven behavior learning
- OpenAI-assisted policy summaries and tuning recommendations

The extension remains browser-only in this version. It does not manage full system CPU or memory yet.

---

## Current feature set

| # | Feature | Description |
|---|---------|-------------|
| F1 | Tab observation | Read open tabs and ignore Chrome-internal pages |
| F2 | AI grouping | Group tabs by topic with Gemini Nano |
| F3 | Group display | Show named groups in the popup |
| F4 | Manual sleep | Discard tabs in a group with frequent-tab protection |
| F5 | Manual close | Close tabs in a group with frequent-tab protection |
| F6 | Manual wake | Reload previously discarded tabs in a group |
| F7 | Visit logging | Record `{url, timestamp}` on tab activation |
| F8 | Frequent-tab protection | Protect URLs visited 3+ times in the last 24 hours |
| F9 | Persistent groups | Cache groups and asleep state in local storage |
| F10 | Stats page | Show estimated memory totals, group state, ratings, and study submission |
| F11 | Autonomous sleep | Auto-sleep high-confidence low-need tabs |
| F12 | Context wake | Wake slept tabs when the user re-enters a related group/context |
| F13 | Action feed | Show autonomous actions, explanations, undo, protect, and explicit feedback |
| F14 | Feedback loop | Learn from reopen, undo, protect, and explicit good/bad signals |
| F15 | OpenAI policy summary | Generate structured policy summaries and recommendations from behavioral telemetry |

---

## Agent policy

### Prediction target

The local policy predicts:

- `willNeedInNext15Min`

### Conservative safety rules

The agent should not auto-sleep:

- pinned tabs
- very recently active tabs
- frequent/protected tabs
- audible tabs when detectable

### Allowed autonomous actions in v1

- auto-sleep
- context wake

### Disallowed autonomous actions in v1

- autonomous close
- aggressive speculative wake
- system-wide memory management outside the browser

---

## Feedback model

### Primary feedback signals

- reopen within 5 minutes after auto-sleep
- reopen within 15 minutes after auto-sleep
- undo
- manual wake shortly after sleep
- repeated protect behavior

### Secondary feedback signals

- explicit `Good`
- explicit `Bad`

### Stored feedback outputs

- regret count
- safe-sleep count
- protection count
- action outcome history

---

## Data stored or sent

| Data | Location | Notes |
|------|----------|-------|
| Visit history | `chrome.storage.local` | Rolling 7-day window |
| Cached groups | `chrome.storage.local` | Used for reopen and context wake |
| Asleep state | `chrome.storage.local` | Group UI persistence |
| URL behavior model | `chrome.storage.local` | Recency, frequency, affinity, regret, safe-sleep counts |
| Group behavior model | `chrome.storage.local` | Group-level activation and regret/safety patterns |
| Agent policy | `chrome.storage.local` | Thresholds and safeguards |
| Agent action log | `chrome.storage.local` | Auto-sleep / auto-wake events and explanations |
| Feedback log | `chrome.storage.local` | Undo / regret / protect / explicit feedback |
| Protected contexts | `chrome.storage.local` | Per-URL and per-group user protections |
| Study submissions | Neon Postgres | Via `/api/collect` |
| OpenAI summaries | Local storage + website API | Structured recommendations only |

---

## OpenAI context design

OpenAI receives structured summaries, not raw browsing dumps.

### Context blocks

1. **Current session context**
- time/day
- open tab count
- asleep tab count
- active context
- recent activations

2. **Behavior summary**
- per-tab/group recency
- frequency
- average revisit interval
- hour/day affinity
- co-activation
- regret / safety / protection counts

3. **Recent action history**
- recent autonomous actions
- explanations
- confidence
- outcomes

### Expected OpenAI output

- short summary
- threshold adjustment suggestions
- protected context suggestions
- explanation copy

OpenAI does not directly control browser actions in this version.

---

## Benchmark framing

### Baseline A
- fixed inactivity threshold
- no personalization

### Baseline B
- current assistant MVP
- AI grouping, manual execution

### Experimental
- personalized autonomous browser agent

### Core success metrics

- estimated memory saved
- autonomous sleep count
- autonomous wake count
- reopen/regret count
- undo rate
- explicit bad-feedback rate
- trust / usefulness / willingness to use

---

## Test-set expectations

The extension repo includes a reusable scenario package under `agent_test_set/`.

The first test set should cover:

- sleep decisions
- context wake decisions
- hard safety constraints
- regret outcomes
- explicit feedback outcomes
- rule vs assistant vs agent comparison cases

---

## Acceptance criteria

- Extension installs and runs from unpacked folder
- Popup still supports manual grouping and group actions
- Background worker runs a periodic autonomous sleep cycle
- Protected/frequent/recent tabs are not auto-slept
- Activating a related tab can context-wake slept sibling tabs
- Stats page shows recent autonomous actions and feedback controls
- Undo / protect / good / bad are stored and reflected in telemetry
- Study submissions include autonomous metrics and baseline comparison data
- Website stores and displays autonomous telemetry
- OpenAI summary endpoint returns structured recommendations or graceful fallback output

---

## Known limitations

- Memory values are estimated on Chrome stable
- Policy is conservative and intentionally narrow in v1
- OpenAI is advisory, not the direct control policy
- Full computer memory management is out of scope for this version
