const fs = require("fs");
const path = require("path");

const BASE_DIR = __dirname;
const SCENARIOS_PATH = path.join(BASE_DIR, "scenarios.json");
const TAXONOMY_PATH = path.join(BASE_DIR, "scenario_taxonomy.md");
const REPORT_PATH = path.join(BASE_DIR, "context_benchmark_report.md");
const CSV_PATH = path.join(BASE_DIR, "benchmark_results_current.csv");
const SUMMARY_PATH = path.join(BASE_DIR, "benchmark_summary_current.md");

const VARIANT_ORDER = ["recency_only", "summary_only", "raw_log_only", "hybrid"];
const CATEGORY_ORDER = [
  "safety",
  "routine low-need sleep",
  "frequent/protected preservation",
  "temporal ambiguity",
  "feedback-sensitive",
  "context wake",
];

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function readText(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function parseTaxonomy(markdown) {
  const mapping = new Map();
  const rowPattern = /^\| `([^`]+)` \| `([^`]+)` \| `([^`]+)` \|/gm;
  let match;

  while ((match = rowPattern.exec(markdown)) !== null) {
    mapping.set(match[1], {
      fixtureCategory: match[2],
      researchCategory: match[3],
    });
  }

  return mapping;
}

function parseReport(reportText) {
  const rows = [];
  const lines = reportText.split(/\r?\n/);
  let currentScenarioId = null;

  for (const line of lines) {
    const scenarioMatch = line.match(/^### ([a-z0-9_]+)$/);
    if (scenarioMatch) {
      currentScenarioId = scenarioMatch[1];
      continue;
    }

    const variantMatch = line.match(
      /^- `([^`]+)`: predicted (.+) \| exact=(true|false) \| precision=([0-9.]+) \| recall=([0-9.]+) \| rubric=([^|]+) \| (.+)$/
    );

    if (!variantMatch || !currentScenarioId) continue;

    const [, variant, predictedSleepSet, exactMatch, precision, recall, rubric, notes] = variantMatch;
    const precisionValue = Number.parseFloat(precision);
    const recallValue = Number.parseFloat(recall);
    const f1Value =
      precisionValue === 0 && recallValue === 0
        ? 0
        : (2 * precisionValue * recallValue) / (precisionValue + recallValue);

    rows.push({
      scenarioId: currentScenarioId,
      variant,
      predictedSleepSet,
      exactMatch: exactMatch === "true",
      precision: precisionValue,
      recall: recallValue,
      f1: Number(f1Value.toFixed(2)),
      notes: `Imported from current report; rubric=${rubric.trim()}; ${notes.trim()}`,
    });
  }

  return rows;
}

function serializeJsonArray(value) {
  return JSON.stringify(Array.isArray(value) ? value : value ? [value] : []);
}

