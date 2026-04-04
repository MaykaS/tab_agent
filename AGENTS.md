# AGENTS.md — Tab Agent Chrome Extension

## What Makes This an Agent

Tab Agent is not a rule-based plugin. It has an observe → decide → act → remember loop, persistent memory that influences future decisions, and takes actions with real consequences (suspending or closing tabs).

**Important distinction — MVP vs agentic:**

The MVP is the *non-agentic* version. The agent groups tabs intelligently and protects frequent tabs, but every action (sleep, wake, close) is triggered by the user. The agent is an assistant.

The full agentic version — currently in design, to be built after the user study — closes the loop: the agent acts *autonomously* based on a learned behavioral model. It sleeps tabs it predicts you won't need, and wakes tabs when context signals you're about to need them. The user sets the policy once; the agent executes continuously.

The observe → decide → act → remember loop is the same in both versions. What changes is the Act step: user-triggered in MVP, autonomous in the agentic version.

---

## Agent Loop

**MVP (current):**
```
OBSERVE  →  DECIDE  →  ACT (user click)  →  REMEMBER
   ↑                                              |
   └──────────────────────────────────────────────┘
                   (next popup open)
```

**Agentic version (next):**
```
OBSERVE  →  DECIDE  →  ACT (autonomous)  →  REMEMBER
   ↑         ↑                                   |
   |         └── behavioral model ───────────────┘
   └──────────────────────────────────────────────
                (continuous background loop)
```

### 1. Observe

**Trigger:** User opens the extension popup.

**What the agent reads:**
- All open tabs via `chrome.tabs.query({})`
- For each tab: `id`, `title`, `url` (Chrome-internal pages filtered out)
- Visit history from `chrome.storage.local` — how many times each URL was accessed in the last 24 hours
- Cached groups from previous session (if available) — used to skip the AI call on reopen

**Output of this step:** A structured list of tab objects passed to the decision layer, plus a Set of frequently-visited URLs.

---

### 2. Decide

**Who decides:** Gemini Nano (`LanguageModel.prompt()`)

**When the AI is called:** Only when there is no cached grouping, or when the user explicitly clicks "Regroup". On normal reopens, the cached result is used directly — no AI call.

**Input prompt structure:**
```
You are a browser tab organizer. Group the following browser tabs by topic.
Return ONLY a JSON object in exactly this format, with no extra text:
{
  "groups": [
    { "name": "group name", "tabIds": [1, 2, 3] }
  ]
}

Rules:
- Create 2 to 6 groups maximum
- Every tab must appear in exactly one group
- Group names should be short (2-4 words)
- If a tab doesn't fit anywhere, put it in a group called "Other"

Tabs:
[{ "id": 1, "title": "...", "url": "..." }, ...]
```

**Output of this step:** A JSON object mapping tab IDs to named groups, saved to `chrome.storage.local`.

**Fallback:** If Gemini Nano is unavailable (`LanguageModel.availability()` returns anything other than `"available"`), show a clear error message in the popup. Do not crash. Do not attempt a cloud API call.

---

### 3. Act

#### MVP behavior (current)

**Who acts:** The user, via popup UI. The agent never acts autonomously in the MVP.

**Available actions:**

| Action | Chrome API | Scope | Constraint |
|--------|-----------|-------|------------|
| Sleep group | `chrome.tabs.discard(tabId)` | Non-frequent tabs in group | Confirms before sleeping frequent tabs |
| Wake group | `chrome.tabs.reload(tabId)` | All slept tabs in group | No constraint |
| Close group | `chrome.tabs.remove([tabIds])` | Tabs matched by URL | Confirms before closing frequent tabs; partial close keeps frequent tabs visible |

**Frequent tab rule:** A tab is "frequent" if its URL appears 3 or more times in visit history within the last 24 hours. Frequent tabs are visually badged. Sleep and Close ask for confirmation before acting on them.

