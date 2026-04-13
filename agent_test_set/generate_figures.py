import csv
import json
from pathlib import Path
from statistics import mean


BASE_DIR = Path(__file__).resolve().parent
CSV_PATH = BASE_DIR / "benchmark_results_current.csv"
SCENARIOS_PATH = BASE_DIR / "scenarios.json"
FIGURES_DIR = BASE_DIR / "figures"

VARIANT_ORDER = ["recency_only", "summary_only", "raw_log_only", "hybrid"]
VARIANT_COLORS = {
    "recency_only": "#b7c6d9",
    "summary_only": "#2e75b6",
    "raw_log_only": "#d97a2b",
    "hybrid": "#2f8f6b",
}
CATEGORY_ORDER = [
    "safety",
    "routine low-need sleep",
    "frequent/protected preservation",
    "temporal ambiguity",
    "feedback-sensitive",
]


def read_rows():
    with CSV_PATH.open("r", encoding="utf-8", newline="") as handle:
        return list(csv.DictReader(handle))


def read_scenarios():
    with SCENARIOS_PATH.open("r", encoding="utf-8") as handle:
        payload = json.load(handle)
    return {scenario["id"]: scenario for scenario in payload["scenarios"]}


def exact_match_rate(rows):
    if not rows:
        return 0.0
    return sum(1 for row in rows if row["exact_match"] == "true") / len(rows)


def aggregate_by_variant(rows):
    result = {}
    for variant in VARIANT_ORDER:
        variant_rows = [row for row in rows if row["variant"] == variant]
        result[variant] = exact_match_rate(variant_rows)
    return result


def aggregate_by_category(rows):
    result = {}
    for category in CATEGORY_ORDER:
        result[category] = {}
        category_rows = [row for row in rows if row["research_category"] == category]
        for variant in VARIANT_ORDER:
            variant_rows = [row for row in category_rows if row["variant"] == variant]
            result[category][variant] = exact_match_rate(variant_rows)
    return result


def svg_header(width, height):
    return [
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}" fill="none">',
        '<rect width="100%" height="100%" fill="#f7fbff"/>',
        '<rect x="18" y="18" width="calc(100% - 36px)" height="calc(100% - 36px)" rx="18" fill="#ffffff" stroke="#d7e4ef"/>',
    ]


def svg_footer():
    return ["</svg>"]


def draw_text(x, y, text, size=14, weight=400, fill="#15324b", anchor="start"):
    return f'<text x="{x}" y="{y}" font-family="Segoe UI, Arial, sans-serif" font-size="{size}" font-weight="{weight}" fill="{fill}" text-anchor="{anchor}">{text}</text>'


def draw_rect(x, y, width, height, fill, rx=8, opacity=None):
    opacity_attr = f' opacity="{opacity}"' if opacity is not None else ""
    return f'<rect x="{x}" y="{y}" width="{width}" height="{height}" rx="{rx}" fill="{fill}"{opacity_attr}/>'


