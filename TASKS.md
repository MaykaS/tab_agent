# TASKS.md — Tab Agent MVP

## How to use this file

Work through tasks in order. Check off each box when done. Commit to git after each block.

If you get stuck on a task for more than 90 minutes, skip it and come back.

---

## Setup

- [x] **S01** — Create repo folder and git init
- [x] **S02** — Enable Gemini Nano: `chrome://flags/#prompt-api-for-gemini-nano` → Enabled + `chrome://flags/#optimization-guide-on-device-model` → Enabled BypassPerfRequirement → Relaunch
- [x] **S03** — Download model: run `await LanguageModel.create()` in DevTools console, wait for download
- [x] **S04** — Verify: run `await LanguageModel.availability()` → should return `"available"`

---

## Block 1 — Extension skeleton

- [x] **T01** — Create `manifest.json` (Manifest V3, tabs + storage permissions, background service worker, popup)
- [x] **T02** — Create empty `background.js`, `popup.html`, `popup.js`, `storage.js`
- [x] **T03** — Load unpacked at `chrome://extensions` — verify no errors
- [x] **T04** — Confirm popup opens when clicking the extension icon

## Block 2 — Observe tabs

- [x] **T05** — Call `chrome.tabs.query({})` in `popup.js`, log result
- [x] **T06** — Map to `{ id, title, url }`, filter out Chrome-internal pages
- [x] **T07** — Show tab count in popup while loading

## Block 3 — AI grouping

- [x] **T08** — Check `LanguageModel.availability()` — show error if not `"available"`
- [x] **T09** — Build prompt with tab list as JSON
- [x] **T10** — Call `LanguageModel.prompt()`, log raw response
- [x] **T11** — Parse JSON response, handle parse errors gracefully
- [x] **T12** — Verify parsed groups look sensible in console

## Block 4 — Render groups

- [x] **T13** — Render group name + tab titles in popup
- [x] **T14** — Add CSS: readable layout, groups visually separated
- [x] **T15** — End-to-end test: 10+ tabs → popup → groups appear

## Block 5 — Sleep and close actions

- [x] **T16** — Add Sleep button per group
- [x] **T17** — Sleep: call `chrome.tabs.discard()` — group stays visible, turns dimmed, Wake button appears
- [x] **T18** — Add Wake button (hidden by default)
- [x] **T19** — Wake: call `chrome.tabs.reload()` on slept tabs, restore group to normal state
- [x] **T20** — Add Close button per group — closes tabs, removes group from UI and cache

## Block 6 — Tab history storage

- [x] **T21** — `storage.js`: `writeVisit(url)` appends `{url, timestamp}` to `visits`
- [x] **T22** — `pruneOldVisits()` removes entries older than 7 days
- [x] **T23** — `background.js`: listen to `chrome.tabs.onActivated`, call `writeVisit(url)`
- [x] **T24** — Verify via DevTools: `chrome.storage.local.get('visits', console.log)`

## Block 7 — Frequent tab protection

- [x] **T25** — `storage.js`: `getFrequentUrls(threshold, windowHours)` returns Set of URLs
- [x] **T26** — Call `getFrequentUrls(3, 24)` on popup open
- [x] **T27** — Render "frequent" badge on qualifying tabs
- [x] **T28** — Sleep: confirm dialog before sleeping frequent tabs
- [x] **T29** — Close: confirm dialog before closing frequent tabs; partial close keeps frequent tabs visible in group

## Block 8 — Persistent groups + state

- [x] **T30** — Cache groups to `chrome.storage.local` after AI call
- [x] **T31** — On popup open: load from cache if available, skip AI call
- [x] **T32** — Persist asleep state to storage — Wake button shown correctly on reopen
- [x] **T33** — Update cache when group is closed — group does not reappear on reopen
- [x] **T34** — Use URL matching (not cached IDs) for close/sleep — handles stale tab IDs

## Block 9 — Stats page

- [x] **T35** — Create `stats.html` + `stats.js`
- [x] **T36** — Add Stats button to popup header — opens stats in new tab
- [x] **T37** — Stats: summary section (tabs open, memory saved, group count)
- [x] **T38** — Stats: memory per group table with awake/asleep status
- [x] **T39** — Stats: auto-refresh every 5 seconds using real open tab count
- [x] **T40** — Stats: agreement rating form — rate each group 1-5 stars, save to storage

## Block 10 — Polish and fixes

