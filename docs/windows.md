# Windows Notes

## Path Spaces

Windows user profiles can contain spaces, for example `C:\Users\Your Name`. Global Claude settings that reference `~/.claude/hooks/...` without quoting can fail under Git Bash.

Use:

```powershell
powershell -ExecutionPolicy Bypass -File .\bin\fix-windows-claude-settings.ps1
```

## Python Hooks

Project-level hooks must not execute `.py` files directly. The scaffolded settings use a short Node runner command:

```powershell
node .claude/hooks/run-python-hook.js .claude/hooks/bash-token-guard.py; exit $LASTEXITCODE
```

Run the command from the project root. `run-python-hook.js` finds `python`, `py`, or `python3` on Windows and forwards the original hook payload to the Python hook.

Native PowerShell commands that do not require Bash:

```powershell
node .\bin\cts.js scaffold --target .
node .\bin\cts.js doctor --target . --no-write
node .\bin\cts.js audit-hooks --target . --no-write
node .\bin\cts.js pack-context --target . --json --no-write
node .\bin\cts.js collect-metrics .token-stack\reports
node .\bin\cts.js compare-metrics .token-stack\reports
node .\bin\cts.js validate-artifacts --target . --json --no-write
```

`doctor` detects PATH-visible `claude.cmd` wrappers on Windows. If Git Bash can find `claude` but PowerShell cannot, compare both shell PATH values before changing repository settings.

## RTK

Do not force RTK auto-install under Windows or MINGW64. Record it as skipped and recommend one of:

- WSL2 with the Linux RTK path.
- Manual native `rtk.exe` installation and explicit `rtk` usage.
