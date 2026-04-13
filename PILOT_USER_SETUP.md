# Pilot User Setup

This file is for someone trying Tab Agent as a pilot user for a few days or a
week.

## What this is

Tab Agent has two parts:

- the **Chrome extension** in this repo
- the **web/admin layer** in the separate `tab_agent_web` repo

To generate real usage data, you need the **extension**, not just the Vercel
site.

## Setup

1. Clone this repo:

   ```bash
   git clone https://github.com/MaykaS/tab_agent.git
   cd tab_agent
   ```

2. Open `chrome://extensions`
3. Turn on **Developer mode**
4. Click **Load unpacked**
5. Select the cloned repo folder

## Gemini Nano setup

Enable both Chrome flags:

- `chrome://flags/#prompt-api-for-gemini-nano` -> `Enabled`
- `chrome://flags/#optimization-guide-on-device-model` -> `Enabled BypassPerfRequirement`

Then open DevTools once and run:

```js
await LanguageModel.create()
```

You can verify availability with:

```js
await LanguageModel.availability()
```

Expected result:

```js
"available"
```

## How to use it

Use Tab Agent normally for a few days or about a week.

Helpful behaviors during the pilot:

- use `Regroup` when your tab context has changed a lot
- use `Undo` if an autonomous action feels wrong
- use `Protect` on tabs or contexts that should be preserved
- use `Good` / `Bad` feedback when a decision feels especially right or wrong

## Exporting data at the end

1. Open the Tab Agent **Stats** page
2. Click **Export data**
3. Send the exported JSON file back to Maya

That export is used to generate:

- a personalized memory artifact
- a personalized benchmark
- a `memory_off` vs `memory_on` comparison

## Notes

- Tab Agent is still a **browser-only v1 agent**
- the policy is intentionally conservative
- OpenAI is advisory only and does not directly control browser actions
- the current goal is to study context quality and lightweight memory, not full RL
