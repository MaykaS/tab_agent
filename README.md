# Tab Agent

Tab Agent is a **browser tab memory-management agent**.

For the current product framing, read [V2_PRODUCT_BRIEF.md](./V2_PRODUCT_BRIEF.md).

It does four things:

1. **Groups** tabs by topic with immediate local grouping and optional Gemini Nano refinement
2. **Sleeps** low-need tabs with a local autonomous policy
3. **Wakes** related slept tabs when the user returns to a context
4. **Learns** from undo, protect, reopen, and explicit feedback

## Repo split

There are **two repos**:

- **`tab_agent`** - the Chrome extension
- **`tab-agent-web`** - the website, backend, admin dashboard, and OpenAI summary endpoint

If you want to change **extension behavior**, this is the repo to edit.  
Updating the web repo alone is **not enough**.

## What lives in this repo

This repo contains the extension runtime:

- popup UI
- background service worker
- local autonomous policy
- Stats page
- feedback loop
- local storage/model state
- raw tab event logging
- training-example export

## What lives in the web repo

The separate `tab-agent-web` repo contains:

- landing site
- study submission API
- Neon/Postgres storage
- admin dashboard
- OpenAI-assisted summary endpoint

## Current product state

Tab Agent is now more than an assistant, but it is still a **browser-tab agent**, not a full computer-wide memory manager.

The current direction is:

- **focus-first**
- **knowledge-worker oriented**
- **observe then act**
- **trust-earned autonomy**
- **caution-first memory**

### Manual assistant features

- Gemini Nano grouping
- cached groups for reopen
- manual sleep / wake / close
- frequent-tab protection
- Stats page
- grouping-quality ratings
- study submission

### Agentic features

- observation mode before trusted autonomy
- autonomous sleep
- context wake
- action log
- raw tab lifecycle event log
- undo
- protect
- explicit `Good` / `Bad` feedback
- local behavior memory
- adaptive policy thresholds from recent outcomes
- exported training examples for offline learning
- OpenAI-generated policy summary

### Current product posture

The product is intentionally conservative.

- new users start in `observation mode`
- autonomous sleep unlocks only in `trusted_autonomy`
- wake is allowed earlier than sleep
- learned caution matters more than weak positive signals
- it is better to miss a sleep than to break focus

The Stats page now surfaces the agent loop in a compact way:

- a collapsible feed for recent autonomous actions and feedback
- a collapsible raw tab event log for temporal debugging and context inspection

The popup is intentionally optimized for responsiveness:

- it can render a useful local grouping immediately
- it can refine that grouping with on-device AI after the first paint
- it does not need to block the first user interaction on model latency

## Why this counts as agentic

Tab Agent now runs a real loop:

1. **Observe**
   - open tabs
   - active tab
   - cached groups
   - visit history
   - recent activations
   - behavior memory
   - raw tab lifecycle events
2. **Predict**
   - estimate whether a tab will be needed in the next 15 minutes
3. **Act**
   - auto-sleep low-need tabs
   - context-wake related slept tabs
4. **Learn**
   - from reopen behavior
   - from undo
   - from protect
   - from explicit good/bad feedback

That is enough to call it an **agentic tab memory-management prototype**.

## What OpenAI does

OpenAI is **not** the real-time controller.

The extension makes sleep/wake decisions locally. OpenAI is used only for:

- policy summaries
- explanation support
- threshold-tuning suggestions
- protected-context suggestions

The web layer can now compare four context variants for summaries:

- `recency_only`
- `summary_only`
- `raw_log_only`
- `hybrid`

This keeps the agent:

- local
- fast
- explainable
- benchmarkable

For the deeper product strategy behind this split, see [V2_PRODUCT_BRIEF.md](./V2_PRODUCT_BRIEF.md).

## Architecture

Tab Agent is split into a few focused runtime pieces:

- `popup.js` handles the grouping UI, manual sleep / wake / close actions, and the trust-status surface shown to the user
- `background.js` observes the tab lifecycle, records activation and reopen signals, runs the 5-minute agent cycle, and triggers context wake behavior
- `agent.js` contains the local autonomous policy, near-term need scoring, and sleep / wake decision logic
- `storage.js` maintains the local behavior model, feedback logs, reward mapping, adaptive policy summary, and exported training examples
- `stats.js` and `stats.html` power the Stats page, feedback UI, export flow, and OpenAI advisory summary button

