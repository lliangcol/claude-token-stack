# Contributing

Thanks for improving `claude-token-stack`. This project is security-sensitive developer tooling, so compatibility, rollback, and validation matter as much as feature behavior.

## Development Environment

Required:

- Node.js 18 or newer.
- Python 3, or Windows `py` launcher.
- Bash for shell-script validation.
- PowerShell for Windows helper validation.

Recommended:

- Git Bash or WSL2 on Windows when running Bash scripts directly.
- Claude CLI for integration testing, though unit tests must not require a logged-in Claude session.

Install dependencies:

```bash
npm install
```

## Test Commands

Run the full local gate:

```bash
npm test
```

Focused commands:

```bash
npm run check:node
npm run check:python
npm run check:shell
npm run check:templates
npm run test:hooks
node bin/cts.js scaffold --target .tmp/verify-fixture
node bin/cts.js verify --target .tmp/verify-fixture
```

Benchmark smoke:

```bash
node bin/cts.js benchmark synthetic-only --target .
node bin/cts.js collect-metrics .token-stack/reports
node bin/cts.js compare-metrics .token-stack/reports
```

## Commit Conventions

Use small, reviewable commits. Prefer these prefixes:

- `docs:`
- `fix:`
- `feat:`
- `test:`
- `chore:`
- `security:`

Every commit should preserve offline scaffold behavior and warn-first defaults unless the change explicitly updates governance policy.

## Pull Request Checklist

- Explain what changed and why.
- Include validation commands and results.
- Note whether behavior affects Windows, macOS, Linux, Git Bash, PowerShell, or WSL2.
- Confirm no secrets, private keys, `.env` content, production tokens, or customer data were added.
- Confirm no `curl | sh` or `dangerously-skip-permissions` examples were added.
- Confirm remote installer behavior remains opt-in.
- Confirm remote npm/npx installs stay pinned by default or require explicit unpinned opt-in.
- Confirm Headroom remains disabled by default.
- Update README/docs when user-facing behavior changes.
- Update `CHANGELOG.md` for release-facing changes.

## Compatibility Requirements

- Scaffold must work without remote network access.
- Hook execution must preserve warn/block exit codes.
- Windows paths with spaces must be handled as arguments, not interpolated shell strings.
- Git Bash/MINGW64 must not be required to auto-install RTK.
- Optional tools must fail into warnings, guidance, or fallback behavior rather than breaking scaffold.
- Tests must not read secrets or require production credentials.