function csvEscape(value) {
  const stringValue = value === null || value === undefined ? "" : String(value);
  if (/[",\n]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}

function buildResultRows({ scenarios, taxonomy, reportRows }) {
  const scenarioMap = new Map(scenarios.map((scenario) => [scenario.id, scenario]));

  return reportRows.map((row) => {
    const scenario = scenarioMap.get(row.scenarioId);
    const taxonomyEntry = taxonomy.get(row.scenarioId);

    if (!scenario || !taxonomyEntry) {
      throw new Error(`Missing scenario or taxonomy mapping for ${row.scenarioId}`);
    }

    return {
      scenario_id: row.scenarioId,
      scenario_name: scenario.name,
      fixture_category: taxonomyEntry.fixtureCategory,
      research_category: taxonomyEntry.researchCategory,
      variant: row.variant,
      memory_condition: "memory_off",
      expected_sleep_set: serializeJsonArray(scenario.expected?.sleepCandidates),
      predicted_sleep_set: row.predictedSleepSet,
      exact_match: row.exactMatch ? "true" : "false",
      precision: row.precision.toFixed(2),
      recall: row.recall.toFixed(2),
      f1: row.f1.toFixed(2),
      protected_violations: "",
      regret_sensitive_errors: "",
      undo_sensitive_errors: "",
      wake_success: "",
      notes: row.notes,
    };
  });
}

function toCsv(rows) {
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(",")];

  for (const row of rows) {
    lines.push(headers.map((header) => csvEscape(row[header])).join(","));
  }

  return `${lines.join("\n")}\n`;
}

function groupBy(items, keyFn) {
  const groups = new Map();
  for (const item of items) {
    const key = keyFn(item);
    const bucket = groups.get(key) || [];
    bucket.push(item);
    groups.set(key, bucket);
  }
  return groups;
}

function average(rows, field) {
  if (rows.length === 0) return 0;
  return rows.reduce((sum, row) => sum + Number.parseFloat(row[field]), 0) / rows.length;
}

function exactMatchCount(rows) {
  return rows.filter((row) => row.exact_match === "true").length;
}

function summarizeVariant(rows) {
  return {
    exactMatchCount: exactMatchCount(rows),
    total: rows.length,
    avgPrecision: average(rows, "precision"),
    avgRecall: average(rows, "recall"),
    avgF1: average(rows, "f1"),
  };
}

function formatMetric(value) {
  return value.toFixed(2);
}

function buildInterpretation(category) {
  const interpretations = {
    safety: [
      "- The current scenario set shows all variants respecting the simple safety cases at the row level.",
      "- This is reassuring for product framing, but it does not replace richer per-row guardrail exports later.",
    ],
    "routine low-need sleep": [
      "- This is the clearest sign that thin recency-only context leaves value on the table.",
      "- Structured summary context already closes that gap strongly.",
    ],
    "frequent/protected preservation": [
      "- The imported benchmark suggests all variants handle these preservation scenarios correctly.",
      "- This category will become more informative once richer per-row protection and regret signals are exported.",
    ],
    "temporal ambiguity": [
      "- This is the strongest professor-aligned finding in the current evidence.",
      "- Raw recent event sequence clearly matters on temporally ambiguous scenarios.",
      "- Summary-only improves over recency-only but does not fully resolve sequence-driven cases.",
    ],
    "feedback-sensitive": [
      "- Feedback-aware and sequence-aware context appears especially valuable here.",
      "- This category is the natural bridge to the later poor person's RL comparison.",
    ],
  };

  return interpretations[category] || ["- This category is not yet summarized in the current imported benchmark."];
}

function buildSummaryMarkdown(rows) {
  const byVariant = groupBy(rows, (row) => row.variant);
  const byCategory = groupBy(rows, (row) => row.research_category);

  const lines = [];
  lines.push("# Current Benchmark Summary", "");
  lines.push(
    "This summary is derived from [benchmark_results_current.csv](/C:/Users/mayas/OneDrive/Desktop/Projects/tab%20agent/agent_test_set/benchmark_results_current.csv) and is the first research-facing aggregate view of the current benchmark.",
    ""
  );
  lines.push("It is intentionally limited to the row-level fields available in the imported table:", "");
  lines.push("- exact match");
  lines.push("- precision");
  lines.push("- recall");
  lines.push("- F1");
  lines.push("- research category");
  lines.push("- context variant", "");
  lines.push(
    "Per-row safety, wake, and feedback-specific counts remain blank in the imported table and should be captured directly in a future richer export.",
    ""
  );

  lines.push("## Overall By Variant", "");
  lines.push("| Variant | Exact-match | Avg precision | Avg recall | Avg F1 | Notes |");
  lines.push("| --- | --- | --- | --- | --- | --- |");

  const overallNotes = {
    recency_only: "Useful thin baseline, but clearly weaker on richer behavior and sequence-sensitive cases.",
    summary_only: "Strong compact abstraction baseline.",
    raw_log_only: "Best current row-level benchmark performer, especially on sequence-sensitive cases.",
    hybrid: "Matches raw-log performance in the current imported benchmark.",
  };

  for (const variant of VARIANT_ORDER) {
    const summary = summarizeVariant(byVariant.get(variant) || []);
    lines.push(
      `| \`${variant}\` | ${summary.exactMatchCount}/${summary.total} | ${formatMetric(summary.avgPrecision)} | ${formatMetric(summary.avgRecall)} | ${formatMetric(summary.avgF1)} | ${overallNotes[variant]} |`
    );
  }

  lines.push("", "## By Research Category", "");

  for (const category of CATEGORY_ORDER) {
    const categoryRows = byCategory.get(category) || [];
    if (categoryRows.length === 0) continue;

    lines.push(`### \`${category}\``, "");
    lines.push("| Variant | Exact-match | Avg precision | Avg recall | Avg F1 |");
    lines.push("| --- | --- | --- | --- | --- |");

    for (const variant of VARIANT_ORDER) {
      const filtered = categoryRows.filter((row) => row.variant === variant);
      const summary = summarizeVariant(filtered);
      lines.push(
        `| \`${variant}\` | ${summary.exactMatchCount}/${summary.total} | ${formatMetric(summary.avgPrecision)} | ${formatMetric(summary.avgRecall)} | ${formatMetric(summary.avgF1)} |`
      );
    }

    lines.push("", "Interpretation:");
    for (const bullet of buildInterpretation(category)) {
      lines.push(bullet);
    }
    lines.push("");
  }

  lines.push("## Current Takeaways", "");
  lines.push("- `recency_only` works as a thin benchmark baseline, but it is clearly weaker on routine low-need sleep and temporal ambiguity.");
  lines.push("- `summary_only` is already strong and compact, which supports the value of structured behavioral abstraction.");
  lines.push("- `raw_log_only` and `hybrid` perform best in the current imported benchmark, with the biggest visible advantage on temporal ambiguity and feedback-sensitive cases.");
  lines.push(
    "- The current imported table is strong enough to support early narrative claims about context quality, but not yet strong enough to support the full safety- and memory-specific story your professor pointed toward.",
    ""
  );
  lines.push("## What This Enables Next", "");
  lines.push("- an early evidence-backed discussion of context quality");
  lines.push("- the first simple variant-by-category plot plan");
  lines.push("- selection of case studies for temporal ambiguity and feedback-sensitive scenarios", "");
  lines.push("The next evidence gap is richer row-level export for:", "");
  lines.push("- protected violations");
  lines.push("- wake success");
  lines.push("- feedback-specific error counts");
  lines.push("- later `memory_on` comparison");

  return `${lines.join("\n")}\n`;
}

function main() {
  const scenarios = readJson(SCENARIOS_PATH).scenarios;
  const taxonomy = parseTaxonomy(readText(TAXONOMY_PATH));
  const reportRows = parseReport(readText(REPORT_PATH));
  const resultRows = buildResultRows({ scenarios, taxonomy, reportRows });

  fs.writeFileSync(CSV_PATH, toCsv(resultRows), "utf8");
  fs.writeFileSync(SUMMARY_PATH, buildSummaryMarkdown(resultRows), "utf8");

  console.log(`Wrote ${path.basename(CSV_PATH)} and ${path.basename(SUMMARY_PATH)} from current benchmark sources.`);
}

main();
