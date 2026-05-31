# Claude Token Stack

This repository has been scaffolded with `claude-token-stack`.

## Defaults

- `TOKEN_GUARD_MODE=warn`
- `CBM_GATE_MODE=warn`
- `ENABLE_HEADROOM=0`
- `TOKEN_STACK_ALLOW_REMOTE_INSTALL=0`

## Expected Workflow

1. Use code discovery before broad file reads.
2. Keep large command output out of the main context.
3. Use focused tests and targeted logs.
4. Review hook logs before changing warn mode to block mode.

## Logs

Hook logs are written under:

```text
.claude/logs/
```

Runtime reports are written under:

```text
.token-stack/reports/
```
