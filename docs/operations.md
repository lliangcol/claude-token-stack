# Operations Playbook

This playbook turns the research plan into repeatable commands. All commands are local-first. Remote installs remain opt-in through `TOKEN_STACK_ALLOW_REMOTE_INSTALL=1`, and npm/npx specs must use exact semver pins such as `package@1.2.3` unless `TOKEN_STACK_ALLOW_UNPINNED_REMOTE_INSTALL=1` is set.

## Native Diagnostics

Use native diagnostics before asking users to install Bash:

```bash
cts doctor --target . --json --no-write
cts audit-hooks --target . --json --no-write
```

`doctor` treats missing Bash and missing Claude CLI as warnings, because scaffold, audit, metrics, log analysis, context packs, and hook smoke tests can still run natively through Node and Python.

## No-Write Mode

Commands that support `--no-write` must not create or modify files in the target repository. `--dry-run` implies `--no-write` for verification and benchmark commands.

```bash
cts verify --target . --no-write
cts benchmark --target . post --no-write
cts pack-context --target . --budget 40000 --json --no-write
cts validate-artifacts --target . --json --no-write
```

Full stdout JSON/no-write behavior is supported by the local Node/Python
commands: `doctor`, `audit-hooks`, `pack-context`, `analyze-logs`,
`ingest-usage`, `events`, `preset`, `collect-metrics`, `compare-metrics`, and
`validate-artifacts`. `scaffold --dry-run --json` emits a local plan and skips
writes. For Bash-backed commands such as `verify`, `benchmark`, `tools`, `all`,
and `advanced-unattended`, `--json` is reserved for CLI preflight failures; the
script output remains human-readable.

CLI preflight failures in JSON mode keep stderr empty. Missing or non-directory
targets exit `2` with `error.code: target_missing` or `target_not_directory`.
Missing runtime dependencies exit `2` with `error.code: python_missing` for
Python-backed commands or `bash_missing` for Bash-backed commands. Non-JSON
invocations keep the concise human-readable error on stderr. Target validation
runs before runtime dependency checks, so a missing target reports
`target_missing` even when Bash or Python is unavailable.

## Benchmark Config

The benchmark runner reads `.token-stack/benchmark.config.json` or `BENCHMARK_CONFIG=/path/to/config.json`. If the file is missing, the built-in `code-discovery`, `test-failure`, and `long-log` tasks are used.

Use [benchmark.config.example.json](examples/benchmark.config.example.json) and validate the shape against `schemas/benchmark.config.schema.json`.

## Evidence Types

- `synthetic`: deterministic fixtures or generated examples. Useful for smoke tests, not enough to recommend block mode.
- `real`: actual project logs, agent output, or validation traces.
- `mixed`: real project evidence plus synthetic fixtures.

`compare-metrics` only recommends block mode when evidence is representative and post-task success, cost, large-output, and blocked-command checks all pass. Missing `evidence_type`, synthetic-only mode, or `evidence_type: synthetic` is wiring evidence only and keeps the recommendation false. A block recommendation also requires local promotion evidence: `.token-stack/reports/verify-report.json`, at least one hook log under `.claude/logs/`, and valid `.token-stack/reports/false-positive-review.json` following `schemas/false-positive-review.schema.json`.

## Artifact Validation

`cts validate-artifacts` validates local `.token-stack` and case-study JSON artifacts against the shipped schemas without reading secrets or uploading data:

```bash
cts validate-artifacts --target . --json --no-write
```

Without `--no-write`, it writes `.token-stack/reports/artifact-validation.json`, `.md`, and `.html`. The HTML file is a static local report generated from the same validation payload, with local navigation for summary, groups, and findings. Missing optional artifact groups are reported as warnings; invalid JSON, schema mismatches, missing case-study `artifacts` references, or references that escape the target directory are failures. JSON mode writes the report to stdout and keeps diagnostics inside the JSON payload. Reports keep the complete JSON `findings` list in collection order and add `groups` totals for quick triage across benchmark config, metric records, case studies, metrics summary, references, and promotion artifacts. Markdown, HTML, and plain-text output display FAIL, then WARN, then PASS findings for review readability. `metrics-summary.json` is checked against `schemas/metrics-summary.schema.json` before case-study metric consistency checks run.

Case-study JSON is discovered from `.token-stack/reports/case-study.json`, `.token-stack/reports/case-studies/**/*.json`, `.token-stack/case-studies/**/*.json`, and `docs/case-studies/**/*.json`. Discovery stays inside these local artifact folders; it does not scan arbitrary project paths or upload data. Case-study `artifacts` entries must be relative paths under the target repository; validation checks that the referenced files exist without uploading their contents. Forward slashes are recommended for portable JSON, and Windows-style relative backslashes are normalized. Absolute paths, UNC paths, drive-relative paths such as `C:logs\file.json`, and `..` escapes are rejected as unsafe. For `real` or `mixed` case studies, `artifacts` must include at least one baseline metric JSON, one post metric JSON, and `.token-stack/reports/metrics-summary.json`. The case-study `metrics.baseline_input_tokens`, `metrics.post_input_tokens`, `metrics.baseline_cost_usd`, `metrics.post_cost_usd`, `metrics.raw_large_output_events_before`, and `metrics.raw_large_output_events_after` fields must match the sums from the referenced baseline/post metric JSON files. The referenced `metrics-summary.json` `evidence_types` must include the case-study `evidence_type`, and its `totals.baseline` and `totals.post` values for core metrics must match the same metric JSON files.

## Context Pack

`cts pack-context` produces a budgeted, redacted Markdown pack and a manifest:

```bash
cts pack-context --target . --budget 60000
```

The pack skips common build/runtime folders, applies basic secret-like redaction, and records selected file paths and character counts in the manifest.

## Usage And Logs

```bash
cts analyze-logs --target .
cts ingest-usage --target .
cts events record --target . --type rollout --message "enabled warn mode for team smoke"
cts events --target . --json
```

These commands provide a local event and usage surface inspired by session/event based tools without requiring a remote dashboard. `cts analyze-logs --json --no-write` and `cts ingest-usage --json --no-write` return local summaries with `outputs.json` and `outputs.markdown` paths but do not create `log-analysis.*` or `usage-summary.*` files. `cts events record --json --no-write` returns a machine-readable payload with `command`, `action`, `target`, `store`, `dry_run`, and `event`, and does not create `.token-stack/events/events.jsonl`. Missing `--message` returns JSON `error.code: message_missing` when `--json` is set.

## Presets

Presets only update `.claude/settings.json` environment defaults:

```bash
cts preset --target . --name soft --json --no-write
cts preset --target . --name balanced
cts preset --target . --name strict --json --no-write
```

- `soft`: `TOKEN_GUARD_MODE=warn`, `CBM_GATE_MODE=warn`.
- `balanced`: shell guard blocks high-noise commands, Codebase Memory gate stays warn.
- `strict`: shell guard and Codebase Memory gate block, including `Read`. Review hook logs before applying this as a team default.

`cts preset --json --no-write` reports the planned environment changes without modifying `.claude/settings.json` or creating a backup. Missing settings return JSON `error.code: settings_missing`; unknown preset names return `error.code: unknown_preset`.
