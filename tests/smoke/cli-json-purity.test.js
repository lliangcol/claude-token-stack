#!/usr/bin/env node
const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const repoRoot = path.resolve(__dirname, "..", "..");
const cliPath = path.join(repoRoot, "bin", "cts.js");
const preflightTempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "cts cli json "));
const missingTarget = path.join(preflightTempRoot, "missing target");
const fileTarget = path.join(preflightTempRoot, "not-a-directory.txt");
const eventTarget = path.join(preflightTempRoot, "event target");
const presetTarget = path.join(preflightTempRoot, "preset target");
const presetMissingSettingsTarget = path.join(preflightTempRoot, "preset missing settings");
const observabilityTarget = path.join(preflightTempRoot, "observability target");
const metricsTarget = path.join(preflightTempRoot, "metrics target");
fs.writeFileSync(fileTarget, "not a directory\n", "utf8");
fs.mkdirSync(eventTarget, { recursive: true });
fs.mkdirSync(path.join(presetTarget, ".claude"), { recursive: true });
fs.mkdirSync(presetMissingSettingsTarget, { recursive: true });
fs.mkdirSync(path.join(observabilityTarget, ".claude", "logs"), { recursive: true });
fs.mkdirSync(path.join(observabilityTarget, ".token-stack", "reports"), { recursive: true });
fs.mkdirSync(path.join(metricsTarget, ".token-stack", "reports", "baseline"), { recursive: true });
fs.mkdirSync(path.join(metricsTarget, ".token-stack", "reports", "post"), { recursive: true });
const presetSettingsPath = path.join(presetTarget, ".claude", "settings.json");
const presetOriginalSettings = `${JSON.stringify({
  env: {
    TOKEN_GUARD_MODE: "warn",
    CBM_GATE_MODE: "warn",
    CBM_GATE_BLOCK_TOOLS: "Grep,Glob",
    LOCAL_ONLY: "keep"
  }
}, null, 2)}\n`;
fs.writeFileSync(presetSettingsPath, presetOriginalSettings, "utf8");
fs.writeFileSync(
  path.join(observabilityTarget, ".claude", "logs", "token-guard.log"),
  `${JSON.stringify({
    mode: "warn",
    tool_name: "Bash",
    violations: ["raw tree"],
    advisories: ["use rg --files"],
    messages: ["keep search scoped"]
  })}\n`,
  "utf8"
);
fs.writeFileSync(
  path.join(observabilityTarget, ".token-stack", "reports", "usage-record.json"),
  `${JSON.stringify({
    input_tokens: 12,
    output_tokens: 5,
    tool_calls: ["Read", "Grep"],
    total_cost_usd: 0.01
  })}\n`,
  "utf8"
);
for (const phase of ["baseline", "post"]) {
  fs.writeFileSync(
    path.join(metricsTarget, ".token-stack", "reports", phase, "smoke-task.json"),
    `${JSON.stringify({
      schema_version: 1,
      phase,
      task: "smoke-task",
      mode: "synthetic-only",
      evidence_type: "synthetic",
      task_success: true,
      metrics: {
        input_tokens: phase === "baseline" ? 100 : 80,
        output_tokens: phase === "baseline" ? 20 : 18,
        raw_large_output_events: phase === "baseline" ? 1 : 0,
        blocked_commands: phase === "baseline" ? 0 : 1,
        cost_usd: phase === "baseline" ? 1 : 0.8
      }
    })}\n`,
    "utf8"
  );
}
const envWithoutPath = Object.assign({}, process.env, { PATH: "", Path: "" });

const helpResult = spawnSync(process.execPath, [cliPath, "help"], { encoding: "utf8" });
assert.strictEqual(helpResult.status, 0, `help command failed\nstdout:\n${helpResult.stdout}\nstderr:\n${helpResult.stderr}`);
assert.strictEqual(helpResult.stderr, "", "help output should keep stderr clean");
assert.match(helpResult.stdout, /JSON\/no-write commands:/);
assert.match(helpResult.stdout, /Scaffold and Bash-backed commands:/);
assert.match(helpResult.stdout, /--json is reserved for CLI preflight errors on Bash-backed commands/);

for (const [commandName, extraArgs] of [
  ["doctor", ["--json", "--no-write"]],
  ["audit-hooks", ["--json", "--no-write"]],
  ["pack-context", ["--budget", "2000", "--json", "--no-write"]],
  ["analyze-logs", ["--json", "--no-write"]],
  ["ingest-usage", ["--json", "--no-write"]],
  ["events", ["--json", "--no-write"]],
  ["preset", ["--name", "balanced", "--json", "--no-write"]],
  ["validate-artifacts", ["--json", "--no-write"]],
]) {
  const result = spawnSync(
    process.execPath,
    [cliPath, commandName, "--target", repoRoot, ...extraArgs],
    { encoding: "utf8" }
  );
  assert.strictEqual(
    result.status,
    0,
    `${commandName} native command failed\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`
  );
  assert.strictEqual(result.stderr, "", `${commandName} --json --no-write should keep this smoke path stderr-clean`);
  JSON.parse(result.stdout);
}

