# Validation

Run:

```bash
npx claude-token-stack verify
```

or:

```bash
bash bin/verify-claude-token-stack.sh
```

## Checks

- Required files exist.
- `.claude/settings.json` parses as JSON.
- `run-python-hook.js` passes Node syntax check.
- `bash-token-guard.py` exits `0` in warn mode.
- `bash-token-guard.py` exits `2` in block mode.
- `cbm-gate.py` exits `0` in warn mode.
- `cbm-gate.py` exits `2` for `Grep` in block mode.
- Optional tools are reported as `PASS` or `WARN`, not silently assumed.

## PowerShell Hook Smoke

```powershell
$env:CLAUDE_PROJECT_DIR = (Get-Location).Path
$env:TOKEN_GUARD_MODE = "warn"
'{"tool_name":"Bash","tool_input":{"command":"tree"}}' | node .claude\hooks\run-python-hook.js .claude\hooks\bash-token-guard.py
```

## Expected Policy

Warn mode should not block work. Block mode should return exit code `2` for configured high-noise patterns.
