# Case Study Template

Use this template for real or mixed evidence. Synthetic-only reports must stay labeled as synthetic and must not justify block-mode rollout by themselves.

```json
{
  "schema_version": 1,
  "project": "example-service",
  "evidence_type": "real",
  "summary": "One paragraph describing the workflow and what changed.",
  "metrics": {
    "baseline_input_tokens": 0,
    "post_input_tokens": 0,
    "baseline_cost_usd": 0,
    "post_cost_usd": 0,
    "raw_large_output_events_before": 0,
    "raw_large_output_events_after": 0
  },
  "artifacts": [
    ".token-stack/reports/verify-report.json",
    ".token-stack/reports/baseline/example-task.json",
    ".token-stack/reports/post/example-task.json",
    ".token-stack/reports/metrics-summary.json",
    ".token-stack/reports/false-positive-review.json",
    ".claude/logs/token-guard.log",
    ".claude/logs/cbm-gate.log"
  ],
  "limitations": [
    "Describe missing logs, model differences, or unverified environments."
  ]
}
```

Recommended flow:

1. Run `cts doctor --target . --json --no-write`.
2. Run baseline and post benchmark tasks with `.token-stack/benchmark.config.json`.
3. Run `cts compare-metrics --target .`.
4. Run `cts analyze-logs --target .` and `cts ingest-usage --target .`.
5. Link only artifacts that can be regenerated locally. `artifacts` entries must be relative paths under the target repository, and `cts validate-artifacts` fails if a listed file is missing or escapes the target directory. Prefer forward slashes in JSON; Windows-style relative backslashes are normalized, but absolute paths, UNC paths, drive-relative paths such as `C:logs\file.json`, and `..` escapes are unsafe. For real or mixed evidence, include at least one baseline metric JSON, one post metric JSON, and `.token-stack/reports/metrics-summary.json`. Keep the six template `metrics` totals and the referenced `metrics-summary.json` `evidence_types` and totals aligned with the referenced baseline/post metric JSON files.

Minimal `false-positive-review.json` shape:

```json
{
  "schema_version": 1,
  "reviewed_at": "2026-05-31T00:00:00Z",
  "reviewed_log_paths": [".claude/logs/token-guard.log"],
  "reviewed_entries": 1,
  "true_positive_count": 1,
  "false_positive_count": 0,
  "unclear_count": 0,
  "reviewer": "local reviewer",
  "notes": "No false positives in this reviewed sample."
}
```
