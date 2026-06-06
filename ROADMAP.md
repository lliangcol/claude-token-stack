# Roadmap

## v0.1 MVP

- Project-level `.claude/settings.json` template.
- Cross-platform `run-python-hook.js`.
- Bash token guard.
- Codebase Memory gate.
- Offline-first scaffold.
- Verification script.
- Synthetic benchmark.
- Native `doctor` and `audit-hooks` diagnostics.
- No-write verification and benchmark dry-runs.
- Configurable benchmark task list.
- Context pack, log analysis, usage ingestion, and local event helpers.
- JSON schemas for metrics, benchmark config, and case studies.
- Windows path-space repair script.
- GitHub Actions smoke checks.

## v0.2 Observability

- False-positive review workflow built on `cts analyze-logs`.
- Lightweight local HTML report for metrics, logs, usage, and events.
- Schema validation command for metrics and case-study artifacts.
- Import adapters for additional local Claude Code usage outputs.

## v0.3 Tooling Integrations

- Stronger context-mode verification.
- RTK WSL2 and native Windows guidance.
- Codebase Memory MCP index health checks.
- MCP deduplication helper.

## v0.4 Team Adoption

- Policy presets: soft, balanced, strict.
- GitHub Action for consuming repositories.
- More example reports from real projects.
- Rollout checklist generated from local `cts events` history.

## v1.0 Stable

- Clear compatibility matrix.
- Security review checklist.
- Public documentation site.
- Stable npm package API.
