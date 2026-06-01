# Examples

These are minimal static demo repositories for showing the `claude-token-stack` governance loop. They are intentionally small: the goal is to demonstrate scaffold, verify, synthetic benchmark, and rollback wiring, not to build full applications.

Each demo assumes you are running commands from inside that demo directory and that `CTS_ROOT` points to a local checkout of this repository.

## Demo index

| Demo | Best for | Minimal files |
| --- | --- | --- |
| [demo-ts-monorepo](demo-ts-monorepo/README.md) | TypeScript teams that want monorepo context governance | `package.json`, workspace metadata, small `apps/` and `packages/` sources |
| [demo-python-service](demo-python-service/README.md) | Python backend teams that want warn-first rollout evidence | `pyproject.toml`, small service source, small test fixture |
| [demo-windows-path-space](demo-windows-path-space/README.md) | Windows teams validating path quoting across PowerShell, Git Bash, and WSL2 | `package.json`, path-report script, `.ps1` and `.sh` helpers |

## Shared constraints

- No real dependencies are installed in these directories.
- No `node_modules/`, virtual environments, build outputs, or lockfiles are committed.
- `scaffold`, `verify`, `benchmark`, and rollback commands are written as if the user is already in the demo directory.
- Generated `.claude/`, `.token-stack/`, cache, report, and temporary outputs are local evidence and should not be committed.
- Synthetic/demo evidence is wiring proof only. It is not real repository savings proof.

## Shared commands

PowerShell setup:

```powershell
$env:CTS_ROOT = "C:\path\to\claude-token-stack"
node "$env:CTS_ROOT\bin\cts.js" scaffold --target .
```

Git Bash or WSL2 verification:

```bash
CTS_ROOT="/c/path/to/claude-token-stack"
node "$CTS_ROOT/bin/cts.js" verify --target .
node "$CTS_ROOT/bin/cts.js" benchmark synthetic-only --target .
node "$CTS_ROOT/bin/cts.js" collect-metrics --target .
node "$CTS_ROOT/bin/cts.js" compare-metrics --target .
```

Expected report paths:

- `.token-stack/reports/verify-report.md`
- `.token-stack/reports/verify-report.json`
- `.token-stack/reports/baseline/*.json`
- `.token-stack/reports/post/*.json`
- `.token-stack/reports/metrics-collected.json`
- `.token-stack/reports/metrics-summary.json`

Rollback:

```powershell
$env:TOKEN_GUARD_MODE = "off"
$env:CBM_GATE_MODE = "off"
```
