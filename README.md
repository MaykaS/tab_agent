# Tab Agent

Tab Agent is a **browser tab memory-management agent**.

It does four things:

1. **Groups** tabs by topic with Gemini Nano
2. **Sleeps** low-need tabs with a local autonomous policy
3. **Wakes** related slept tabs when the user returns to a context
4. **Learns** from undo, protect, reopen, and explicit feedback

## Repo split

There are **two repos**:

- **`tab_agent`** - the Chrome extension
- **`tab_agent_web`** - the website, backend, admin dashboard, and OpenAI summary endpoint

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

The separate `tab_agent_web` repo contains:

- landing site
- study submission API
- Neon/Postgres storage
- admin dashboard
- OpenAI-assisted summary endpoint

## Current product state

Tab Agent is now more than an assistant, but it is still a **v1 browser agent**, not a full computer-wide memory manager.

### Manual assistant features

- Gemini Nano grouping
- cached groups for reopen
- manual sleep / wake / close
- frequent-tab protection
- Stats page
- grouping-quality ratings
- study submission

### Agentic features

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

The Stats page now surfaces the agent loop in a compact way:

- a collapsible feed for recent autonomous actions and feedback
- a collapsible raw tab event log for temporal debugging and context inspection

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

The web layer can now compare three context variants for summaries:

- `summary_only`
- `raw_log_only`
- `hybrid`

This keeps the agent:

- local
- fast
- explainable
- benchmarkable

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

This repo includes a reusable scenario set in [agent_test_set/README.md](/C:/Users/mayas/OneDrive/Desktop/Projects/tab%20agent/agent_test_set/README.md).

Use it to test:

- sleep decisions
- wake behavior
- safety constraints
- feedback handling
- baseline-vs-agent comparison cases
- summary-vs-raw-vs-hybrid context comparisons

The generated benchmark report lives at [agent_test_set/context_benchmark_report.md](/C:/Users/mayas/OneDrive/Desktop/Projects/tab%20agent/agent_test_set/context_benchmark_report.md).

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

- browser-only for now
- not full system memory management yet
- memory values are estimated on Chrome stable
- the v1 policy is intentionally conservative
- OpenAI summaries are advisory only
- offline learning data is exported, but the runtime policy is still mostly heuristic
