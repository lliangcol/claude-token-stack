# Validation Playbook

Use this playbook before tightening from `warn` to `block`.

## Hook Unit Tests

Run repository checks:

```bash
npm run lint
npm run test:hooks
```

`npm run lint` validates Node syntax, Python compilation, Bash syntax, and required templates. `npm run test:hooks` runs smoke tests in `tests/smoke/hook-smoke.test.js`.

For a scaffolded target repo, run:

```bash
node bin/cts.js verify --target .
```

Expected hook smoke behavior:

- `TOKEN_GUARD_MODE=warn` exits `0` for noisy commands.
- `TOKEN_GUARD_MODE=block` exits `2` for noisy commands.
- `CBM_GATE_MODE=warn` exits `0` for broad discovery.
- `CBM_GATE_MODE=block` exits `2` for broad `Grep` or `Glob` cases.

## Claude Code Integration Test

After scaffold:

1. Confirm `.claude/settings.json` contains `PreToolUse` hooks for `Bash`, `Read`, `Grep`, and `Glob`.
2. Start Claude Code in the target repo.
3. Ask for a harmless broad command, for example a raw tree or broad grep, and confirm a warning appears in warn mode.
4. Check logs:

```bash
ls .claude/logs
cat .claude/logs/token-guard.log
cat .claude/logs/cbm-gate.log
```

On Windows PowerShell, use:

```powershell
Get-ChildItem .claude\logs
Get-Content .claude\logs\token-guard.log
Get-Content .claude\logs\cbm-gate.log
```

## Benchmark Baseline/Post

Synthetic benchmark:

```bash
node bin/cts.js benchmark baseline synthetic-only --target .
node bin/cts.js benchmark post synthetic-only --target .
node bin/cts.js collect-metrics .token-stack/reports
node bin/cts.js compare-metrics .token-stack/reports
```

Optional real Claude Code benchmark:

```bash
node bin/cts.js benchmark baseline ai-enabled --target .
node bin/cts.js benchmark post ai-enabled --target .
node bin/cts.js collect-metrics .token-stack/reports
node bin/cts.js compare-metrics .token-stack/reports
```

Keep real runs budgeted with `BENCHMARK_MAX_TURNS` and `BENCHMARK_MAX_BUDGET_USD`.

## Reading metrics-summary.json

Open `.token-stack/reports/metrics-summary.json`.

Key fields:

- `tasks`: per-task baseline/post metrics and deltas.
- `totals.baseline`: aggregate baseline metrics.
- `totals.post`: aggregate post metrics.
- `totals.delta`: post minus baseline.
- `cache_hit_rate`: cache read ratio for baseline and post.
- `cost_change_usd`: post cost minus baseline cost.
- `cost_change_pct`: relative cost change.
- `recommend_enter_block`: machine recommendation for moving to block.
- `recommendation_reason`: booleans explaining the recommendation.

`recommend_enter_block` is true only when post tasks pass, raw large output events are not worse, cost is not worse, and post data includes blocked command events.

## Deciding Whether To Enter Block

Do not enter block mode from synthetic data alone. Use synthetic data for wiring confidence, then verify on real or representative tasks.

Minimum criteria:

- `npm test` passes in this repo.
- Target repo `verify` has no failures.
- Claude Code integration test produces warnings in warn mode.
- Hook logs show low false positives for normal workflows.
- `metrics-summary.json` has `"recommend_enter_block": true` for representative data.
- The team accepts the rollback path.

Recommended first block:

```bash
TOKEN_GUARD_MODE=block
CBM_GATE_MODE=warn
```

Move `CBM_GATE_MODE` to `block` later only if broad `Grep`/`Glob` warnings are consistently correct.
