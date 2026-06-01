# claude-token-stack

## Hero

**Repo-level governance toolkit for Claude Code and AI coding agents: policy, hooks, MCP guidance, verification, benchmarks, and rollback.**

`claude-token-stack` helps maintainers and engineering teams make agent sessions more bounded, measurable, and reversible across real repositories.

It is not a one-off token compression tool. It is a repository-level governance kit for reducing avoidable context waste through warn-first controls, benchmark evidence, cross-platform setup, and safe rollback paths.

## Why Now

AI coding agents are moving from individual experiments into shared engineering workflows. That makes unmanaged context more than a cost problem: it affects speed, reviewability, reproducibility, and team trust.

Most avoidable waste comes from ordinary repository behavior:

- recursive shell output such as `tree`, `ls -R`, `grep -R`, broad `find`, and full log dumps;
- whole-file reads before symbol, caller, or snippet discovery;
- duplicate MCP servers returning overlapping context;
- generated, vendor, build, lock, or log files entering prompts;
- optimization tools enabled without a baseline, post measurement, or rollback path;
- missing project-local policy, so every agent session rediscovers the same constraints.

`claude-token-stack` gives the repository a practical operating layer: policy, hooks, MCP guidance, verification, benchmark reports, and rollback.

## Who This Is For

Use this if you are:

- maintaining a repository where Claude Code or AI coding agents are used repeatedly;
- standardizing AI coding workflows across a team;
- trying to reduce avoidable context waste without blocking useful exploration too early;
- evaluating MCP tools and want guidance against duplicate or noisy context;
- looking for benchmark and rollback evidence before enforcing stricter controls.

This may not be for you if you only need a prompt-shortening utility, a generic linter, or a guaranteed token-savings percentage.

## What You Get

`claude-token-stack` scaffolds:

- **Policy**: project-local Claude Code token and context rules.
- **Hooks**: warn-first guards for noisy shell commands, broad reads, greps, and globs.
- **MCP guidance**: recommendations for bounded discovery and duplicate MCP avoidance.
- **Verification**: scripts and reports to confirm the stack is installed correctly.
- **Benchmarking**: baseline/post metrics for adoption decisions.
- **Rollback**: backups, disable modes, and removal instructions.

Core files and behavior include:

- `.claude/settings.json`, `.claude/token-policy.md`, hooks, output style guidance, and rollback docs;
- `bash-token-guard.py` for high-noise Bash command warnings;
- `cbm-gate.py` for broad `Read`, `Grep`, and `Glob` warnings;
- `run-python-hook.js` for Windows, WSL2, macOS, Linux, Git Bash, and PowerShell hook execution;
- optional guidance for RTK, Headroom, Caveman, context-mode, codebase-memory-mcp, and local MCP setup;
- verification and benchmark artifacts under `.token-stack/reports/`.

## Quickstart

From this repository:

```bash
npm install
node bin/cts.js scaffold --target /path/to/your-repo
node bin/cts.js verify --target /path/to/your-repo
```

After npm publication:

```bash
npx claude-token-stack scaffold
npx claude-token-stack verify
```

Default behavior:

- warn-first, not block-first;
- local-first, with remote optional tools disabled by default;
- benchmark-ready, so adoption can be measured;
- rollback-ready, so changes can be undone cleanly.

## Recommended Rollout

Start in warn mode and collect evidence:

```bash
export TOKEN_GUARD_MODE=warn
export CBM_GATE_MODE=warn
export ENABLE_HEADROOM=0
```

Defaults in `templates/.claude/settings.json` follow the same posture:

```json
{
  "TOKEN_GUARD_MODE": "warn",
  "CBM_GATE_MODE": "warn",
  "ENABLE_HEADROOM": "0"
}
```

Consider blocking only after:

- hook smoke tests pass in warn and block modes;
- `metrics-summary.json` recommends entering block mode;
- post-adoption tasks still pass;
- raw large-output events are not worse than baseline;
- cost or token metrics are not worse than baseline;
- the team has reviewed false positives in `.claude/logs/token-guard.log` and `.claude/logs/cbm-gate.log`.

A conservative path is to switch `TOKEN_GUARD_MODE=block` first, keep `CBM_GATE_MODE=warn`, and evaluate broad `Grep`/`Glob` blocking later. Test and build commands remain warn-only advisories in the default hook even when block mode is enabled.

## Real Proof

This project is designed to produce evidence instead of claims.

Verification and benchmark runs generate artifacts such as:

- `.token-stack/reports/verify-report.md`
- `.token-stack/reports/verify-report.json`
- `.token-stack/reports/baseline/*.json`
- `.token-stack/reports/post/*.json`
- `.token-stack/reports/metrics-summary.json`
- `.token-stack/reports/metrics-summary.md`

Run synthetic baseline/post benchmarks and compare:

```bash
node bin/cts.js benchmark synthetic-only --target .
node bin/cts.js collect-metrics .token-stack/reports
node bin/cts.js compare-metrics .token-stack/reports
```

Example evidence table to fill with measured data:

| Scenario | Baseline | Post-adoption | Result |
| --- | --- | --- | --- |
| Broad shell output | TBD | TBD | TBD |
| Full-file reads before discovery | TBD | TBD | TBD |
| Duplicate MCP context | TBD | TBD | TBD |
| Task success | TBD | TBD | TBD |

Do not replace `TBD` with estimates. This README should only claim measured outcomes.

## Comparison

