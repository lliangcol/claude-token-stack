# Claude Token Stack v0.1.0 Release Notes Draft

## What is Claude Token Stack

Claude Token Stack is a local-first Claude Code token governance kit. It scaffolds project policy, warn-first hooks, output style guidance, validation scripts, benchmark helpers, and rollback documentation so teams can measure and reduce avoidable context waste without relying on fixed savings claims.

## Key features

- Offline-first scaffold for `.claude/settings.json`, token policy, hooks, output style guidance, and rollback docs.
- Warn-first Bash command guard for high-noise commands and common secret-like shell reads.
- Warn-first code-discovery gate for broad `Read`, `Grep`, and `Glob` usage.
- Cross-platform Node hook runner for Python hooks.
- Verification report generation under `.token-stack/reports/`.
- Synthetic baseline/post benchmark workflow with metrics collection and comparison.
- Optional tool detection for context-mode, codebase-memory-mcp, RTK, Caveman, Headroom, and duplicate codegraph cleanup guidance.

## Supported platforms

- Node.js 18 or newer.
- Python 3, or the Windows `py` launcher.
- Bash through macOS/Linux shells, Git Bash, or WSL2.
- PowerShell for Windows helper scripts.
- Windows, macOS, Linux, Git Bash/MINGW64, and WSL2 are supported when their shell boundaries are kept explicit.

## Known limitations

- The project does not guarantee a fixed token or cost reduction percentage.
- Synthetic benchmark data is wiring evidence, not proof of real repository savings.
- Optional tools can be missing; verification reports them as WARN instead of silently assuming they exist.
- `verify`, `benchmark`, `install-tools`, and `all` invoke Bash scripts under the Node CLI.
- Remote optional installs are disabled by default and require explicit opt-in.
- This is not a full DLP system; extend deny rules for project-specific secret names.

## Windows notes

- Prefer the Node CLI from PowerShell for scaffold, collect-metrics, and compare-metrics.
- Run Bash-backed commands from Git Bash/WSL2, or install Git Bash and quote target paths.
- Windows paths with spaces must be passed as quoted arguments.
- Project hooks use `run-python-hook.js` so Python hook paths are passed as arguments instead of interpolated shell strings.
- Use `bin/fix-windows-claude-settings.ps1 -DryRun` before applying global Claude settings path fixes.

## RTK notes

RTK is optional. Native Windows, Git Bash, MINGW, MSYS, and Cygwin skip RTK auto-install by design and report a warning or skipped item. Use WSL2 or manual native installation if a project requires RTK. The stack remains usable without RTK through hooks, policy, validation, and benchmark reports.

## Headroom disabled by default

Headroom is disabled by default with `ENABLE_HEADROOM=0`. Enable it only with `ENABLE_HEADROOM=1` after the team accepts the proxy-layer blast radius, verifies streaming/tool-call/MCP behavior, and has a rollback path.

## Verification command

```bash
npm test
```

Focused release-candidate checks:

```bash
npm run lint
npm run verify
bash -lc 'bash -n bin/*.sh'
npm run test:hooks
node bin/cts.js scaffold --target .tmp/scaffold-dry-run dry-run
```

## Rollback command

Fast disable for Bash-compatible shells:

```bash
export TOKEN_GUARD_MODE=off
export CBM_GATE_MODE=off
```

PowerShell equivalent:

```powershell
$env:TOKEN_GUARD_MODE = "off"
$env:CBM_GATE_MODE = "off"
```

For full file removal and optional MCP cleanup, use `docs/rollback.md`.
