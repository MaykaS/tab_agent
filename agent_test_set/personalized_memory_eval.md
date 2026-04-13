# Personalized Memory Evaluation

This report compares a no-memory advisory baseline against memory-informed advisory behavior on the personalized benchmark.

## Summary

- Scenarios evaluated: `8`
- Exact matches with `memory_off`: `0`
- Exact matches with `memory_on`: `3`
- Scenarios improved by memory: `6`

## Category Breakdown

- `context wake`: `0/2` scenarios improved with memory
- `feedback-sensitive`: `5/5` scenarios improved with memory
- `routine low-need sleep`: `1/1` scenarios improved with memory

## Scenario Comparison

### Outlook Guardrail Priority (`feedback-sensitive`)

- Improved with memory: `true`
- `memory_off` net score: `-2`
- `memory_on` net score: `0`
- `memory_off` risk: Without memory, this tab may look sleepable because it has also accumulated positive outcomes.
- `memory_on` intended behavior: With memory, Outlook should be treated as protected and preserved.
- Expected protected: `https://outlook.cloud.microsoft/mail/inbox/id/AAQkADViNTg0NDA4LTg2MmEtNDNhYi05OWY3LWU1ZThlMTgyMWQzNAAQAHle4xhcasBGkZkjJlbV3oI%3D`
- Expected sleep: `none`
- Expected wake groups: `none`
- `memory_off` prediction: `{"protected_tabs": ["https://www.notion.so/Tab_Agent-33fae558f1fc8048a5aff85f3310dccf"], "sleep_candidates": [], "wake_groups": []}`
- `memory_on` prediction: `{"protected_tabs": ["https://outlook.cloud.microsoft/mail/inbox/id/AAQkADViNTg0NDA4LTg2MmEtNDNhYi05OWY3LWU1ZThlMTgyMWQzNAAQAHle4xhcasBGkZkjJlbV3oI%3D", "https://www.notion.so/Tab_Agent-33fae558f1fc8048a5aff85f3310dccf"], "sleep_candidates": [], "wake_groups": []}`

### Vercel Admin Repeat Regret (`feedback-sensitive`)

- Improved with memory: `true`
- `memory_off` net score: `0`
- `memory_on` net score: `1`
- `memory_off` risk: Without memory, the admin page may be treated like a stale utility tab.
- `memory_on` intended behavior: With memory, the admin page should be preserved because it has repeated regret-linked evidence.
- Expected protected: `https://tab-agent-web.vercel.app/admin, https://github.com/MaykaS/tab-agent-web/tree/master`
- Expected sleep: `none`
- Expected wake groups: `none`
- `memory_off` prediction: `{"protected_tabs": ["https://github.com/MaykaS/tab-agent-web/tree/master"], "sleep_candidates": [], "wake_groups": []}`
- `memory_on` prediction: `{"protected_tabs": ["https://github.com/MaykaS/tab-agent-web/tree/master", "https://tab-agent-web.vercel.app/admin"], "sleep_candidates": ["https://github.com/MaykaS/tab-agent-web/tree/master"], "wake_groups": []}`

### Vercel Deployment Guardrail (`feedback-sensitive`)

- Improved with memory: `true`
- `memory_off` net score: `-2`
- `memory_on` net score: `2`
- `memory_off` risk: Without memory, deployment tabs can look stale and be slept too aggressively.
- `memory_on` intended behavior: With memory, the explicitly protected deployment should be guardrail-first, and similar Vercel tabs should lean conservative.
- Expected protected: `https://vercel.com/mayasag10-5355s-projects/tab-agent-web/72C8WDkShnimgnMuqpz4SoFg9opg, https://vercel.com/mayasag10-5355s-projects/tab-agent-web/6LP8dA32qMjrfG2WQXejF4Vwju3o`
- Expected sleep: `none`
- Expected wake groups: `none`
- `memory_off` prediction: `{"protected_tabs": [], "sleep_candidates": [], "wake_groups": []}`
- `memory_on` prediction: `{"protected_tabs": ["https://vercel.com/mayasag10-5355s-projects/tab-agent-web/6LP8dA32qMjrfG2WQXejF4Vwju3o", "https://vercel.com/mayasag10-5355s-projects/tab-agent-web/72C8WDkShnimgnMuqpz4SoFg9opg"], "sleep_candidates": [], "wake_groups": []}`

### Notion Workspace Mixed Context (`feedback-sensitive`)

