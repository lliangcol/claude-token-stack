# demo-python-service

Minimal Python service-shaped demo for showing warn-first context governance and local evidence collection. It avoids virtual environments, dependency installs, and lockfiles so the demo stays static and copyable.

Synthetic/demo evidence here is wiring proof only. It is not real savings proof for Python services.

## Scaffold

Run from this directory in PowerShell:

```powershell
$env:CTS_ROOT = "C:\path\to\claude-token-stack"
node "$env:CTS_ROOT\bin\cts.js" scaffold --target .
```

Expected output: `.claude/` policy, hooks, rollback docs, and `.token-stack/` report paths are created or merged.

## Verify

Run from Git Bash or WSL2 because `verify` invokes Bash scripts:

```bash
CTS_ROOT="/c/path/to/claude-token-stack"
node "$CTS_ROOT/bin/cts.js" verify --target .
```

Expected reports:

- `.token-stack/reports/verify-report.md`
- `.token-stack/reports/verify-report.json`

## Benchmark

Run synthetic baseline/post wiring from Git Bash or WSL2:

```bash
CTS_ROOT="/c/path/to/claude-token-stack"
node "$CTS_ROOT/bin/cts.js" benchmark synthetic-only --target .
node "$CTS_ROOT/bin/cts.js" collect-metrics --target .
node "$CTS_ROOT/bin/cts.js" compare-metrics --target .
```

Expected reports:

- `.token-stack/reports/baseline/test-failure.json`
- `.token-stack/reports/post/test-failure.json`
- `.token-stack/reports/metrics-collected.json`
- `.token-stack/reports/metrics-summary.json`

## Optional local source check

This check uses only Python stdlib:

```powershell
python -m py_compile .\src\order_service\app.py
```

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

- PowerShell: use it for scaffold and direct source checks.
- Git Bash/WSL2: use it for Bash-backed verify and benchmark commands.
- Do not create `.venv/` or install test dependencies for this static demo unless you keep those outputs uncommitted.
