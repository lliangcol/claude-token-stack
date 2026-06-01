# demo-windows-path-space

Minimal Windows path demo for validating quoted paths across PowerShell, Git Bash, and WSL2. The recommended test location intentionally contains spaces.

Synthetic/demo evidence here is wiring proof only. It is not real savings proof for Windows repositories.

## Prepare a path with spaces

PowerShell:

```powershell
New-Item -ItemType Directory -Force "D:\Demo Repos\windows token stack" | Out-Null
Copy-Item -Recurse -Force ".\*" "D:\Demo Repos\windows token stack"
Set-Location "D:\Demo Repos\windows token stack"
```

If you are already in a copied demo directory with spaces in the path, skip the copy step.

## Scaffold

Run from this directory in PowerShell:

```powershell
$env:CTS_ROOT = "C:\path\to\claude-token-stack"
node "$env:CTS_ROOT\bin\cts.js" scaffold --target .
```

Expected output: `.claude/` and `.token-stack/` paths are created or merged without breaking paths that contain spaces.

## Verify

Run from Git Bash or WSL2 and quote paths:

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

- `.token-stack/reports/baseline/long-log.json`
- `.token-stack/reports/post/long-log.json`
- `.token-stack/reports/metrics-collected.json`
- `.token-stack/reports/metrics-summary.json`

## Optional path smoke checks

PowerShell:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\quote-paths.ps1
```

Git Bash:

```bash
bash scripts/quote-paths.sh
```

Both commands should print the current path without splitting it at spaces.

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

- PowerShell: use it for scaffold and `.ps1` smoke tests.
- Git Bash/WSL2: use it for Bash-backed verify and benchmark commands.
- Always quote Windows paths with spaces.
