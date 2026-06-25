# Validation Playbook

Use this playbook before tightening from `warn` to `block`.

## Hook Unit Tests

Run repository checks:

```bash
npm run check:native
npm run lint
npm run test:hooks
```

`npm run check:native` validates the PowerShell-friendly path. `npm run lint` validates Node syntax, Python compilation, Bash syntax, and required templates. `npm run test:hooks` runs smoke tests in `tests/smoke/hook-smoke.test.js`.

For a scaffolded target repo, run:

```bash
node bin/cts.js verify --target .
```

Use `node bin/cts.js verify --target . --no-write` when you need a dry diagnostic that does not create target repository artifacts.

Expected hook smoke behavior:

- `TOKEN_GUARD_MODE=warn` exits `0` for noisy commands.
- `TOKEN_GUARD_MODE=block` exits `2` for noisy commands.
- Test/build advisories exit `0` by default even when `TOKEN_GUARD_MODE=block`; they are prompts to summarize output, not default hard blocks.
- `CBM_GATE_MODE=warn` exits `0` for broad discovery.
- `CBM_GATE_MODE=block` exits `2` for broad `Grep` or `Glob` cases.
- `CBM_GATE_BLOCK_TOOLS` controls which of `Read`, `Grep`, and `Glob` can block. Keep the default `Grep,Glob` unless hook logs prove `Read` false positives are low.

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
node bin/cts.js validate-artifacts --target . --json --no-write
```

Optional real Claude Code benchmark:

```bash
node bin/cts.js benchmark baseline ai-enabled --target .
node bin/cts.js benchmark post ai-enabled --target .
node bin/cts.js collect-metrics .token-stack/reports
node bin/cts.js compare-metrics .token-stack/reports
node bin/cts.js validate-artifacts --target . --json --no-write
```

Keep real runs budgeted with `BENCHMARK_MAX_TURNS` and `BENCHMARK_MAX_BUDGET_USD`.

Custom task lists can be stored in `.token-stack/benchmark.config.json`; start from `docs/examples/benchmark.config.example.json`.

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
- `evidence_types`: metric record labels such as `synthetic`, `real`, or `mixed`.
- `promotion_evidence`: local verify report, hook log, and false-positive review artifact presence.
- `recommend_enter_block`: machine recommendation for moving to block.
- `recommendation_reason`: booleans explaining the recommendation.

`cts validate-artifacts --target . --json --no-write` validates the summary shape against `schemas/metrics-summary.schema.json` and then checks referenced case-study totals against baseline/post metric artifacts.

`recommend_enter_block` is true only when post tasks pass, raw large output events are not worse, cost is not worse, post data includes blocked command events, the evidence is representative, and promotion evidence is present. Missing `evidence_type`, synthetic-only mode, and `evidence_type: synthetic` keep `recommend_enter_block` false.

## Deciding Whether To Enter Block

Do not enter block mode from synthetic data alone. Use synthetic data for wiring confidence, then verify on real or representative tasks.

Minimum criteria:

- `npm test` passes in this repo.
- Target repo `verify` has no failures.
- Claude Code integration test produces warnings in warn mode.
- Hook logs show low false positives for normal workflows.
- `.token-stack/reports/false-positive-review.json` records the reviewed sample and false-positive count.
- `metrics-summary.json` has `"recommend_enter_block": true` for representative data.
- The team accepts the rollback path.

Use hook logs as the final promotion gate:

1. Collect warn-mode logs for representative coding, debugging, test, and review tasks.
2. Classify each `token-guard.log` and `cbm-gate.log` hit as true positive, acceptable advisory, false positive, or unclear.
3. Keep `Read` in warn unless source-read warnings have near-zero false positives and the team accepts the interruption cost.
4. Promote only deterministic high-noise Bash rules first. Test/build advisories should remain warn-only unless a project explicitly opts into stricter local rules.
5. Promote `Grep`/`Glob` blocking only when broad-search warnings are consistently true positives and narrowed retries are easy.
6. Record the reviewed log sample, false-positive count, rollback owner, and rollback command in `.token-stack/reports/false-positive-review.json`.

Recommended first block:

```bash
TOKEN_GUARD_MODE=block
CBM_GATE_MODE=warn
```

Move `CBM_GATE_MODE` to `block` later only if broad `Grep`/`Glob` warnings are consistently correct.

## Local MCP Smoke

Optional project-local MCP dependencies start from `.mcp.local.example.json`. Pin reviewed exact semver versions before use and do not auto-install remote tools during validation.

Capture this evidence before treating MCP governance as reliable:

- Active MCP list shows one code discovery server and no duplicate `codegraph` route.
- A bounded Codebase Memory request succeeds against the target repo, or the repo is explicitly recorded as not indexed.
- Repeating a bounded request shows cache reuse, warm-cache timing, or stable output when the MCP exposes cache evidence.
- Rate-limit or throttling status is clean for a small request.
- Read-only behavior is documented: mutation tools are absent, disabled, or out of scope.
- Three small bounded requests complete without reconnect failures.

## Context Pack Check

Use `docs/context-pack-template.md` for handoffs that would otherwise become broad scans or long reports. A context pack is acceptable only if it has a narrow topic, top-k evidence, bounded snippets, risks, and a verification checklist.

The native helper can generate a budgeted pack and manifest:

```bash
node bin/cts.js pack-context --target . --budget 60000
```
