# AI Agent Claude Token Stack Execution Plan v2

This is the public, self-contained summary of the internal seed execution plan used to build v0.1.0. The seed files are excluded from the npm package.

## Key Implementation Requirements

- Use `--verbose` with Claude CLI `--output-format stream-json`.
- Invoke Python hooks through `.claude/hooks/run-python-hook.js`.
- Skip RTK auto-install on Windows/MINGW64 and record guidance.
- Keep Headroom disabled by default.
- Keep hooks in warn mode by default.
- Support offline scaffold with `TOKEN_STACK_ALLOW_REMOTE_INSTALL=0`.
- Provide validation scripts and rollback docs.
