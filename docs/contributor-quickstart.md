# Contributor Quickstart

This guide is for contributors opening `claude-token-stack` for the first time.
It explains the repository layout, the test commands, and the safest places to
change docs, templates, and hooks.

## Code Structure

`claude-token-stack` is a CommonJS Node package that scaffolds Claude Code token
governance files into another repository. Most behavior lives in scripts and
templates, not in a compiled library.

Key paths:

- `bin/`: package CLI and helper scripts.
  - `bin/cts.js` is the npm binary behind `claude-token-stack` and `cts`.
  - `bin/install-claude-token-stack.sh`, `bin/verify-claude-token-stack.sh`,
    and `bin/run-token-benchmark.sh` are shell entrypoints.
  - `bin/*.py` and `bin/*.ps1` support metrics and Windows compatibility.
- `templates/`: files copied or merged into a target project during scaffold.
  This is the main source of truth for generated `.claude/`, `.mcp`, and docs
  content.
- `templates/.claude/hooks/`: published hook runtime files.
  - `run-python-hook.js` normalizes Python execution across platforms.
  - `bash-token-guard.py` handles Bash token-risk advisories and optional
    blocking.
  - `cbm-gate.py` guides broad source reads toward Codebase Memory first.
- `.claude/`: repo-local Claude Code configuration used while developing this
  repository. Keep it aligned with templates when relevant, but do not treat it
  as the published source by default.
- `docs/`: public documentation for users and operators.
- `prompts/`: build, migration, reviewer, release, and agent prompts used to
  maintain the project.
- `tests/smoke/`: Node smoke tests for hooks, package surface, package install,
  CLI output, Windows behavior, scaffold behavior, metrics, artifact
  validation, README command coverage, schema fixtures, and safety constraints.
- `benchmarks/`: benchmark runbooks and measurement guidance.
- `src/`: reserved for future library code. It is intentionally empty in
  `v0.1.0`.
- `.github/`: CI workflows and issue or PR templates.

The package publish surface is controlled by `package.json` `files`. If you add
a public template, script, or doc that must ship in npm, confirm it is included
there. `npm run test:package-surface` runs `npm pack --dry-run --json` and
checks the actual dry-run file list for required public files and forbidden
local-only paths. `npm run test:package-install` creates a local tarball in a
temporary directory, installs it into a source-free consumer project with
`--offline --ignore-scripts --no-audit --no-fund`, and runs installed `cts`
commands without writing to the target.

## Run Tests

Install dependencies first:

```bash
npm install
```

Run the full local gate:

```bash
npm test
```

`npm test` runs syntax checks, template checks, hook smoke tests,
package-surface smoke tests, package-install smoke tests, CLI JSON purity smoke
tests, Windows compatibility smoke tests, scaffold smoke tests, metrics smoke
tests, artifact-validation smoke tests, README command-matrix smoke tests,
safety-boundary smoke tests, schema fixture smoke tests, scaffold, and verify.

Focused commands are useful while iterating:

```bash
npm run lint
npm run check:node
npm run check:python
npm run check:shell
npm run check:templates
npm run test:hooks
npm run test:package-surface
npm run test:package-install
npm run test:cli-json
npm run test:windows
npm run test:scaffold
npm run test:metrics
npm run test:artifacts
npm run test:readme
npm run test:safety-boundary
npm run test:schema
```

To exercise scaffold and verify directly:

```bash
node bin/cts.js scaffold --target .tmp/verify-fixture
node bin/cts.js verify --target .tmp/verify-fixture
```

Benchmark smoke commands:

```bash
node bin/cts.js benchmark synthetic-only --target .
node bin/cts.js collect-metrics .token-stack/reports
node bin/cts.js compare-metrics .token-stack/reports
node bin/cts.js validate-artifacts --target . --json --no-write
```

Notes:

- Node.js 18 or newer is required.
- Python 3, or the Windows `py` launcher, is required for hook checks.
- Bash is required for shell-script validation.
- PowerShell is used by Windows compatibility validation when available.
- Tests must not require production credentials, secrets, or a logged-in Claude
  session.

## Change Docs

Use `docs/` for public user-facing documentation.

Common doc targets:

