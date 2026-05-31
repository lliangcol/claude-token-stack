# Claude Token Stack Final Report Example

This is an example final report shape for a v0.1.0 adoption or release-candidate review. It is not a certification for every downstream repository; replace the target, dates, optional-tool status, and benchmark numbers with live evidence from the target repo.

## Summary

- Date: 2026-05-31T00:00:00Z
- Target: `example-repo`
- Mode: release-candidate verification
- Result: PASS with optional-tool warnings
- Recommendation: keep warn mode first; do not enter block mode from synthetic data alone

## Verification Commands

```bash
npm test
npm run lint
npm run verify
bash -lc 'bash -n bin/*.sh'
python -m py_compile templates/.claude/hooks/bash-token-guard.py templates/.claude/hooks/cbm-gate.py bin/collect-metrics.py bin/compare-metrics.py
node --check bin/cts.js
node --check templates/.claude/hooks/run-python-hook.js
node bin/cts.js scaffold --target .tmp/scaffold-dry-run dry-run
npm run test:hooks
```

## Verification Result

| Gate | Result | Notes |
|---|---|---|
| `npm test` | PASS | Includes lint, hook smoke, helper smoke, scaffold, and verify |
| `npm run lint` | PASS | Node, Python, Bash, and template checks |
| `npm run verify` | PASS | Optional tools may be WARN in offline or minimal environments |
| `bash -n bin/*.sh` | PASS | All shipped shell scripts parse |
| `python -m py_compile` | PASS | Python hooks and metric helpers compile |
| `node --check` | PASS | CLI and hook runner parse |
| scaffold dry-run | PASS | Reports intended copies and merges without writing target files |
| hook smoke tests | PASS | Warn exits 0, block exits 2 for configured cases |

## Optional Tools

| Tool | Expected v0.1.0 Behavior | Example Status |
|---|---|---|
| `context-mode` MCP | Optional; report WARN if unavailable | WARN |
| `codebase-memory-mcp` | Preferred code discovery route when available | WARN |
| `codegraph` | Optional duplicate; remove if it conflicts with codebase-memory-mcp | WARN if duplicate or unknown |
| `rtk` | Optional; Windows/MINGW64 auto-install is skipped | WARN or SKIP |
| `Caveman` | Optional concise-output fallback | WARN or SKIP |
| `Headroom` | Disabled unless `ENABLE_HEADROOM=1` | PASS when disabled |

## Benchmark Evidence

Use synthetic benchmark results only for wiring confidence. Use representative baseline/post runs before recommending block mode.

```bash
node bin/cts.js benchmark baseline synthetic-only --target .
node bin/cts.js benchmark post synthetic-only --target .
node bin/cts.js collect-metrics .token-stack/reports
node bin/cts.js compare-metrics .token-stack/reports
```

Expected evidence files:

- `.token-stack/reports/verify-report.md`
- `.token-stack/reports/verify-report.json`
- `.token-stack/reports/baseline/*.json`
- `.token-stack/reports/post/*.json`
- `.token-stack/reports/metrics-summary.json`
- `.token-stack/reports/metrics-summary.md`

## Rollout Decision

Keep the default template values for first adoption:

```json
{
  "TOKEN_GUARD_MODE": "warn",
  "CBM_GATE_MODE": "warn",
  "ENABLE_HEADROOM": "0"
}
```

Consider `TOKEN_GUARD_MODE=block` only after representative post-adoption tasks pass, false positives are low, and `metrics-summary.json` recommends entering block mode. Keep `CBM_GATE_MODE=warn` longer unless broad `Grep` and `Glob` warnings are consistently correct.

## Rollback

Fast disable:

```bash
export TOKEN_GUARD_MODE=off
export CBM_GATE_MODE=off
```

PowerShell equivalent:

```powershell
$env:TOKEN_GUARD_MODE = "off"
$env:CBM_GATE_MODE = "off"
```

For file removal and MCP cleanup, follow `docs/rollback.md`.