const eventStorePath = path.join(eventTarget, ".token-stack", "events", "events.jsonl");
const eventRecordResult = spawnSync(
  process.execPath,
  [
    cliPath,
    "events",
    "record",
    "--target",
    eventTarget,
    "--type",
    "rollout",
    "--message",
    "warn mode smoke",
    "--json",
    "--no-write"
  ],
  { encoding: "utf8" }
);
assert.strictEqual(
  eventRecordResult.status,
  0,
  `events record --json --no-write should pass\nstdout:\n${eventRecordResult.stdout}\nstderr:\n${eventRecordResult.stderr}`
);
assert.strictEqual(eventRecordResult.stderr, "", "events record --json --no-write should keep stderr clean");
const eventRecordPayload = JSON.parse(eventRecordResult.stdout);
assert.strictEqual(eventRecordPayload.command, "events");
assert.strictEqual(eventRecordPayload.action, "record");
assert.strictEqual(eventRecordPayload.target, eventTarget);
assert.strictEqual(eventRecordPayload.store, eventStorePath);
assert.strictEqual(eventRecordPayload.dry_run, true);
assert.strictEqual(eventRecordPayload.event.type, "rollout");
assert.strictEqual(eventRecordPayload.event.message, "warn mode smoke");
assert.ok(!fs.existsSync(eventStorePath), "events record --no-write should not create events.jsonl");

const eventMissingMessageResult = spawnSync(
  process.execPath,
  [cliPath, "events", "record", "--target", eventTarget, "--json", "--no-write"],
  { encoding: "utf8" }
);
assert.strictEqual(eventMissingMessageResult.status, 2, "events record missing --message should fail");
assert.strictEqual(eventMissingMessageResult.stderr, "", "events record --json missing --message should keep stderr clean");
const eventMissingMessagePayload = JSON.parse(eventMissingMessageResult.stdout);
assert.strictEqual(eventMissingMessagePayload.command, "events");
assert.strictEqual(eventMissingMessagePayload.action, "record");
assert.strictEqual(eventMissingMessagePayload.target, eventTarget);
assert.strictEqual(eventMissingMessagePayload.error.code, "message_missing");
assert.ok(!fs.existsSync(eventStorePath), "failed events record --no-write should not create events.jsonl");

const presetNoWriteResult = spawnSync(
  process.execPath,
  [cliPath, "preset", "--target", presetTarget, "--name", "balanced", "--json", "--no-write"],
  { encoding: "utf8" }
);
assert.strictEqual(
  presetNoWriteResult.status,
  0,
  `preset --json --no-write should pass\nstdout:\n${presetNoWriteResult.stdout}\nstderr:\n${presetNoWriteResult.stderr}`
);
assert.strictEqual(presetNoWriteResult.stderr, "", "preset --json --no-write should keep stderr clean");
const presetNoWritePayload = JSON.parse(presetNoWriteResult.stdout);
assert.strictEqual(presetNoWritePayload.command, "preset");
assert.strictEqual(presetNoWritePayload.target, presetTarget);
assert.strictEqual(presetNoWritePayload.preset, "balanced");
assert.strictEqual(presetNoWritePayload.dry_run, true);
assert.strictEqual(presetNoWritePayload.changed, true);
assert.strictEqual(presetNoWritePayload.backup, null);
assert.strictEqual(presetNoWritePayload.env_after.TOKEN_GUARD_MODE, "block");
assert.strictEqual(presetNoWritePayload.env_after.LOCAL_ONLY, "keep");
assert.strictEqual(fs.readFileSync(presetSettingsPath, "utf8"), presetOriginalSettings, "preset --no-write should not modify settings.json");
assert.strictEqual(
  fs.readdirSync(path.dirname(presetSettingsPath)).filter((name) => name.startsWith("settings.json.bak.")).length,
  0,
  "preset --no-write should not create settings backups"
);

for (const [argsForPreset, expectedCode] of [
  [["preset", "--target", presetMissingSettingsTarget, "--json", "--no-write"], "settings_missing"],
  [["preset", "--target", presetTarget, "--name", "unknown", "--json", "--no-write"], "unknown_preset"],
]) {
  const result = spawnSync(process.execPath, [cliPath, ...argsForPreset], { encoding: "utf8" });
  assert.strictEqual(result.status, 2, `preset ${expectedCode} should fail`);
  assert.strictEqual(result.stderr, "", `preset --json ${expectedCode} errors should keep stderr clean`);
  const payload = JSON.parse(result.stdout);
  assert.strictEqual(payload.command, "preset");
  assert.strictEqual(payload.target, argsForPreset[argsForPreset.indexOf("--target") + 1]);
  assert.strictEqual(payload.error.code, expectedCode);
}

