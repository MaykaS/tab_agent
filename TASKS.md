# TASKS.md — Tab Agent MVP (2-Day Sprint)

## How to use this file

Work through tasks in order. Check off each box when done. Each task should take 30–90 minutes. Commit to git after each completed task — your commit history becomes your build log.

```bash
git add .
git commit -m "T01 - extension skeleton loads in Chrome"
```

If you get stuck on a task for more than 90 minutes, skip it and come back — don't let one blocker kill the sprint.

---

## Setup (do this first, ~30 min)

- [ ] **S01** — Create repo folder: `mkdir tab-agent && cd tab-agent && git init`
- [ ] **S02** — Enable Gemini Nano in Chrome: go to `chrome://flags/#prompt-api-for-gemini-nano` → Enabled → restart Chrome
- [ ] **S03** — Verify Gemini Nano works: open DevTools console on any page, run `await LanguageModel.availability()` — should return `"available"`

---

## Day 1 — Get the Loop Working

### Block 1 — Extension skeleton (morning, ~1.5h)

- [ ] **T01** — Create `manifest.json` with name, version, manifest_version 3, permissions for `tabs` and `storage`, background service worker pointing to `background.js`, and popup pointing to `popup.html`
- [ ] **T02** — Create empty `background.js`, `popup.html`, `popup.js`
- [ ] **T03** — Load extension unpacked at `chrome://extensions` — verify it appears in toolbar without errors
- [ ] **T04** — Add a `<h1>Tab Agent</h1>` to `popup.html` and confirm popup opens when you click the extension icon

### Block 2 — Read open tabs (late morning, ~1h)

- [ ] **T05** — In `popup.js`, call `chrome.tabs.query({})` and `console.log` the full result — open popup, inspect DevTools, verify you see your open tabs
- [ ] **T06** — Map the result down to just `{ id, title, url, lastAccessed }` per tab — log the cleaned list
- [ ] **T07** — Display tab count in the popup HTML: "Analyzing 12 tabs..."

### Block 3 — AI grouping call (afternoon, ~2h)

- [ ] **T08** — In `popup.js`, check `await LanguageModel.availability()` — if not `"available"`, show an error message in the popup and stop
- [ ] **T09** — Build the prompt string: serialize the cleaned tab list as JSON and insert into the prompt template from AGENTS.md
- [ ] **T10** — Call `await LanguageModel.prompt(yourPrompt)` and `console.log` the raw response
- [ ] **T11** — Parse the JSON response — handle parse errors gracefully (show "Grouping failed, try again" rather than crashing)
- [ ] **T12** — `console.log` the parsed groups object — verify group names and tab ID arrays look sensible

### Block 4 — Render groups in popup (late afternoon, ~1.5h)

- [ ] **T13** — For each group in the parsed result, render a section in the popup: group name as a heading, tab titles as a list underneath
- [ ] **T14** — Add basic CSS: readable font, some padding, groups visually separated
- [ ] **T15** — End-to-end test: open 10+ tabs on different topics, open popup, verify groups make sense

---

## Day 2 — Make It Useful

### Block 5 — Sleep and close actions (morning, ~1.5h)

- [ ] **T16** — Add a "Sleep group" button to each group in the popup
- [ ] **T17** — On click: call `chrome.tabs.discard(tabId)` for each tab in that group, then remove the group from the UI
- [ ] **T18** — Add a "Close group" button to each group
- [ ] **T19** — On click: call `chrome.tabs.remove([...tabIds])` for all tabs in that group, then remove the group from the UI
- [ ] **T20** — Test both actions: verify tabs are actually discarded/closed in Chrome

### Block 6 — Tab history storage (late morning, ~1h)

- [ ] **T21** — Create `storage.js` with a `writeVisit(url)` function that appends `{ url, timestamp: Date.now() }` to the `visits` array in `chrome.storage.local`
- [ ] **T22** — Add a `pruneOldVisits()` call inside `writeVisit` that removes entries older than 7 days
- [ ] **T23** — In `background.js`, listen to `chrome.tabs.onActivated` — on each activation, get the active tab's URL and call `writeVisit(url)`
- [ ] **T24** — Verify storage is working: open several tabs, switch between them, then run `chrome.storage.local.get('visits', console.log)` in DevTools — confirm entries are accumulating

### Block 7 — Frequent tab protection (afternoon, ~1.5h)

- [ ] **T25** — In `storage.js`, add `getFrequentUrls(thresholdCount, windowHours)` — returns a Set of URLs visited `thresholdCount` or more times within `windowHours`
- [ ] **T26** — In `popup.js`, call `getFrequentUrls(3, 24)` when the popup opens, before rendering
- [ ] **T27** — In the group rendering, check each tab's URL against the frequent set — if frequent, add a small "frequent" badge next to the tab title
- [ ] **T28** — In the sleep action handler, skip `chrome.tabs.discard()` for tabs whose URL is in the frequent set
- [ ] **T29** — In the close action handler, skip `chrome.tabs.remove()` for frequent tabs
- [ ] **T30** — Test: manually add fake visit history for a URL via DevTools, verify the badge appears and the tab survives a "sleep group" action

### Block 8 — Polish and finalize (late afternoon, ~1h)

- [ ] **T31** — Add a loading spinner or "Grouping your tabs..." message while the Gemini Nano call is in-flight
- [ ] **T32** — Add a "Regroup" button that re-runs the full observe → decide → render cycle
- [ ] **T33** — Test on a fresh Chrome profile (no visit history) — verify graceful behavior with zero history
- [ ] **T34** — Test with Gemini Nano flag disabled — verify error message shows cleanly
- [ ] **T35** — Final install test: delete and reload the extension from scratch, run through the full flow once
- [ ] **T36** — Record a short demo (Loom or QuickTime): install → open 10+ tabs → open popup → show groups → sleep one group → show frequent badge

---

## Done Definition

MVP is complete when:
- All T01–T36 are checked off
- All acceptance criteria in SPEC.md are met
- The demo recording exists
- Everything is committed and pushed to git

---

## Post-MVP Backlog (don't touch during the sprint)

- Add OpenAI / Anthropic API as optional backend
- Settings page (threshold configuration, API key entry)
- Chrome Tab Groups API integration (native colored groups in the tab bar)
- Background re-grouping loop (runs every N minutes)
- Feed visit frequency as a signal into the LLM prompt
- Eval harness: compare Gemini Nano vs Claude vs GPT-4o mini grouping quality
