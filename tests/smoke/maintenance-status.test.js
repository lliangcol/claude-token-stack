#!/usr/bin/env node
const assert = require("assert");
const fs = require("fs");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..", "..");
const statusPath = path.join(repoRoot, "docs", "claude-token-stack-maintenance-status.md");
const status = fs.readFileSync(statusPath, "utf8");

for (const requiredHeading of [
  "# Claude Token Stack Maintenance Status",
  "## Project Positioning",
  "## Safety And Evidence Boundaries",
  "## Key Directories",
  "## Script Entrypoints",
  "## Fact Sources",
  "## Validation Commands",
  "## Known Risks",
  "## Backlog Candidates",
  "## Selected Work Package",
  "## Next Candidate",
]) {
  assert.ok(status.includes(requiredHeading), `maintenance status should include ${requiredHeading}`);
}

for (const requiredBoundary of [
  "offline/local-first",
  "warn-first",
  "no `curl | sh`",
  "no `dangerously-skip-permissions`",
  "no secret reads or uploads",
  "Synthetic/demo evidence proves wiring only.",
  "Real savings claims require baseline/post metrics",
  "Any block recommendation requires verify report, metrics summary, hook logs, structured false-positive review, and representative evidence.",
  "Headroom is disabled by default",
]) {
  assert.ok(status.includes(requiredBoundary), `maintenance status should preserve boundary: ${requiredBoundary}`);
}

for (const validationCommand of [
  "npm run check:native",
  "npm test",
  "npm pack --dry-run",
  "node tests/smoke/maintenance-status.test.js",
  "node bin/cts.js validate-artifacts --target . --json --no-write",
]) {
  assert.ok(status.includes(validationCommand), `maintenance status should include validation command: ${validationCommand}`);
}

for (const factSource of [
  "bin/cts.js",
  "bin/compare-metrics.py",
  "bin/validate-artifacts.js",
  "templates/.claude/hooks/bash-token-guard.py",
  "templates/.claude/hooks/cbm-gate.py",
  "package.json",
  "README.md",
  "README_zh-CN.md",
]) {
  assert.ok(status.includes(factSource), `maintenance status should name fact source: ${factSource}`);
}

for (const recentGuard of [
  "package surface smoke now expands the `package.json` files allowlist and compares it with real `npm pack --dry-run --json` output",
  "release checklist safety wording is protected by `tests/smoke/safety-boundary.test.js`",
  "`docs/release/` remains repo-only and absent from the npm package",
]) {
  assert.ok(status.includes(recentGuard), `maintenance status should record recent guard: ${recentGuard}`);
}

console.log("maintenance status smoke tests passed");