const analyzeLogsResult = spawnSync(
  process.execPath,
  [cliPath, "analyze-logs", "--target", observabilityTarget, "--json", "--no-write"],
  { encoding: "utf8" }
);
assert.strictEqual(
  analyzeLogsResult.status,
  0,
  `analyze-logs --json --no-write should pass\nstdout:\n${analyzeLogsResult.stdout}\nstderr:\n${analyzeLogsResult.stderr}`
);
assert.strictEqual(analyzeLogsResult.stderr, "", "analyze-logs --json --no-write should keep stderr clean");
const analyzeLogsPayload = JSON.parse(analyzeLogsResult.stdout);
assert.strictEqual(analyzeLogsPayload.command, "analyze-logs");
assert.strictEqual(analyzeLogsPayload.target, observabilityTarget);
assert.strictEqual(analyzeLogsPayload.dry_run, true);
assert.deepStrictEqual(analyzeLogsPayload.outputs, {
  json: path.join(observabilityTarget, ".token-stack", "reports", "log-analysis.json"),
  markdown: path.join(observabilityTarget, ".token-stack", "reports", "log-analysis.md")
});
assert.strictEqual(analyzeLogsPayload.files.length, 1);
assert.strictEqual(analyzeLogsPayload.totals.records, 1);
assert.strictEqual(analyzeLogsPayload.totals.violations["raw tree"], 1);
assert.strictEqual(analyzeLogsPayload.totals.tools.Bash, 1);
assert.ok(
  !fs.existsSync(path.join(observabilityTarget, ".token-stack", "reports", "log-analysis.json")),
  "analyze-logs --no-write should not create log-analysis.json"
);
assert.ok(
  !fs.existsSync(path.join(observabilityTarget, ".token-stack", "reports", "log-analysis.md")),
  "analyze-logs --no-write should not create log-analysis.md"
);

const ingestUsageResult = spawnSync(
  process.execPath,
  [cliPath, "ingest-usage", "--target", observabilityTarget, "--root", ".token-stack/reports", "--json", "--no-write"],
  { encoding: "utf8" }
);
assert.strictEqual(
  ingestUsageResult.status,
  0,
  `ingest-usage --json --no-write should pass\nstdout:\n${ingestUsageResult.stdout}\nstderr:\n${ingestUsageResult.stderr}`
);
assert.strictEqual(ingestUsageResult.stderr, "", "ingest-usage --json --no-write should keep stderr clean");
const ingestUsagePayload = JSON.parse(ingestUsageResult.stdout);
assert.strictEqual(ingestUsagePayload.command, "ingest-usage");
assert.strictEqual(ingestUsagePayload.target, observabilityTarget);
assert.strictEqual(ingestUsagePayload.dry_run, true);
assert.deepStrictEqual(ingestUsagePayload.outputs, {
  json: path.join(observabilityTarget, ".token-stack", "reports", "usage-summary.json"),
  markdown: path.join(observabilityTarget, ".token-stack", "reports", "usage-summary.md")
});
assert.strictEqual(ingestUsagePayload.files.length, 1);
assert.strictEqual(ingestUsagePayload.totals.input_tokens, 12);
assert.strictEqual(ingestUsagePayload.totals.output_tokens, 5);
assert.strictEqual(ingestUsagePayload.totals.tool_calls, 2);
assert.strictEqual(ingestUsagePayload.totals.cost_usd, 0.01);
assert.ok(
  !fs.existsSync(path.join(observabilityTarget, ".token-stack", "reports", "usage-summary.json")),
  "ingest-usage --no-write should not create usage-summary.json"
);
assert.ok(
  !fs.existsSync(path.join(observabilityTarget, ".token-stack", "reports", "usage-summary.md")),
  "ingest-usage --no-write should not create usage-summary.md"
);

