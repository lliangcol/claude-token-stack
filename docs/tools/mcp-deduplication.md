# MCP Deduplication

`codebase-memory-mcp` and `codegraph` can overlap. Keep one primary code graph MCP by default to reduce tool-choice ambiguity.

If `codebase-memory-mcp` is connected and `codegraph` is optional or pending approval, remove `codegraph`:

```powershell
powershell -ExecutionPolicy Bypass -File .\bin\remove-optional-codegraph.ps1
```
