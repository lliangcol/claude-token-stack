#!/usr/bin/env node
const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const repoRoot = path.resolve(__dirname, "..", "..");
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "cts scaffold smoke "));
const templateSettings = JSON.parse(fs.readFileSync(path.join(repoRoot, "templates", ".claude", "settings.json"), "utf8"));

function findBash() {
  const result = spawnSync("bash", ["--version"], { encoding: "utf8" });
  return result.status === 0 ? "bash" : null;
}

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

const bash = findBash();

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

if (bash) {
  const shellInstallerExistingHookTarget = path.join(repoRoot, ".tmp", `scaffold-shell-existing-hook-${Date.now()}`);
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

  const shellInstallerDryRunTarget = path.join(repoRoot, ".tmp", `scaffold-shell-dry-run-${Date.now()}`);
  const shellInstallerDryRunScaffold = spawnSync(
    process.execPath,
    [path.join(repoRoot, "bin", "cts.js"), "scaffold", "--target", shellInstallerDryRunTarget],
    { encoding: "utf8" }
  );
  assert.strictEqual(
    shellInstallerDryRunScaffold.status,
    0,
    `shell installer dry-run fixture scaffold failed\nstdout:\n${shellInstallerDryRunScaffold.stdout}\nstderr:\n${shellInstallerDryRunScaffold.stderr}`
  );
  fs.rmSync(path.join(shellInstallerDryRunTarget, ".token-stack"), { recursive: true, force: true });
  fs.rmSync(path.join(shellInstallerDryRunTarget, ".claude", "logs"), { recursive: true, force: true });
  const shellInstallerDryRunResult = spawnSync(
    process.execPath,
    [path.join(repoRoot, "bin", "cts.js"), "all", "--target", shellInstallerDryRunTarget, "--dry-run"],
    { encoding: "utf8" }
  );
  assert.strictEqual(
    shellInstallerDryRunResult.status,
    0,
    `all --dry-run should pass without target writes\nstdout:\n${shellInstallerDryRunResult.stdout}\nstderr:\n${shellInstallerDryRunResult.stderr}`
  );
  assert.ok(!fs.existsSync(path.join(shellInstallerDryRunTarget, ".token-stack")), "all --dry-run should not create .token-stack");
  assert.ok(!fs.existsSync(path.join(shellInstallerDryRunTarget, ".claude", "logs")), "all --dry-run should not create .claude/logs");
} else {
  console.log("Bash not found; skipped shell installer duplicate-hook smoke test");
}

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

const noWriteTarget = path.join(tempRoot, "scaffold no write target");
fs.mkdirSync(noWriteTarget, { recursive: true });
const noWriteScaffold = spawnSync(
  process.execPath,
  [path.join(repoRoot, "bin", "cts.js"), "scaffold", "--target", noWriteTarget, "--no-write"],
  { encoding: "utf8" }
);
assert.strictEqual(
  noWriteScaffold.status,
  0,
  `scaffold --no-write failed\nstdout:\n${noWriteScaffold.stdout}\nstderr:\n${noWriteScaffold.stderr}`
);
for (const rel of [".claude/settings.json", ".gitignore", ".mcp.local.example.json", "docs/claude-token-stack.md"]) {
  assert.ok(!fs.existsSync(path.join(noWriteTarget, rel)), `scaffold --no-write should not create ${rel}`);
}

const verifyRiskTarget = path.join(repoRoot, ".tmp", `scaffold-verify-risk-${Date.now()}`);
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
if (bash) {
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
} else {
  console.log("Bash not found; skipped verify risk smoke test");
}

console.log("scaffold smoke tests passed");
