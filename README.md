# Tab Agent — Chrome Extension

An agentic Chrome extension that uses on-device AI (Gemini Nano) to intelligently group your open tabs by topic, protect your most-used tabs from being suspended, and let you take one-click actions on entire groups.

No API key required. No data leaves your device. Works for any Chrome user on desktop.

---

## What it does

- Reads all your open tabs and sends them to Gemini Nano (runs locally in your browser)
- Groups them by topic using AI — e.g. "Python debugging", "Research papers", "Shopping"
- Shows the groups in a popup with the tab titles under each group
- **Remembers your groups** — closing and reopening the popup is instant, no re-grouping. Hit "Regroup" when you want a fresh analysis
- Lets you **sleep** a group (suspends tabs to free memory) or **close** a group with one click
- Slept groups **stay visible** in the popup with a Wake button — click Wake to reload all tabs in that group
- Tracks which tabs you visit frequently and shows a **"frequent" badge** on those tabs
- If you try to sleep or close a group with frequent tabs, it **asks you to confirm** before acting on them
- If you cancel closing a mixed group, only the non-frequent tabs close — frequent tabs stay open and visible in the group
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

Open Chrome and go to each of these URLs. Set the value shown.

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

> Note: You may see a warning about output language in the DevTools console — this is harmless and won't affect functionality.

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

> Every time you change a file, go back to `chrome://extensions` and click the refresh icon on the Tab Agent card. Then close and reopen the popup.

---

## File structure

```
tab-agent/
├── README.md         ← you are here
├── SPEC.md           ← product specification (what we're building and why)
├── AGENTS.md         ← agent design (the observe → decide → act loop)
├── TASKS.md          ← build checklist (36 tasks across the 2-day MVP sprint)
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
1. Check storage for cached groups — if found, render instantly (no AI call)
2. If no cache or Regroup pressed: read all open tabs, call Gemini Nano, parse groups, save to storage
3. Read visit history to identify frequent tabs
4. Render groups into the popup with sleep/wake/close buttons
5. Handle all button actions, persisting sleep/wake state across popup opens

**`storage.js`**
A shared utility module used by both `background.js` and `popup.js`. Contains three functions:
- `writeVisit(url)` — saves a tab visit with current timestamp
- `getFrequentUrls(threshold, windowHours)` — returns URLs visited frequently
- `pruneOldVisits()` — removes entries older than 7 days

---

## Git workflow

Every task in TASKS.md gets its own commit. This keeps your history clean and maps directly to your build log.

### Commit format

```bash
git add .
git commit -m "T01 - short description of what you did"
git push origin main
```

### Commit history so far

```
T01-T04  - extension skeleton: all 5 files, loads in Chrome
T05-T29  - full agent loop: observe, group, render, sleep/wake, storage, frequent tabs
T30-T31  - fix sleep/close: confirm before acting on frequent tabs, keep group visible after partial close
```

### After every code change

1. Make your change
2. Go to `chrome://extensions` → click the refresh icon on Tab Agent
3. Close and reopen the popup to test
4. If it works → commit

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
- Groups persist between popup opens but reset if you hit Regroup or reinstall the extension
- No undo for close actions (sleep can be undone with Wake)
- No autonomous actions — all actions require a user click
- Grouping quality depends on Gemini Nano — it's a small model, good but not perfect
