import csv
import json
import sys
from pathlib import Path

import generate_memory_artifact as memory


def load_json(path):
    return json.loads(Path(path).read_text(encoding="utf-8"))


def get_memory_sets(export_data):
    _, url_signals, group_signals, domain_signals = memory.aggregate_signals(export_data)
    scored_urls = memory.compute_scores(url_signals)
    scored_groups = memory.compute_scores(group_signals)
    scored_domains = memory.compute_scores(domain_signals)

    protected_urls = memory.filter_ranked(scored_urls, "protect_score", min_evidence=2, min_score=2)
    protected_groups = memory.filter_ranked(scored_groups, "protect_score", min_evidence=2, min_score=2)
    protected_domains = memory.filter_ranked(scored_domains, "protect_score", min_evidence=2, min_score=2)

    protected_url_keys = {item["key"] for item in protected_urls}
    protected_group_keys = {item["key"] for item in protected_groups}
    protected_domain_keys = {item["key"] for item in protected_domains}

    risky_urls = memory.filter_ranked(
        memory.filter_excluding_keys(scored_urls, protected_url_keys),
        "risk_score",
        min_evidence=2,
        min_score=2,
    )
    risky_groups = memory.filter_ranked(
        memory.filter_excluding_keys(scored_groups, protected_group_keys),
        "risk_score",
        min_evidence=2,
        min_score=2,
    )
    risky_domains = memory.filter_ranked(
        memory.filter_excluding_keys(scored_domains, protected_domain_keys),
        "risk_score",
        min_evidence=2,
        min_score=2,
    )

    safe_urls = memory.filter_ranked(
        memory.filter_excluding_keys(scored_urls, protected_url_keys),
        "safe_score",
        min_evidence=2,
        min_score=2,
    )
    safe_groups = memory.filter_ranked(
        memory.filter_excluding_keys(scored_groups, protected_group_keys),
        "safe_score",
        min_evidence=2,
        min_score=2,
    )
    safe_domains = memory.filter_ranked(
        memory.filter_excluding_keys(scored_domains, protected_domain_keys),
        "safe_score",
        min_evidence=2,
        min_score=2,
    )

    mixed_urls = memory.filter_ranked(
        memory.filter_excluding_keys(scored_urls, protected_url_keys),
        "mixed_score",
        min_evidence=3,
        min_score=1,
    )
    mixed_groups = memory.filter_ranked(
        memory.filter_excluding_keys(scored_groups, protected_group_keys),
        "mixed_score",
        min_evidence=3,
        min_score=1,
    )

    wake_groups = memory.filter_ranked(scored_groups, "wake_score", min_evidence=1, min_score=1)

    return {
        "protected_urls": {item["key"] for item in protected_urls},
        "protected_groups": {item["key"] for item in protected_groups},
        "protected_domains": {item["key"] for item in protected_domains},
        "risky_urls": {item["key"] for item in risky_urls},
        "risky_groups": {item["key"] for item in risky_groups},
        "risky_domains": {item["key"] for item in risky_domains},
        "safe_urls": {item["key"] for item in safe_urls},
        "safe_groups": {item["key"] for item in safe_groups},
        "safe_domains": {item["key"] for item in safe_domains},
        "mixed_urls": {item["key"] for item in mixed_urls},
        "mixed_groups": {item["key"] for item in mixed_groups},
        "wake_groups": {item["key"] for item in wake_groups},
    }


def active_tab_urls(open_tabs):
    return {tab["url"] for tab in open_tabs if tab.get("active")}


def tab_domain(url):
    return memory.normalize_domain(url)


def build_off_prediction(scenario):
    open_tabs = scenario.get("open_tabs", [])
    # Advisory baseline with no personalized memory:
    # only active tabs are treated as obviously preserve-worthy,
    # and there are no learned wake or safe-sleep boosts.
    return {
        "protected_tabs": sorted(active_tab_urls(open_tabs)),
        "sleep_candidates": [],
        "wake_groups": [],
    }