- Improved with memory: `true`
- `memory_off` net score: `0`
- `memory_on` net score: `2`
- `memory_off` risk: Without memory, summary features may over-trust safe outcomes and sleep this context too eagerly.
- `memory_on` intended behavior: With memory, the context should be treated as mixed and kept conservative unless clearly stale.
- Expected protected: `https://www.notion.so/Tab_Agent-33fae558f1fc8048a5aff85f3310dccf, https://www.notion.so/HTC-25bae558f1fc800e8752cb9f725ec0ee`
- Expected sleep: `none`
- Expected wake groups: `none`
- `memory_off` prediction: `{"protected_tabs": ["https://www.notion.so/HTC-25bae558f1fc800e8752cb9f725ec0ee"], "sleep_candidates": [], "wake_groups": []}`
- `memory_on` prediction: `{"protected_tabs": ["https://www.notion.so/HTC-25bae558f1fc800e8752cb9f725ec0ee", "https://www.notion.so/Tab_Agent-33fae558f1fc8048a5aff85f3310dccf"], "sleep_candidates": [], "wake_groups": []}`

### LinkedIn Profile Mixed Context (`feedback-sensitive`)

- Improved with memory: `true`
- `memory_off` net score: `-2`
- `memory_on` net score: `0`
- `memory_off` risk: Without memory, the LinkedIn profile may be treated inconsistently based only on recency.
- `memory_on` intended behavior: With memory, the profile should be treated as mixed and protected under uncertainty.
- Expected protected: `https://www.linkedin.com/in/chrisbrabham-mba/`
- Expected sleep: `none`
- Expected wake groups: `none`
- `memory_off` prediction: `{"protected_tabs": ["https://jobs.ashbyhq.com/openai/d6d4fbf8-1976-4745-bf48-1a3cca5503b9?utm_source=8lvZy0eqYJ"], "sleep_candidates": [], "wake_groups": []}`
- `memory_on` prediction: `{"protected_tabs": ["https://jobs.ashbyhq.com/openai/d6d4fbf8-1976-4745-bf48-1a3cca5503b9?utm_source=8lvZy0eqYJ", "https://www.linkedin.com/in/chrisbrabham-mba/"], "sleep_candidates": [], "wake_groups": []}`

### Career Context Wake Return (`context wake`)

- Improved with memory: `false`
- `memory_off` net score: `-2`
- `memory_on` net score: `-3`
- `memory_off` risk: Without memory, wake behavior may rely only on generic group matching.
- `memory_on` intended behavior: With memory, re-entering Career & Internships should strongly support waking the sibling context.
- Expected protected: `none`
- Expected sleep: `none`
- Expected wake groups: `Career & Internships`
- `memory_off` prediction: `{"protected_tabs": ["https://jobs.ashbyhq.com/openai/d6d4fbf8-1976-4745-bf48-1a3cca5503b9?utm_source=8lvZy0eqYJ"], "sleep_candidates": [], "wake_groups": []}`
- `memory_on` prediction: `{"protected_tabs": ["https://jobs.ashbyhq.com/openai/d6d4fbf8-1976-4745-bf48-1a3cca5503b9?utm_source=8lvZy0eqYJ", "https://www.linkedin.com/in/chrisbrabham-mba/"], "sleep_candidates": [], "wake_groups": []}`

### Notion Context Wake Return (`context wake`)

- Improved with memory: `false`
- `memory_off` net score: `-2`
- `memory_on` net score: `-3`
- `memory_off` risk: Without memory, wake logic may miss that this context has repeatedly benefited from sibling restoration.
- `memory_on` intended behavior: With memory, Notion & Tabs should strongly support sibling wake on return.
- Expected protected: `none`
- Expected sleep: `none`
- Expected wake groups: `Notion & Tabs`
- `memory_off` prediction: `{"protected_tabs": ["https://www.notion.so/Tab_Agent-33fae558f1fc8048a5aff85f3310dccf"], "sleep_candidates": [], "wake_groups": []}`
- `memory_on` prediction: `{"protected_tabs": ["https://www.notion.so/HTC-25bae558f1fc800e8752cb9f725ec0ee", "https://www.notion.so/Tab_Agent-33fae558f1fc8048a5aff85f3310dccf"], "sleep_candidates": [], "wake_groups": []}`

### Known Safe Reference Tabs (`routine low-need sleep`)

- Improved with memory: `true`
- `memory_off` net score: `-1`
- `memory_on` net score: `3`
- `memory_off` risk: Without memory, all three tabs may be treated similarly if only recency is considered.
- `memory_on` intended behavior: With memory, the docs and repo tree should lean safe-to-sleep, while admin remains protected by risky memory.
- Expected protected: `https://tab-agent-web.vercel.app/admin`
- Expected sleep: `https://developer.chrome.com/docs/webstore/register/, https://github.com/MaykaS/tab-agent-web/tree/master`
- Expected wake groups: `none`
- `memory_off` prediction: `{"protected_tabs": ["https://tab-agent-web.vercel.app/admin"], "sleep_candidates": [], "wake_groups": []}`
- `memory_on` prediction: `{"protected_tabs": ["https://tab-agent-web.vercel.app/admin"], "sleep_candidates": ["https://developer.chrome.com/docs/webstore/register/", "https://github.com/MaykaS/tab-agent-web/tree/master"], "wake_groups": []}`
