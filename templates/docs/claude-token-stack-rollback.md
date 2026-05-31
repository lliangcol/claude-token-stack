# Claude Token Stack Rollback

## Fast Disable

```bash
export TOKEN_GUARD_MODE=off
export CBM_GATE_MODE=off
```

## Disable Project Hooks

```bash
mv .claude/settings.json .claude/settings.json.disabled
```

or restore backup:

```bash
cp .claude/settings.json.bak.<timestamp> .claude/settings.json
```

If scaffold overwrote an existing copied file, restore the sibling backup before removing the stack files:

```bash
cp .claude/token-policy.md.bak.<timestamp> .claude/token-policy.md
```

## Remove MCP Servers

```bash
claude mcp remove context-mode
claude mcp remove codebase-memory-mcp
claude mcp remove codegraph
```

## Remove Scaffold Files

```bash
rm -f .claude/token-policy.md
rm -f .claude/hooks/run-python-hook.js
rm -f .claude/hooks/bash-token-guard.py
rm -f .claude/hooks/cbm-gate.py
rm -f .claude/output-styles/token-lean.md
rm -f docs/claude-token-stack.md
rm -f docs/claude-token-stack-rollback.md
rm -rf .token-stack/
```
