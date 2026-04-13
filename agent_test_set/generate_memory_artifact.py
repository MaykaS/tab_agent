import json
import sys
from collections import Counter, defaultdict
from pathlib import Path


NEGATIVE_FEEDBACK_TYPES = {"undo", "bad_feedback", "regret_reopen_within_5m", "regret_reopen_within_15m"}
POSITIVE_FEEDBACK_TYPES = {"good_feedback", "safe_after_15m"}


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


def init_signal_bucket():
    return {
        "negative_feedback": 0,
        "positive_feedback": 0,
        "protect": 0,
        "negative_training": 0,
        "positive_training": 0,
        "auto_wake": 0,
    }


def aggregate_signals(export_data):
    feedback_log = export_data.get("feedbackLog", [])
    training_examples = export_data.get("trainingExamples", [])
    action_log = export_data.get("actionLog", [])

    url_signals = defaultdict(init_signal_bucket)
    group_signals = defaultdict(init_signal_bucket)
    domain_signals = defaultdict(init_signal_bucket)
    feedback_counts = Counter()

    for entry in feedback_log:
        feedback_type = entry.get("type") or "unknown"
        feedback_counts[feedback_type] += 1

        url = entry.get("url")
        group = entry.get("groupName")
        domain = normalize_domain(url) if url else None

        if feedback_type in NEGATIVE_FEEDBACK_TYPES:
            if url:
                url_signals[url]["negative_feedback"] += 1
            if domain:
                domain_signals[domain]["negative_feedback"] += 1
            if group:
                group_signals[group]["negative_feedback"] += 1
        elif feedback_type in POSITIVE_FEEDBACK_TYPES:
            if url:
                url_signals[url]["positive_feedback"] += 1
            if domain:
                domain_signals[domain]["positive_feedback"] += 1
            if group:
                group_signals[group]["positive_feedback"] += 1
        elif feedback_type == "protect":
            if url:
                url_signals[url]["protect"] += 1
            if domain:
                domain_signals[domain]["protect"] += 1
            if group:
                group_signals[group]["protect"] += 1

    for example in training_examples:
        reward = example.get("reward", 0)
        target = example.get("target", {})
        url = target.get("url")
        group = target.get("groupName")
        domain = normalize_domain(url) if url else None

        if reward < 0:
            if url:
                url_signals[url]["negative_training"] += 1
            if domain:
                domain_signals[domain]["negative_training"] += 1
            if group:
                group_signals[group]["negative_training"] += 1
        elif reward > 0:
            if url:
                url_signals[url]["positive_training"] += 1
            if domain:
                domain_signals[domain]["positive_training"] += 1
            if group:
                group_signals[group]["positive_training"] += 1

    for action in action_log:
        if action.get("type") != "auto_wake":
            continue
        target = action.get("target", {})
        group = target.get("groupName")
        urls = target.get("urls", []) or []
        if group:
            group_signals[group]["auto_wake"] += 1
        for url in urls:
            if not url:
                continue
            url_signals[url]["auto_wake"] += 1
            domain_signals[normalize_domain(url)]["auto_wake"] += 1

    return feedback_counts, url_signals, group_signals, domain_signals


def compute_scores(signal_map):
    scored = []
    for key, signals in signal_map.items():
        negative = signals["negative_feedback"] * 2 + signals["negative_training"]
        positive = signals["positive_feedback"] * 2 + signals["positive_training"]
        protect = signals["protect"] * 2
        wake = signals["auto_wake"]
        evidence = negative + positive + protect + wake
        scored.append(
            {
                "key": key,
                "signals": signals,
                "negative_score": negative,
                "positive_score": positive,
                "protect_score": protect,
                "wake_score": wake,
                "risk_score": negative + protect - positive,
                "safe_score": positive - negative,
                "mixed_score": min(negative, positive),
                "evidence": evidence,
            }
        )
    return scored


def filter_ranked(items, score_key, min_evidence=2, min_score=1, limit=5):
    filtered = [
        item
        for item in items
        if item["evidence"] >= min_evidence and item[score_key] >= min_score
    ]
    filtered.sort(key=lambda item: (item[score_key], item["evidence"]), reverse=True)
    return filtered[:limit]


