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
assert.ok(
  !/verify-claude-token-stack\.sh"\s*\|\|\s*record/.test(shellScript),
  "all mode must not swallow verify failures"
);
assert.match(shellScript, /exit 1/, "all mode should exit non-zero when verify fails");

const packageJson = JSON.parse(fs.readFileSync(path.join(repoRoot, "package.json"), "utf8"));
assert.ok(!packageJson.homepage, "package metadata should not point to an unpublished homepage");
assert.ok(!packageJson.repository, "package metadata should not point to an unpublished repository");
assert.ok(!packageJson.bugs, "package metadata should not point to unpublished issue tracker");

const unattendedRunner = fs.readFileSync(path.join(repoRoot, "bin", "cts-run-agent-unattended.sh"), "utf8");
const benchmarkRunner = fs.readFileSync(path.join(repoRoot, "bin", "run-token-benchmark.sh"), "utf8");
assert.match(unattendedRunner, /Refusing unsafe PERMISSION_MODE/, "advanced runner should reject unsafe permission modes");
assert.match(benchmarkRunner, /Refusing unsafe PERMISSION_MODE/, "benchmark runner should reject unsafe permission modes");

const publicResearchPlan = fs.readFileSync(path.join(repoRoot, "docs", "research", "execution-plan-v2.md"), "utf8");
const publicResearchReport = fs.readFileSync(path.join(repoRoot, "docs", "research", "research-report.md"), "utf8");
assert.ok(!publicResearchPlan.includes("_seed/"), "public execution plan summary should not link to unpublished seed files");
assert.ok(!publicResearchReport.includes("_seed/"), "public research summary should not link to unpublished seed files");

const templateRunner = fs.readFileSync(path.join(repoRoot, "templates", ".claude", "hooks", "run-python-hook.js"), "utf8");
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
