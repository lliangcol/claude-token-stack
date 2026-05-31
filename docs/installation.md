# Installation

This project supports scaffold-only adoption, full optional tool detection/install, offline operation, and no-remote-installer mode.

## Scaffold Only

Scaffold only copies project-local Claude Code governance files and merges settings. It does not install optional tools.

```bash
node bin/cts.js scaffold --target /path/to/repo
node bin/cts.js verify --target /path/to/repo
```

Inside a target repo after npm publication:

```bash
npx claude-token-stack scaffold
npx claude-token-stack verify
```

Files copied or merged include:

- `.claude/settings.json`
- `.claude/settings.local.unattended.example.json`
- `.claude/token-policy.md`
- `.claude/hooks/run-python-hook.js`
- `.claude/hooks/bash-token-guard.py`
- `.claude/hooks/cbm-gate.py`
- `.claude/output-styles/token-lean.md`
- `docs/claude-token-stack.md`
- `docs/claude-token-stack-rollback.md`

If any copied destination already exists and differs from the template, scaffold writes a sibling `.bak.<timestamp>` file before overwriting it.

## Full Install

Full install means scaffold plus optional tool detection/install:

```bash
TOKEN_STACK_ALLOW_REMOTE_INSTALL=1 \
CONTEXT_MODE_NPM_SPEC=context-mode@REVIEWED_VERSION \
CODEBASE_MEMORY_MCP_NPM_SPEC=codebase-memory-mcp@REVIEWED_VERSION \
node bin/cts.js all --target /path/to/repo
```

or from Bash:

```bash
TOKEN_STACK_ALLOW_REMOTE_INSTALL=1 \
CONTEXT_MODE_NPM_SPEC=context-mode@REVIEWED_VERSION \
CODEBASE_MEMORY_MCP_NPM_SPEC=codebase-memory-mcp@REVIEWED_VERSION \
bash bin/install-claude-token-stack.sh all
```

Optional tools are not required for the stack to function. The installer detects or attempts:

- `context-mode`
- `codebase-memory-mcp`
- `Caveman`
- `RTK`
- `Headroom`, only when `ENABLE_HEADROOM=1`

## Offline Install

Offline scaffold is the default:

```bash
TOKEN_STACK_ALLOW_REMOTE_INSTALL=0 node bin/cts.js scaffold --target /path/to/repo
node bin/cts.js verify --target /path/to/repo
```

`verify` may warn that optional tools are missing. Those warnings are expected in offline mode.

## No Remote Installer Mode

No remote installer mode is controlled by:

```bash
TOKEN_STACK_ALLOW_REMOTE_INSTALL=0
```

This mode prevents remote package installs and remote installer execution. It is the default and should be used in locked-down repositories. Tool installation commands become detection or guidance steps.

When `TOKEN_STACK_ALLOW_REMOTE_INSTALL=1` is enabled, package-manager installs remain opt-in and require pinned npm specs by default. Set `TOKEN_STACK_ALLOW_UNPINNED_REMOTE_INSTALL=1` only after accepting that supply-chain risk. Unpinned remote shell installers are still not executed by this project; they are downloaded, hashed for audit when possible, reported, and discarded.

## Windows Path Space Fix

Windows user profiles such as `C:\Users\Your Name` include spaces. Broken hook settings often come from unquoted paths in global Claude settings.

Run a dry run first:

```powershell
powershell -ExecutionPolicy Bypass -File .\bin\fix-windows-claude-settings.ps1 -DryRun
```

Then apply:

```powershell
powershell -ExecutionPolicy Bypass -File .\bin\fix-windows-claude-settings.ps1
```

The script backs up `$HOME\.claude\settings.json` before rewriting unquoted hook path patterns.

For project-local install from PowerShell, prefer:

```powershell
node .\bin\cts.js scaffold --target .
```

`verify`, `benchmark`, `install-tools`, and `all` use Bash scripts under the Node CLI. Run those from Git Bash/WSL2, or install Git Bash and keep paths quoted.

## Remove Optional Codegraph

`codegraph` can duplicate `codebase-memory-mcp` for code discovery. If both are installed and duplicate context is a problem, remove `codegraph`:

```powershell
powershell -ExecutionPolicy Bypass -File .\bin\remove-optional-codegraph.ps1 -DryRun
powershell -ExecutionPolicy Bypass -File .\bin\remove-optional-codegraph.ps1
```

Equivalent Claude CLI command:

```bash
claude mcp remove codegraph
```
