# AGENTS.md — Tab Agent Chrome Extension

## What Makes This an Agent

Tab Agent is not a rule-based plugin. It has an observe → decide → act loop, a persistent memory that influences future decisions, and it takes actions with real consequences (suspending or closing tabs). The AI (Gemini Nano) is the decision-making layer — it receives structured observations and produces a grouping plan. The extension then acts on that plan on behalf of the user.

---

## Agent Loop

```
OBSERVE  →  DECIDE  →  ACT  →  REMEMBER
   ↑                               |
   └───────────────────────────────┘
          (next popup open)
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

**Who acts:** The user, via popup UI. The agent never acts autonomously.

**Available actions:**

| Action | Chrome API | Scope | Constraint |
|--------|-----------|-------|------------|
| Sleep group | `chrome.tabs.discard(tabId)` | Non-frequent tabs in group | Confirms before sleeping frequent tabs |
| Wake group | `chrome.tabs.reload(tabId)` | All slept tabs in group | No constraint |
| Close group | `chrome.tabs.remove([tabIds])` | Tabs matched by URL | Confirms before closing frequent tabs; partial close keeps frequent tabs visible |

**Frequent tab rule:** A tab is "frequent" if its URL appears 3 or more times in visit history within the last 24 hours. Frequent tabs are visually badged. Sleep and Close ask for confirmation before acting on them — the user can choose to include or exclude them.

**URL-based matching:** Tab IDs in Chrome are session-scoped and go stale after discards and reloads. All close and sleep actions match tabs by URL against current open tabs, not by cached ID.

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

**d) Stats data** — measurement
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

---

## What This Agent Does NOT Do (MVP)

- Does not act without a user click
- Does not run in the background on a timer
- Does not learn preferences from user corrections
- Does not communicate with any external server
- Does not have access to page content (only tab title and URL)
- Does not use real CPU/memory data (estimated only on stable Chrome)

---

## Future Agent Capabilities (Post-MVP)

- Feed visit frequency as a signal into the LLM grouping prompt
- Re-run grouping automatically when tab count changes significantly
- Accept user corrections to groups and use them to refine future prompts
- Compare grouping quality: Gemini Nano vs Claude vs GPT-4o mini (eval study)
- Persistent learning model that improves grouping based on rating history
