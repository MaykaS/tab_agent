# Tab Agent - Chrome Extension

**Website:** https://tab-agent-web.vercel.app/ · **GitHub:** https://github.com/MaykaS/tab_agent

An agentic Chrome extension that uses on-device AI (Gemini Nano) to intelligently group your open tabs by topic, protect your most-used tabs from being suspended, and let you take one-click actions on entire groups.

No API key required. Gemini Nano runs locally in Chrome. Study submissions are anonymous and only sent when the user explicitly clicks submit in the Stats page.

---

## What it does

- Reads all your open tabs and sends them to Gemini Nano running locally in Chrome
- Groups tabs by topic, for example "Research", "Planning", or "Web Development"
- Caches groups so reopening the popup is instant
- Lets you sleep, wake, or close groups
- Protects frequently visited tabs with a visible badge and confirmation prompts
- Tracks local visit history for frequent-tab detection
- Includes a Stats page with estimated memory, grouping ratings, and study submission
- Auto-generates an anonymous participant ID for study submissions
- Sends a richer study snapshot with group counts, asleep state, rating summary, per-group details, and three self-report questions

---

## Tech stack

| Layer | Choice |
|-------|--------|
| AI | Gemini Nano via Chrome's built-in Prompt API |
| Extension framework | Chrome Manifest V3 |
| Language | Vanilla JavaScript |
| Storage | `chrome.storage.local` |
| UI | HTML + CSS |
| Study backend | Next.js API + Neon Postgres |

---

## How to enable Gemini Nano

Gemini Nano requires a one-time Chrome setup.

### Step 1 - Enable the flags

Open these pages in Chrome and enable the listed values:

**Flag 1**
```
chrome://flags/#prompt-api-for-gemini-nano
```
Set to: **Enabled**

**Flag 2**
```
chrome://flags/#optimization-guide-on-device-model
```
Set to: **Enabled BypassPerfRequirement**

### Step 2 - Relaunch Chrome

Use the **Relaunch** button from the flags page.

### Step 3 - Download the model

Open DevTools on any page and run:

```js
await LanguageModel.create()
```

### Step 4 - Verify it worked

Run:

```js
await LanguageModel.availability()
```

It should return `"available"`.

---

## How to install the extension

1. Clone this repo
   ```bash
   git clone https://github.com/MaykaS/tab_agent.git
   cd tab_agent
   ```
2. Open `chrome://extensions`
3. Enable **Developer mode**
4. Click **Load unpacked**
5. Select the project folder
6. Open the popup from the toolbar

After every change:

1. Reload the extension in `chrome://extensions`
2. Close and reopen the popup or Stats page

---

## File structure

```text
tab agent/
|-- README.md
|-- SPEC.md
|-- AGENTS.md
|-- TASKS.md
|-- manifest.json
|-- background.js
|-- popup.html
|-- popup.js
|-- stats.html
|-- stats.js
`-- storage.js
```

### What each file does

**`manifest.json`**
Chrome extension entry point and permissions.

**`background.js`**
Background service worker that logs tab activations into local storage.

**`popup.html` + `popup.js`**
Popup UI and main agent loop:
- load cached groups if available
- otherwise observe tabs and ask Gemini Nano to group them
- render groups
- handle sleep, wake, and close actions

**`stats.html` + `stats.js`**
Stats and study page:
- estimated total memory and per-group memory
- awake/asleep group display
- grouping quality ratings
- participant ID display
- self-report study questions
- one-click study submission

**`storage.js`**
Shared helper file used by background, popup, and stats pages:
- visit logging
- frequent-tab lookup
- participant ID generation
- study response persistence
- automatic study snapshot export

---

## Study submission

The Stats page can send an anonymized submission to the website backend.

Each submission can include:
- anonymous participant ID
- session log and visit count
- tab and group counts
- asleep group and asleep tab counts
- estimated total tab memory
- estimated saved memory
- agreement rating summary
- per-group snapshot data
- self-report answers:
  - Was the grouping useful?
  - Did you trust the sleep/close suggestions?
  - Would you use this in real browsing?

Memory fields are estimated on Chrome stable at roughly `50 MB` per open tab.

---

## Milestones

- MVP
- User Study
- Evals + Red Team
- Presentation

---

## Known limitations

- Requires manual Chrome flag setup
- Gemini Nano only supports English, Spanish, and Japanese
- Grouping quality depends on Gemini Nano and is not perfect
- Memory values shown in Stats are estimated on Chrome stable
- No autonomous tab actions in the MVP
- Study submissions do not include researcher-observed timing or Chrome Task Manager measurements
