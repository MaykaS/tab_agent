# SPEC.md — Tab Agent Chrome Extension

## Overview

Tab Agent is a Chrome extension that uses an on-device AI (Gemini Nano) to intelligently group a user's open tabs by topic, protect frequently-used tabs from being suspended, and let the user take one-click actions on entire groups. It requires no API key and works for any Chrome user on desktop.

**Milestone this spec covers:** MVP (2-day build)

---

## Problem

Chrome's built-in tab suspension is dumb — it uses a fixed inactivity timer with no understanding of context or user behavior. It will suspend a Figma tab you return to every 20 minutes just as readily as a news article you opened 3 hours ago and forgot about. Existing extensions (The Marvellous Suspender, OneTab, Tab Wrangler) are either rule-based or require manual organization. None of them learn from the user.

---

## Users

Primary user for MVP: the developer/researcher (you). Secondary users for user study: students and knowledge workers who regularly have 10+ tabs open.

---

## MVP Feature Set

### In scope

| # | Feature | Description |
|---|---------|-------------|
| F1 | Tab observation | Read all open tabs: title, URL, last active timestamp |
| F2 | AI grouping | Send tab list to Gemini Nano, receive back named groups with tab assignments |
| F3 | Group display | Show groups + tab titles in the extension popup |
| F4 | Sleep group | One-click: discard all tabs in a group (`chrome.tabs.discard`) |
| F5 | Close group | One-click: close all tabs in a group (`chrome.tabs.remove`) |
| F6 | Tab history logging | On every tab activation, write `{url, timestamp}` to `chrome.storage.local` |
| F7 | Frequent tab protection | Tabs visited 3+ times in the last 24h get a "frequent" badge and are skipped by sleep actions |

### Out of scope for MVP

- Autonomous actions (no sleeping tabs without user click)
- Continuous background monitoring loop
- OpenAI / Anthropic API toggle
- Settings or preferences page
- Cross-session learned model
- Chrome Tab Groups API integration (native colored groups)
- CPU / memory data via `chrome.processes`
- Mobile support

---

## Data the Extension Touches

| Data | Where stored | Retention |
|------|-------------|-----------|
| Tab titles + URLs | In-memory only, per popup open | Cleared on popup close |
| Tab visit history `{url, timestamp}` | `chrome.storage.local` | Rolling 7 days |
| AI grouping result | In-memory only | Cleared on popup close |

No data leaves the device. Gemini Nano runs fully on-device.

---

## Tech Stack

| Layer | Choice | Why |
|-------|--------|-----|
| Extension framework | Chrome Manifest V3 | Current standard, required for Chrome Web Store |
| AI | Gemini Nano via `LanguageModel` Prompt API | Free, on-device, no account needed |
| Language | Vanilla JS | No build step, faster to iterate in 2 days |
| Storage | `chrome.storage.local` | Built-in, persistent across sessions |
| UI | HTML + CSS in popup | Simple, no framework needed for MVP |

---

## Acceptance Criteria

The MVP is done when all of the following are true:

- [ ] Extension installs from unpacked folder without errors
- [ ] Popup opens and shows a loading state while grouping
- [ ] Tabs are grouped into 2–5 named groups (with 10+ tabs open)
- [ ] Each group shows the tab titles under it
- [ ] "Sleep group" discards the tabs in that group (except frequent ones)
- [ ] "Close group" closes the tabs in that group (except frequent ones)
- [ ] Tabs visited 3+ times in 24h show a "frequent" badge
- [ ] Frequent tabs are NOT discarded when their group is slept
- [ ] Extension works on Chrome 127+ with the Gemini Nano flag enabled
- [ ] If Gemini Nano is unavailable, a clear error message is shown (not a crash)

---

## Known Limitations (MVP)

- Requires user to manually enable `chrome://flags/#prompt-api-for-gemini-nano`
- Grouping quality depends on Gemini Nano (small model — adequate, not excellent)
- Groups are regenerated fresh each time the popup opens (no persistence)
- No undo for sleep/close actions