**URL-based matching:** Tab IDs in Chrome are session-scoped and go stale after discards and reloads. All close and sleep actions match tabs by URL against current open tabs, not by cached ID.

#### Agentic behavior (next — to be built)

**Who acts:** The agent, autonomously, running as a background service worker.

**Auto-sleep triggers:**

| Trigger | Signal | Behavior |
|---------|--------|----------|
| Inactivity threshold | Time since last visit, personalized per URL | Sleep tab if inactive longer than learned threshold |
| Low need score | Time-of-day + day-of-week patterns | Sleep tab if predicted need in next 60 min is below threshold |
| Never sleep | Frequent tab flag | Skip tabs above visit frequency threshold |
| Never sleep | Active media or open form | Detect tab state before discarding |

**Auto-wake trigger (Option B — context-based):**

When a tab becomes active, the agent checks: are there slept tabs in the same group? If yes, wake them. The reasoning: if you're working in a context (e.g. "Research"), the related tabs in that group are probably needed too.

| Trigger | Signal | Behavior |
|---------|--------|----------|
| Related tab activated | Group membership | Wake all slept tabs in the same group |
| Scheduled pattern | Time-of-day history | Wake tabs that are consistently visited at this time |

**Transparency rule:** Every autonomous action is logged and surfaced to the user — "Slept 3 tabs in Shopping (inactive 45 min)" and "Woke GitHub Docs because you opened a related tab." The user can undo any autonomous action.

**Why Option B over Option A for wake:**
Option A (time-based prediction) requires extensive history and risks waking tabs the user doesn't need — wasting memory. Option B (context-triggered) is reactive to what the user is doing *right now*, more reliable, and naturally scoped to the current working context.

---

### 4. Remember

The agent maintains three types of memory in `chrome.storage.local`:

**a) Visit history** — behavioral signal
```js
{
  "visits": [
    { "url": "https://...", "timestamp": 1234567890 },
    ...
  ]
}
```
- Written by `background.js` on every `chrome.tabs.onActivated` event
- Pruned to 7 days on each write
- Used to compute frequent tabs threshold (3+ visits in 24h)

**b) Cached groups** — session continuity
```js
{
  "cachedGroups": {
    "groups": [{ "name": "...", "tabIds": [...] }],
    "tabMap": { "tabId": { "id", "title", "url" } }
  }
}
```
- Written after every successful AI grouping
- Read on popup open to skip re-grouping
- Updated when a group is closed (group removed from cache)
- Cleared on Regroup

**c) Asleep state** — UI persistence
```js
{
  "asleepGroups": {
    "0": [tabId1, tabId2],  // groupIndex → slept tabIds
    ...
  }
}
```
- Written when a group is slept
- Read on popup open to restore Wake buttons
- Cleared when group is woken

**d) Behavioral model** — agentic decision input (to be built)
```js
{
  "urlModel": {
    "https://...": {
      "avgVisitInterval": 1200000,  // ms between visits
      "peakHours": [9, 10, 14, 15], // hours of day typically visited
      "peakDays": [1, 2, 3, 4, 5],  // days of week (0=Sun)
      "coActivations": ["https://related-url..."] // tabs often opened together
    }
  }
}
```
- Built from visit history over time
- Used by the agentic loop to score tab need probability
- Co-activation data powers Option B wake behavior

**e) Stats data** — measurement
```js
{
  "memorySaved": 150.0,          // cumulative estimated MB saved
  "ratingHistory": [             // agreement rating sessions
    { "timestamp": ..., "avgScore": 4.2, "ratings": {...} }
  ]
}
```

---

## Agent Components

