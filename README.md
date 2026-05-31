# claude-token-stack

`claude-token-stack` is an open-source Claude Code token governance kit. It gives a repository a project policy, warn-first hooks, MCP/tool guidance, validation scripts, benchmark reports, and rollback instructions so token reduction work is measurable instead of anecdotal.

中文摘要：本项目面向 Claude Code / AI Coding Agent 的上下文治理。它不承诺所有仓库总成本降低固定比例，而是把大输出、无边界搜索、重复 MCP、整文件读取和冗长报告变成可检测、可验证、可回滚的工程流程。

## Problem Background

Most avoidable token waste comes from unmanaged context:

- Recursive output such as `tree`, `ls -R`, `grep -R`, broad `find`, and full log dumps.
- Reading entire source files before symbol or caller discovery.
- Using overlapping MCP servers that return duplicate context.
- Letting generated, vendor, build, lock, or log files enter the prompt.
- Enabling optimization tools without a baseline, post measurement, or rollback path.
- Missing project-local policy, so every agent session rediscovers the same constraints.

## Core Capabilities

- Scaffold `.claude/settings.json`, `.claude/token-policy.md`, hooks, output style guidance, and rollback docs into a target repo.
- Warn on high-noise Bash commands through `bash-token-guard.py`.
- Warn on broad `Read`, `Grep`, and `Glob` usage through `cbm-gate.py`.
- Run Python hooks through `run-python-hook.js` for Windows, WSL2, macOS, Linux, Git Bash, and PowerShell compatibility.
- Keep remote installers, RTK, Headroom, Caveman, context-mode, and codebase-memory-mcp optional.
- Generate verification and benchmark artifacts under `.token-stack/reports/`.

## Quick Start

From this repository:

```bash
npm install
npm test
node bin/cts.js scaffold --target /path/to/target-repo
node bin/cts.js verify --target /path/to/target-repo
```

From npm after publication:

```bash
npx claude-token-stack scaffold
npx claude-token-stack verify
```

Scaffold is local-first. Remote optional tool installation is disabled unless explicitly enabled:

```bash
TOKEN_STACK_ALLOW_REMOTE_INSTALL=1 \
CONTEXT_MODE_NPM_SPEC=context-mode@REVIEWED_VERSION \
CODEBASE_MEMORY_MCP_NPM_SPEC=codebase-memory-mcp@REVIEWED_VERSION \
npx claude-token-stack install-tools
```

Remote npm/npx installs require pinned package specs by default. Set `TOKEN_STACK_ALLOW_UNPINNED_REMOTE_INSTALL=1` only in disposable or otherwise reviewed environments.

## Windows / macOS / Linux

macOS and Linux can run the Bash scripts directly:

```bash
bash bin/install-claude-token-stack.sh scaffold
bash bin/verify-claude-token-stack.sh
bash bin/run-token-benchmark.sh synthetic-only
```

Windows users should prefer the Node CLI from PowerShell for scaffold and metrics commands:

```powershell
node .\bin\cts.js scaffold --target .
powershell -ExecutionPolicy Bypass -File .\bin\fix-windows-claude-settings.ps1 -DryRun
```

`verify`, `benchmark`, `install-tools`, and `all` invoke Bash scripts even when started through the Node CLI. Run those commands from Git Bash/WSL2, or install Git Bash and keep target paths quoted.

WSL2 users can run the Bash scripts inside WSL2. Keep target paths consistent inside the same environment, for example `/mnt/d/...` rather than mixing Windows and WSL path forms in one command.

## Git Bash / PowerShell / WSL2 Notes

- PowerShell does not support Bash heredoc syntax such as `python - <<'PY'`; use the Node CLI or run Bash scripts inside Git Bash/WSL2.
- Git Bash and MINGW64 are supported for scaffold and verification, but RTK auto-install is skipped there by default.
- WSL2 is the recommended Windows path for POSIX shell workflows and optional Unix-oriented tools.
- Windows paths with spaces must be passed as quoted arguments. The Node CLI and `run-python-hook.js` avoid shell interpolation for hook execution.

## Default Warn, When To Block

Defaults in `templates/.claude/settings.json`:

```json
{
  "TOKEN_GUARD_MODE": "warn",
  "CBM_GATE_MODE": "warn",
  "ENABLE_HEADROOM": "0"
}
```

Use `warn` first while collecting hook logs and benchmark data. Consider `block` only when:

- Hook smoke tests pass in both warn and block modes.
- `metrics-summary.json` has `"recommend_enter_block": true`.
- Post-adoption tasks still pass.
- Raw large output events are not worse than baseline.
- Cost or token metrics are not worse than baseline.
- The team has reviewed false positives in `.claude/logs/token-guard.log` and `.claude/logs/cbm-gate.log`.

