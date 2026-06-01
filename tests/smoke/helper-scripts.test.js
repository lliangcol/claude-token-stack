#!/usr/bin/env node
const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const repoRoot = path.resolve(__dirname, "..", "..");
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "cts helper scripts "));

function findPowerShell() {
  for (const cmd of ["pwsh", "powershell"]) {
    const result = spawnSync(cmd, ["-NoProfile", "-Command", "$PSVersionTable.PSVersion.ToString()"], {
      encoding: "utf8",
    });
    if (result.status === 0) return cmd;
  }
  return null;
}

const shellScript = fs.readFileSync(path.join(repoRoot, "bin", "install-claude-token-stack.sh"), "utf8");
assert.ok(!/sh\s+"\$tmp"/.test(shellScript), "remote shell installer must not execute downloaded temp scripts");
assert.match(shellScript, /downloaded for audit only/, "remote shell installer should report audit-only behavior");
assert.match(shellScript, /TOKEN_STACK_ALLOW_UNPINNED_REMOTE_INSTALL/, "remote npm installs should expose an explicit unpinned opt-in");
assert.match(shellScript, /run_optional_npm_global/, "remote npm installs should route through the pinning guard");
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
assert.ok(
  packageJson.files.includes("examples/demo-windows-path-space/scripts/quote-paths.ps1"),
  "package should include static demo files"
);

const unattendedRunner = fs.readFileSync(path.join(repoRoot, "bin", "cts-run-agent-unattended.sh"), "utf8");
const benchmarkRunner = fs.readFileSync(path.join(repoRoot, "bin", "run-token-benchmark.sh"), "utf8");
assert.match(unattendedRunner, /Refusing unsafe PERMISSION_MODE/, "advanced runner should reject unsafe permission modes");
assert.match(benchmarkRunner, /Refusing unsafe PERMISSION_MODE/, "benchmark runner should reject unsafe permission modes");

const publicResearchPlan = fs.readFileSync(path.join(repoRoot, "docs", "research", "execution-plan-v2.md"), "utf8");
const publicResearchReport = fs.readFileSync(path.join(repoRoot, "docs", "research", "research-report.md"), "utf8");
assert.ok(!publicResearchPlan.includes("_seed/"), "public execution plan summary should not link to unpublished seed files");
assert.ok(!publicResearchReport.includes("_seed/"), "public research summary should not link to unpublished seed files");

const templateRunner = fs.readFileSync(path.join(repoRoot, "templates", ".claude", "hooks", "run-python-hook.js"), "utf8");
const templateSettings = JSON.parse(fs.readFileSync(path.join(repoRoot, "templates", ".claude", "settings.json"), "utf8"));
const projectRunnerPath = path.join(repoRoot, ".claude", "hooks", "run-python-hook.js");
if (fs.existsSync(projectRunnerPath)) {
  assert.strictEqual(
    fs.readFileSync(projectRunnerPath, "utf8"),
    templateRunner,
    "repo-local runner should match the published template runner"
  );
}

