#!/usr/bin/env node
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const repoRoot = path.resolve(__dirname, "..", "..");

const shellScript = fs.readFileSync(path.join(repoRoot, "bin", "install-claude-token-stack.sh"), "utf8");
assert.ok(!/sh\s+"\$tmp"/.test(shellScript), "remote shell installer must not execute downloaded temp scripts");
assert.match(shellScript, /downloaded for audit only/, "remote shell installer should report audit-only behavior");
assert.match(shellScript, /TOKEN_STACK_ALLOW_UNPINNED_REMOTE_INSTALL/, "remote npm installs should expose an explicit unpinned opt-in");
assert.match(shellScript, /run_optional_npm_global/, "remote npm installs should route through the pinning guard");
assert.ok(shellScript.includes("[0-9]+\\.[0-9]+\\.[0-9]+"), "remote npm pinning should require exact semver, not package@latest");
assert.match(shellScript, /backup_file "\$dst"/, "shell scaffold should backup existing template destinations before overwrite");
assert.match(shellScript, /configure_codebase_memory_mcp/, "remote codebase-memory-mcp install should run MCP setup when command becomes available");
assert.match(shellScript, /mcp-local-smoke\.md/, "shell scaffold should include local MCP smoke docs");
assert.match(shellScript, /context-pack-template\.md/, "shell scaffold should include context pack template");
assert.ok(
  !/verify-claude-token-stack\.sh"\s*\|\|\s*record/.test(shellScript),
  "all mode must not swallow verify failures"
);
assert.match(shellScript, /exit 1/, "all mode should exit non-zero when verify fails");

const packageJson = JSON.parse(fs.readFileSync(path.join(repoRoot, "package.json"), "utf8"));
assert.strictEqual(packageJson.homepage, "https://github.com/lliangcol/claude-token-stack#readme");
assert.deepStrictEqual(packageJson.repository, {
  type: "git",
  url: "git+https://github.com/lliangcol/claude-token-stack.git",
});
assert.deepStrictEqual(packageJson.bugs, {
  url: "https://github.com/lliangcol/claude-token-stack/issues",
});
assert.ok(packageJson.files.includes("templates/.mcp.local.example.json"), "package should include local MCP template");
assert.ok(!packageJson.files.includes("docs/**/*.md"), "package docs surface should be explicitly allowlisted");
assert.ok(
  !packageJson.files.some((entry) => entry.startsWith("docs/release/")),
  "GitHub release-management docs should stay out of the npm package"
);
assert.ok(packageJson.files.includes("README_zh-CN.md"), "package should include Chinese README");
assert.ok(packageJson.files.includes("examples/README.md"), "package should include examples index");
assert.ok(packageJson.files.includes("docs/case-studies/synthetic-demo.md"), "package should include npm-user case study docs");
assert.ok(packageJson.files.includes("docs/case-studies/template.md"), "package should include case study template");
assert.ok(packageJson.files.includes("docs/operations.md"), "package should include operations playbook");
assert.ok(packageJson.files.includes("docs/examples/benchmark.config.example.json"), "package should include benchmark config example");
assert.ok(packageJson.files.includes("schemas/*.json"), "package should include JSON schemas");
assert.ok(
  packageJson.files.includes("examples/demo-windows-path-space/scripts/quote-paths.ps1"),
  "package should include static demo files"
);