- [x] **T41** — Add loading spinner while Gemini Nano is thinking
- [x] **T42** — Add Regroup button — forces fresh AI call, clears cache
- [x] **T43** — Fix: language warning suppressed via `expectedOutputLanguages: ["en"]`
- [x] **T44** — Fix: close on slept groups works correctly (URL-based matching)
- [x] **T45** — Fix: stats tab count reflects real open tabs not cached group count
- [x] **T46** — Test: fresh Chrome profile with no visit history
- [x] **T47** — Test: Gemini Nano unavailable → error message shows cleanly
- [x] **T48** — Record demo video: install → group → sleep → wake → close → stats

---

## Done Definition

MVP is complete. All acceptance criteria in SPEC.md are met.

---

## Phase 2 — Agentic Version

Build this after the user study is complete. These tasks turn Tab Agent from a manually-triggered assistant into an autonomous agent.

### Block A — Behavioral model

- [ ] **A01** — Create `agent.js` with `buildModel(visitHistory)` → returns `urlModel` object per URL (avgInterval, peakHours, peakDays, coActivations)
- [ ] **A02** — Add `scoreTab(url, currentTime, urlModel)` → returns need probability 0–1
- [ ] **A03** — Add `shouldSleep(url, urlModel)` → boolean + reason string
- [ ] **A04** — Add `shouldWake(activatedUrl, groupMap, urlModel)` → array of URLs to wake
- [ ] **A05** — Unit test: does model score tabs you actually return to higher than ones you don't?
- [ ] **A06** — Add `updateUrlModel(url, visitData)` and `getUrlModel(url)` to `storage.js`

### Block B — Auto-sleep

- [ ] **A07** — Add continuous decision loop to `background.js` (setInterval, every 5 minutes)
- [ ] **A08** — Loop reads all open tabs, scores each via `agent.js`, sleeps tabs below threshold
- [ ] **A09** — Never sleep guard: skip frequent tabs, tabs with audible audio, tabs with active forms (use `chrome.tabs.get` to check `audible` property)
- [ ] **A10** — Log every autonomous sleep to `actionLog` in storage with timestamp + reason
- [ ] **A11** — Test: open 10 tabs, leave some idle, verify agent sleeps the right ones within 10 minutes

### Block C — Auto-wake (Option B)

- [ ] **A12** — In `background.js` `onActivated` listener: when a tab activates, call `shouldWake()` with its URL and current group map
- [ ] **A13** — If wake targets returned: call `chrome.tabs.reload()` on each slept tab in same group
- [ ] **A14** — Log every autonomous wake to `actionLog` with reason ("Woke X because you opened a related tab")
- [ ] **A15** — Test: sleep a group, activate one tab in it, verify siblings wake automatically

### Block D — Scheduled wake

- [ ] **A16** — In `agent.js`, add `getPeakHours(url, visitHistory)` → array of hours with high visit frequency
- [ ] **A17** — In background loop: check if any slept tab has a peak hour approaching (within 15 min) → wake it
- [ ] **A18** — Test: manually set visit history to simulate a 9am pattern, verify tab wakes at 8:45am

### Block E — Transparency + control

- [ ] **A19** — Add action log section to stats page: shows last 20 autonomous actions with timestamp, type, reason
- [ ] **A20** — Add undo button per action log entry: reverses the sleep or wake
- [ ] **A21** — Create settings page (`settings.html`): sleep threshold slider, wake sensitivity toggle, per-group opt-out checkboxes
- [ ] **A22** — Wire settings to agent loop: agent respects per-group opt-outs
- [ ] **A23** — Add feedback buttons to action log: "Good call" / "Wrong call" → saves to model feedback store

### Block F — Eval harness

- [ ] **A24** — Build tab set fixtures: 10 pre-defined tab sets with known "correct" groupings for blind eval
- [ ] **A25** — Add backend toggle to popup settings: Gemini Nano / Claude Haiku / GPT-4o mini
- [ ] **A26** — Build eval runner: same tab set → all three models → save results with model label hidden
- [ ] **A27** — Add precision/recall measurement to stats: "Did the agent sleep the right tabs?" (needs ground truth from user study)

---

## Other Post-MVP Backlog

- Chrome Tab Groups API integration (native colored groups in tab bar)
- Vercel deployment (landing page + demo — professor requirement)
- Real per-tab memory data (requires Chrome Dev channel)
- MCP server exposing tab state to external tools
- RAG over browsing history to improve grouping