const scaffoldTarget = path.join(tempRoot, "invalid settings target");
fs.mkdirSync(path.join(scaffoldTarget, ".claude"), { recursive: true });
const invalidSettingsPath = path.join(scaffoldTarget, ".claude", "settings.json");
fs.writeFileSync(invalidSettingsPath, "{ invalid json", "utf8");
const existingPolicyPath = path.join(scaffoldTarget, ".claude", "token-policy.md");
fs.writeFileSync(existingPolicyPath, "local token policy\n", "utf8");
const scaffoldResult = spawnSync(
  process.execPath,
  [path.join(repoRoot, "bin", "cts.js"), "scaffold", "--target", scaffoldTarget],
  { encoding: "utf8" }
);
assert.strictEqual(
  scaffoldResult.status,
  0,
  `node scaffold failed\nstdout:\n${scaffoldResult.stdout}\nstderr:\n${scaffoldResult.stderr}`
);
JSON.parse(fs.readFileSync(invalidSettingsPath, "utf8"));
const backupNames = fs.readdirSync(path.dirname(invalidSettingsPath)).filter((name) => name.startsWith("settings.json.bak."));
assert.ok(backupNames.length > 0, "invalid settings should be backed up before template merge");
assert.strictEqual(fs.readFileSync(path.join(path.dirname(invalidSettingsPath), backupNames[0]), "utf8"), "{ invalid json");
assert.match(fs.readFileSync(path.join(scaffoldTarget, ".gitignore"), "utf8"), /^\.token-stack\/$/m);
assert.ok(fs.existsSync(path.join(scaffoldTarget, ".mcp.local.example.json")), "scaffold should copy local MCP template");
assert.ok(fs.existsSync(path.join(scaffoldTarget, "docs", "mcp-local-smoke.md")), "scaffold should copy local MCP smoke docs");
assert.ok(fs.existsSync(path.join(scaffoldTarget, "docs", "context-pack-template.md")), "scaffold should copy context pack template");
const policyBackupNames = fs.readdirSync(path.dirname(existingPolicyPath)).filter((name) => name.startsWith("token-policy.md.bak."));
assert.ok(policyBackupNames.length > 0, "existing template destination should be backed up before overwrite");
assert.strictEqual(
  fs.readFileSync(path.join(path.dirname(existingPolicyPath), policyBackupNames[0]), "utf8"),
  "local token policy\n"
);

const settingsBackupsBeforeSecondScaffold = fs
  .readdirSync(path.dirname(invalidSettingsPath))
  .filter((name) => name.startsWith("settings.json.bak."));
const secondScaffoldResult = spawnSync(
  process.execPath,
  [path.join(repoRoot, "bin", "cts.js"), "scaffold", "--target", scaffoldTarget],
  { encoding: "utf8" }
);
assert.strictEqual(
  secondScaffoldResult.status,
  0,
  `second node scaffold failed\nstdout:\n${secondScaffoldResult.stdout}\nstderr:\n${secondScaffoldResult.stderr}`
);
const settingsBackupsAfterSecondScaffold = fs
  .readdirSync(path.dirname(invalidSettingsPath))
  .filter((name) => name.startsWith("settings.json.bak."));
assert.deepStrictEqual(
  settingsBackupsAfterSecondScaffold.sort(),
  settingsBackupsBeforeSecondScaffold.sort(),
  "idempotent settings merge should not create another backup"
);

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function countTokenHooks(settings) {
  const expected = {
    Bash: "bash-token-guard.py",
    Read: "cbm-gate.py",
    Grep: "cbm-gate.py",
    Glob: "cbm-gate.py",
  };
  const counts = Object.fromEntries(Object.keys(expected).map((matcher) => [matcher, 0]));
  for (const entry of settings.hooks?.PreToolUse || []) {
    for (const hook of entry.hooks || []) {
      if (expected[entry.matcher] && String(hook.command || "").includes(expected[entry.matcher])) {
        counts[entry.matcher] += 1;
      }
    }
  }
  return counts;
}

const existingHooksTarget = path.join(tempRoot, "existing token hooks");
fs.mkdirSync(path.join(existingHooksTarget, ".claude"), { recursive: true });
fs.writeFileSync(
  path.join(existingHooksTarget, ".claude", "settings.json"),
  JSON.stringify(templateSettings, null, 2),
  "utf8"
);
const existingHooksScaffold = spawnSync(
  process.execPath,
  [path.join(repoRoot, "bin", "cts.js"), "scaffold", "--target", existingHooksTarget],
  { encoding: "utf8" }
);
assert.strictEqual(
  existingHooksScaffold.status,
  0,
  `scaffold with existing token hooks failed\nstdout:\n${existingHooksScaffold.stdout}\nstderr:\n${existingHooksScaffold.stderr}`
);
const existingHooksSettings = JSON.parse(fs.readFileSync(path.join(existingHooksTarget, ".claude", "settings.json"), "utf8"));
assert.deepStrictEqual(
  countTokenHooks(existingHooksSettings),
  { Bash: 1, Read: 1, Grep: 1, Glob: 1 },
  "scaffold should not add duplicate token hooks when target already has them"
);

