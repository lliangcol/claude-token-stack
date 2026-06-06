# Validation

Run:

```bash
npx claude-token-stack doctor --no-write
npx claude-token-stack audit-hooks --no-write
npx claude-token-stack verify
```

or:

```bash
bash bin/verify-claude-token-stack.sh
```

## Checks

- Native `doctor` checks Node, npm, Python, Git, Bash availability, template files, dogfood drift, and a no-write hook sample.
- `audit-hooks` checks hook command surface, duplicate token hooks, missing hook files, and invalid modes.
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

PowerShell users without Bash can still run:

```powershell
node .\bin\cts.js doctor --target . --no-write
node .\bin\cts.js audit-hooks --target . --no-write
node .\bin\cts.js pack-context --target . --json --no-write
```

## Expected Policy

Warn mode should not block work. Block mode should return exit code `2` for configured high-noise patterns.
