# Architecture

## Layers

1. Policy: `.claude/token-policy.md` and output styles.
2. Runtime: `run-python-hook.js` normalizes Python execution across OSes.
3. Enforcement: `bash-token-guard.py` and `cbm-gate.py`.
4. MCP routing: Codebase Memory MCP first; context-mode for large outputs.
5. Optional integrations: RTK, Caveman, and Headroom are opt-in.
6. Verification: smoke tests, benchmarks, and metrics collection.
7. Adoption: warn first, block later.

## Why Node Runner?

Windows can run Python as `python` or `py`; Linux/macOS often use `python3`. Node is common in Claude Code environments through the npm/npx ecosystem. Passing paths as arguments avoids quoting failures when project paths or user directories contain spaces.

## Why Offline First?

Open-source users should be able to inspect and scaffold the project templates without trusting any remote installer. `TOKEN_STACK_ALLOW_REMOTE_INSTALL` defaults to `0`; remote installation attempts require explicit opt-in.

## Chinese Summary

架构核心是三层：先用策略声明行为边界，再用跨平台 runner 执行 hooks，最后用验证和 benchmark 证明效果。默认不联网、不 block、不启用 Headroom。
