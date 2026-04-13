# Memory Artifact Spec

This file defines the first implementation shape for Tab Agent's "poor person's RL" memory artifact.

The goal is to stay aligned with the professor's suggestion:

- summarize repeated logs and feedback into memory
- store that memory in a human-readable Markdown file
- let the agent read that memory before future suggestions or decisions

## What This Is

The memory artifact is an interpretable Markdown summary of recurring behavioral patterns derived from:

- `feedbackLog`
- `actionLog`
- `trainingExamples`
- `tabEventLog`
- `urlModel`
- `groupModel`
- `protectedContexts`

It is **not** full RL.

It is a lightweight memory layer that can later be used for:

- policy guidance
- explanation support
- protected-context suggestions
- memory-enabled benchmarking

## Source Data

The intended input shape already exists in the extension export pipeline through `getAllDataForExport()` in [storage.js](/C:/Users/mayas/OneDrive/Desktop/Projects/tab%20agent/storage.js:1095).

Relevant fields include:

- `feedbackLog`
- `actionLog`
- `trainingExamples`
- `tabEventLog`
- `urlModel`
- `groupModel`
- `protectedContexts`
- `adaptivePolicySummary`

## Memory Sections

The Markdown memory file should include these sections:

### 1. Overview

Short summary of:

- export timestamp
- action count
- feedback count
- main observed themes

### 2. High-Regret Patterns

Patterns that should make the agent more conservative.

Signals:

- repeated `undo`
- repeated `bad_feedback`
- repeated regret outcomes
- repeated quick reopen after sleep

### 3. Safe-Sleep Patterns

Patterns that suggest low interruption risk.

Signals:

- repeated `safe_after_15m`
- repeated `good_feedback`
- repeated low-reward reopen activity after sleep does not appear

### 4. Protection Patterns

Patterns indicating contexts or resources that should be treated carefully.

Signals:

- repeated `protect`
- high `protectionCount`
- strong group-level protection history

### 5. Wake Patterns

Patterns where returning to a context makes sibling wake useful.

Signals:

- repeated `auto_wake`
- repeated related group returns
- positive outcomes around context restoration

### 6. Suggested Policy Notes

Short guidance statements the future memory-aware policy could use, such as:

- "Be more conservative with design tabs during active work sessions."
- "Reference tabs in burst workflows are often safe to sleep after context returns."

## Pattern Granularity

Memory entries can refer to:

- specific URLs when behavior is highly repeated
- domains when patterns generalize well
- group names or contexts when behavior is cluster-based

Preferred order:

1. group/context
2. domain
3. URL

This keeps memory from becoming too brittle or too noisy.

## Entry Style

Each memory item should be short, evidence-based, and reusable.

Good examples:

- "Hiring candidate-profile tabs triggered repeated undo and bad-feedback signals; treat them conservatively after recent review activity."
- "Reference burst tabs often become sleep-safe after the user returns to the main writing doc."

Avoid:

- vague summaries with no behavioral implication
- one-off events presented as stable patterns
- entries that duplicate raw logs instead of summarizing them

## Use Rules

The memory artifact is intended to be advisory.

It should:

- bias policy scores conservatively
- support explanation text
- inform memory-enabled benchmark variants

It should not:

- override hard guardrails
- replace the local policy entirely
- invent patterns without repeated evidence

## Current Status

This spec supports two immediate outputs:

1. a prototype memory file derived from current benchmark evidence
2. a generator that can later convert real exported session JSON into a Markdown memory artifact
