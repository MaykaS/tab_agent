# Memory Advisory Evaluation

This report estimates where the synthesized memory artifact would provide useful advisory signals on the fixed scenario benchmark.

## Summary

- Scenarios evaluated: `20`
- Scenarios with useful memory signal: `0`

## Category Coverage

- `feedback-sensitive`: `0/3` scenarios show useful memory signal
- `frequent/protected preservation`: `0/2` scenarios show useful memory signal
- `routine low-need sleep`: `0/3` scenarios show useful memory signal
- `safety`: `0/4` scenarios show useful memory signal
- `temporal ambiguity`: `0/5` scenarios show useful memory signal
- `wake`: `0/3` scenarios show useful memory signal

## Scenario Notes

### Deep Work Cluster (`routine low-need sleep`)

- Useful memory signal: `false`
- Notes: misses 4 expected protected tabs; adds 1 extra sleep-leaning tabs
- Recommended sleep boost: `https://github.com/org/repo/pull/1`

### Heavy Productivity Cluster (`frequent/protected preservation`)

- Useful memory signal: `false`
- Notes: misses 4 expected protected tabs

### Research Sprawl (`routine low-need sleep`)

- Useful memory signal: `false`
- Notes: misses 2 expected protected tabs

### Media Audible Safety (`safety`)

- Useful memory signal: `false`
- Notes: misses 2 expected protected tabs

### Pinned Tab Safety (`safety`)

- Useful memory signal: `false`
- Notes: misses 2 expected protected tabs

### Recent Activity Safety (`safety`)

- Useful memory signal: `false`
- Notes: misses 2 expected protected tabs

### Frequent Tab Protection (`frequent/protected preservation`)

- Useful memory signal: `false`
- Notes: misses 2 expected protected tabs

### Explicit Protected Context (`safety`)

- Useful memory signal: `false`
- Notes: misses 2 expected protected tabs

### Regret History Tab (`feedback-sensitive`)

- Useful memory signal: `false`
- Notes: misses 2 expected protected tabs

### Context Wake Success (`wake`)

- Useful memory signal: `false`
- Notes: misses 1 expected protected tabs; adds 1 extra sleep-leaning tabs
- Recommended sleep boost: `https://github.com/org/repo`

### Context Wake No-op (`wake`)

- Useful memory signal: `false`
- Notes: misses 1 expected protected tabs

### Mixed Safe Sleep Batch (`routine low-need sleep`)

- Useful memory signal: `false`
- Notes: misses 1 expected protected tabs

### Assistant vs Rule vs Agent (`feedback-sensitive`)

- Useful memory signal: `false`
- Notes: misses 2 expected protected tabs

### Same Summary, Different Sequence A (`temporal ambiguity`)

- Useful memory signal: `false`
- Notes: misses 2 expected protected tabs

### Same Summary, Different Sequence B (`temporal ambiguity`)

- Useful memory signal: `false`
- Notes: misses 1 expected protected tabs

### Burst Then Return (`temporal ambiguity`)

- Useful memory signal: `false`
- Notes: misses 1 expected protected tabs

### Opened But Not Used (`temporal ambiguity`)

- Useful memory signal: `false`
- Notes: misses 1 expected protected tabs

### Repeated Open-Close Cycle (`temporal ambiguity`)

- Useful memory signal: `false`
- Notes: misses 1 expected protected tabs

### Feedback After Sleep Sequence (`feedback-sensitive`)

- Useful memory signal: `false`
- Notes: misses 2 expected protected tabs

### Context Switch With Sibling Wake (`wake`)

- Useful memory signal: `false`
- Notes: misses 1 expected protected tabs
