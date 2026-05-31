# Project Charter

## Mission

Make Claude Code token governance practical, verifiable, and safe for real development teams.

中文摘要：本项目的目标是把 Claude Code 的上下文治理从提示词建议变成可审计、可验证、可回滚的工程工具链。

## Principles

1. Measurement before claims.
2. Warnings before enforcement.
3. Local-first and auditable scripts.
4. No business-code modifications by default.
5. Cross-platform by design: Windows, WSL2, Linux, and macOS.
6. Failure should degrade gracefully, not block the whole stack.
7. Remote installation must be explicit and disableable.

## Target Users

- Claude Code power users.
- Teams with large repositories.
- Developers hitting rate limits from long sessions, large logs, repeated file reads, or broad grep.
- Maintainers who want reproducible benchmark reports before adopting a token-saving stack.
