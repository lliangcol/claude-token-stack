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
```

## Benchmark Config

The benchmark runner reads `.token-stack/benchmark.config.json` or `BENCHMARK_CONFIG=/path/to/config.json`. If the file is missing, the built-in `code-discovery`, `test-failure`, and `long-log` tasks are used.

Use [benchmark.config.example.json](examples/benchmark.config.example.json) and validate the shape against `schemas/benchmark.config.schema.json`.

## Evidence Types

- `synthetic`: deterministic fixtures or generated examples. Useful for smoke tests, not enough to recommend block mode.
- `real`: actual project logs, agent output, or validation traces.
- `mixed`: real project evidence plus synthetic fixtures.

`compare-metrics` only recommends block mode when evidence is representative and post-task success, cost, large-output, and blocked-command checks all pass.

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

These commands provide a local event and usage surface inspired by session/event based tools without requiring a remote dashboard.

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