const collectMetricsResult = spawnSync(
  process.execPath,
  [
    cliPath,
    "collect-metrics",
    "--target",
    metricsTarget,
    ".token-stack/reports",
    "--json",
    "--no-write"
  ],
  { encoding: "utf8" }
);
assert.strictEqual(
  collectMetricsResult.status,
  0,
  `collect-metrics --json --no-write should pass\nstdout:\n${collectMetricsResult.stdout}\nstderr:\n${collectMetricsResult.stderr}`
);
assert.strictEqual(collectMetricsResult.stderr, "", "collect-metrics --json --no-write should keep stderr clean");
const collectMetricsPayload = JSON.parse(collectMetricsResult.stdout);
assert.strictEqual(collectMetricsPayload.root.replace(/\\/g, "/"), ".token-stack/reports");
assert.strictEqual(collectMetricsPayload.files.length, 2);
assert.strictEqual(collectMetricsPayload.totals.input_tokens, 180);
assert.ok(
  !fs.existsSync(path.join(metricsTarget, ".token-stack", "reports", "metrics-collected.json")),
  "collect-metrics --no-write should not create metrics-collected.json"
);
assert.ok(
  !fs.existsSync(path.join(metricsTarget, ".token-stack", "reports", "metrics-collected.md")),
  "collect-metrics --no-write should not create metrics-collected.md"
);

const compareMetricsResult = spawnSync(
  process.execPath,
  [
    cliPath,
    "compare-metrics",
    "--target",
    metricsTarget,
    ".token-stack/reports",
    "--json",
    "--no-write"
  ],
  { encoding: "utf8" }
);
assert.strictEqual(
  compareMetricsResult.status,
  0,
  `compare-metrics --json --no-write should pass\nstdout:\n${compareMetricsResult.stdout}\nstderr:\n${compareMetricsResult.stderr}`
);
assert.strictEqual(compareMetricsResult.stderr, "", "compare-metrics --json --no-write should keep stderr clean");
const compareMetricsPayload = JSON.parse(compareMetricsResult.stdout);
assert.strictEqual(compareMetricsPayload.root.replace(/\\/g, "/"), ".token-stack/reports");
assert.deepStrictEqual(compareMetricsPayload.evidence_types, ["synthetic"]);
assert.strictEqual(compareMetricsPayload.recommend_enter_block, false);
assert.strictEqual(compareMetricsPayload.totals.baseline.input_tokens, 100);
assert.strictEqual(compareMetricsPayload.totals.post.input_tokens, 80);
assert.ok(
  !fs.existsSync(path.join(metricsTarget, ".token-stack", "reports", "metrics-summary.json")),
  "compare-metrics --no-write should not create metrics-summary.json"
);
assert.ok(
  !fs.existsSync(path.join(metricsTarget, ".token-stack", "reports", "metrics-summary.md")),
  "compare-metrics --no-write should not create metrics-summary.md"
);

for (const commandName of ["doctor", "collect-metrics"]) {
  for (const [targetPath, expectedCode] of [
    [missingTarget, "target_missing"],
    [fileTarget, "target_not_directory"],
  ]) {
    const result = spawnSync(
      process.execPath,
      [cliPath, commandName, "--target", targetPath, "--json", "--no-write"],
      { encoding: "utf8" }
    );
    assert.strictEqual(result.status, 2, `${commandName} ${expectedCode} should fail preflight`);
    assert.strictEqual(result.stderr, "", `${commandName} --json ${expectedCode} errors should keep stderr clean`);
    const payload = JSON.parse(result.stdout);
    assert.strictEqual(payload.command, commandName);
    assert.strictEqual(payload.error.code, expectedCode);
    assert.strictEqual(payload.target, targetPath);
  }
}

for (const [targetPath, expectedCode] of [
  [missingTarget, "target_missing"],
  [fileTarget, "target_not_directory"],
]) {
  const result = spawnSync(
    process.execPath,
    [cliPath, "verify", "--target", targetPath, "--json", "--no-write"],
    { encoding: "utf8", env: envWithoutPath }
  );
  assert.strictEqual(result.status, 2, `verify ${expectedCode} should fail target preflight before Bash lookup`);
  assert.strictEqual(result.stderr, "", `verify --json ${expectedCode} errors should keep stderr clean`);
  const payload = JSON.parse(result.stdout);
  assert.strictEqual(payload.command, "verify");
  assert.strictEqual(payload.error.code, expectedCode);
  assert.strictEqual(payload.target, targetPath);
}

for (const [commandName, expectedCode] of [
  ["collect-metrics", "python_missing"],
  ["compare-metrics", "python_missing"],
  ["verify", "bash_missing"],
  ["benchmark", "bash_missing"],
]) {
  const result = spawnSync(
    process.execPath,
    [cliPath, commandName, "--target", repoRoot, "--json", "--no-write"],
    { encoding: "utf8", env: envWithoutPath }
  );
  assert.strictEqual(result.status, 2, `${commandName} missing dependency should fail`);
  assert.strictEqual(result.stderr, "", `${commandName} --json missing dependency errors should keep stderr clean`);
  const payload = JSON.parse(result.stdout);
  assert.strictEqual(payload.command, commandName);
  assert.strictEqual(payload.error.code, expectedCode);
  assert.strictEqual(payload.target, repoRoot);
}

console.log("CLI JSON purity smoke tests passed");
