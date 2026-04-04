# Tab Agent — Product Document

**Maya Sagalin | Cornell Johnson MBA | 2025–2026**

> MVP completed · Next: User Study · Then: Evals + Red Team · Final: Presentation

---

## 1. Problem

Chrome's built-in tab suspension is dumb. It uses a fixed inactivity timer with no understanding of context or user behavior — it will suspend a Figma tab you return to every 20 minutes just as readily as a news article you opened 3 hours ago and forgot about.

When Chrome suspends a tab, it discards the page from memory. When you revisit it, Chrome has to reload the full page — network requests, JS execution, re-rendering. For heavy pages (Google Docs, Figma, complex web apps) this is genuinely expensive and disruptive.

### What exists today — and why Tab Agent is different

| Extension | Approach | The gap |
|-----------|----------|---------|
| The Marvellous Suspender | Suspends inactive tabs by time | No intelligence — same rule for all tabs |
| OneTab | Collapses everything into a list | Saves memory but loses all context |
| Tab Wrangler | Auto-closes stale tabs | Rule-based, no learning |
| Workona | Project-based spaces (manual) | Requires manual organization by user |
| Side Space / VertiTab | AI-powered grouping | Surface-level grouping, no learning loop |
| **Tab Agent** | **Agent that learns your patterns** | **Protects tabs you actually return to** |

---

## 2. Solution

Tab Agent is a Chrome extension that uses on-device AI (Gemini Nano) to intelligently group open tabs by topic, learn user behavior over time, and autonomously manage tab memory — sleeping tabs the user doesn't need and waking them when context suggests they will.

> No API key required. No data leaves the device. Free for any Chrome user on desktop.

### MVP vs agentic — the core distinction

The MVP and the full agentic version share the same observe → decide → act → remember loop. The critical difference is in the **Act** step:

| Version | Observe | Decide | Act | Remember |
|---------|---------|--------|-----|----------|
| MVP (done) | Reads tabs + history | AI groups tabs | **User clicks** Sleep/Wake/Close | Logs visit history |
| Agentic (next) | Reads tabs + history + context | AI predicts tab need | **Autonomous** Sleep/Wake based on learned patterns | Builds behavioral model per URL |

In the MVP, the agent is an assistant — it organizes, but the user executes. In the agentic version, the agent acts on its own. The user sets the policy once ("manage my tabs") and the agent handles execution.

### The agent loop (MVP)

| Step | What happens |
|------|-------------|
| Observe | Reads all open tabs (title, URL). Reads visit history from local storage to identify frequently-visited tabs. |
| Decide | Sends tab list to Gemini Nano. Receives back named groups (e.g. "Work", "Research", "Shopping"). Caches result — no re-grouping on reopen. |
| Act | User clicks Sleep, Wake, or Close on a group. Agent never acts autonomously. |
| Remember | Background worker logs every tab switch. Tabs visited 3+ times in 24h are marked "frequent" and protected. |

### The agent loop (agentic version)

| Step | What happens |
|------|-------------|
| Observe | Reads all open tabs. Monitors which tab just became active. Reads full behavioral history: visit frequency, time-of-day patterns, group membership. |
| Decide | Scores each tab: "How likely is the user to need this tab in the next N minutes?" Sleep if below threshold. Wake if a related tab just opened (Option B). |
| Act | **Autonomously** discards low-need tabs. **Autonomously** reloads tabs when a contextually related tab is activated. Notifies user of what it did and why. |
| Remember | Continuously updates per-URL behavioral model: frequency, recency, time-of-day, co-activation patterns (which tabs are opened together). |

### Why Option B for auto-wake

Two approaches were considered for proactive waking:

**Option A — Time/pattern based:** "You visit Gmail every morning at 9am — wake it at 8:55am." Works for habitual tabs but requires extensive history and risks false positives (waking a tab the user doesn't need wastes memory).

**Option B — Trigger based (chosen):** "You just opened a tab related to X — wake other tabs in the same group." For example: you open a GitHub repo → agent wakes your Stack Overflow tab and your docs tab from the same group. This is context-aware, reactive to what you're doing *right now*, and more reliable than pure time prediction.

> Key design principle: **auto-sleep should be silent and reversible. Auto-wake should be conservative and explainable** — when the agent wakes something, it tells the user why ("Woke 'GitHub Docs' because you opened a related tab").

---

## 3. MVP — What Was Built

### Features implemented

| Feature | Description |
|---------|-------------|
| AI tab grouping | Gemini Nano groups open tabs by topic into 2–6 named groups |
| Persistent groups | Groups cached in storage — reopening popup is instant, no re-grouping |
| Sleep group | Discards tabs in a group to free memory. Asks confirmation for frequent tabs |
| Wake group | Slept groups stay visible with a Wake button. Reloads all discarded tabs |
| Close group | Closes tabs. Partial close keeps frequent tabs open if user cancels |
| Frequent tab protection | Tabs visited 3+ times in 24h get a badge. Sleep/close confirm before acting |
| Sleep/wake persistence | Asleep state survives popup close and reopen |
| Stats page | Live dashboard: tabs open, memory saved (est.), memory per group, awake/asleep status |
| Agreement rating | Rate each group 1–5 stars. Scores saved to storage for eval use |

### Tech stack

| Layer | Choice | Why |
|-------|--------|-----|
| AI | Gemini Nano (Chrome Prompt API) | Free, on-device, no account needed |
| Extension framework | Chrome Manifest V3 | Current standard |
| Language | Vanilla JavaScript | No build step needed for MVP |
| Storage | chrome.storage.local | Persistent across sessions, built-in |
| Stats UI | HTML + CSS (separate extension page) | Simple, no framework needed |

### File structure

| File | Purpose |
|------|---------|
| `manifest.json` | Chrome extension entry point — permissions, background worker, popup |
| `background.js` | Always-on listener — records tab visits to storage on every tab switch |
| `popup.html / popup.js` | The agent brain — observe, decide, render, act |
| `storage.js` | Shared helpers — writeVisit, getFrequentUrls, pruneOldVisits |
| `stats.html / stats.js` | Measurement dashboard — memory, tab counts, agreement rating form |
| `SPEC.md` | Product specification — features, acceptance criteria, data schema |
| `AGENTS.md` | Agent design — observe/decide/act/remember loop, storage schema, component map |
| `TASKS.md` | Build checklist — 48 tasks, all completed |

---

## 4. AI Backend — Options Evaluated

| | Gemini Nano | Anthropic (Claude) | OpenAI (GPT) |
|--|-------------|-------------------|--------------|
| Cost to user | **Free, always** | Pay-per-use (~$0.001/call) | Free credits, then pay |
| Needs account | No | Yes | Yes |
| Works offline | Yes | No | No |
| Model quality | Good (small model) | Best | Very good |
| Setup friction | Low (flag enable) | Medium | Medium |
| Role in evals | Baseline | Gold standard | Comparison point |
| Mobile support | No | Yes | Yes |

> **Decision:** Gemini Nano as default (zero friction). Claude and GPT as optional backends post-MVP, and as comparison points in the Evals milestone.

---

## 5. Milestones & Next Steps

### Milestone 1 — MVP ✅ COMPLETE

**Status: Done. Extension built, tested, committed to GitHub.**

Delivered:
- Working Chrome extension installable from unpacked folder
- Full agent loop: observe tabs → Gemini Nano grouping → render → sleep/wake/close actions
- Persistent groups, frequent tab protection, stats dashboard, agreement rating form
- SPEC.md, AGENTS.md, TASKS.md all completed and up to date

Pending:
- Deploy to public website on Vercel (professor requirement — see Section 6)
- Record demo video: install → group → sleep → wake → close → stats

---

### Milestone 2 — User Study

**Goal: validate the three core claims with real users.**

#### Claim 1 — Grouping quality matches how users think

Method: Agreement rate test (already built into the Stats page)

- Participant opens 15–20 tabs across different topics
- They write down how they would group them (ground truth)
- Tab Agent runs — participant rates each group 1–5 stars in the Stats page
- Score = % agreement with their mental model
- Baseline comparison: domain-only grouping (all github.com tabs together, etc.)

#### Claim 2 — Sleeping tabs frees meaningful memory

Method: Before/after measurement using Chrome Task Manager (Shift+Esc)

- Record memory per tab before sleeping a group
- Record memory after — calculate delta
- Compare to Chrome's built-in discard (same tabs, same pages)
- Stats page shows estimated savings (~50MB/tab) — validate against actual Task Manager readings

#### Claim 3 — Users find and manage tabs faster

Method: Time-to-find task

- Open 20 tabs across different topics
- Without Tab Agent: "find your Figma tab" — time how long scanning the tab bar takes
- With Tab Agent: same task using popup groups — time it
- Repeat 10 times with different target tabs
- Metric: median time-to-find, with and without the extension

#### User study logistics

| Item | Plan |
|------|------|
| Participants | 5–8 students or knowledge workers who regularly use 10+ tabs |
| Session length | ~20 minutes per participant |
| Format | Think-aloud protocol — participant narrates what they're doing |
| Data collected | Agreement scores (from Stats page), time-to-find, qualitative feedback |
| Analysis | Agreement rate vs baseline, time delta, common grouping complaints |

---

### Milestone 3 — Evals + Red Team Study

**Goal: rigorous comparison of AI backends and stress-testing of edge cases.**

#### Eval 1 — Grouping quality across backends

Same tab set, three models, blind rating:
- Gemini Nano vs Claude Haiku vs GPT-4o mini
- 10 different tab sets (varied topics, varied tab counts: 5, 10, 20, 30+)
- Rater scores each grouping without knowing which model produced it
- Metric: agreement score, group naming quality, handling of edge cases

#### Eval 2 — Memory savings accuracy

Validate the ~50MB/tab estimate against real measurements:
- Use Chrome Dev channel to access chrome.processes API
- Measure actual vs estimated memory savings for 20 tab sets
- Identify tab types where estimate is most/least accurate (Gmail vs simple HTML page)

#### Eval 2 — Memory savings validity

**How we currently measure memory saved**

The Stats page shows an estimate: every tab that gets slept is assumed to save ~50MB. That number is hardcoded. It's not measured — it's a rough industry average for a typical Chrome tab. The honest answer is: we don't actually know if it's true for any individual user. It's a proxy.

**Why ~50MB is a reasonable starting estimate**

Chrome's memory usage per tab varies wildly:
- A simple Wikipedia page: ~30–60MB
- Gmail or Google Docs: ~150–300MB
- A video playing in a background tab: ~200–500MB
- A blank new tab: ~15–20MB

The ~50MB figure is roughly the low end for a typical productive tab. It's conservative, which means claimed savings are more likely to be *underestimates* than overestimates — the safer direction for a research claim.

**Three threats to validity**

*1. Construct validity — are we measuring what we claim to measure?*
`chrome.tabs.discard()` tells Chrome to unload the tab from memory, but Chrome decides *when* to actually free that memory. The OS may not reclaim it immediately. "Tab discarded" ≠ "memory freed right now."

*2. Internal validity — is the difference caused by Tab Agent or something else?*
Between sleeping a group and measuring memory, other Chrome processes may have changed. Background tabs load content, garbage collection runs, Chrome's own memory manager acts. A controlled before/after requires nothing else changing in that window.

*3. External validity — does the ~50MB estimate generalize?*
A person with mostly Gmail, Docs, and Figma tabs will save much more than ~50MB per tab. A person with mostly news articles will save less. The estimate doesn't reflect individual usage patterns.

**How to validate in evals**

1. Open the same 10 tabs on a test machine
2. Record actual memory per tab from Chrome Task Manager (Shift+Esc)
3. Sleep the group with Tab Agent, wait 10 seconds
4. Re-check Task Manager, record actual memory freed
5. Compare to the ~50MB/tab estimate
6. Repeat 5 times with different tab sets to get a calibration factor

Report: "Estimated savings shown in UI: X MB. Actual measured savings via Chrome Task Manager: Y MB. Estimate accuracy: Z%."

**Honest framing for the paper**

> "Memory savings are estimated at ~50MB per discarded tab based on conservative industry averages for typical productive tabs. Actual savings vary by tab type and are validated against Chrome Task Manager measurements in the Evals section. Real per-tab data via `chrome.processes` API requires Chrome Dev channel and is logged as a known limitation."

---

#### Red team scenarios

| Scenario | What we test |
|----------|-------------|
| 100+ tabs open | Does Gemini Nano hit context window limits? Does grouping degrade? |
| All tabs same domain | Does agent create useful groups or one giant group? |
| Non-English tabs | Does grouping work for Hebrew, Spanish, Japanese tabs? |
| Tabs with no titles | Untitled tabs — how does agent handle missing signals? |
| Frequent tab threshold edge | Tab visited exactly 3x in 24h — badge appears correctly? |
| Stale cache after browser restart | Do cached tab IDs survive a Chrome restart? |
| Gemini Nano unavailable | Error message shows cleanly, no crash |

#### Sequence toward full product (professor guidance)

| Phase | What changes |
|-------|-------------|
| Current (MVP) | Single agent, Gemini Nano, vanilla JS. User-triggered actions only. Groups tabs intelligently but does not act autonomously. |
| Next: Agentic | Same single agent, but Act step becomes autonomous. Agent sleeps/wakes tabs based on learned behavioral model. Background loop runs continuously. User sets policy, agent executes. |
| Then: Tools / MCP + RAG | MCP server exposes tab state to external tools. RAG over user's browsing history to improve grouping and need prediction. Connect to calendar, Notion, etc. for richer context signals. |
| Full product | Cross-device sync, team workspaces, API for developers, Chrome Web Store distribution |

---

### Milestone 4 — Presentation

Suggested structure:
- **Problem:** the tab overload problem and why current solutions fail
- **Solution:** the agent loop — observe, decide, act, remember
- **Demo:** live extension demo (20 tabs, group, sleep, wake, stats)
- **Evals:** agreement scores, memory savings, time-to-find results
- **Architecture:** how it evolved from simple → multi-agent → MCP + RAG
- **Next steps:** full product vision, Chrome Web Store, team workspaces

---

## 6. Vercel Deployment (Professor Requirement)

Chrome extensions can't be deployed to Vercel directly — they're installed locally. The Vercel deployment will be a landing page for Tab Agent that:

- Explains the project and the agent design
- Links to the GitHub repo for installation instructions
- Embeds the Stats page UI as a standalone web demo (without the Chrome extension — uses mock data)
- Shows eval results once the evals milestone is complete

### Pages to build

| Page | Content |
|------|---------|
| `/` (landing) | Hero: what Tab Agent does. Demo GIF. Install instructions. GitHub link. |
| `/demo` | Interactive stats UI with mock tab data — shows the grouping and memory UI without needing the extension installed |
| `/evals` | Results from the user study and evals milestone (built after Milestone 3) |

> **Suggested stack:** Next.js (React) — easiest Vercel deployment, can reuse the stats page logic as a React component.

---

## 7. Course Deliverables Checklist

| Deliverable | Status | Notes |
|-------------|--------|-------|
| AGENTS.md | ✅ Done | Updated to reflect full MVP |
| TASKS.md | ✅ Done | 48 tasks, all checked off |
| SPEC.md | ✅ Done | F12 features, all acceptance criteria met |
| MVP (implementation) | ✅ Done | Extension built and working |
| Vercel deployment | 🔲 To do | Landing page + demo — build after User Study |
| User Study | 🔲 To do | 5–8 participants, 3 claims, ~20 min sessions |
| Evals + Red Team Study | 🔲 To do | 3 models, 7 red team scenarios |
| Presentation | 🔲 To do | After evals — 4-part structure above |