Recommended rollout: switch `TOKEN_GUARD_MODE=block` first, keep `CBM_GATE_MODE=warn`, then evaluate broad `Grep`/`Glob` blocking later.

## RTK Windows/MINGW64 Strategy

RTK is optional. The installer detects `rtk` if it already exists. If not installed, native Windows, Git Bash, MINGW, MSYS, and Cygwin skip RTK auto-install and record a warning or skipped item. Use WSL2 or manual RTK installation if a project requires it. The stack remains usable without RTK through hooks, policy, codebase-memory-mcp guidance, context-mode guidance, and benchmark reports.

## Tool Strategy

- `codebase-memory-mcp`: default code discovery route for symbols, callers, callees, snippets, and architecture. Use it before broad `Read`, `Grep`, or `Glob`.
- `context-mode`: large output governance tool for logs and long command output. It is complementary to code discovery, not a replacement for codebase-memory-mcp.
- `Caveman`: optional concise output style/tooling. If unavailable, use `.claude/output-styles/token-lean.md`.
- `Headroom`: disabled by default. Enable only with `ENABLE_HEADROOM=1` after agreeing to setup, measurement, and rollback.
- `codegraph`: optional duplicate MCP. If both `codebase-memory-mcp` and `codegraph` exist, prefer codebase-memory-mcp and remove codegraph if it creates duplicate context.

## Verification And Benchmark

Run local checks:

```bash
npm run lint
npm run test:hooks
npm test
```

Verify a scaffolded target:

```bash
node bin/cts.js verify --target .
```

Run synthetic baseline/post benchmark and compare:

```bash
node bin/cts.js benchmark synthetic-only --target .
node bin/cts.js collect-metrics .token-stack/reports
node bin/cts.js compare-metrics .token-stack/reports
```

Important outputs:

- `.token-stack/reports/verify-report.md`
- `.token-stack/reports/verify-report.json`
- `.token-stack/reports/baseline/*.json`
- `.token-stack/reports/post/*.json`
- `.token-stack/reports/metrics-summary.json`
- `.token-stack/reports/metrics-summary.md`

## Rollback

Scaffold creates `.bak.*` backups before changing an existing `.claude/settings.json` or overwriting any copied template destination. To roll back:

1. Restore the relevant `.claude/settings.json.bak.*` file.
2. Remove copied hook files from `.claude/hooks/`.
3. Remove `.claude/token-policy.md` and `.claude/output-styles/token-lean.md` if they were only used for this stack.
4. Remove optional MCP servers added during tool installation, especially duplicate `codegraph`.
5. Keep `.token-stack/reports/` if you need adoption evidence; otherwise remove generated reports and logs.

See [docs/rollback.md](docs/rollback.md) and [docs/claude-token-stack-rollback.md](docs/claude-token-stack-rollback.md).

## FAQ

### Does this guarantee token reduction?

No. It provides guardrails and measurement. Synthetic benchmark data is only a sanity check; real repository impact must be measured with baseline/post runs.

### Why not block immediately?

Broad commands are sometimes legitimate during incident response or unfamiliar repo exploration. Warn-first mode gives the team evidence before enforcement.

### Does it read secrets?

It does not intentionally read secrets and does not require uploading secrets. Templates deny common `Read` paths, and the Bash guard warns or blocks common shell reads such as `cat .env` in warn/block mode. This is not a full DLP system; extend the deny list for project-specific secret names and do not run benchmarks or issue reports with credentials, `.env` content, private keys, or production tokens.

### Can I use only scaffold without optional tools?

Yes. `scaffold` and `verify` work without remote installers. Optional tools are detection/install guidance only.

### What if PowerShell fails on Bash syntax?

Use `node bin/cts.js ...` from PowerShell, or run Bash scripts in Git Bash/WSL2. Do not paste Bash heredocs into PowerShell.

### What if Claude settings have broken Windows hook paths?

Run:

```powershell
powershell -ExecutionPolicy Bypass -File .\bin\fix-windows-claude-settings.ps1 -DryRun
powershell -ExecutionPolicy Bypass -File .\bin\fix-windows-claude-settings.ps1
```

### How do I remove optional codegraph?

Run:

```powershell
powershell -ExecutionPolicy Bypass -File .\bin\remove-optional-codegraph.ps1 -DryRun
```

or:

```bash
claude mcp remove codegraph
```

## Documentation

- [Architecture](docs/architecture.md)
- [Installation](docs/installation.md)
- [Validation Playbook](docs/validation-playbook.md)
- [Windows Compatibility](docs/windows-compatibility.md)
- [Security Model](docs/security-model.md)
- [MCP Deduplication](docs/mcp-deduplication.md)
- [Benchmark](docs/benchmark.md)
- [Rollback](docs/rollback.md)