| Capability | Token compression tool | Context summarizer | MCP discovery tool | Generic linter | claude-token-stack |
| --- | --- | --- | --- | --- | --- |
| Repo-level policy | Usually no | Usually no | No | Sometimes | Yes |
| Claude Code hooks | No | No | No | No | Yes |
| Warn-first rollout | Rare | Rare | No | Sometimes | Yes |
| MCP guidance | No | No | Yes | No | Yes |
| Verification workflow | Rare | Rare | Rare | Sometimes | Yes |
| Benchmark workflow | Rare | Rare | Rare | No | Yes |
| Rollback docs | Rare | Rare | No | No | Yes |
| Cross-platform setup guidance | Varies | Varies | Varies | Varies | Yes |

`claude-token-stack` complements compression and discovery tools. It provides the repository-level governance layer around them.

## Cross-Platform Notes

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

PowerShell does not support Bash heredoc syntax such as `python - <<'PY'`. Use the Node CLI or run Bash scripts inside Git Bash/WSL2.

## Tool Strategy

- `codebase-memory-mcp`: default code discovery route for symbols, callers, callees, snippets, and architecture. Use it before broad `Read`, `Grep`, or `Glob`.
- `context-mode`: large output governance for logs and long command output. It complements code discovery rather than replacing it.
- `Caveman`: optional concise output style/tooling. If unavailable, use `.claude/output-styles/token-lean.md`.
- `Headroom`: disabled by default. Enable only with `ENABLE_HEADROOM=1` after agreeing to setup, measurement, and rollback.
- `RTK`: optional. Native Windows, Git Bash, MINGW, MSYS, and Cygwin skip RTK auto-install by default if it is not already installed.
- `codegraph`: optional duplicate MCP. If both `codebase-memory-mcp` and `codegraph` exist, prefer codebase-memory-mcp and remove codegraph if it creates duplicate context.

Project-local MCP setup is optional. Start from `.mcp.local.example.json`, pin reviewed versions, avoid duplicate global/project servers, and record tool-list, connection, cache, rate-limit, read-only, and stability evidence with `docs/mcp-local-smoke.md`.

## Rollback

Fast disable:

```bash
export TOKEN_GUARD_MODE=off
export CBM_GATE_MODE=off
```

Scaffold creates `.bak.*` backups before changing an existing `.claude/settings.json` or overwriting copied template destinations. To roll back:

1. Restore the relevant `.claude/settings.json.bak.*` file.
2. Remove copied hook files from `.claude/hooks/`.
3. Remove `.claude/token-policy.md` and `.claude/output-styles/token-lean.md` if they were only used for this stack.
4. Remove optional MCP servers added during tool installation, especially duplicate `codegraph`.
5. Keep `.token-stack/reports/` if you need adoption evidence; otherwise remove generated reports and logs.

See [docs/rollback.md](docs/rollback.md) and [docs/claude-token-stack-rollback.md](docs/claude-token-stack-rollback.md).

## FAQ

### Is this a token compression tool?

No. It is a repo-level governance toolkit for Claude Code and AI coding agents. It focuses on policy, hooks, MCP guidance, verification, benchmark, and rollback.

### Does it guarantee token reduction?

No. It helps detect and measure avoidable context waste. Real impact depends on repository size, workflow, agent behavior, and adoption mode.

### Why warn-first?

Broad commands and large reads are sometimes legitimate during incident response or unfamiliar repo exploration. Warn-first mode lets teams collect evidence and tune false positives before blocking.

### Does it require remote tools?

No. The default path is local-first. Optional tools require explicit opt-in.

### Can I use only scaffold without optional tools?

Yes. `scaffold` and `verify` work without remote installers. Optional tools are detection/install guidance only.

### Can I use it on Windows?

Yes. The Node CLI and hook wrappers are designed for cross-platform use, including PowerShell, Git Bash, WSL2, macOS, and Linux.

### How do I roll it back?

Use the generated backups, disable modes, and rollback docs. The stack is designed to be removable without treating adoption as a one-way migration.

## Roadmap

Planned areas:

- stronger benchmark examples from real repositories;
- more hook smoke tests across Windows, macOS, Linux, Git Bash, and WSL2;
- clearer MCP deduplication guidance;
- improved metrics summaries for maintainers;
- optional templates for team rollout documentation;
- more examples for open-source and enterprise repository adoption.

See [ROADMAP.md](ROADMAP.md) for details.

## Contributing

Contributions are welcome, especially:

- real benchmark reports with anonymized data;
- Windows, macOS, Linux, Git Bash, and WSL2 compatibility fixes;
- hook false-positive reductions;
- MCP guidance improvements;
- documentation examples from real adoption paths;
- security and rollback review.

Start with:

```bash
npm install
npm test
```

Please read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request.

## Security

`claude-token-stack` does not intentionally read secrets and does not require uploading repository data.

The default setup is local-first. Remote optional tool installation is disabled unless explicitly enabled:

```bash
TOKEN_STACK_ALLOW_REMOTE_INSTALL=1 \
CONTEXT_MODE_NPM_SPEC=context-mode@REVIEWED_VERSION \
CODEBASE_MEMORY_MCP_NPM_SPEC=codebase-memory-mcp@REVIEWED_VERSION \
npx claude-token-stack install-tools
```

Remote npm/npx installs require pinned package specs by default. Set `TOKEN_STACK_ALLOW_UNPINNED_REMOTE_INSTALL=1` only in disposable or otherwise reviewed environments.

This is not a full DLP system. Review generated policies, extend deny lists for project-specific secrets, and avoid including credentials, `.env` content, private keys, or production tokens in benchmark reports.

For details, see [SECURITY.md](SECURITY.md).

## Documentation

- [Getting Started](docs/getting-started.md)
- [Installation](docs/installation.md)
- [Architecture](docs/architecture.md)
- [Benchmark](docs/benchmark.md)
- [Validation Playbook](docs/validation-playbook.md)
- [Rollback](docs/rollback.md)
- [Security Model](docs/security-model.md)
