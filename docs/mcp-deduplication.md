# MCP Deduplication

MCP servers can reduce token usage when each server has a clear job. They can also increase token usage when multiple servers return overlapping context.

## Default Code Discovery Tool

`codebase-memory-mcp` is the default code discovery MCP for this project. Prefer it for:

- Finding functions, classes, routes, and variables.
- Tracing callers and callees.
- Reading specific symbol snippets.
- Querying architecture and dependencies.

Use broad `Read`, `Grep`, or `Glob` only after graph discovery is insufficient or the target is narrowed.

## codegraph Is Optional

`codegraph` is treated as an optional duplicate MCP. It may be useful in some environments, but when `codebase-memory-mcp` is already available it can create duplicate discovery routes and repeated context.

Keep one primary code discovery path per repository unless there is a measured reason to keep both.

## Remove codegraph

Use the helper:

```powershell
powershell -ExecutionPolicy Bypass -File .\bin\remove-optional-codegraph.ps1 -DryRun
powershell -ExecutionPolicy Bypass -File .\bin\remove-optional-codegraph.ps1
```

Or use Claude CLI directly:

```bash
claude mcp list
claude mcp remove codegraph
claude mcp list
```

The helper is intentionally narrow: it lists MCP servers, removes `codegraph`, then lists servers again.

## context-mode Role

`context-mode` is not a code graph. It is a large-output governance tool. Use it for:

- Long logs.
- Large command output.
- Summarization boundaries.
- Output routing when raw content would flood the prompt.

Recommended split:

- Code structure: `codebase-memory-mcp`.
- Large text/output: `context-mode`.
- Concise response style: Caveman or `.claude/output-styles/token-lean.md`.
