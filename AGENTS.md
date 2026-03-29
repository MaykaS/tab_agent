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
- For each tab: `id`, `title`, `url`, `lastAccessed` timestamp
- Visit history from `chrome.storage.local` — how many times each URL was accessed in the last 24 hours

**Output of this step:** A structured list of tab objects passed to the decision layer.

---

### 2. Decide

**Who decides:** Gemini Nano (`LanguageModel.prompt()`)

**Input prompt structure:**
```
You are a tab manager. Group the following browser tabs by topic.
Return ONLY valid JSON in this format:
{
  "groups": [
    { "name": "group name", "tabIds": [1, 2, 3] },
    ...
  ]
}

Tabs:
[{ "id": 1, "title": "...", "url": "..." }, ...]
```

**Output of this step:** A JSON object mapping tab IDs to named groups.

**Fallback:** If Gemini Nano is unavailable (`LanguageModel.availability()` returns `"unavailable"`), show an error message in the popup. Do not crash. Do not attempt a cloud API call.

---

### 3. Act

**Who acts:** The user, via popup UI. The agent never acts autonomously.

**Available actions:**

| Action | Chrome API | Scope | Constraint |
|--------|-----------|-------|------------|
| Sleep group | `chrome.tabs.discard(tabId)` | All tabs in group | Skips frequent tabs |
| Close group | `chrome.tabs.remove(tabId)` | All tabs in group | Skips frequent tabs |

**Frequent tab rule:** A tab is "frequent" if its URL appears 3 or more times in visit history within the last 24 hours. Frequent tabs are visually badged in the UI and excluded from all sleep/close actions.

---

### 4. Remember

**Trigger:** Any tab becomes active (`chrome.tabs.onActivated` listener in background service worker).

**What is stored:**
```js
// chrome.storage.local schema
{
  "visits": [
    { "url": "https://...", "timestamp": 1234567890 },
    ...
  ]
}
```

**Retention policy:** On each write, entries older than 7 days are pruned.

**How memory influences decisions:** The visit history is not currently fed back into the LLM prompt (post-MVP). In MVP it is used only for the frequent tab threshold. Future versions will include visit frequency as a signal in the grouping prompt.

---

## Agent Components

```
background.js        — persistent service worker
  ├── listens to chrome.tabs.onActivated
  └── writes visit history to chrome.storage.local

popup.js             — runs when popup opens
  ├── calls chrome.tabs.query() → observation
  ├── reads chrome.storage.local → memory
  ├── calls LanguageModel.prompt() → decision
  ├── renders groups in popup.html → display
  └── handles sleep/close button clicks → action

storage.js           — helper module
  ├── writeVisit(url)
  ├── getRecentVisits(windowHours)
  └── pruneOldVisits()
```

---

## What This Agent Does NOT Do (MVP)

- It does not act without a user click
- It does not run in the background on a timer
- It does not learn preferences from user corrections
- It does not communicate with any external server
- It does not have access to page content (only tab title and URL)

---

## Future Agent Capabilities (Post-MVP)

- Feed visit frequency into the grouping prompt as a signal
- Re-run grouping automatically when tab count changes significantly
- Accept user corrections to groups and use them to refine future prompts
- Compare grouping quality across Gemini Nano vs Claude vs GPT-4o mini (eval study)