def filter_excluding_keys(items, excluded_keys):
    return [item for item in items if item["key"] not in excluded_keys]


def build_signal_suffix(item):
    signals = item["signals"]
    parts = []
    if signals["negative_feedback"]:
        parts.append(f"negative_feedback={signals['negative_feedback']}")
    if signals["negative_training"]:
        parts.append(f"negative_training={signals['negative_training']}")
    if signals["positive_feedback"]:
        parts.append(f"positive_feedback={signals['positive_feedback']}")
    if signals["positive_training"]:
        parts.append(f"positive_training={signals['positive_training']}")
    if signals["protect"]:
        parts.append(f"protect={signals['protect']}")
    if signals["auto_wake"]:
        parts.append(f"auto_wake={signals['auto_wake']}")
    return ", ".join(parts) if parts else "no strong signals"


def build_lines(export_data, source_name):
    action_log = export_data.get("actionLog", [])
    feedback_log = export_data.get("feedbackLog", [])
    training_examples = export_data.get("trainingExamples", [])

    feedback_counts, url_signals, group_signals, domain_signals = aggregate_signals(export_data)
    scored_urls = compute_scores(url_signals)
    scored_groups = compute_scores(group_signals)
    scored_domains = compute_scores(domain_signals)

    protected_urls = filter_ranked(scored_urls, "protect_score", min_evidence=2, min_score=2)
    protected_groups = filter_ranked(scored_groups, "protect_score", min_evidence=2, min_score=2)
    protected_domains = filter_ranked(scored_domains, "protect_score", min_evidence=2, min_score=2)

    protected_url_keys = {item["key"] for item in protected_urls}
    protected_group_keys = {item["key"] for item in protected_groups}
    protected_domain_keys = {item["key"] for item in protected_domains}

    high_regret_urls = filter_ranked(
        filter_excluding_keys(scored_urls, protected_url_keys),
        "risk_score",
        min_evidence=2,
        min_score=2,
    )
    high_regret_groups = filter_ranked(
        filter_excluding_keys(scored_groups, protected_group_keys),
        "risk_score",
        min_evidence=2,
        min_score=2,
    )
    high_regret_domains = filter_ranked(
        filter_excluding_keys(scored_domains, protected_domain_keys),
        "risk_score",
        min_evidence=2,
        min_score=2,
    )

    safe_urls = filter_ranked(
        filter_excluding_keys(scored_urls, protected_url_keys),
        "safe_score",
        min_evidence=2,
        min_score=2,
    )
    safe_groups = filter_ranked(
        filter_excluding_keys(scored_groups, protected_group_keys),
        "safe_score",
        min_evidence=2,
        min_score=2,
    )
    safe_domains = filter_ranked(
        filter_excluding_keys(scored_domains, protected_domain_keys),
        "safe_score",
        min_evidence=2,
        min_score=2,
    )

    wake_groups = filter_ranked(scored_groups, "wake_score", min_evidence=1, min_score=1)
    mixed_contexts = filter_ranked(
        filter_excluding_keys(scored_urls, protected_url_keys) + filter_excluding_keys(scored_groups, protected_group_keys),
        "mixed_score",
        min_evidence=3,
        min_score=1,
    )

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
    lines.append("- This memory summarizes repeated signals, not one-off events, and should remain advisory.")
    lines.append("")
    lines.append("## High-Regret Patterns")
    lines.append("")

    wrote_regret = False
    for item in high_regret_urls:
        lines.append(
            f"- URL `{item['key']}` trends risky (`risk_score={item['risk_score']}`; {build_signal_suffix(item)}); avoid sleeping it aggressively."
        )
        wrote_regret = True
    for item in high_regret_domains:
        lines.append(
            f"- Domain `{item['key']}` trends risky (`risk_score={item['risk_score']}`; {build_signal_suffix(item)}); similar tabs likely need a more conservative threshold."
        )
        wrote_regret = True
    for item in high_regret_groups:
        lines.append(
            f"- Group `{item['key']}` trends risky (`risk_score={item['risk_score']}`; {build_signal_suffix(item)}); treat this context cautiously."
        )
        wrote_regret = True
    if not wrote_regret:
        lines.append("- No repeated high-regret patterns were strong enough in the current export.")

    lines.append("")
    lines.append("## Safe-Sleep Patterns")
    lines.append("")

    wrote_safe = False
    for item in safe_urls:
        lines.append(
            f"- URL `{item['key']}` trends safe (`safe_score={item['safe_score']}`; {build_signal_suffix(item)}); it may tolerate sleep when stale."
        )
        wrote_safe = True
    for item in safe_domains:
        lines.append(
            f"- Domain `{item['key']}` trends safe (`safe_score={item['safe_score']}`; {build_signal_suffix(item)}); similar tabs often tolerate sleep well."
        )
        wrote_safe = True
    for item in safe_groups:
        lines.append(
            f"- Group `{item['key']}` trends safe (`safe_score={item['safe_score']}`; {build_signal_suffix(item)}); this context often tolerates sleep when inactive."
        )
        wrote_safe = True
    if feedback_counts.get("good_feedback", 0) > 0 or feedback_counts.get("safe_after_15m", 0) > 0:
        lines.append(
            f"- Positive signals observed overall: `good_feedback={feedback_counts.get('good_feedback', 0)}`, `safe_after_15m={feedback_counts.get('safe_after_15m', 0)}`."
        )
        wrote_safe = True
    if not wrote_safe:
        lines.append("- No repeated safe-sleep patterns were strong enough in the current export.")

    lines.append("")
    lines.append("## Protection Patterns")
    lines.append("")

    wrote_protection = False
    for item in protected_urls:
        lines.append(
            f"- URL `{item['key']}` has repeated protection signals (`protect_score={item['protect_score']}`; {build_signal_suffix(item)}); treat it as a strong guardrail candidate."
        )
        wrote_protection = True
    for item in protected_groups:
        lines.append(
            f"- Group `{item['key']}` has repeated protection signals (`protect_score={item['protect_score']}`; {build_signal_suffix(item)}); preserve similar contexts conservatively."
        )
        wrote_protection = True
    for item in protected_domains:
        lines.append(
            f"- Domain `{item['key']}` has repeated protection signals (`protect_score={item['protect_score']}`; {build_signal_suffix(item)}); similar resources should be treated as guardrail-first contexts."
        )
        wrote_protection = True
    if not wrote_protection:
        lines.append("- No repeated protection patterns were strong enough in the current export.")

    lines.append("")
    lines.append("## Wake Patterns")
    lines.append("")

    wrote_wake = False
    for item in wake_groups:
        lines.append(
            f"- Group `{item['key']}` repeatedly triggered useful wakes (`auto_wake={item['signals']['auto_wake']}`); re-entering this context often restores helpful sibling tabs."
        )
        wrote_wake = True
    if not wrote_wake:
        lines.append("- No repeated wake patterns were strong enough in the current export.")

    lines.append("")
    lines.append("## Mixed Or Unstable Contexts")
    lines.append("")

    wrote_mixed = False
    for item in mixed_contexts:
        label = "Group" if item["key"] in group_signals else "URL"
        lines.append(
            f"- {label} `{item['key']}` shows mixed evidence ({build_signal_suffix(item)}); avoid overfitting and keep decisions conservative until more data accumulates."
        )
        wrote_mixed = True
    if not wrote_mixed:
        lines.append("- No strongly mixed contexts were detected; most repeated signals currently lean clearly safe or risky.")

    lines.append("")
    lines.append("## Suggested Policy Notes")
    lines.append("")
    if feedback_counts.get("undo", 0) or feedback_counts.get("bad_feedback", 0):
        lines.append("- Recent undo and bad-feedback signals suggest the policy should stay conservative around repeated-risk tabs.")
    if feedback_counts.get("protect", 0):
        lines.append("- Repeated protect signals should take priority over generic risky/safe summaries for the affected contexts.")
    if feedback_counts.get("good_feedback", 0) or feedback_counts.get("safe_after_15m", 0):
        lines.append("- Repeated safe outcomes suggest some stale contexts may tolerate slightly more aggressive sleeping.")
    lines.append("- Mixed contexts should remain on conservative defaults until the signal becomes clearer.")
    lines.append("- Protected contexts should be handled as guardrails first, not as normal sleepability candidates.")
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
