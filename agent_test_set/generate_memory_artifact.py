import json
import sys
from collections import Counter, defaultdict
from pathlib import Path


def normalize_domain(url):
    if not url or "://" not in url:
        return url or ""
    try:
        return url.split("://", 1)[1].split("/", 1)[0]
    except Exception:
        return url


def load_export(path):
    with Path(path).open("r", encoding="utf-8") as handle:
        return json.load(handle)


def count_feedback(feedback_log):
    counts = Counter()
    by_url = defaultdict(Counter)
    by_group = defaultdict(Counter)

    for entry in feedback_log or []:
        feedback_type = entry.get("type") or "unknown"
        counts[feedback_type] += 1

        url = entry.get("url")
        group = entry.get("groupName")
        if url:
            by_url[url][feedback_type] += 1
        if group:
            by_group[group][feedback_type] += 1

    return counts, by_url, by_group


def collect_training_patterns(training_examples):
    regret_urls = Counter()
    safe_urls = Counter()
    regret_groups = Counter()
    safe_groups = Counter()

    for example in training_examples or []:
        reward = example.get("reward", 0)
        target = example.get("target", {})
        url = target.get("url")
        group = target.get("groupName")
        if reward < 0:
            if url:
                regret_urls[url] += 1
            if group:
                regret_groups[group] += 1
        elif reward > 0:
            if url:
                safe_urls[url] += 1
            if group:
                safe_groups[group] += 1

    return regret_urls, safe_urls, regret_groups, safe_groups


def summarize_protected_contexts(protected_contexts):
    urls = protected_contexts.get("urls", {}) if isinstance(protected_contexts, dict) else {}
    groups = protected_contexts.get("groups", {}) if isinstance(protected_contexts, dict) else {}

    top_urls = sorted(urls.items(), key=lambda item: item[1].get("count", 0), reverse=True)[:5]
    top_groups = sorted(groups.items(), key=lambda item: item[1].get("count", 0), reverse=True)[:5]
    return top_urls, top_groups


