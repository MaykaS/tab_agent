import csv
import json
import sys
from pathlib import Path

import generate_memory_artifact as memory


def load_json(path):
    return json.loads(Path(path).read_text(encoding="utf-8"))


def load_research_categories(path):
    rows = list(csv.DictReader(Path(path).open(encoding="utf-8")))
    mapping = {}
    for row in rows:
      mapping.setdefault(row["scenario_id"], row["research_category"])
    return mapping


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

    wake_groups = memory.filter_ranked(scored_groups, "wake_score", min_evidence=1, min_score=1)

    return {
        "protected_urls": protected_url_keys,
        "protected_groups": protected_group_keys,
        "protected_domains": protected_domain_keys,
        "risky_urls": {item["key"] for item in risky_urls},
        "risky_groups": {item["key"] for item in risky_groups},
        "risky_domains": {item["key"] for item in risky_domains},
        "safe_urls": {item["key"] for item in safe_urls},
        "safe_groups": {item["key"] for item in safe_groups},
        "safe_domains": {item["key"] for item in safe_domains},
        "wake_groups": {item["key"] for item in wake_groups},
    }


def scenario_tab_domains(open_tabs):
    return {tab["url"]: memory.normalize_domain(tab.get("url")) for tab in open_tabs}


def evaluate_scenario(scenario, research_category, memory_sets):
    open_tabs = scenario.get("openTabs", [])
    expected = scenario.get("expected", {})
    domains = scenario_tab_domains(open_tabs)
    expected_sleep = set(expected.get("sleepCandidates", []))
    expected_protected = set(expected.get("protectedTabs", []))
    wake_groups = set(expected.get("contextWake", {}).get("shouldWakeGroups", []))

    recommended_protected = set()
    recommended_sleep_boost = set()
    recommended_wake = set()

    for tab in open_tabs:
        url = tab.get("url")
        group = tab.get("group")
        domain = domains.get(url)

        if (
            url in memory_sets["protected_urls"]
            or group in memory_sets["protected_groups"]
            or domain in memory_sets["protected_domains"]
            or url in memory_sets["risky_urls"]
            or group in memory_sets["risky_groups"]
            or domain in memory_sets["risky_domains"]
        ):
            recommended_protected.add(url)

        if (
            url in memory_sets["safe_urls"]
            or group in memory_sets["safe_groups"]
            or domain in memory_sets["safe_domains"]
        ) and url not in recommended_protected:
            recommended_sleep_boost.add(url)

        if group in memory_sets["wake_groups"]:
            recommended_wake.add(group)

    protected_hits = len(recommended_protected & expected_protected)
    protected_misses = len(expected_protected - recommended_protected)
    sleep_hits = len(recommended_sleep_boost & expected_sleep)
    sleep_false_positives = len(recommended_sleep_boost - expected_sleep)
    wake_hits = len(recommended_wake & wake_groups)

    useful = (
        protected_hits > 0
        or sleep_hits > 0
        or wake_hits > 0
    )

    notes = []
    if protected_hits:
        notes.append(f"memory reinforces {protected_hits} expected protected tabs")
    if sleep_hits:
        notes.append(f"memory boosts {sleep_hits} expected sleep candidates")
    if wake_hits:
        notes.append(f"memory supports {wake_hits} expected wake groups")
    if protected_misses:
        notes.append(f"misses {protected_misses} expected protected tabs")
    if sleep_false_positives:
        notes.append(f"adds {sleep_false_positives} extra sleep-leaning tabs")
    if not notes:
        notes.append("memory has no strong effect on this scenario")

    return {
        "scenario_id": scenario["id"],
        "scenario_name": scenario["name"],
        "research_category": research_category,
        "memory_useful": useful,
        "protected_hits": protected_hits,
        "protected_misses": protected_misses,
        "sleep_hits": sleep_hits,
        "sleep_false_positives": sleep_false_positives,
        "wake_hits": wake_hits,
        "recommended_protected": sorted(recommended_protected),
        "recommended_sleep_boost": sorted(recommended_sleep_boost),
        "recommended_wake_groups": sorted(recommended_wake),
        "notes": "; ".join(notes),
    }


def build_markdown(results):
    total = len(results)
    useful = sum(1 for row in results if row["memory_useful"])
    by_category = {}
    for row in results:
        category = row["research_category"]
        by_category.setdefault(category, {"count": 0, "useful": 0})
        by_category[category]["count"] += 1
        by_category[category]["useful"] += int(row["memory_useful"])

    lines = [
        "# Memory Advisory Evaluation",
        "",
        "This report estimates where the synthesized memory artifact would provide useful advisory signals on the fixed scenario benchmark.",
        "",
        "## Summary",
        "",
        f"- Scenarios evaluated: `{total}`",
        f"- Scenarios with useful memory signal: `{useful}`",
        "",
        "## Category Coverage",
        "",
    ]

    for category, stats in sorted(by_category.items()):
        lines.append(f"- `{category}`: `{stats['useful']}/{stats['count']}` scenarios show useful memory signal")

    lines.extend([
        "",
        "## Scenario Notes",
        "",
    ])

    for row in results:
        lines.append(f"### {row['scenario_name']} (`{row['research_category']}`)")
        lines.append("")
        lines.append(f"- Useful memory signal: `{str(row['memory_useful']).lower()}`")
        lines.append(f"- Notes: {row['notes']}")
        if row["recommended_protected"]:
            lines.append(f"- Recommended protected: `{', '.join(row['recommended_protected'])}`")
        if row["recommended_sleep_boost"]:
            lines.append(f"- Recommended sleep boost: `{', '.join(row['recommended_sleep_boost'])}`")
        if row["recommended_wake_groups"]:
            lines.append(f"- Recommended wake groups: `{', '.join(row['recommended_wake_groups'])}`")
        lines.append("")

    return "\n".join(lines)


def main():
    export_path = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("agent_test_set/real_export.json")
    scenarios_path = Path(sys.argv[2]) if len(sys.argv) > 2 else Path("agent_test_set/scenarios.json")
    benchmark_csv = Path(sys.argv[3]) if len(sys.argv) > 3 else Path("agent_test_set/benchmark_results_current.csv")

    export_data = load_json(export_path)
    scenarios_data = load_json(scenarios_path)
    research_categories = load_research_categories(benchmark_csv)
    memory_sets = get_memory_sets(export_data)

    results = []
    for scenario in scenarios_data["scenarios"]:
        research_category = research_categories.get(scenario["id"], scenario.get("category", "unknown"))
        results.append(evaluate_scenario(scenario, research_category, memory_sets))

    csv_path = export_path.with_name("memory_advisory_eval.csv")
    md_path = export_path.with_name("memory_advisory_eval.md")

    with csv_path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=[
                "scenario_id",
                "scenario_name",
                "research_category",
                "memory_useful",
                "protected_hits",
                "protected_misses",
                "sleep_hits",
                "sleep_false_positives",
                "wake_hits",
                "recommended_protected",
                "recommended_sleep_boost",
                "recommended_wake_groups",
                "notes",
            ],
        )
        writer.writeheader()
        for row in results:
            serializable = row.copy()
            for key in ("recommended_protected", "recommended_sleep_boost", "recommended_wake_groups"):
                serializable[key] = json.dumps(serializable[key])
            writer.writerow(serializable)

    md_path.write_text(build_markdown(results), encoding="utf-8")
    print(f"Wrote advisory evaluation to {csv_path} and {md_path}")


if __name__ == "__main__":
    main()
