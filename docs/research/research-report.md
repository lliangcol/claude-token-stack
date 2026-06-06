# Claude Token Stack Research Report

This is the public, self-contained research report for the v0.1.0-rc line. It summarizes current implementation risks, missing product surfaces, stability concerns, and implementation ideas borrowed from adjacent high-signal open-source tools. Internal seed files are excluded from the npm package.

## Core Finding

Most avoidable token waste happens before content reaches the model: unbounded repository discovery, full-file reads before symbol discovery, raw logs, duplicate MCP outputs, and generated/vendor files entering the prompt. `claude-token-stack` should therefore behave as a repo-local governance layer, not as a single prompt compression command.

The project must not advertise fixed savings. Synthetic evidence can prove wiring and regression safety, but real savings claims require representative baseline/post artifacts and clearly labeled evidence type.

## Confirmed Risk Themes

- Hidden rule gaps are high impact. A small regex boundary error can leave common commands such as `ls -R` and `grep -R` unguarded unless covered by smoke tests.
- Remote package install safety must be exact. `package@latest` is not a pinned spec for governance tooling; optional npm/npx installs should require exact semver by default.
- Native Windows usability matters. PowerShell users need diagnostics and helper commands that do not require Bash before they can adopt the Bash-backed verify/benchmark flows.
- Dry-run must be trustworthy. Validation and benchmark dry-runs should not write target repository artifacts.
- Advanced unattended flows must return failing exit codes by default. Best-effort behavior should be explicit.
- Template and dogfood drift is a release risk. Published templates, `.claude`, and `.codex` copies should stay comparable by native diagnostics.
- Metrics must distinguish synthetic, real, and mixed evidence. Synthetic-only evidence should never recommend block-mode rollout.

## Missing Product Surfaces

- `doctor`: native environment and dogfood diagnostics.
- `audit-hooks`: hook command and settings audit.
- `pack-context`: budgeted, redacted repository context pack with manifest.
- `analyze-logs`: hook log summary for violations, advisories, modes, and tool patterns.
- `ingest-usage`: local token/cost usage ingestion from reports and JSONL outputs.
- `events`: append-only local event stream for rollout notes and later summaries.
- Configurable benchmark task list and JSON schemas for benchmark config, metrics, and case studies.

## External Project Patterns

- Repomix-style context packs are useful when they include manifests, budget limits, ignore rules, and redaction.
- Aider-style repo maps suggest a future symbol-aware context pack, but a deterministic file-budget pack is the safer first step.
- Cline-style modes and checkpoints map well to warn/balanced/strict rollout presets and rollback evidence.
- OpenCode-style local sessions and events justify a small local event store before any hosted dashboard.
- Token Tracker-style local-first usage dashboards justify `ingest-usage` before remote analytics.
- Volt-style immutable context history suggests keeping raw events append-only and regenerating summaries from them.

## Implementation Direction

The v0.1.0-rc direction is:

1. Keep default mode warn-first and local-first.
2. Treat Bash and Claude CLI absence as warnings in native diagnostics.
3. Require exact semver pins for optional npm/npx installs unless an explicit unpinned override is set.
4. Label evidence as `synthetic`, `real`, or `mixed`.
5. Keep generated reports in `.token-stack/` and make `--no-write` avoid target repository writes.
6. Use JSON schemas and examples for externally consumed artifacts.
7. Harden CI with least-privilege permissions and dependency review.

## Evidence Bar

Synthetic evidence can support:

- hook behavior smoke tests;
- package and scaffold regression tests;
- baseline/post report wiring;
- documentation examples.

Representative evidence is required for:

- public savings claims;
- default block-mode recommendations;
- team rollout case studies;
- comparisons against other tools.
