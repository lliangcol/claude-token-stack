# Security Model

`claude-token-stack` is development tooling for Claude Code governance. It should be reviewed like any script that can influence agent behavior.

## No Secret Reads

The stack does not require reading secrets. The template settings deny common sensitive paths:

- `.env`
- `.env.*`
- `*.pem`
- `*.key`
- `id_rsa`
- paths containing `secret`
- paths containing `private_key`

**Limitation:** These glob patterns are case-sensitive on Linux and macOS. Files named `SECRET_KEY`, `PRIVATE_KEY`, or `MySecret.json` are not covered. Extend the deny list for your project's naming conventions if needed.

**Note:** The deny list covers `Read` permissions. `Write` to sensitive paths is not denied by default. Projects handling sensitive files should add corresponding `Write` deny entries.

The Bash guard also warns or blocks common shell reads of secret-like paths, such as `cat .env`, `less *.pem`, or `grep secret ...`, depending on `TOKEN_GUARD_MODE`. This is a guardrail, not a full DLP engine; extend both permissions and hook rules for project-specific naming conventions.

Do not paste secrets into issues, benchmark prompts, reports, or logs. Do not upload credentials, private keys, production tokens, customer data, or proprietary logs when reporting bugs.

## Permissions deny / ask

The scaffolded `.claude/settings.json` uses `permissions.deny` for sensitive reads and dangerous shell patterns such as `curl * | sh`.

It uses `permissions.ask` for operations that publish or mutate external systems:

- `git push`
- package publishing
- Docker push
- `kubectl apply`
- `terraform apply`

Projects should extend these lists for their own production systems.

## No dangerously skip permissions

Do not use or recommend `dangerously-skip-permissions` with this stack. The project is designed around explicit policy, warn-first hooks, and reviewable permission boundaries.

## No curl | sh

The project does not use `curl | sh` or `wget | sh`. Remote shell installer support, when explicitly enabled, downloads to a temporary file, prints a SHA256 hash when tooling exists, reports the path for audit, and then discards the file without executing it.

Remote installation remains opt-in:

```bash
TOKEN_STACK_ALLOW_REMOTE_INSTALL=1
```

Default behavior is:

```bash
TOKEN_STACK_ALLOW_REMOTE_INSTALL=0
```

## Remote Installer Safety Strategy

Remote installer mode is for users who accept the dependency risk. Remote npm/npx installs require pinned package specs by default, for example `CONTEXT_MODE_NPM_SPEC=context-mode@REVIEWED_VERSION`. Set `TOKEN_STACK_ALLOW_UNPINNED_REMOTE_INSTALL=1` only after accepting unpinned package resolution risk. Before enabling remote installs:

1. Review the installer script and optional tool sources.
2. Prefer pinned package versions where your organization requires them.
3. Run in a disposable environment first.
4. Keep `.token-stack/reports/install-report.json`.
5. Confirm rollback commands for every optional tool.

On Windows-like shells, RTK remote auto-install is skipped and manual/WSL2 guidance is used.

## Headroom Default Disabled

Headroom is disabled by default:

```bash
ENABLE_HEADROOM=0
```

Enable it only after the team accepts its setup, data handling, measurement method, and rollback plan:

```bash
ENABLE_HEADROOM=1
```

Verification treats disabled Headroom as a pass because it is not part of the required baseline.
