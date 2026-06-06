# Security Policy

## Reporting Security Issues

Please report security issues privately before opening a public issue. If the repository has GitHub private vulnerability reporting enabled, use that channel. Otherwise contact the maintainers through the project owner channel and include:

- A short description of the issue.
- Affected file, command, or workflow.
- Reproduction steps that do not include secrets.
- Expected impact.
- Suggested fix, if known.

Do not include credentials, private keys, `.env` content, production tokens, customer data, or proprietary logs in reports.

## Supported Scope

This project is development tooling for Claude Code token governance. It provides scaffolding, hooks, optional installer checks, validation, benchmark scripts, and documentation.

Security issues in third-party optional tools should also be reported upstream to those projects.

## Secret Handling

This project does not support uploading or processing secrets. The default template denies common sensitive reads, including `.env`, PEM/key files, `id_rsa`, and paths containing `secret` or `private_key`.

If a benchmark or bug reproduction requires sample data, use synthetic data.

## Installer Risk

The default mode is offline/local scaffold. Remote optional installer behavior is disabled unless the user sets:

```bash
TOKEN_STACK_ALLOW_REMOTE_INSTALL=1
```

The project does not use `curl | sh`. Remote shell installers are not executed by this project. When remote installer mode is enabled for a shell-script installer, the script is downloaded to a temporary file, hashed when SHA tooling is available, reported for audit, and then discarded. Users who choose to run third-party installers must do so manually after reviewing and pinning them according to their own supply-chain policy.

Package-manager installs, such as optional `npm install -g ...` integrations, remain opt-in under `TOKEN_STACK_ALLOW_REMOTE_INSTALL=1` and require exact semver npm specs by default, for example `context-mode@1.2.3` or `@scope/package@1.2.3`. Tags and ranges such as `@latest`, `^1.2.3`, or `1.x` are treated as unpinned. Users can set `TOKEN_STACK_ALLOW_UNPINNED_REMOTE_INSTALL=1` to allow unpinned package resolution, but should treat that as a supply-chain risk and review optional tool sources before enabling it.

Headroom is disabled by default and must be explicitly enabled with `ENABLE_HEADROOM=1`.

## Permission Model

The scaffold uses Claude settings with `permissions.deny` for sensitive reads and dangerous shell patterns, and `permissions.ask` for publishing or external mutation commands.

Do not use `dangerously-skip-permissions` with this project.