def build_on_prediction(scenario, memory_sets):
    open_tabs = scenario.get("open_tabs", [])
    protected = set(active_tab_urls(open_tabs))
    sleep = set()
    wake = set()

    for tab in open_tabs:
        url = tab["url"]
        group = tab.get("group")
        domain = tab_domain(url)
        asleep = bool(tab.get("asleep"))

        if (
            url in memory_sets["protected_urls"]
            or group in memory_sets["protected_groups"]
            or domain in memory_sets["protected_domains"]
            or url in memory_sets["risky_urls"]
            or group in memory_sets["risky_groups"]
            or domain in memory_sets["risky_domains"]
            or url in memory_sets["mixed_urls"]
            or group in memory_sets["mixed_groups"]
        ):
            protected.add(url)
            continue

        if (
            not asleep
            and url in memory_sets["safe_urls"]
            or group in memory_sets["safe_groups"]
            or domain in memory_sets["safe_domains"]
        ):
            sleep.add(url)

        if group in memory_sets["wake_groups"]:
            wake.add(group)

    return {
        "protected_tabs": sorted(protected),
        "sleep_candidates": sorted(sleep),
        "wake_groups": sorted(wake),
    }


def score_prediction(prediction, expected):
    expected_protected = set(expected.get("protected_tabs", []))
    expected_sleep = set(expected.get("sleep_candidates", []))
    expected_wake = set(expected.get("wake_groups", []))

    predicted_protected = set(prediction["protected_tabs"])
    predicted_sleep = set(prediction["sleep_candidates"])
    predicted_wake = set(prediction["wake_groups"])

    protected_hits = len(predicted_protected & expected_protected)
    protected_fp = len(predicted_protected - expected_protected)
    protected_misses = len(expected_protected - predicted_protected)

    sleep_hits = len(predicted_sleep & expected_sleep)
    sleep_fp = len(predicted_sleep - expected_sleep)
    sleep_misses = len(expected_sleep - predicted_sleep)

    wake_hits = len(predicted_wake & expected_wake)
    wake_fp = len(predicted_wake - expected_wake)
    wake_misses = len(expected_wake - predicted_wake)

    exact = (
        predicted_protected == expected_protected
        and predicted_sleep == expected_sleep
        and predicted_wake == expected_wake
    )

    score = protected_hits + sleep_hits + wake_hits
    penalty = protected_fp + protected_misses + sleep_fp + sleep_misses + wake_fp + wake_misses

    return {
        "exact_match": exact,
        "score": score,
        "penalty": penalty,
        "protected_hits": protected_hits,
        "protected_fp": protected_fp,
        "protected_misses": protected_misses,
        "sleep_hits": sleep_hits,
        "sleep_fp": sleep_fp,
        "sleep_misses": sleep_misses,
        "wake_hits": wake_hits,
        "wake_fp": wake_fp,
        "wake_misses": wake_misses,
    }


def evaluate_scenario(scenario, memory_sets):
    expected = scenario.get("expected", {})
    off_prediction = build_off_prediction(scenario)
    on_prediction = build_on_prediction(scenario, memory_sets)

    off_score = score_prediction(off_prediction, expected)
    on_score = score_prediction(on_prediction, expected)

    improved = (on_score["score"] - on_score["penalty"]) > (off_score["score"] - off_score["penalty"])

    return {
        "scenario_id": scenario["id"],
        "scenario_name": scenario["name"],
        "research_category": scenario["research_category"],
        "memory_off_exact": off_score["exact_match"],
        "memory_on_exact": on_score["exact_match"],
        "memory_off_net": off_score["score"] - off_score["penalty"],
        "memory_on_net": on_score["score"] - on_score["penalty"],
        "improved_with_memory": improved,
        "memory_off_prediction": off_prediction,
        "memory_on_prediction": on_prediction,
        "expected": expected,
        "memory_off_risk": expected.get("memory_off_risk", ""),
        "memory_on_behavior": expected.get("memory_on_behavior", ""),
    }


