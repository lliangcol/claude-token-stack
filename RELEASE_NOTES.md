# Claude Token Stack v0.1.0-rc

This is a GitHub release-candidate surface for `claude-token-stack`. It prepares the project for public trial, feedback, and verification. It does not require `npm publish`.

## Features

- Repo-level Claude Code token governance kit with scaffolded `.claude/` policy, hooks, output style guidance, and rollback docs.
- Warn-first Bash command guard for high-noise shell patterns such as `tree`, `ls -R`, `grep -R`, broad `find`, and full log dumps.
- Warn-first code-discovery gate for broad `Read`, `Grep`, and `Glob` usage, with explicit block-mode tuning.
- Cross-platform Node hook runner for Python hooks.
- Local verification reports under `.token-stack/reports/`.
- Synthetic baseline/post benchmark workflow with metrics collection and comparison.
- Optional guidance for context-mode, codebase-memory-mcp, RTK, Caveman, Headroom, and duplicate MCP cleanup.
- Static demo repositories under `examples/` for TypeScript monorepo, Python service, and Windows path-with-spaces scenarios.
- Synthetic case-study format under `docs/case-studies/`.
- English and Chinese README surfaces.

## Platform support

- Node.js 18 or newer.
- Python 3, or the Windows `py` launcher.
- Bash through macOS/Linux shells, Git Bash, or WSL2.
- PowerShell for Windows scaffold, metrics, path checks, and helper scripts.
- Windows, macOS, Linux, Git Bash/MINGW64, and WSL2 are supported when shell boundaries are kept explicit.

## Verification commands

Repository release-candidate checks:

```bash
npm test
npm pack --dry-run
```

Focused checks:

```bash
npm run lint
npm run verify
npm run test:hooks
npm run test:helpers
```

`scripts/check-release.ps1` and `scripts/check-release.sh` both run:

```bash
npm test
npm pack --dry-run
```

## Demo and benchmark commands

From a local checkout:

```bash
node bin/cts.js scaffold --target .tmp/demo-review
node bin/cts.js verify --target .tmp/demo-review
node bin/cts.js benchmark synthetic-only --target .tmp/demo-review
node bin/cts.js collect-metrics --target .tmp/demo-review
node bin/cts.js compare-metrics --target .tmp/demo-review
```

Synthetic/demo evidence is wiring proof only. It is not real repository savings proof.

## Known limitations

- No fixed token or cost savings percentage is claimed.
- Synthetic benchmark data does not prove real repository savings.
- Optional tools may be missing; verification reports them as `WARN`.
- `verify`, `benchmark`, `install-tools`, and `all` invoke Bash scripts under the Node CLI.
- Remote optional installs are disabled by default and require explicit opt-in.
- Headroom is disabled by default with `ENABLE_HEADROOM=0`.
- This is not a full DLP system; projects must extend deny rules for project-specific secret names.

## Rollback

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

For full file removal and optional MCP cleanup, use:

- `docs/rollback.md`
- generated `docs/claude-token-stack-rollback.md`
- scaffold-created `.bak.<timestamp>` backups

## Security posture

- Offline-first and local-first by default.
- Warn-first by default.
- Remote optional install is opt-in.
- No `curl | sh` install path.
- No `dangerously-skip-permissions` recommendation.
- No intentional secret reads.

## Release checklist

Manual GitHub repository and promotion tasks are tracked in:

- `https://github.com/lliangcol/claude-token-stack/blob/main/docs/release/v0.1.0-rc-checklist.md`
