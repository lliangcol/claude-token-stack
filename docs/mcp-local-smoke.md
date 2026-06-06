# Local MCP Smoke

Optional smoke checklist for project-local MCP tools that reduce duplicate code
discovery or summarize large output. This checklist supports token/context
governance only; it does not make MCP setup a required project scope.

## Local Dependency Template

Review `.mcp.local.example.json`, pin each package to an exact semver version such as `@1.2.3`, then copy it to
the MCP config path your Claude Code workflow uses only if local MCP governance
is in scope.

Do not keep both a global and project-local server with the same purpose unless
you intentionally want both. Prefer one reviewed code-discovery route.

## Smoke Evidence

Capture evidence under `.token-stack/reports/`:

| Check | Expected evidence |
| --- | --- |
| Tool list | Each optional MCP server appears at most once in the active MCP list. |
| Connection | A simple architecture or tool-list request succeeds without auth errors. |
| Cache | Repeated discovery records cache hit, warm-cache timing, or stable reuse evidence when the tool exposes it. |
| Rate limit | The MCP reports no throttling for a small bounded request, or records the configured local limit. |
| Read-only | Write, edit, or mutation tools are absent or disabled for governance smoke. |
| Stability | Three small bounded requests complete without reconnect failures. |

## Rollback

Remove the project-local MCP config copy, then run the active MCP list command again to confirm no duplicate server remains.