def build_markdown(results):
    improved = sum(1 for row in results if row["improved_with_memory"])
    off_exact = sum(1 for row in results if row["memory_off_exact"])
    on_exact = sum(1 for row in results if row["memory_on_exact"])

    by_category = {}
    for row in results:
        category = row["research_category"]
        by_category.setdefault(category, {"count": 0, "improved": 0})
        by_category[category]["count"] += 1
        by_category[category]["improved"] += int(row["improved_with_memory"])

    lines = [
        "# Personalized Memory Evaluation",
        "",
        "This report compares a no-memory advisory baseline against memory-informed advisory behavior on the personalized benchmark.",
        "",
        "## Summary",
        "",
        f"- Scenarios evaluated: `{len(results)}`",
        f"- Exact matches with `memory_off`: `{off_exact}`",
        f"- Exact matches with `memory_on`: `{on_exact}`",
        f"- Scenarios improved by memory: `{improved}`",
        "",
        "## Category Breakdown",
        "",
    ]

    for category, stats in sorted(by_category.items()):
        lines.append(f"- `{category}`: `{stats['improved']}/{stats['count']}` scenarios improved with memory")

    lines.extend([
        "",
        "## Scenario Comparison",
        "",
    ])

    for row in results:
        lines.append(f"### {row['scenario_name']} (`{row['research_category']}`)")
        lines.append("")
        lines.append(f"- Improved with memory: `{str(row['improved_with_memory']).lower()}`")
        lines.append(f"- `memory_off` net score: `{row['memory_off_net']}`")
        lines.append(f"- `memory_on` net score: `{row['memory_on_net']}`")
        lines.append(f"- `memory_off` risk: {row['memory_off_risk']}")
        lines.append(f"- `memory_on` intended behavior: {row['memory_on_behavior']}")
        lines.append(f"- Expected protected: `{', '.join(row['expected'].get('protected_tabs', [])) or 'none'}`")
        lines.append(f"- Expected sleep: `{', '.join(row['expected'].get('sleep_candidates', [])) or 'none'}`")
        lines.append(f"- Expected wake groups: `{', '.join(row['expected'].get('wake_groups', [])) or 'none'}`")
        lines.append(f"- `memory_off` prediction: `{json.dumps(row['memory_off_prediction'])}`")
        lines.append(f"- `memory_on` prediction: `{json.dumps(row['memory_on_prediction'])}`")
        lines.append("")

    return "\n".join(lines)


def main():
    export_path = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("agent_test_set/real_export.json")
    benchmark_path = Path(sys.argv[2]) if len(sys.argv) > 2 else Path("agent_test_set/personalized_memory_benchmark.json")

    export_data = load_json(export_path)
    benchmark_data = load_json(benchmark_path)
    memory_sets = get_memory_sets(export_data)

    results = [evaluate_scenario(scenario, memory_sets) for scenario in benchmark_data["scenarios"]]

    csv_path = export_path.with_name("personalized_memory_eval.csv")
    md_path = export_path.with_name("personalized_memory_eval.md")

    with csv_path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=[
                "scenario_id",
                "scenario_name",
                "research_category",
                "memory_off_exact",
                "memory_on_exact",
                "memory_off_net",
                "memory_on_net",
                "improved_with_memory",
                "memory_off_prediction",
                "memory_on_prediction",
                "expected",
                "memory_off_risk",
                "memory_on_behavior",
            ],
        )
        writer.writeheader()
        for row in results:
            serializable = row.copy()
            for key in ("memory_off_prediction", "memory_on_prediction", "expected"):
                serializable[key] = json.dumps(serializable[key])
            writer.writerow(serializable)

    md_path.write_text(build_markdown(results), encoding="utf-8")
    print(f"Wrote personalized memory evaluation to {csv_path} and {md_path}")


if __name__ == "__main__":
    main()
