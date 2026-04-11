# Tab Agent - Chrome Extension

**Website:** https://tab-agent-web.vercel.app/ · **GitHub:** https://github.com/MaykaS/tab_agent

Tab Agent is an agentic Chrome extension that groups tabs with Gemini Nano, autonomously sleeps low-need tabs, context-wakes related tabs, and learns from feedback over time.

The real-time agent stays local in the browser. OpenAI is used for behavior summaries, explanation support, and policy-tuning recommendations, not for the hot-path sleep/wake controller.

## Repo split

- **`tab_agent`**: the Chrome extension itself
  - popup
  - background service worker
  - local autonomous policy
  - Stats page
  - feedback loop
- **`tab_agent_web`**: the website and backend
  - study storage
  - admin dashboard
  - OpenAI summary endpoint

If you want the browser extension behavior to change, this repo is the one that needs to be updated.

---

## What it does

- Groups open tabs by topic with Gemini Nano running locally in Chrome
- Caches groups for instant reopen
- Lets users manually sleep, wake, or close groups
- Autonomously sleeps low-need tabs using a conservative local policy
- Context-wakes slept tabs when the user re-enters a related group
- Logs autonomous actions, outcomes, undo events, and feedback
- Supports explicit feedback:
  - `Undo`
  - `Protect`
  - `Good`
  - `Bad`
- Includes a Stats page with:
  - estimated memory totals
  - per-group memory view
  - autonomous activity feed
  - OpenAI policy summary generation
  - grouping-quality ratings
  - study submission

---

## Architecture

### Local browser agent

- `background.js`
  - records activations
  - updates behavior memory
  - runs a periodic agent cycle
  - auto-sleeps low-need tabs
  - auto-wakes related slept tabs

- `agent.js`
  - builds tab features
  - scores near-term need
  - selects conservative autonomous actions

- `storage.js`
  - stores visit history
  - stores behavior models
  - stores action logs and feedback logs
  - stores protected contexts and policy state
  - builds study export payloads

### Website / research backend

- `/api/collect`
  - stores anonymized study submissions in Neon Postgres
- `/api/agent-summary`
  - sends structured behavioral summaries to OpenAI
  - returns policy-tuning recommendations and explanation summaries
- `/admin`
  - compares autonomous agent metrics with rule-baseline metrics

---

## Agent loop

1. **Observe**
- active tab
- open tabs
- grouped context
- visit history
- time/day patterns
- recent activations

2. **Predict**
- estimate `willNeedInNext15Min`

3. **Act**
- auto-sleep high-confidence low-need tabs
- context-wake related slept tabs

4. **Learn**
- implicit feedback:
  - reopen within 5 / 15 minutes
  - undo
  - manual wake after sleep
  - protect
- explicit feedback:
  - good
  - bad

---

## Benchmark framing

The system is evaluated as:

- **Baseline A:** static rule-based tab management
- **Baseline B:** assistant MVP with manual actions
- **Experimental:** personalized autonomous agent

Key metrics:

- estimated memory saved
- autonomous sleep count
- autonomous wake count
- reopen/regret count
- undo rate
- trust / usefulness / willingness to use

---

## How to enable Gemini Nano

### 1. Enable Chrome flags

`chrome://flags/#prompt-api-for-gemini-nano`
Set to: `Enabled`

`chrome://flags/#optimization-guide-on-device-model`
Set to: `Enabled BypassPerfRequirement`

### 2. Relaunch Chrome

### 3. Download the model

Run in DevTools:

```js
await LanguageModel.create()
```

### 4. Verify availability

```js
await LanguageModel.availability()
```

It should return `"available"`.

---

## How to install

1. Clone the repo
   ```bash
   git clone https://github.com/MaykaS/tab_agent.git
   cd tab_agent
   ```
2. Open `chrome://extensions`
3. Enable **Developer mode**
4. Click **Load unpacked**
5. Select the project folder

After code changes:

1. Reload the extension in `chrome://extensions`
2. Reopen the popup or Stats page

---

## Study submission

The Stats page submits an anonymized snapshot that can include:

- participant ID
- tab/group/asleep counts
- rating summary
- estimated memory totals
- autonomous action log
- feedback log
- protected contexts
- baseline comparison summary
- self-report answers

Memory fields are estimated on Chrome stable.

---

## Test set

This repo now includes a reusable scenario package in [agent_test_set/README.md](/C:/Users/mayas/OneDrive/Desktop/Projects/tab%20agent/agent_test_set/README.md).

Use it to manually compare:
- rule baseline
- assistant MVP
- autonomous agent

before building a formal runner.

---

## Known limitations

- Browser-only for now; not full system memory management yet
- Memory values are estimated on Chrome stable
- Autonomous policy is intentionally conservative in v1
- OpenAI summaries are advisory; the local policy still controls actions
