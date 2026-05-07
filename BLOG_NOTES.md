# Tab Agent Blog Notes

## Product summary

Tab Agent is a local-first browser tab memory agent for Chrome. It groups tabs into workable contexts, sleeps low-need tabs to reduce tab load, wakes related tabs when a user returns to a context, and learns from both behavior and feedback over time. The extension is the main product surface, while the web layer supports summaries, storage, admin views, and evaluation workflows.

## Why this is agentic

Tab Agent is agentic because it does more than organize tabs on command. It observes browser state, predicts near-term tab need, takes limited autonomous actions, and then updates its future behavior from the outcomes. The real-time controller is still local and conservative, but it already runs a genuine decision loop instead of acting like a static utility.

## Core loop

`Observe -> Predict -> Act -> Learn`

- Observe: open tabs, active tab, visit history, cached groups, asleep state, recent activations, protected contexts, and tab lifecycle events
- Predict: estimate whether a tab will be needed in the next 15 minutes
- Act: auto-sleep low-need tabs and wake related tab contexts when the user returns
- Learn: update caution and safe-sleep signals from outcomes and feedback

## Learning signals

Explicit signals:

- `Undo`
- `Protect`
- `Good`
- `Bad`

Implicit signals:

- quick reopen after auto-sleep
- manual wake after sleep
- safe-after-15-minutes outcomes
- repeated activation or re-entry patterns

Current reward mapping:

- `safe_after_15m` / `good_feedback` = `+1`
- `protect` = `-0.5`
- `undo` / `bad_feedback` / regret-like outcomes = `-1`

Current learning is heuristic and adaptive policy tuning, not a full online reinforcement learning system.

## Evaluation baselines

- Baseline A: fixed rule-based sleep policy
- Baseline B: assistant MVP with manual actions
- Experimental: personalized autonomous tab agent

Core evaluation question:

Can a personalized autonomous browser policy save more memory than a fixed rule while causing less interruption?

## Known limitations

- browser-only, not OS-wide memory management
- memory usage is estimated on Chrome stable rather than measured per tab in production
- Gemini Nano depends on Chrome flags and local model availability
- the runtime policy is mostly heuristic and adaptive, not a trained online RL model
- OpenAI is advisory only and does not control browser actions
- public install currently requires developer-mode loading from GitHub

## Open questions

- How much autonomy users will trust before they want stronger manual controls
- Which implicit signals are most predictive of regret versus safe sleep
- Whether personalized memory benefits hold across different work styles and tab habits
- How much value context wake adds relative to sleep alone
- When it makes sense to move from heuristic adaptation to learned policy updates
