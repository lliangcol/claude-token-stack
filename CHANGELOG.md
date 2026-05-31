# Changelog

All notable changes to this project will be documented in this file.

## [0.1.0] - 2026-05-31

### Added

- Initial open-source Claude Code token governance kit.
- Offline-first scaffold for `.claude` policy, hooks, output style, and rollback docs.
- Warn-first `bash-token-guard.py` and `cbm-gate.py` hook templates.
- Cross-platform `run-python-hook.js` launcher for Python hook execution.
- Node CLI entrypoint with scaffold, verify, benchmark, metrics collection, and comparison commands.
- Verification reports under `.token-stack/reports/`.
- Synthetic baseline/post benchmark workflow and `metrics-summary.json` block recommendation.
- Windows helper for global Claude settings hook-path quoting.
- Optional codegraph removal helper.
- Documentation for architecture, installation, validation, Windows compatibility, security model, MCP deduplication, contribution, and release governance.
- Codegraph duplicate detection in install and verify flows.
- Secret-like Bash read guard coverage for common shell readers.
- Release-candidate notes and a final-report example for adoption handoff.

### Security

- Remote installers are opt-in with `TOKEN_STACK_ALLOW_REMOTE_INSTALL=1`.
- Remote npm/npx installs require pinned specs by default unless explicitly allowed with `TOKEN_STACK_ALLOW_UNPINNED_REMOTE_INSTALL=1`.
- No `curl | sh` installer pattern.
- Headroom disabled by default.
- Default template denies common secret paths and asks before publish/apply commands.

### Validation

- Release-candidate checks cover `npm test`, `npm run lint`, `npm run verify`, shell syntax checks, Python compilation, Node syntax checks, scaffold dry-run, and hook smoke tests.