- `docs/getting-started.md`: installation and first scaffold workflow.
- `docs/installation.md`: install details.
- `docs/validation.md` and `docs/validation-playbook.md`: verification flow.
- `docs/security-model.md`: security-sensitive behavior and defaults.
- `docs/windows.md` and `docs/windows-compatibility.md`: Windows-specific
  behavior.
- `docs/tools/`: optional tool documentation.
- `docs/research/`: public research summaries.

When changing docs:

- Keep examples offline-first unless the doc is explicitly about remote
  opt-in behavior.
- Do not add `curl | sh` examples.
- Do not show `dangerously-skip-permissions` as a recommended workflow.
- Keep `tests/smoke/safety-boundary.test.js` checks green when
  changing executable docs or installer scripts.
- Keep `tests/smoke/readme-command-matrix.test.js` green when changing CLI
  command names, write behavior, JSON support, or failure codes.
- Keep Headroom disabled by default unless the governance policy changes.
- Update `README.md` when a change affects the main user path.
- Update `CHANGELOG.md` when a change is release-facing.

If a doc is copied into scaffolded projects, change the matching file under
`templates/docs/` instead of only changing `docs/`.

## Change Templates

Templates are the files users receive when they run scaffold.

Important paths:

- `templates/.claude/settings.json`
- `templates/.claude/settings.local.unattended.example.json`
- `templates/.claude/token-policy.md`
- `templates/.claude/hooks/*.js`
- `templates/.claude/hooks/*.py`
- `templates/.claude/output-styles/token-lean.md`
- `templates/.mcp.local.example.json`
- `templates/docs/*.md`

When changing templates:

- Run `npm run check:templates`.
- Run `node bin/cts.js scaffold --target .tmp/verify-fixture`.
- Run `node bin/cts.js verify --target .tmp/verify-fixture`.
- Check whether `package.json` `files` includes any new template path.
- Preserve backup-before-overwrite behavior for scaffolded files.
- Preserve idempotency: running scaffold twice should not duplicate token hooks.
- Keep remote installs opt-in through explicit environment variables.

Template changes often need smoke-test updates in `tests/smoke/scaffold.test.js`
and, when the published package surface changes,
`tests/smoke/package-surface.test.js` or
`tests/smoke/package-install.test.js`.

## Change Hooks

Published hooks live under `templates/.claude/hooks/`.

Hook responsibilities:

- `run-python-hook.js`: finds and runs Python consistently across Windows,
  macOS, and Linux.
- `bash-token-guard.py`: inspects Bash tool commands, writes token-guard logs,
  warns by default, and can block high-risk commands when configured.
- `cbm-gate.py`: inspects broad source-reading tool calls, writes cbm-gate logs,
  warns by default, and can block configured tools.

When changing hooks:

- Keep warn-first behavior as the default.
- Preserve block exit code behavior; blocking hooks should exit with code `2`.
- Pass paths as arguments instead of interpolating shell strings.
- Handle Windows paths with spaces.
- Do not read secrets or require production credentials in tests.
- Update `templates/.claude/settings.json` if hook invocation changes.
- If repo-local `.claude/hooks/` copies are meant to match the published hooks,
  update both locations intentionally.

Run at least:

```bash
npm run check:node
npm run check:python
npm run test:hooks
```

For scaffold or settings changes, also run:

```bash
npm run test:scaffold
npm run test:package-surface
node bin/cts.js scaffold --target .tmp/verify-fixture
node bin/cts.js verify --target .tmp/verify-fixture
```

## Before Opening a PR

Use small, reviewable commits. Preferred prefixes are:

- `docs:`
- `fix:`
- `feat:`
- `test:`
- `chore:`
- `security:`

Before submitting:

- Run `npm test`, or list the focused commands you ran and why full validation
  was not possible.
- Mention whether the change affects Windows, macOS, Linux, Git Bash,
  PowerShell, or WSL2.
- Confirm no secrets, private keys, `.env` values, production tokens, or
  customer data were added.
- Confirm scaffold remains offline-first and remote installation remains
  explicit opt-in.
- Confirm npm or npx remote installs remain pinned by default, or require an
  explicit unpinned opt-in.
