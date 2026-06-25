# Claude Token Stack Maintenance Status

Last updated: 2026-06-25

## Project Positioning

`claude-token-stack` is a repository-level context governance kit for Claude Code and AI coding agents. It is not a single prompt compressor, automatic permission bypass, hosted analytics service, or public savings claim generator.

The default posture is offline/local-first, warn-first, no default network access, no `curl | sh`, no `dangerously-skip-permissions`, no secret reads or uploads, and no block-mode recommendation without evidence.

## Safety And Evidence Boundaries

- Synthetic/demo evidence proves wiring only.
- Real savings claims require baseline/post metrics, retained local evidence, a case report, and explicit `evidence_type`.
- Any block recommendation requires verify report, metrics summary, hook logs, structured false-positive review, and representative evidence.
- Headroom is disabled by default and must remain explicit opt-in.
- Reports, fixtures, examples, docs, and test output must not include secrets, private paths, unredacted logs, complete source dumps, complete diffs, or private config.

## Key Directories

- `bin/`: CLI entrypoints, native diagnostics, validation, metrics, log, event, scaffold, preset, and benchmark wrappers.
- `templates/`: scaffolded `.claude`, hook, MCP, output-style, and repo docs templates.
- `schemas/`: local JSON schemas for metrics, metrics summary, benchmark config, case studies, and false-positive review.
- `docs/`: user docs, operations playbook, validation playbook, Windows guidance, tool notes, examples, research notes, and case-study material.
- `tests/smoke/`: smoke coverage for hooks, package surface, package install, JSON purity, Windows compatibility, scaffold idempotency, metrics, artifacts, README matrix, safety boundary, and schema fixtures.
- `examples/`: synthetic/demo repositories and path-space fixtures.

## Script Entrypoints

- `node bin/cts.js help`
- `node bin/cts.js scaffold --target <dir>`
- `node bin/cts.js doctor --target <dir> --json --no-write`
- `node bin/cts.js audit-hooks --target <dir> --json --no-write`
- `node bin/cts.js verify --target <dir>`
- `node bin/cts.js benchmark <phase> <mode> --target <dir>`
- `node bin/cts.js collect-metrics <report-root>`
- `node bin/cts.js compare-metrics <report-root>`
- `node bin/cts.js validate-artifacts --target <dir> --json --no-write`
- `node bin/cts.js analyze-logs --target <dir>`
- `node bin/cts.js ingest-usage --target <dir>`
- `node bin/cts.js events --target <dir> --json`
- `node bin/cts.js preset --target <dir> --name <soft|balanced|strict> --json --no-write`

## Fact Sources

- CLI and command dispatch: `bin/cts.js`
- Native diagnostics: `bin/doctor.js`, `bin/audit-hooks.js`
- Metrics and rollout recommendation: `bin/collect-metrics.py`, `bin/compare-metrics.py`
- Artifact/schema validation: `bin/schema-validator.js`, `bin/validate-artifacts.js`
- Hook behavior: `templates/.claude/hooks/bash-token-guard.py`, `templates/.claude/hooks/cbm-gate.py`, `templates/.claude/hooks/run-python-hook.js`
- Package surface: `package.json` `files` allowlist and `tests/smoke/package-surface.test.js`
- User-facing command matrix: `README.md`, `README_zh-CN.md`, `tests/smoke/readme-command-matrix.test.js`
- Validation and promotion rules: `docs/validation-playbook.md`, `docs/operations.md`

## Validation Commands

- `npm run check:native`
- `npm test`
- `npm pack --dry-run`
- `node tests/smoke/maintenance-status.test.js`
- `node bin/cts.js validate-artifacts --target . --json --no-write`

## Current Baseline Snapshot

- Branch: `main...origin/main`.
- Worktree: clean at the start of the second maintenance pass.
- `npm run check:native`: passed on 2026-06-25 after the first maintenance pass.
- `npm test`: passed on 2026-06-25 after the first maintenance pass.
- `npm pack --dry-run`: passed on 2026-06-25 after the first maintenance pass.
- Second pass targeted validation on 2026-06-25: `node tests/smoke/cli-json-purity.test.js` passed.
- Second pass full validation on 2026-06-25: `npm run check:native`, `npm test`, and `npm pack --dry-run` passed.
- Third pass package surface decision on 2026-06-25: maintenance status remains repo-only; package surface smoke now asserts it is absent from npm pack output.
- Third pass validation on 2026-06-25: `node tests/smoke/package-surface.test.js`, `node tests/smoke/cli-json-purity.test.js`, `node tests/smoke/maintenance-status.test.js`, `npm run check:native`, `npm test`, and `npm pack --dry-run` passed.
- Fourth pass MCP/tool doc boundary on 2026-06-25: Headroom and codebase-memory-mcp docs now preserve explicit opt-in, local-first, no hidden upload, and duplicate-context boundaries through `tests/smoke/safety-boundary.test.js`.
- Fifth pass README command sync on 2026-06-25: English and Chinese command behavior tables now have smoke coverage for row order and selected write/no-write markers.
- Native environment observed by `doctor`: Windows, Node v24.16.0, npm 11.13.0, Python 3.12.13, Bash 5.3.9, Claude Code 2.1.173.
- `doctor --json --no-write`: 27 PASS.
- `audit-hooks --json --no-write`: 10 PASS.

## Known Risks

- Even with a clean worktree, maintenance passes should stay small and avoid rewriting unrelated docs or fixtures.
- Bash-backed commands only reserve `--json` for CLI preflight failures; docs and tests must keep this distinction explicit.
- Block-mode wording can drift into overclaiming unless docs keep promotion evidence requirements visible.
- Windows/Git Bash/WSL2 path and quoting behavior remains a high-risk compatibility surface.
- Package `files` is explicit; new user-facing docs or runtime files can be accidentally omitted from npm packages unless covered by smoke checks.

## Backlog Candidates

1. Extend no-write/JSON purity coverage around remaining Bash-backed preflight cases if new Bash commands are added.
2. Keep command write/no-write markers synchronized in README/README_zh-CN when command behavior changes.
3. Re-check package whitelist whenever user-facing docs, schemas, or bin entrypoints are added.

## Selected Work Package

Implement this pass by strengthening `tests/smoke/readme-command-matrix.test.js` so the English and Chinese command behavior tables must keep the same command rows in the same order and preserve selected write/no-write markers for scaffold, verify, benchmark, validate-artifacts, and tools. This is a narrow documentation guard and does not change CLI behavior, schemas, package contents, or installer behavior.

## Next Candidate

After this pass, prioritize remaining Bash-backed preflight coverage only when new Bash-backed commands or options are added; otherwise re-check package whitelist when user-facing docs, schemas, or bin entrypoints change.