const shellInstallerExistingHookTarget = path.join(repoRoot, ".tmp", `helper-shell-existing-hook-${Date.now()}`);
fs.mkdirSync(path.join(shellInstallerExistingHookTarget, ".claude"), { recursive: true });
fs.writeFileSync(
  path.join(shellInstallerExistingHookTarget, ".claude", "settings.json"),
  JSON.stringify(
    {
      hooks: {
        PreToolUse: [
          {
            matcher: "Bash",
            hooks: [{ type: "command", command: "python .claude/hooks/bash-token-guard.py --custom" }],
          },
        ],
      },
    },
    null,
    2
  ),
  "utf8"
);
const shellInstallerExistingHookResult = spawnSync(
  process.execPath,
  [path.join(repoRoot, "bin", "cts.js"), "all", "--target", shellInstallerExistingHookTarget],
  { encoding: "utf8" }
);
assert.strictEqual(
  shellInstallerExistingHookResult.status,
  0,
  `shell installer existing hook path failed\nstdout:\n${shellInstallerExistingHookResult.stdout}\nstderr:\n${shellInstallerExistingHookResult.stderr}`
);
const shellInstallerExistingHookSettings = JSON.parse(
  fs.readFileSync(path.join(shellInstallerExistingHookTarget, ".claude", "settings.json"), "utf8")
);
assert.deepStrictEqual(
  countTokenHooks(shellInstallerExistingHookSettings),
  { Bash: 1, Read: 1, Grep: 1, Glob: 1 },
  "shell installer path should not add duplicate token hooks when target already has one"
);

const duplicateDryRunTarget = path.join(tempRoot, "duplicate dry run target");
fs.mkdirSync(path.join(duplicateDryRunTarget, ".claude"), { recursive: true });
const duplicateDryRunSettings = clone(templateSettings);
duplicateDryRunSettings.hooks.PreToolUse.push(
  clone(templateSettings.hooks.PreToolUse.find((entry) => entry.matcher === "Grep"))
);
fs.writeFileSync(
  path.join(duplicateDryRunTarget, ".claude", "settings.json"),
  JSON.stringify(duplicateDryRunSettings, null, 2),
  "utf8"
);
const duplicateDryRun = spawnSync(
  process.execPath,
  [path.join(repoRoot, "bin", "cts.js"), "scaffold", "--target", duplicateDryRunTarget, "--dry-run", "--json"],
  { encoding: "utf8" }
);
assert.strictEqual(
  duplicateDryRun.status,
  0,
  `duplicate dry-run failed\nstdout:\n${duplicateDryRun.stdout}\nstderr:\n${duplicateDryRun.stderr}`
);
const duplicatePlan = JSON.parse(duplicateDryRun.stdout);
assert.strictEqual(duplicatePlan.token_settings.token_hooks.Grep.status, "duplicate");
assert.ok(
  duplicatePlan.risks.some((risk) => risk.code === "duplicate_token_hook" && risk.matcher === "Grep"),
  "dry-run should report duplicate token hook risk"
);

const invalidDryRunTarget = path.join(tempRoot, "invalid dry run target");
fs.mkdirSync(path.join(invalidDryRunTarget, ".claude"), { recursive: true });
fs.writeFileSync(path.join(invalidDryRunTarget, ".claude", "settings.json"), "{ invalid json", "utf8");
const invalidDryRun = spawnSync(
  process.execPath,
  [path.join(repoRoot, "bin", "cts.js"), "scaffold", "--target", invalidDryRunTarget, "--dry-run", "--json"],
  { encoding: "utf8" }
);
assert.strictEqual(
  invalidDryRun.status,
  0,
  `invalid dry-run failed\nstdout:\n${invalidDryRun.stdout}\nstderr:\n${invalidDryRun.stderr}`
);
const invalidDryRunPlan = JSON.parse(invalidDryRun.stdout);
const invalidDryRunSettingsPlan = invalidDryRunPlan.plan.find((item) => item.path === ".claude/settings.json");
assert.strictEqual(invalidDryRunSettingsPlan.action, "merge");
assert.strictEqual(invalidDryRunSettingsPlan.backup_required, true);
assert.strictEqual(invalidDryRunSettingsPlan.invalid_existing_json, true);
assert.ok(
  invalidDryRunPlan.risks.some((risk) => risk.code === "invalid_settings_json"),
  "dry-run should report invalid settings JSON risk"
);

