# Claude Code Token Policy

## Session Hygiene

- New task: run `/clear` first.
- Long task: use `/compact` before context gets noisy.
- Do not keep unrelated tasks in the same session.

## Code Discovery

Default flow:

1. Use Codebase Memory MCP to find symbols, callers, callees, modules, and likely files.
2. Read only the necessary file sections.
3. Avoid whole-repo grep unless explicitly justified.
4. Avoid generated files, lockfiles, build outputs, coverage, dist, vendor, and `node_modules`.

## Bash / CLI

Avoid raw noisy commands:

- `tree`
- `ls -R`
- `grep -R`
- `find . -type f`
- `cat` large source files
- unbounded test/log commands

Prefer:

- targeted `rg`
- `git diff --stat` before full diff
- focused test commands
- context-mode for large logs
- RTK only when explicitly installed and appropriate

## Large Outputs

If output is likely large, route it through a summarization path and return:

- failure summary
- top stack frames
- file paths
- line numbers
- reproduction command
- next recommended action

## Output Style

Default: concise. Use detailed mode only for architecture, handoff docs, incident analysis, or explicit user request.

## Safety

Never read:

- `.env`
- secrets
- private keys
- production credentials
- token files

## Cross-Platform Hook Policy

Project hooks must be invoked through `.claude/hooks/run-python-hook.js` so Windows, Linux, and macOS share one `.claude/settings.json`.

## Windows/MINGW64 Policy

- Do not assume `~/.claude/hooks/...` works when the user profile contains spaces.
- Do not force RTK auto-rewrite installation under MINGW64.
- If `codebase-memory-mcp` is connected, do not also approve duplicate `codegraph` unless the user requests comparison.
