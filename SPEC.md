# SPEC.md - Tab Agent Chrome Extension

## Overview

Tab Agent is a Chrome extension that uses on-device AI (Gemini Nano) to group open tabs by topic, protect frequent tabs from risky bulk actions, and let the user act on entire groups with one click.

This spec covers the implemented MVP plus the planned agentic follow-up.

---

## MVP feature set

### Implemented

| # | Feature | Description |
|---|---------|-------------|
| F1 | Tab observation | Read open tabs and filter out Chrome-internal pages |
| F2 | AI grouping | Send tab metadata to Gemini Nano and receive named groups |
| F3 | Group display | Show grouped tabs in the popup |
| F4 | Sleep group | Discard tabs in a group, with confirmation for frequent tabs |
| F5 | Close group | Close tabs in a group, with confirmation for frequent tabs |
| F6 | Wake group | Reload previously discarded tabs in a group |
| F7 | Visit history logging | Record `{url, timestamp}` on tab activation |
| F8 | Frequent tab protection | Badge and protect URLs visited 3+ times in the last 24 hours |
| F9 | Persistent groups | Cache groups in local storage for instant reopen |
| F10 | Asleep state persistence | Keep wake/sleep state across popup reopen |
| F11 | Stats page | Show estimated total memory, saved memory, group counts, per-group memory, and awake/asleep state |
| F12 | Grouping quality rating | Let the user rate each group 1-5 and save the results locally |
| F13 | Study submission | Auto-generate participant ID, collect three self-report answers, and submit an anonymized study snapshot |

### Out of scope for MVP

- Autonomous background actions
- Continuous decision loop
- Learned behavioral model
- Settings page
- Real per-tab memory/CPU metrics on Chrome stable

---

## Data the extension stores or sends

| Data | Location | Retention |
|------|----------|-----------|
| Live tab titles + URLs | In memory during popup/stats usage | Cleared on close |
| Visit history | `chrome.storage.local` key `visits` | Rolling 7 days |
| Cached groups + tab map | `chrome.storage.local` key `cachedGroups` | Until regroup/close |
| Asleep state | `chrome.storage.local` key `asleepGroups` | Until wake/regroup |
| Estimated memory saved | `chrome.storage.local` key `memorySaved` | Persistent |
| Rating history | `chrome.storage.local` key `ratingHistory` | Persistent |
| Participant ID | `chrome.storage.local` key `participantId` | Persistent |
| Study responses | `chrome.storage.local` key `studyResponses` | Persistent |

Gemini Nano grouping runs locally on-device.

Study submissions leave the device only when the user explicitly clicks submit in the Stats page.

---

## Study snapshot contents

Each submitted study snapshot can include:

- `participantId`
- `sessionLog`
- `visitCount`
- `tabCount`
- `openTabCount`
- `groupCount`
- `asleepGroupCount`
- `asleepTabCount`
- `ratingCount`
- `avgRating`
- `memorySavedEstimateMb`
- `totalTabMemoryEstimateMb`
- `memoryMetricsAreEstimated`
- `groups[]` with per-group details:
  - `name`
  - `tabCount`
  - `openTabCount`
  - `isAsleep`
  - `estimatedMemoryMb`
  - `estimatedSavedMemoryMb`
  - `rating`
  - `tabTitlesPreview`
- `studyResponses`:
  - `groupingUseful`
  - `trustSleepClose`
  - `wouldUseInRealBrowsing`

---

## Acceptance criteria

- Extension installs and runs from an unpacked folder
- Popup groups tabs or falls back safely instead of crashing
- Frequent tabs are visibly badged and protected by confirmation
- Sleep/wake/close actions work on group-level controls
- Stats page is accessible from the popup
- Stats page shows estimated total memory, per-group memory, counts, and group state
- Agreement rating form saves correctly
- Stats page can submit an anonymized study snapshot
- Website backend stores submissions in Neon Postgres

---

## Known limitations

- Requires Gemini Nano flag setup in Chrome
- Grouping quality depends on Gemini Nano output
- Memory values in Stats and study payload are estimated on Chrome stable
- No autonomous actions in the MVP
- No researcher-observed timing or Task Manager memory is collected automatically
