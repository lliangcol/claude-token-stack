# Windows Compatibility

Windows is a first-class target, but Claude Code hook execution crosses Node, Python, Bash, PowerShell, Git Bash, and WSL2 boundaries. Keep those boundaries explicit.

## User Paths With Spaces

Windows profiles often contain spaces, for example:

```text
C:\Users\Your Name
```

Unquoted hook paths can break Claude settings. Always pass paths as quoted arguments and prefer the Node CLI:

```powershell
node .\bin\cts.js scaffold --target "D:\Work\Projects\my repo"
```

The Node CLI runs `verify`, `benchmark`, `install-tools`, and `all` through Bash scripts. From PowerShell, install Git Bash or use WSL2 for those commands. `scaffold`, `collect-metrics`, and `compare-metrics` do not require Bash.

## PowerShell Is Not Bash

PowerShell does not support Bash heredoc syntax:

```bash
python - <<'PY'
print("hello")
PY
```

Run Bash scripts in Git Bash or WSL2. From PowerShell, prefer `node .\bin\cts.js ...` or native `.ps1` scripts.

## Git Bash / MINGW64 RTK Behavior

Git Bash/MINGW64 can run scaffold and verification. RTK auto-install is skipped on Windows-like environments:

- native Windows
- MINGW64
- MSYS
- Cygwin

Use WSL2 or manual RTK installation when RTK is required. The rest of the stack continues to work without RTK.

## run-python-hook.js

`.claude/hooks/run-python-hook.js` is the hook launcher used by the scaffolded Claude settings. It:

- Resolves the Python hook path.
- Tries `python`, `py`, and `python3` on Windows.
- Tries `python3` and `python` on Unix-like systems.
- Uses `spawnSync(..., shell: false)` to avoid shell quoting bugs.
- Preserves the hook exit code so warn/block behavior works.

This runner is why project hooks can be configured as Node commands even when the underlying policy logic is Python.

## fix-windows-claude-settings.ps1

`bin/fix-windows-claude-settings.ps1` repairs common unquoted hook-path patterns in global Claude settings:

```powershell
powershell -ExecutionPolicy Bypass -File .\bin\fix-windows-claude-settings.ps1 -DryRun
powershell -ExecutionPolicy Bypass -File .\bin\fix-windows-claude-settings.ps1
```

It reads `$HOME\.claude\settings.json` as JSON, creates a timestamped backup, and quotes matching `~/.claude/hooks/...` or `~\.claude\hooks\...` patterns inside `command` fields.

Use dry run first. If global settings are already valid, the script may have nothing to change.
