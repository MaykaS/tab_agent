# SPEC.md — Tab Agent Chrome Extension

## Overview

Tab Agent is a Chrome extension that uses on-device AI (Gemini Nano) to intelligently group a user's open tabs by topic, protect frequently-used tabs from being suspended, and let the user take one-click actions on entire groups. It requires no API key and works for any Chrome user on desktop.

**Milestone this spec covers:** MVP (completed) + Agentic version (Phase 2 — planned)

> The MVP is the non-agentic baseline. All user actions are manually triggered. The agentic version — built after the user study — makes the Act step autonomous, driven by a learned behavioral model.

---

## Problem

Chrome's built-in tab suspension is dumb — it uses a fixed inactivity timer with no understanding of context or user behavior. It will suspend a Figma tab you return to every 20 minutes just as readily as a news article you opened 3 hours ago and forgot about. Existing extensions (The Marvellous Suspender, OneTab, Tab Wrangler) are either rule-based or require manual organization. None of them learn from the user.

---

## Users

Primary user for MVP: the developer/researcher. Secondary users for user study: students and knowledge workers who regularly have 10+ tabs open.

---

## MVP Feature Set

### Implemented

| # | Feature | Description |
|---|---------|-------------|
| F1 | Tab observation | Read all open tabs: title, URL, filtered to non-Chrome-internal pages |
| F2 | AI grouping | Send tab list to Gemini Nano, receive back named groups with tab assignments |
| F3 | Group display | Show groups + tab titles in the extension popup |
| F4 | Sleep group | One-click: discard tabs in a group (`chrome.tabs.discard`). Confirms before acting on frequent tabs |
| F5 | Close group | One-click: close tabs in a group (`chrome.tabs.remove`). Confirms before acting on frequent tabs. Partial close keeps frequent tabs visible |
| F6 | Wake group | Slept groups stay visible in popup with a Wake button. Wake reloads all discarded tabs in the group |
| F7 | Tab history logging | On every tab activation, write `{url, timestamp}` to `chrome.storage.local` |
| F8 | Frequent tab protection | Tabs visited 3+ times in the last 24h get a "frequent" badge. Sleep/close confirm before acting on them |
| F9 | Persistent groups | Groups cached in `chrome.storage.local` — reopening popup is instant, no re-grouping. Cache cleared when groups are closed or Regroup is pressed |
| F10 | Sleep/wake state persistence | Asleep state survives popup close/reopen. Wake button shown correctly on reopen |
| F11 | Stats page | Separate page showing: total tabs open, memory saved (estimated), groups count, memory per group, asleep/awake status per group |
| F12 | Grouping quality rating | Agreement rating form in stats page — user rates each group 1-5 stars, produces an agreement score. Ratings saved to storage for eval use |

### Out of scope for MVP (Phase 1)

- Autonomous actions — all actions are user-triggered in MVP
- Continuous background decision loop
- Per-URL behavioral model (history is collected but not modeled yet)
- OpenAI / Anthropic API toggle
- Settings or preferences page
- Chrome Tab Groups API integration (native colored groups)
- Real per-tab CPU/memory data (requires Chrome Dev channel)
- Mobile support

---

## Phase 2 Feature Set — Agentic Version

### In scope (to be built after user study)

| # | Feature | Description |
|---|---------|-------------|
| A1 | Behavioral model | Per-URL model built from visit history: avg interval, peak hours, peak days, co-activation patterns |
| A2 | Need scoring | Score each open tab 0–1 for predicted need in next N minutes |
| A3 | Auto-sleep | Background loop sleeps tabs below need threshold. Never sleeps frequent tabs, active media, or open forms |
| A4 | Auto-wake (Option B) | When a tab activates, wake slept tabs in same group. Context-triggered, not time-triggered |
| A5 | Scheduled wake | Detect time-of-day patterns, wake tabs before predicted need window |
| A6 | Action log | Every autonomous action logged with reason. Visible in stats page. |
| A7 | Undo | User can undo any autonomous sleep or wake from the action log |
| A8 | Settings | Sleep threshold, wake sensitivity, per-group opt-out |
| A9 | Feedback loop | User marks actions correct/incorrect → model improves over time |

### Agentic acceptance criteria

- [ ] Agent sleeps a tab autonomously within 5 minutes of it falling below threshold
- [ ] Agent never sleeps a tab marked frequent
- [ ] Agent wakes slept tabs when a tab in the same group is activated
- [ ] Every autonomous action appears in the action log with a reason
- [ ] User can undo any autonomous action from the log
- [ ] Behavioral model correctly predicts tab need with >70% precision (measured in evals)
- [ ] Settings page allows threshold configuration and per-group opt-out

---

## Data the Extension Touches

| Data | Where stored | Retention |
|------|-------------|-----------|
| Tab titles + URLs (live) | In-memory only, per popup open | Cleared on popup close |
| Tab visit history `{url, timestamp}` | `chrome.storage.local` → key: `visits` | Rolling 7 days |
| Cached groups + tabMap | `chrome.storage.local` → key: `cachedGroups` | Until closed or regrouped |
| Asleep group state | `chrome.storage.local` → key: `asleepGroups` | Until woken or regrouped |
| Estimated memory saved | `chrome.storage.local` → key: `memorySaved` | Cumulative, manual reset only |
| Agreement rating history | `chrome.storage.local` → key: `ratingHistory` | Persistent, used for evals |

No data leaves the device. Gemini Nano runs fully on-device.

---

## Tech Stack

| Layer | Choice | Why |
|-------|--------|-----|
| Extension framework | Chrome Manifest V3 | Current standard, required for Chrome Web Store |
| AI | Gemini Nano via `LanguageModel` Prompt API | Free, on-device, no account needed |
| Language | Vanilla JS | No build step, faster to iterate |
| Storage | `chrome.storage.local` | Built-in, persistent across sessions |
| UI | HTML + CSS in popup + stats page | Simple, no framework needed for MVP |

---

## Acceptance Criteria

All of the following are met:

- [x] Extension installs from unpacked folder without errors
- [x] Popup opens and shows a loading state while grouping
- [x] Tabs are grouped into 2–6 named groups (with 10+ tabs open)
- [x] Each group shows the tab titles under it
- [x] Reopening popup loads cached groups instantly — no re-grouping
- [x] "Sleep group" discards non-frequent tabs, stays visible with Wake button
- [x] "Wake group" reloads all discarded tabs in the group
- [x] "Close group" closes tabs, removes group from popup and cache
- [x] Closing a group with frequent tabs asks for confirmation
- [x] Cancelling partial close keeps frequent tabs visible in the group
- [x] Tabs visited 3+ times in 24h show a "frequent" badge
- [x] Sleep/wake state persists across popup open/close
- [x] Stats page accessible via Stats button — shows memory, tab counts, group status
- [x] Agreement rating form saves scores to storage
- [x] Extension works on Chrome 127+ with the Gemini Nano flag enabled
- [x] If Gemini Nano is unavailable, a clear error message is shown (not a crash)

---

## Known Limitations (MVP)

- Requires manual Chrome flag setup (`chrome://flags/#prompt-api-for-gemini-nano`)
- Grouping quality depends on Gemini Nano — small model, adequate but not perfect
- Memory data is estimated (~50MB per tab) — real per-tab data requires Chrome Dev channel
- No undo for close actions (sleep can be undone with Wake)
- **No autonomous actions — this is by design in MVP.** The agentic version (Phase 2) adds autonomous sleep/wake.
- Gemini Nano only supports English, Spanish, and Japanese
