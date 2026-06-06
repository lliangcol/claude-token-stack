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
    ".token-stack/reports/metrics-summary.json"
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
5. Link only artifacts that can be regenerated locally.