const verifyRiskTarget = path.join(repoRoot, ".tmp", `helper-verify-risk-${Date.now()}`);
const verifyRiskScaffold = spawnSync(
  process.execPath,
  [path.join(repoRoot, "bin", "cts.js"), "scaffold", "--target", verifyRiskTarget],
  { encoding: "utf8" }
);
assert.strictEqual(
  verifyRiskScaffold.status,
  0,
  `verify risk scaffold failed\nstdout:\n${verifyRiskScaffold.stdout}\nstderr:\n${verifyRiskScaffold.stderr}`
);
const verifyRiskSettingsPath = path.join(verifyRiskTarget, ".claude", "settings.json");
const verifyRiskSettings = JSON.parse(fs.readFileSync(verifyRiskSettingsPath, "utf8"));
verifyRiskSettings.env.TOKEN_GUARD_MODE = "block";
verifyRiskSettings.hooks.PreToolUse.push(
  clone(verifyRiskSettings.hooks.PreToolUse.find((entry) => entry.matcher === "Bash"))
);
fs.writeFileSync(verifyRiskSettingsPath, JSON.stringify(verifyRiskSettings, null, 2), "utf8");
const verifyRiskResult = spawnSync(
  process.execPath,
  [path.join(repoRoot, "bin", "cts.js"), "verify", "--target", verifyRiskTarget],
  { encoding: "utf8" }
);
assert.strictEqual(
  verifyRiskResult.status,
  0,
  `verify should warn, not fail, on duplicate hooks and missing block evidence\nstdout:\n${verifyRiskResult.stdout}\nstderr:\n${verifyRiskResult.stderr}`
);
const verifyRiskReport = JSON.parse(
  fs.readFileSync(path.join(verifyRiskTarget, ".token-stack", "reports", "verify-report.json"), "utf8")
);
assert.ok(
  verifyRiskReport.checks.some((check) => check.status === "WARN" && check.name === "token hook Bash" && check.detail.includes("duplicate")),
  "verify should warn about duplicate token hooks"
);
assert.ok(
  verifyRiskReport.checks.some((check) => check.status === "WARN" && check.name === "TOKEN_GUARD_MODE block evidence"),
  "verify should warn when block mode lacks metrics/verify evidence"
);

const missingTarget = path.join(tempRoot, "missing metrics target");
const missingTargetResult = spawnSync(
  process.execPath,
  [path.join(repoRoot, "bin", "cts.js"), "collect-metrics", "--target", missingTarget, "--dry-run"],
  { encoding: "utf8" }
);
assert.strictEqual(missingTargetResult.status, 2, "missing target should fail before Python lookup");
assert.match(missingTargetResult.stderr, /Target directory does not exist/);
assert.ok(!missingTargetResult.stderr.includes("Python not found"), "missing target should not be reported as missing Python");

const metricsTarget = path.join(tempRoot, "metrics target");
const baselineDir = path.join(metricsTarget, ".token-stack", "reports", "baseline");
const postDir = path.join(metricsTarget, ".token-stack", "reports", "post");
fs.mkdirSync(baselineDir, { recursive: true });
fs.mkdirSync(postDir, { recursive: true });
fs.writeFileSync(
  path.join(baselineDir, "code-discovery.json"),
  JSON.stringify({ phase: "baseline", task: "code-discovery", metrics: { input_tokens: 100, task_success: true } }),
  "utf8"
);
fs.writeFileSync(
  path.join(postDir, "code-discovery.json"),
  JSON.stringify({ phase: "post", task: "code-discovery", metrics: { input_tokens: 50, task_success: true } }),
  "utf8"
);
const collectResult = spawnSync(
  process.execPath,
  [path.join(repoRoot, "bin", "cts.js"), "collect-metrics", "--target", metricsTarget, "--dry-run"],
  { encoding: "utf8" }
);
assert.strictEqual(
  collectResult.status,
  0,
  `collect-metrics with --target failed\nstdout:\n${collectResult.stdout}\nstderr:\n${collectResult.stderr}`
);
const collected = JSON.parse(collectResult.stdout);
assert.strictEqual(collected.root.replace(/\\/g, "/"), ".token-stack/reports");
assert.ok(collected.files.length >= 2, "collect-metrics should scan the target report directory, not --target");

