# Demo Repo Plans

This document outlines three demo repository plans for showing `claude-token-stack`
to different engineering teams.

中文摘要：三套 demo 分别面向 TypeScript 团队、Python 团队和多平台 Windows 团队；重点展示大仓上下文治理、warn-first 到 block 的评估闭环，以及 Windows/PowerShell/Git Bash/WSL2 兼容性。

## Review Notes

- `verify` and `benchmark` invoke Bash scripts through the Node CLI. Run them from Git Bash, WSL2, macOS, or Linux. Native PowerShell can run `scaffold`, `collect-metrics`, `compare-metrics`, and direct hook smoke tests.
- `fix-windows-claude-settings.ps1` repairs global Claude settings at `$HOME\.claude\settings.json`; it does not edit the target demo repository's `.claude/settings.json`.
- For examples that run from a local checkout of this project, set `CTS_ROOT` to the checkout path in the current shell and run commands from the target demo repository root with `--target .`.
- Keep package manager examples consistent with the repository shape. A repo with `pnpm-workspace.yaml` should use `pnpm install`, not `npm install`.

## 1. TypeScript Team: `demo-ts-monorepo`

Best fit for showing: context governance in a large TypeScript monorepo.

This demo should show how project policy and warn-first hooks reduce avoidable
context noise from commands such as `tree`, `ls -R`, `grep -R`, direct `cat` of
source files, and reads from generated paths such as `dist/`, `coverage/`, and
`node_modules/`.

Suggested files:

```text
package.json
pnpm-workspace.yaml
tsconfig.base.json
apps/web/src/
apps/api/src/
packages/pricing/src/
packages/pricing/tests/
packages/shared/src/
dist/
coverage/
docs/architecture.md
```

Prepare from PowerShell:

```powershell
$env:CTS_ROOT = "<claude-token-stack-root>"
corepack enable
pnpm install
node "$env:CTS_ROOT\bin\cts.js" scaffold --target .
```

PowerShell hook smoke:

```powershell
$env:CLAUDE_PROJECT_DIR = (Get-Location).Path
$env:TOKEN_GUARD_MODE = "warn"
'{"tool_name":"Bash","tool_input":{"command":"tree"}}' | node .claude\hooks\run-python-hook.js .claude\hooks\bash-token-guard.py
```

Run full verification and synthetic benchmark from Git Bash:

```bash
CTS_ROOT="<claude-token-stack-root>"
node "$CTS_ROOT/bin/cts.js" verify --target .
node "$CTS_ROOT/bin/cts.js" benchmark --target . synthetic-only
node "$CTS_ROOT/bin/cts.js" collect-metrics --target .
node "$CTS_ROOT/bin/cts.js" compare-metrics --target .
```

Run the same flow from WSL2:

```bash
CTS_ROOT="<claude-token-stack-root>"
node "$CTS_ROOT/bin/cts.js" verify --target .
node "$CTS_ROOT/bin/cts.js" benchmark --target . synthetic-only
node "$CTS_ROOT/bin/cts.js" collect-metrics --target .
node "$CTS_ROOT/bin/cts.js" compare-metrics --target .
```

## 2. Python Team: `demo-python-service`

Best fit for showing: the warn-first rollout path and evidence loop before
enabling stricter block behavior.

This demo should show how a backend team can scaffold policy, collect hook logs
and reports, review false positives, and then decide whether block mode is
appropriate for broad `Grep` and `Glob` usage.

Suggested files:

```text
pyproject.toml
README.md
src/order_service/api.py
src/order_service/domain.py
src/order_service/repository.py
tests/test_order_status.py
tests/fixtures/orders.json
migrations/
logs/app.log
docs/runbook.md
```

Prepare from PowerShell:

```powershell
$env:CTS_ROOT = "<claude-token-stack-root>"
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -e . pytest fastapi
pytest
node "$env:CTS_ROOT\bin\cts.js" scaffold --target .
```

Show warn and block behavior:

```powershell
$env:CLAUDE_PROJECT_DIR = (Get-Location).Path

$env:CBM_GATE_MODE = "warn"
'{"tool_name":"Grep","tool_input":{"pattern":"OrderStatus","path":".","glob":"**/*"}}' | node .claude\hooks\run-python-hook.js .claude\hooks\cbm-gate.py

$env:CBM_GATE_MODE = "block"
'{"tool_name":"Grep","tool_input":{"pattern":"OrderStatus","path":".","glob":"**/*"}}' | node .claude\hooks\run-python-hook.js .claude\hooks\cbm-gate.py
```

Run full verification and synthetic benchmark from Git Bash:

```bash
CTS_ROOT="<claude-token-stack-root>"
node "$CTS_ROOT/bin/cts.js" verify --target .
node "$CTS_ROOT/bin/cts.js" benchmark --target . synthetic-only
```

Run the same flow from WSL2:

```bash
CTS_ROOT="<claude-token-stack-root>"
node "$CTS_ROOT/bin/cts.js" verify --target .
node "$CTS_ROOT/bin/cts.js" benchmark --target . synthetic-only
```

## 3. Multi-Platform Windows Team: `demo-windows-cross-platform`

Best fit for showing: Windows-first compatibility across PowerShell, Git Bash,
WSL2, Node, Python hooks, path quoting, and rollback-ready adoption.

Place this demo under a path with spaces to make the Windows value clear:

```powershell
mkdir "D:\Demo Repos\windows token stack"
cd "D:\Demo Repos\windows token stack"
```

Suggested files:

```text
package.json
scripts/build.ps1
scripts/build.sh
tools/inspect_logs.py
src/cli.ts
src/windows-paths.ts
tests/path-quoting.test.ts
docs/windows-support.md
```

PowerShell-native commands:

```powershell
$env:CTS_ROOT = "<claude-token-stack-root>"
npm init -y
node "$env:CTS_ROOT\bin\cts.js" scaffold --target .

$env:CLAUDE_PROJECT_DIR = (Get-Location).Path
$env:TOKEN_GUARD_MODE = "warn"
'{"tool_name":"Bash","tool_input":{"command":"ls -R ."}}' | node .claude\hooks\run-python-hook.js .claude\hooks\bash-token-guard.py
```

Optional global Claude settings dry-run:

```powershell
powershell -ExecutionPolicy Bypass -File "$env:CTS_ROOT\bin\fix-windows-claude-settings.ps1" -DryRun
```

Git Bash verification:

```bash
CTS_ROOT="<claude-token-stack-root>"
node "$CTS_ROOT/bin/cts.js" verify --target .
```

WSL2 verification:

```bash
CTS_ROOT="<claude-token-stack-root>"
node "$CTS_ROOT/bin/cts.js" verify --target .
```

Rollback demonstration:

```powershell
$env:TOKEN_GUARD_MODE = "off"
$env:CBM_GATE_MODE = "off"
Get-ChildItem .claude -Recurse
Get-ChildItem .token-stack\reports -ErrorAction SilentlyContinue
```

## Validation Expectations

Use these checks when preparing a concrete demo repository:

- `scaffold` should run successfully from native PowerShell.
- `bash-token-guard` warn smoke should exit `0`.
- `cbm-gate` block smoke should exit `2`.
- If Bash is unavailable, `verify` should fail with guidance to use Git Bash or WSL2.
