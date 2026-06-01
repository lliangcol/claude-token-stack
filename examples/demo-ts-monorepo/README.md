# demo-ts-monorepo

Minimal TypeScript monorepo-shaped demo for showing repo-level Claude Code token governance. It is not a full buildable app; it exists to exercise scaffold, verify, benchmark, and rollback wiring.

## What this demo shows

- Project policy and hooks installed into a monorepo-style tree.
- Warn-first handling for noisy commands such as `tree`, `ls -R`, and broad `grep`.
- Synthetic baseline/post report generation.
- Clear shell boundary between PowerShell scaffold and Bash-backed verify/benchmark.

Synthetic/demo evidence here is wiring proof only. It is not real savings proof for TypeScript monorepos.

## Scaffold

Run from this directory in PowerShell:

```powershell
$env:CTS_ROOT = "C:\path\to\claude-token-stack"
node "$env:CTS_ROOT\bin\cts.js" scaffold --target .
```

Expected output: `.claude/` and `.token-stack/` paths are created or merged. Existing files are backed up with `.bak.<timestamp>` before overwrite.

## Verify

Run from Git Bash or WSL2 because `verify` invokes Bash scripts:

```bash
CTS_ROOT="/c/path/to/claude-token-stack"
node "$CTS_ROOT/bin/cts.js" verify --target .
```

Expected reports:

- `.token-stack/reports/verify-report.md`
- `.token-stack/reports/verify-report.json`

If Bash is missing from native PowerShell, use Git Bash or WSL2 instead of changing the demo.

## Benchmark

Run synthetic baseline/post wiring from Git Bash or WSL2:

```bash
CTS_ROOT="/c/path/to/claude-token-stack"
node "$CTS_ROOT/bin/cts.js" benchmark synthetic-only --target .
node "$CTS_ROOT/bin/cts.js" collect-metrics --target .
node "$CTS_ROOT/bin/cts.js" compare-metrics --target .
```

Expected reports:

- `.token-stack/reports/baseline/code-discovery.json`
- `.token-stack/reports/post/code-discovery.json`
- `.token-stack/reports/metrics-collected.json`
- `.token-stack/reports/metrics-summary.json`

## Rollback

Fast disable in PowerShell:

```powershell
$env:TOKEN_GUARD_MODE = "off"
$env:CBM_GATE_MODE = "off"
```

Fast disable in Git Bash or WSL2:

```bash
export TOKEN_GUARD_MODE=off
export CBM_GATE_MODE=off
```

For full removal, follow the generated rollback doc under `docs/claude-token-stack-rollback.md`.

## Shell boundary

- PowerShell: use it for `scaffold`, direct hook smoke tests, `collect-metrics`, and `compare-metrics`.
- Git Bash/WSL2: use it for `verify` and `benchmark`.
- Paths with spaces must be quoted in every shell.