const packResult = spawnSync("npm", ["pack", "--dry-run", "--json"], {
  cwd: repoRoot,
  encoding: "utf8",
});
assert.strictEqual(
  packResult.status,
  0,
  `npm pack --dry-run --json should pass\nerror:\n${packResult.error}\nstdout:\n${packResult.stdout}\nstderr:\n${packResult.stderr}`
);
const packJson = JSON.parse(packResult.stdout);
assert.ok(Array.isArray(packJson) && packJson.length === 1, "npm pack JSON should contain one package entry");
const packedPaths = new Set(packJson[0].files.map((entry) => entry.path));
for (const requiredPackedPath of [
  "bin/cts.js",
  "bin/validate-artifacts.js",
  "schemas/metrics-summary.schema.json",
  "schemas/false-positive-review.schema.json",
  "templates/.claude/hooks/run-python-hook.js",
  "templates/.mcp.local.example.json",
  "docs/operations.md",
  "docs/case-studies/template.md",
  "docs/examples/benchmark.config.example.json",
  "examples/demo-windows-path-space/scripts/quote-paths.ps1",
  "README_zh-CN.md",
]) {
  assert.ok(packedPaths.has(requiredPackedPath), `npm pack output should include ${requiredPackedPath}`);
}
for (const forbiddenPrefix of [
  ".claude/",
  ".codex/",
  ".github/",
  ".token-stack/",
  "docs/release/",
  "node_modules/",
  "tests/",
]) {
  assert.ok(
    ![...packedPaths].some((entry) => entry.startsWith(forbiddenPrefix)),
    `npm pack output should not include ${forbiddenPrefix}`
  );
}
for (const forbiddenPath of [
  "package-lock.json",
  "tests/smoke/package-surface.test.js",
  ".env",
]) {
  assert.ok(!packedPaths.has(forbiddenPath), `npm pack output should not include ${forbiddenPath}`);
}

const unattendedRunner = fs.readFileSync(path.join(repoRoot, "bin", "cts-run-agent-unattended.sh"), "utf8");
const benchmarkRunner = fs.readFileSync(path.join(repoRoot, "bin", "run-token-benchmark.sh"), "utf8");
assert.match(unattendedRunner, /Refusing unsafe PERMISSION_MODE/, "advanced runner should reject unsafe permission modes");
assert.ok(!/verify-claude-token-stack\.sh"\s*\|\|\s*true/.test(unattendedRunner), "advanced runner must not swallow final verify failures by default");
assert.match(unattendedRunner, /BEST_EFFORT/, "advanced runner should expose explicit best-effort opt-in");
assert.match(benchmarkRunner, /Refusing unsafe PERMISSION_MODE/, "benchmark runner should reject unsafe permission modes");
assert.match(benchmarkRunner, /BENCHMARK_CONFIG/, "benchmark runner should support configurable tasks");
assert.match(benchmarkRunner, /tr -d '\\r'/, "benchmark runner should strip CR from task ids before building report paths");
assert.match(benchmarkRunner, /setdefault\("evidence_type", "real"\)/, "ai-enabled benchmark records should label real evidence");

const publicResearchPlan = fs.readFileSync(path.join(repoRoot, "docs", "research", "execution-plan-v2.md"), "utf8");
const publicResearchReport = fs.readFileSync(path.join(repoRoot, "docs", "research", "research-report.md"), "utf8");
assert.ok(!publicResearchPlan.includes("_seed/"), "public execution plan summary should not link to unpublished seed files");
assert.ok(!publicResearchReport.includes("_seed/"), "public research summary should not link to unpublished seed files");
const readmeEn = fs.readFileSync(path.join(repoRoot, "README.md"), "utf8");
const readmeZh = fs.readFileSync(path.join(repoRoot, "README_zh-CN.md"), "utf8");
assert.match(readmeEn, /artifact-validation\.html/, "English README should document local HTML artifact validation report output");
assert.match(readmeZh, /artifact-validation\.html/, "Chinese README should document local HTML artifact validation report output");

const templateRunner = fs.readFileSync(path.join(repoRoot, "templates", ".claude", "hooks", "run-python-hook.js"), "utf8");
const projectRunnerPath = path.join(repoRoot, ".claude", "hooks", "run-python-hook.js");
if (fs.existsSync(projectRunnerPath)) {
  assert.strictEqual(
    fs.readFileSync(projectRunnerPath, "utf8"),
    templateRunner,
    "repo-local runner should match the published template runner"
  );
}

console.log("package surface smoke tests passed");