const compareResult = spawnSync(
  process.execPath,
  [path.join(repoRoot, "bin", "cts.js"), "compare-metrics", "--target", metricsTarget, "--dry-run"],
  { encoding: "utf8" }
);
assert.strictEqual(
  compareResult.status,
  0,
  `compare-metrics with --target failed\nstdout:\n${compareResult.stdout}\nstderr:\n${compareResult.stderr}`
);
const compared = JSON.parse(compareResult.stdout);
assert.strictEqual(compared.tasks["code-discovery"].baseline.input_tokens, 100);
assert.strictEqual(compared.tasks["code-discovery"].post.input_tokens, 50);

const syntheticMetricsTarget = path.join(tempRoot, "synthetic metrics target");
for (const phase of ["baseline", "post"]) {
  fs.mkdirSync(path.join(syntheticMetricsTarget, ".token-stack", "reports", phase), { recursive: true });
}
for (const task of ["code-discovery", "test-failure", "long-log"]) {
  fs.writeFileSync(
    path.join(syntheticMetricsTarget, ".token-stack", "reports", "baseline", `${task}.json`),
    JSON.stringify({
      mode: "synthetic-only",
      phase: "baseline",
      task,
      task_success: true,
      metrics: { raw_large_output_events: 1, blocked_commands: 0, cost_usd: 1 },
    }),
    "utf8"
  );
  fs.writeFileSync(
    path.join(syntheticMetricsTarget, ".token-stack", "reports", "post", `${task}.json`),
    JSON.stringify({
      mode: "synthetic-only",
      phase: "post",
      task,
      task_success: true,
      metrics: { raw_large_output_events: 0, blocked_commands: 1, cost_usd: 0.5 },
    }),
    "utf8"
  );
}
const syntheticCompareResult = spawnSync(
  process.execPath,
  [path.join(repoRoot, "bin", "cts.js"), "compare-metrics", "--target", syntheticMetricsTarget, "--dry-run"],
  { encoding: "utf8" }
);
assert.strictEqual(
  syntheticCompareResult.status,
  0,
  `synthetic compare-metrics failed\nstdout:\n${syntheticCompareResult.stdout}\nstderr:\n${syntheticCompareResult.stderr}`
);
const syntheticCompared = JSON.parse(syntheticCompareResult.stdout);
assert.strictEqual(syntheticCompared.recommend_enter_block, false, "synthetic-only evidence must not recommend block mode");
assert.deepStrictEqual(syntheticCompared.evidence_modes, ["synthetic-only"]);
assert.strictEqual(syntheticCompared.recommendation_reason.representative_evidence, false);

const ps = findPowerShell();
if (ps) {
  const settingsPath = path.join(tempRoot, ".claude", "settings.json");
  fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
  fs.writeFileSync(
    settingsPath,
    JSON.stringify(
      {
        hooks: {
          SessionStart: [
            {
              hooks: [
                {
                  type: "command",
                  command: "bash -lc ~/.claude/hooks/cbm-session-reminder",
                },
              ],
            },
          ],
        },
      },
      null,
      2
    )
  );

  const script = path.join(repoRoot, "bin", "fix-windows-claude-settings.ps1");
  const result = spawnSync(
    ps,
    ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", script, "-SettingsPath", settingsPath],
    { encoding: "utf8" }
  );
  assert.strictEqual(
    result.status,
    0,
    `fix-windows-claude-settings.ps1 failed\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`
  );

  const repaired = JSON.parse(fs.readFileSync(settingsPath, "utf8"));
  const command = repaired.hooks.SessionStart[0].hooks[0].command;
  assert.strictEqual(command, 'bash -lc "$HOME/.claude/hooks/cbm-session-reminder"');
  assert.ok(fs.readdirSync(path.dirname(settingsPath)).some((name) => name.startsWith("settings.json.bak.")));
} else {
  console.log("PowerShell not found; skipped PowerShell helper smoke test");
}

console.log("helper script smoke tests passed");
