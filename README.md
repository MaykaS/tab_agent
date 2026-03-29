# Tab Agent — Chrome Extension

An agentic Chrome extension that uses on-device AI (Gemini Nano) to intelligently group your open tabs by topic, protect your most-used tabs from being suspended, and let you take one-click actions on entire groups.

No API key required. No data leaves your device. Works for any Chrome user on desktop.

---

## What it does

- Reads all your open tabs and sends them to Gemini Nano (runs locally in your browser)
- Groups them by topic using AI — e.g. "Python debugging", "Research papers", "Shopping"
- Shows the groups in a popup with the tab titles under each group
- Lets you **sleep** a group (suspends tabs to free memory) or **close** a group with one click
- Tracks which tabs you visit frequently and **protects** them — frequent tabs are never suspended automatically
- Learns from your behavior over time via local visit history

---

## Tech stack

| Layer | Choice |
|-------|--------|
| AI | Gemini Nano via Chrome's built-in Prompt API |
| Extension framework | Chrome Manifest V3 |
| Language | Vanilla JavaScript |
| Storage | `chrome.storage.local` |
| UI | HTML + CSS in popup |

---

## How to enable Gemini Nano

Gemini Nano is built into Chrome but requires a one-time setup. Do this before running the extension.

### Step 1 — Enable the flags

Open Chrome and go to each of these URLs. Set the value shown and leave the page open.

**Flag 1:**
```
chrome://flags/#prompt-api-for-gemini-nano
```
Set to: **Enabled**

**Flag 2:**
```
chrome://flags/#optimization-guide-on-device-model
```
Set to: **Enabled BypassPerfRequirement**

### Step 2 — Relaunch Chrome

Click the **Relaunch** button that appears at the bottom of the flags page. Don't just close and reopen — use the Relaunch button so both flags save together.

### Step 3 — Download the model

Open any page in Chrome, open DevTools (F12 → Console tab), and run:

```js
await LanguageModel.create()
```

This triggers Chrome to download the Gemini Nano model in the background. It's a few GB — give it 5–10 minutes depending on your connection.

### Step 4 — Verify it worked

Once the download finishes, run:

```js
await LanguageModel.availability()
```

It should return `"available"`. If it still says `"downloadable"`, wait a few more minutes and try again.

> Note: You may see a warning about output language — ignore it. It doesn't affect functionality.

---

## How to install the extension

1. Clone this repo:
   ```bash
   git clone https://github.com/YOUR_USERNAME/tab-agent.git
   cd tab-agent
   ```

2. Open Chrome and go to:
   ```
   chrome://extensions
   ```

3. Toggle **Developer mode** on (top right corner)

4. Click **"Load unpacked"** and select the `tab-agent/` folder

5. The extension appears in your Chrome toolbar — click it to open the popup

> Every time you change a file, go back to `chrome://extensions` and click the refresh icon on the Tab Agent card.

---

## File structure

```
tab-agent/
├── README.md         ← you are here
├── SPEC.md           ← product specification (what we're building and why)
├── AGENTS.md         ← agent design (the observe → decide → act loop)
├── TASKS.md          ← build checklist (36 tasks across 2 days)
├── manifest.json     ← Chrome extension entry point
├── background.js     ← silent background service worker
├── popup.html        ← UI that appears when you click the extension icon
├── popup.js          ← agent brain (observe, call AI, render, act)
└── storage.js        ← tab visit history helpers
```

### What each file does

**`manifest.json`**
The ID card of the extension. Chrome reads this first and learns everything — the extension name, what permissions it needs (tabs, storage), which file is the background worker, and which file is the popup. Required in every Chrome extension.

**`background.js`**
Runs silently in the background even when the popup is closed. Its one job: listen for tab switches (`chrome.tabs.onActivated`) and record `{url, timestamp}` to local storage every time the user changes tabs. Never shows UI — just quietly collects data.

**`popup.html`**
The small window that appears when you click the extension icon in the toolbar. Just HTML — it shows a loading message while the AI runs, then groups get rendered into it dynamically by `popup.js`.

**`popup.js`**
The brain of the popup. Runs the full agent loop when the popup opens:
1. Read all open tabs (`chrome.tabs.query`)
2. Read visit history from storage
3. Call Gemini Nano with the tab list
4. Parse the grouped response
5. Render groups into the popup
6. Handle sleep/close button clicks

**`storage.js`**
A shared utility module used by both `background.js` and `popup.js`. Contains three functions:
- `writeVisit(url)` — saves a tab visit with current timestamp
- `getFrequentUrls(threshold, windowHours)` — returns URLs visited frequently
- `pruneOldVisits()` — removes entries older than 7 days

---

## AI backend options

This extension uses Gemini Nano by default — free, on-device, no account needed. Future versions will support switching to a cloud model for better grouping quality.

| Option | Cost | Needs account | Works offline | Quality |
|--------|------|--------------|---------------|---------|
| Gemini Nano (default) | Free | No | Yes | Good |
| Anthropic Claude (future) | ~$0.001/use | Yes | No | Best |
| OpenAI GPT (future) | ~$0.001/use | Yes (free credits) | No | Very good |

---

## Project deliverables

This project is part of a research course. The required deliverables are:

| File | Description |
|------|-------------|
| `SPEC.md` | Product specification — what the extension does, feature set, acceptance criteria |
| `AGENTS.md` | Agent design — the observe → decide → act loop, memory schema, component map |
| `TASKS.md` | Build checklist — 36 atomic tasks broken across the 2-day MVP sprint |

---

## Milestones

- **MVP** ← current milestone
- **User Study** — test with real users, measure grouping quality and task completion
- **Evals + Red Team** — compare Gemini Nano vs Claude vs GPT grouping quality, stress test edge cases
- **Presentation** — final demo and research writeup

---

## Known limitations (MVP)

- Requires manual Chrome flag setup (see above)
- Gemini Nano only supports English, Spanish, and Japanese
- Groups are regenerated fresh each time the popup opens — no persistence between sessions
- No undo for sleep or close actions
- No autonomous actions — all actions require a user click
