# Claude Token Stack

This repository has been scaffolded with `claude-token-stack`.

`claude-token-stack` only targets token and context governance. It does not add
business architecture rules, code quality gates, domain allowlists, or broad
`.claude-governance` controls.

## Defaults

- `TOKEN_GUARD_MODE=warn`
- `CBM_GATE_MODE=warn`
- `CBM_GATE_BLOCK_TOOLS=Grep,Glob`
- `ENABLE_HEADROOM=0`
- `TOKEN_STACK_ALLOW_REMOTE_INSTALL=0`

## Expected Workflow

1. Use code discovery before broad file reads.
2. Keep large command output out of the main context.
3. Use focused tests and targeted logs.
4. Review hook logs before changing warn mode to block mode.

Keep one token hook per matcher (`Bash`, `Read`, `Grep`, and `Glob`). If a
target repository already has a token hook for a matcher, scaffold keeps the
existing hook and skips the template hook instead of adding a duplicate.

Test and build commands are warn-only advisories by default, even when
`TOKEN_GUARD_MODE=block`. They should be summarized, targeted, or routed
through context-mode when output is large, but short local test runs should not
be hard-blocked by the default template.

Optional local MCP setup starts from `.mcp.local.example.json`. Pin reviewed
versions before use, avoid duplicate global/project MCP servers, and capture
tool-list, connection, cache, rate-limit, read-only, and stability evidence with
`docs/mcp-local-smoke.md`.

Use `docs/context-pack-template.md` for bounded handoffs: top-k evidence,
short snippets, risks, and a verification checklist instead of open-ended
whole-file scans.

## Logs

Hook logs are written under:

```text
.claude/logs/
```

Runtime reports are written under:

```text
.token-stack/reports/
```
