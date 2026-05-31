# Windows Notes

## Path Spaces

Windows user profiles can contain spaces, for example `C:\Users\Your Name`. Global Claude settings that reference `~/.claude/hooks/...` without quoting can fail under Git Bash.

Use:

```powershell
powershell -ExecutionPolicy Bypass -File .\bin\fix-windows-claude-settings.ps1
```

## Python Hooks

Project-level hooks must not execute `.py` files directly. The scaffolded settings use a shell-neutral Node command that reads `CLAUDE_PROJECT_DIR` from `process.env`, resolves `.claude/hooks/run-python-hook.js`, and passes the Python hook path as an argument.

## RTK

Do not force RTK auto-install under Windows or MINGW64. Record it as skipped and recommend one of:

- WSL2 with the Linux RTK path.
- Manual native `rtk.exe` installation and explicit `rtk` usage.