def build_lines(export_data, source_name):
    feedback_log = export_data.get("feedbackLog", [])
    training_examples = export_data.get("trainingExamples", [])
    action_log = export_data.get("actionLog", [])
    protected_contexts = export_data.get("protectedContexts", {})

    feedback_counts, feedback_by_url, feedback_by_group = count_feedback(feedback_log)
    regret_urls, safe_urls, regret_groups, safe_groups = collect_training_patterns(training_examples)
    protected_urls, protected_groups = summarize_protected_contexts(protected_contexts)

    lines = []
    lines.append("# Agent Memory")
    lines.append("")
    lines.append(f"Generated from export: `{source_name}`")
    lines.append("")
    lines.append("## Overview")
    lines.append("")
    lines.append(f"- Export timestamp: `{export_data.get('exportedAt', 'unknown')}`")
    lines.append(f"- Agent actions: `{len(action_log)}`")
    lines.append(f"- Feedback entries: `{len(feedback_log)}`")
    lines.append(f"- Training examples: `{len(training_examples)}`")
    lines.append("")
    lines.append("## High-Regret Patterns")
    lines.append("")

    wrote_regret = False
    for url, count in regret_urls.most_common(5):
        domain = normalize_domain(url)
        lines.append(f"- `{domain}` / `{url}` showed `{count}` regret-linked training examples; be more conservative before sleeping similar tabs.")
        wrote_regret = True
    for group, count in regret_groups.most_common(5):
        lines.append(f"- Group `{group}` showed `{count}` regret-linked training examples; treat the context more cautiously.")
        wrote_regret = True
    for url, counts in sorted(feedback_by_url.items(), key=lambda item: item[1].get("bad_feedback", 0) + item[1].get("undo", 0), reverse=True)[:5]:
        negative = counts.get("bad_feedback", 0) + counts.get("undo", 0)
        if negative > 0:
            lines.append(f"- `{url}` received `{negative}` direct negative signals (`undo`/`bad_feedback`); sleeping it soon again is likely risky.")
            wrote_regret = True
    if not wrote_regret:
        lines.append("- No repeated high-regret patterns were strong enough in the current export.")

    lines.append("")
    lines.append("## Safe-Sleep Patterns")
    lines.append("")
    wrote_safe = False
    for url, count in safe_urls.most_common(5):
        domain = normalize_domain(url)
        lines.append(f"- `{domain}` / `{url}` showed `{count}` positive training examples; similar tabs may be safe to sleep when inactive.")
        wrote_safe = True
    for group, count in safe_groups.most_common(5):
        lines.append(f"- Group `{group}` showed `{count}` positive training examples; this context often tolerates sleep well when stale.")
        wrote_safe = True
    if feedback_counts.get("good_feedback", 0) > 0 or feedback_counts.get("safe_after_15m", 0) > 0:
        lines.append(
            f"- Positive signals observed: `good_feedback={feedback_counts.get('good_feedback', 0)}`, `safe_after_15m={feedback_counts.get('safe_after_15m', 0)}`."
        )
        wrote_safe = True
    if not wrote_safe:
        lines.append("- No repeated safe-sleep patterns were strong enough in the current export.")

    lines.append("")
    lines.append("## Protection Patterns")
    lines.append("")
    wrote_protection = False
    for group, details in protected_groups:
        lines.append(f"- Protected group `{group}` was reinforced `{details.get('count', 0)}` times; preserve similar contexts conservatively.")
        wrote_protection = True
    for url, details in protected_urls:
        lines.append(f"- Protected URL `{url}` was reinforced `{details.get('count', 0)}` times; treat it as a strong guardrail candidate.")
        wrote_protection = True
    for group, counts in sorted(feedback_by_group.items(), key=lambda item: item[1].get("protect", 0), reverse=True)[:5]:
        if counts.get("protect", 0) > 0:
            lines.append(f"- Group `{group}` received `{counts.get('protect', 0)}` protect signals; similar contexts likely deserve a protection boost.")
            wrote_protection = True
    if not wrote_protection:
        lines.append("- No repeated protection patterns were strong enough in the current export.")

    lines.append("")
    lines.append("## Wake Patterns")
    lines.append("")
    auto_wake_count = sum(1 for action in action_log if action.get("type") == "auto_wake")
    wake_groups = Counter(
        action.get("target", {}).get("groupName")
        for action in action_log
        if action.get("type") == "auto_wake" and action.get("target", {}).get("groupName")
    )
    if auto_wake_count:
        lines.append(f"- Auto-wake actions observed: `{auto_wake_count}`.")
        for group, count in wake_groups.most_common(5):
            lines.append(f"- Group `{group}` triggered `{count}` auto-wake actions; re-entering this context often restores useful sibling tabs.")
    else:
        lines.append("- No repeated wake patterns were strong enough in the current export.")

    lines.append("")
    lines.append("## Suggested Policy Notes")
    lines.append("")
    if feedback_counts.get("undo", 0) or feedback_counts.get("bad_feedback", 0):
        lines.append("- Recent undo and bad-feedback signals suggest the policy should stay conservative around repeated-risk tabs.")
    if feedback_counts.get("protect", 0):
        lines.append("- Repeated protect signals suggest extending context-level protection for affected groups or resources.")
    if feedback_counts.get("good_feedback", 0) or feedback_counts.get("safe_after_15m", 0):
        lines.append("- Repeated safe outcomes suggest some stale contexts may tolerate slightly more aggressive sleeping.")
    lines.append("- This memory remains advisory and should not override hard guardrails.")

    return "\n".join(lines) + "\n"


def main():
    if len(sys.argv) < 2:
        print("Usage: python agent_test_set/generate_memory_artifact.py <export.json> [output.md]")
        sys.exit(1)

    export_path = Path(sys.argv[1])
    output_path = Path(sys.argv[2]) if len(sys.argv) > 2 else export_path.with_suffix(".memory.md")

    export_data = load_export(export_path)
    output = build_lines(export_data, export_path.name)
    output_path.write_text(output, encoding="utf-8")
    print(f"Wrote memory artifact to {output_path}")


if __name__ == "__main__":
    main()
