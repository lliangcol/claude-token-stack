# Getting Started

`claude-token-stack` scaffolds Claude Code token governance files into a target repository.

中文摘要：先本地 scaffold，再验证；默认不联网、不启用 Headroom、不切 block。

## Install

```bash
npm install -D claude-token-stack
```

or run without installing:

```bash
npx claude-token-stack scaffold
```

## Scaffold

```bash
npx claude-token-stack scaffold
```

This creates or merges:

- `.claude/settings.json`
- `.claude/token-policy.md`
- `.claude/hooks/run-python-hook.js`
- `.claude/hooks/bash-token-guard.py`
- `.claude/hooks/cbm-gate.py`
- `.claude/output-styles/token-lean.md`
- `docs/claude-token-stack.md`
- `docs/claude-token-stack-rollback.md`

## Remote Tools

Remote install attempts are disabled by default:

```bash
TOKEN_STACK_ALLOW_REMOTE_INSTALL=0
```

To opt in:

```bash
TOKEN_STACK_ALLOW_REMOTE_INSTALL=1 \
CONTEXT_MODE_NPM_SPEC=context-mode@REVIEWED_VERSION \
npx claude-token-stack install-tools
```

Use reviewed `package@version` specs for optional remote npm/npx installs. Unpinned installs require `TOKEN_STACK_ALLOW_UNPINNED_REMOTE_INSTALL=1`.

## Modes

Recommended defaults:

```bash
export TOKEN_GUARD_MODE=warn
export CBM_GATE_MODE=warn
export ENABLE_HEADROOM=0
```

Switch to block only after observing low false positives.