**MVP (current):**
```
background.js        — persistent service worker
  ├── listens to chrome.tabs.onActivated
  └── writes visit history to chrome.storage.local

popup.js             — runs when popup opens
  ├── checks cache → skips AI if groups exist
  ├── calls chrome.tabs.query() → observation
  ├── reads chrome.storage.local → frequent URLs + asleep state
  ├── calls LanguageModel.prompt() → decision (only when needed)
  ├── saves groups + asleep state to storage → memory
  ├── renders groups in popup.html → display
  └── handles sleep/wake/close button clicks → action

storage.js           — shared helper module
  ├── writeVisit(url)
  ├── getFrequentUrls(threshold, windowHours)
  └── pruneOldVisits()

stats.html + stats.js — measurement dashboard
  ├── reads cachedGroups + asleepGroups + memorySaved from storage
  ├── cross-references with real open tabs via chrome.tabs.query()
  ├── displays memory per group (estimated) + awake/asleep status
  ├── auto-refreshes every 5 seconds
  └── agreement rating form → saves to ratingHistory
```

**Agentic version (to be built):**
```
background.js        — expanded service worker (always running)
  ├── existing: listens to chrome.tabs.onActivated → writes visit history
  ├── NEW: builds behavioral model per URL (avgInterval, peakHours, coActivations)
  ├── NEW: runs decision loop every N minutes
  │     ├── scores each open tab for predicted need
  │     ├── sleeps tabs below sleep threshold
  │     └── logs autonomous actions to storage
  └── NEW: listens for tab activation → triggers context-based wake (Option B)
        └── when tab activates → wake slept tabs in same group

agent.js             — NEW: behavioral model + scoring engine
  ├── buildModel(visitHistory) → urlModel
  ├── scoreTab(url, currentTime) → needProbability (0–1)
  ├── shouldSleep(url) → boolean + reason
  ├── shouldWake(activatedUrl, groupMap) → [urlsToWake]
  └── logAction(type, url, reason) → actionLog

storage.js           — expanded helpers
  ├── existing: writeVisit, getFrequentUrls, pruneOldVisits
  ├── NEW: updateUrlModel(url, visitData)
  ├── NEW: getUrlModel(url) → behavioral stats
  └── NEW: logAgentAction(action) → append to actionLog
```

---

## What This Agent Does NOT Do (MVP)

- Does not act without a user click — all actions are user-triggered in MVP
- Does not run a continuous background decision loop
- Does not build a per-URL behavioral model (collects history but doesn't model it yet)
- Does not communicate with any external server
- Does not have access to page content (only tab title and URL)
- Does not use real CPU/memory data (estimated only on stable Chrome)

These are the exact gaps the agentic version fills.

---

## Agentic Version — Build Plan

This is the next implementation phase after the user study.

### Phase 1 — Behavioral model (foundation)
- Build `agent.js` with `buildModel()` and `scoreTab()` functions
- Model inputs: visit frequency, time-of-day, day-of-week patterns per URL
- Output: need probability score (0–1) for each open tab
- Test: does the model correctly rank tabs the user actually returns to?

### Phase 2 — Auto-sleep
- Add continuous decision loop to `background.js` (runs every 5 minutes)
- Sleep tabs whose need score falls below configurable threshold
- Never sleep: frequent tabs, tabs with active media, tabs with open forms
- Surface all autonomous actions in the Stats page action log

### Phase 3 — Auto-wake (Option B)
- On `chrome.tabs.onActivated`: check if activated tab has slept siblings in same group
- If yes: wake them
- Log the wake action with reason ("Woke X because you opened a related tab")
- Add scheduled wake: detect time-of-day patterns, wake tabs before predicted need

### Phase 4 — User control + transparency
- Settings page: sleep threshold, wake sensitivity, per-group opt-out
- Action log visible in stats page: every autonomous action with reason + undo button
- Feedback loop: user can mark autonomous actions as correct/incorrect → improves model

### Phase 5 — MCP + RAG (professor sequence)
- MCP server exposes tab state to external tools (calendar, Notion, etc.)
- RAG over browsing history to improve grouping and need prediction
- Richer context signals beyond tab title/URL
