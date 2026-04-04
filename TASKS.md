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

## Post-MVP Backlog

- Add OpenAI / Anthropic API as optional backend with quality comparison
- Settings page (threshold configuration, API key entry)
- Chrome Tab Groups API integration (native colored groups in tab bar)
- Background re-grouping loop (runs every N minutes)
- Feed visit frequency as signal into LLM prompt
- Eval harness: compare Gemini Nano vs Claude vs GPT-4o mini grouping quality
- Real per-tab memory data (requires Chrome Dev channel or alternative approach)
