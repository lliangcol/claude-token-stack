# Codebase Memory MCP

Codebase Memory MCP is the recommended first-hop code discovery tool for symbol, caller, callee, and module lookup.

Use it before broad `Read`, `Grep`, or `Glob` on source code. If the index is missing, stale, or insufficient, fall back to targeted file reads and explain the fallback.

Use a repository-local index by default. Do not configure hidden remote indexing, telemetry, or source upload as part of the scaffolded workflow. If a team chooses a remote or shared index, record that as an explicit owner-approved data path before using it.

Keep one primary code discovery MCP per repository. When another code graph tool returns overlapping context, prefer the narrower source and avoid pasting duplicate snippets into the agent context.