def generate_overall_chart(rows):
    width, height = 980, 620
    left, right, top, bottom = 120, 70, 120, 120
    chart_width = width - left - right
    chart_height = height - top - bottom
    baseline_y = top + chart_height

    data = aggregate_by_variant(rows)
    elements = svg_header(width, height)
    elements.append(draw_text(60, 70, "Overall Context Comparison", size=28, weight=700))
    elements.append(
        draw_text(
            60,
            100,
            "Exact-match rate across the current benchmark. Raw-log-aware variants currently lead.",
            size=15,
            fill="#4c667d",
        )
    )

    for i in range(6):
        value = i / 5
        y = baseline_y - value * chart_height
        elements.append(f'<line x1="{left}" y1="{y}" x2="{left + chart_width}" y2="{y}" stroke="#e6eef5" stroke-width="1"/>')
        elements.append(draw_text(left - 16, y + 5, f"{int(value * 100)}%", size=12, fill="#6c8296", anchor="end"))

    bar_width = 120
    gap = (chart_width - len(VARIANT_ORDER) * bar_width) / (len(VARIANT_ORDER) + 1)

    for index, variant in enumerate(VARIANT_ORDER):
        x = left + gap + index * (bar_width + gap)
        value = data[variant]
        bar_height = value * chart_height
        y = baseline_y - bar_height
        elements.append(draw_rect(x, y, bar_width, bar_height, VARIANT_COLORS[variant], rx=16))
        elements.append(draw_text(x + bar_width / 2, y - 12, f"{round(value * 100):.0f}%", size=18, weight=700, anchor="middle"))
        label = variant.replace("_", "\n")
        line_y = baseline_y + 28
        for line in label.split("\n"):
            elements.append(draw_text(x + bar_width / 2, line_y, line, size=13, fill="#36506a", anchor="middle"))
            line_y += 16

    legend_x = 700
    legend_y = 520
    for idx, variant in enumerate(VARIANT_ORDER):
        x = legend_x + (idx % 2) * 140
        y = legend_y + (idx // 2) * 26
        elements.append(draw_rect(x, y - 12, 18, 18, VARIANT_COLORS[variant], rx=4))
        elements.append(draw_text(x + 26, y + 2, variant, size=13, fill="#36506a"))

    elements.extend(svg_footer())
    (FIGURES_DIR / "overall_context_comparison.svg").write_text("\n".join(elements), encoding="utf-8")


def generate_category_chart(rows):
    width, height = 1240, 760
    left, right, top, bottom = 110, 70, 120, 150
    chart_width = width - left - right
    chart_height = height - top - bottom
    baseline_y = top + chart_height
    data = aggregate_by_category(rows)

    elements = svg_header(width, height)
    elements.append(draw_text(60, 70, "Category-Level Context Comparison", size=28, weight=700))
    elements.append(
        draw_text(
            60,
            100,
            "Exact-match rate by research category. Temporal ambiguity is where raw recent event logs help most.",
            size=15,
            fill="#4c667d",
        )
    )

    for i in range(6):
        value = i / 5
        y = baseline_y - value * chart_height
        elements.append(f'<line x1="{left}" y1="{y}" x2="{left + chart_width}" y2="{y}" stroke="#e6eef5" stroke-width="1"/>')
        elements.append(draw_text(left - 16, y + 5, f"{int(value * 100)}%", size=12, fill="#6c8296", anchor="end"))

    group_width = chart_width / len(CATEGORY_ORDER)
    bar_width = 36

    for cat_idx, category in enumerate(CATEGORY_ORDER):
        group_x = left + cat_idx * group_width + 16
        elements.append(draw_text(group_x + group_width / 2 - 16, baseline_y + 35, category, size=12, fill="#36506a", anchor="middle"))
        for var_idx, variant in enumerate(VARIANT_ORDER):
            value = data[category][variant]
            x = group_x + var_idx * (bar_width + 10)
            bar_height = value * chart_height
            y = baseline_y - bar_height
            elements.append(draw_rect(x, y, bar_width, bar_height, VARIANT_COLORS[variant], rx=8))
            elements.append(draw_text(x + bar_width / 2, y - 8, f"{round(value * 100):.0f}", size=11, fill="#36506a", anchor="middle"))

    legend_x = 120
    legend_y = 655
    for idx, variant in enumerate(VARIANT_ORDER):
        x = legend_x + idx * 230
        elements.append(draw_rect(x, legend_y - 12, 18, 18, VARIANT_COLORS[variant], rx=4))
        elements.append(draw_text(x + 28, legend_y + 2, variant, size=13, fill="#36506a"))

    elements.extend(svg_footer())
    (FIGURES_DIR / "category_context_comparison.svg").write_text("\n".join(elements), encoding="utf-8")


def generate_temporal_walkthrough(scenarios):
    scenario = scenarios["same_summary_different_sequence_a"]
    events = scenario["eventLog"]

    width, height = 1200, 560
    elements = svg_header(width, height)
    elements.append(draw_text(60, 70, "Temporal Ambiguity Walkthrough", size=28, weight=700))
    elements.append(
        draw_text(
            60,
            100,
            "same_summary_different_sequence_a: raw sequence preserves the fresh brief while summary-only sleeps too much.",
            size=15,
            fill="#4c667d",
        )
    )

    line_y = 250
    elements.append(f'<line x1="120" y1="{line_y}" x2="1080" y2="{line_y}" stroke="#cad9e6" stroke-width="3"/>')

    start_x = 150
    step = 190
    for idx, event in enumerate(events):
        x = start_x + idx * step
        elements.append(draw_rect(x - 18, line_y - 18, 36, 36, "#2e75b6", rx=18))
        elements.append(draw_text(x, line_y - 34, event["eventType"], size=12, weight=700, fill="#2e75b6", anchor="middle"))
        elements.append(draw_text(x, line_y + 62, event["title"], size=12, fill="#36506a", anchor="middle"))
        elements.append(draw_text(x, line_y + 80, event["groupName"], size=11, fill="#6c8296", anchor="middle"))
        elements.append(draw_text(x, line_y + 98, event["timestamp"][11:16], size=11, fill="#6c8296", anchor="middle"))

    elements.append(draw_rect(70, 360, 500, 120, "#eef5fb", rx=16))
    elements.append(draw_text(95, 395, "What the sequence shows", size=18, weight=700))
    elements.append(draw_text(95, 425, "- The old article belonged to an older reading context.", size=14, fill="#36506a"))
    elements.append(draw_text(95, 450, "- The fresh brief was opened near the return to the main doc.", size=14, fill="#36506a"))
    elements.append(draw_text(95, 475, "- Raw logs capture that burst; summary-only context misses it.", size=14, fill="#36506a"))

    elements.append(draw_rect(620, 360, 510, 120, "#fff3e8", rx=16))
    elements.append(draw_text(645, 395, "Benchmark outcome", size=18, weight=700))
    elements.append(draw_text(645, 425, "- recency_only: wrong", size=14, fill="#36506a"))
    elements.append(draw_text(645, 450, "- summary_only: wrong", size=14, fill="#36506a"))
    elements.append(draw_text(645, 475, "- raw_log_only + hybrid: exact match", size=14, fill="#36506a"))

    elements.extend(svg_footer())
    (FIGURES_DIR / "temporal_ambiguity_walkthrough.svg").write_text("\n".join(elements), encoding="utf-8")


def generate_feedback_walkthrough(scenarios):
    scenario = scenarios["feedback_after_sleep_sequence"]
    events = scenario["eventLog"]

    width, height = 1200, 560
    elements = svg_header(width, height)
    elements.append(draw_text(60, 70, "Feedback-Sensitive Walkthrough", size=28, weight=700))
    elements.append(
        draw_text(
            60,
            100,
            "feedback_after_sleep_sequence: recent undo and bad feedback should change future behavior.",
            size=15,
            fill="#4c667d",
        )
    )

    line_y = 250
    elements.append(f'<line x1="120" y1="{line_y}" x2="1080" y2="{line_y}" stroke="#cad9e6" stroke-width="3"/>')

    start_x = 145
    step = 185
    color_map = {
        "sleep": "#d97a2b",
        "undo": "#c84b4b",
        "bad_feedback": "#c84b4b",
        "good_feedback": "#2f8f6b",
        "activate": "#2e75b6",
    }

    for idx, event in enumerate(events):
        x = start_x + idx * step
        fill = color_map.get(event["eventType"], "#2e75b6")
        elements.append(draw_rect(x - 18, line_y - 18, 36, 36, fill, rx=18))
        elements.append(draw_text(x, line_y - 34, event["eventType"], size=12, weight=700, fill=fill, anchor="middle"))
        elements.append(draw_text(x, line_y + 62, event["title"], size=12, fill="#36506a", anchor="middle"))
        elements.append(draw_text(x, line_y + 80, event["groupName"], size=11, fill="#6c8296", anchor="middle"))
        elements.append(draw_text(x, line_y + 98, event["timestamp"][11:16], size=11, fill="#6c8296", anchor="middle"))

    elements.append(draw_rect(70, 360, 520, 120, "#eef5fb", rx=16))
    elements.append(draw_text(95, 395, "What the feedback means", size=18, weight=700))
    elements.append(draw_text(95, 425, "- The candidate profile was auto-slept, then undone, then marked bad.", size=14, fill="#36506a"))
    elements.append(draw_text(95, 450, "- The reference note later received positive feedback.", size=14, fill="#36506a"))
    elements.append(draw_text(95, 475, "- This is exactly the kind of pattern the memory layer should learn from.", size=14, fill="#36506a"))

    elements.append(draw_rect(620, 360, 510, 120, "#fff3e8", rx=16))
    elements.append(draw_text(645, 395, "Benchmark outcome", size=18, weight=700))
    elements.append(draw_text(645, 425, "- summary_only still sleeps too aggressively here", size=14, fill="#36506a"))
    elements.append(draw_text(645, 450, "- raw_log_only + hybrid protect the regret-heavy tab", size=14, fill="#36506a"))
    elements.append(draw_text(645, 475, "- This is the bridge to poor person's RL", size=14, fill="#36506a"))

    elements.extend(svg_footer())
    (FIGURES_DIR / "feedback_sensitive_walkthrough.svg").write_text("\n".join(elements), encoding="utf-8")


def main():
    FIGURES_DIR.mkdir(parents=True, exist_ok=True)
    rows = read_rows()
    scenarios = read_scenarios()

    generate_overall_chart(rows)
    generate_category_chart(rows)
    generate_temporal_walkthrough(scenarios)
    generate_feedback_walkthrough(scenarios)

    readme = """# Figures

Generated local visuals for the current benchmark.

Files:

- `overall_context_comparison.svg`
- `category_context_comparison.svg`
- `temporal_ambiguity_walkthrough.svg`
- `feedback_sensitive_walkthrough.svg`

Regenerate with:

```bash
python agent_test_set/generate_figures.py
```
"""
    (FIGURES_DIR / "README.md").write_text(readme, encoding="utf-8")
    print("Wrote benchmark SVG figures to agent_test_set/figures.")


if __name__ == "__main__":
    main()