## Learning loop

Tab Agent learns from both explicit and implicit signals, but the current runtime is still heuristic and adaptive rather than a full online RL system.

Explicit signals:

- `Undo`
- `Protect`
- `Good`
- `Bad`

Implicit signals:

- quick reopen after an autonomous sleep
- manual wake after sleep
- safe-after-15-minutes outcomes
- repeated activation and re-entry patterns

Reward mapping in the exported training examples:

- `safe_after_15m` / `good_feedback` = `+1`
- `protect` = `-0.5`
- `undo` / `bad_feedback` / regret-like outcomes = `-1`

## Publishability improvements

The current extension surface now makes the learning and safety story visible for pilots, professors, and technical readers:

- explicit and implicit learning signals are shown directly in the Stats page
- a reward ledger explains how recent autonomous sleep outcomes translate into reward-shaped feedback
- conservative non-action explanations show why the agent held back instead of sleeping a tab
- observation mode and trusted autonomy are visible with trust progress, reasons, and missing signals
- agent memory is surfaced as protection, safe-sleep, and useful wake areas
- baseline comparison framing makes the static-rule vs manual-assistant vs Tab Agent story easier to explain

Tab Agent uses reward-shaped feedback signals to tune a conservative local policy. It is not currently a fully trained online reinforcement learning system.

## Benchmark framing

The product should be evaluated against:

- **Baseline A:** static rule-based tab management
- **Baseline B:** assistant MVP with manual actions
- **Experimental:** personalized autonomous agent

Core metrics:

- estimated memory saved
- autonomous sleep count
- autonomous wake count
- regret / reopen count
- undo rate
- usefulness
- trust
- willingness to use

## Test set

This repo includes a reusable scenario set in [agent_test_set/README.md](./agent_test_set/README.md).

Use it to test:

- sleep decisions
- wake behavior
- safety constraints
- feedback handling
- baseline-vs-agent comparison cases
- summary-vs-raw-vs-hybrid context comparisons

The generated benchmark report lives at [agent_test_set/context_benchmark_report.md](./agent_test_set/context_benchmark_report.md).

The current evaluation story is split in two:

- **fixed benchmark** for context evaluation
- **personalized benchmark** for memory evaluation

This matters because personalized memory only helps when the evaluation overlaps
with the user's real learned contexts.

## Install

1. Clone the repo
   ```bash
   git clone https://github.com/MaykaS/tab_agent.git
   cd tab_agent
   ```
2. Open `chrome://extensions`
3. Turn on **Developer mode**
4. Click **Load unpacked**
5. Select this folder

After code changes:

1. Reload the extension in `chrome://extensions`
2. Reopen the popup or Stats page

If you changed autonomous behavior, feedback logging, or the Stats UI, you must reload the unpacked extension before Chrome will pick up the new version.

## Pilot user setup

If you want someone else, like a professor or pilot user, to try Tab Agent:

1. Share this repo, not just the Vercel link
2. Have them install the extension from `chrome://extensions`
3. Make sure Gemini Nano is enabled in Chrome
4. Ask them to use the extension naturally for a few days
5. Ask them to use `Undo`, `Protect`, `Good`, and `Bad` when relevant
6. At the end, have them open the Stats page and click `Export data`

Important:

- the **Vercel site** is useful for the landing page, backend, and admin views
- the **extension runtime** lives in this repo
- using the Vercel link alone is **not enough** to generate real tab behavior data

For a single-file version you can send directly, use [PILOT_USER_SETUP.md](./PILOT_USER_SETUP.md).

## Gemini Nano setup

Enable both Chrome flags:

- `chrome://flags/#prompt-api-for-gemini-nano` -> `Enabled`
- `chrome://flags/#optimization-guide-on-device-model` -> `Enabled BypassPerfRequirement`

Then run in DevTools:

```js
await LanguageModel.create()
```

Verify:

```js
await LanguageModel.availability()
```

Expected result:

```js
"available"
```

## Known limitations

- browser-only for now, not OS-wide memory management
- memory values are estimated on Chrome stable
- Gemini Nano availability depends on Chrome flags and local model availability
- the runtime policy is intentionally conservative and still mostly heuristic / adaptive rather than a trained online RL model
- OpenAI summaries are advisory only and do not control browser actions
- public install is currently developer-mode from GitHub
