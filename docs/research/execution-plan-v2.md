# AI Agent Claude Token Stack Execution Plan v2

This is the public, self-contained execution plan for the v0.1.0-rc line. The seed files are excluded from the npm package.

## P0 Correctness And Safety

- Cover `tree`, `ls -R`, `grep -R`, secret-like shell reads, and advisory test/build commands in hook smoke tests.
- Reject optional remote npm/npx specs unless they use exact semver pins such as `package@1.2.3` or `@scope/package@1.2.3`.
- Keep `.claude` and `.codex` dogfood hooks aligned with published templates.
- Make advanced unattended verification fail closed by default and expose `BEST_EFFORT=1` for explicit best-effort use.
- Treat `--dry-run` as no-write for verify and benchmark, with explicit `--no-write` support.

## P1 Native Usability

- Add `cts doctor --no-write` for Node/Python/Git/Bash/Claude detection, template presence, dogfood drift, and hook sample behavior.
- Add `npm run check:native` for PowerShell-friendly validation that avoids Bash.
- Keep Bash-backed `verify`, `benchmark`, `tools`, and `all` documented as Git Bash/WSL2/macOS/Linux commands.
- Keep machine-readable `--json` outputs for native diagnostics.

## P2 Security And CI

- Add `cts audit-hooks` for hook command surface, duplicate hook, missing hook target, and invalid mode checks.
- Reduce hook command shell surface by using the project runner command instead of inline `node -e` payloads.
- Set GitHub Actions `permissions: contents: read` by default.
- Run dependency review on pull requests.
- Use `npm ci` in the verify workflow.
- Leave publish provenance and SBOM generation for a future publish workflow.

## P3 Metrics And Evidence

- Add `schemas/metrics.schema.json`, `schemas/benchmark.config.schema.json`, and `schemas/case-study.schema.json`.
- Let benchmark tasks come from `.token-stack/benchmark.config.json` or `BENCHMARK_CONFIG`.
- Let `compare-metrics` follow configured tasks and auto-detect task JSON files.
- Preserve `synthetic-only` behavior as non-representative evidence.
- Add a case-study template that separates artifacts, limitations, and evidence type.

## P4 Context And Local History

- Add `cts pack-context` for budgeted, redacted context packs with manifests.
- Add `cts analyze-logs` for hook log aggregation.
- Add `cts ingest-usage` for local token/cost usage aggregation.
- Add `cts events` as a small append-only rollout event store.

## Release Acceptance

- `npm run check:native` passes on Windows PowerShell without Bash.
- Full `npm test` passes in Bash-capable environments.
- `npm pack --dry-run --json` contains only the allowlisted public surface.
- Synthetic benchmark still produces baseline/post artifacts.
- Synthetic-only comparison does not recommend block mode.
- Public docs label synthetic, real, and mixed evidence clearly.
