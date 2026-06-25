#!/usr/bin/env node
const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const repoRoot = path.resolve(__dirname, "..", "..");
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "cts windows compat "));

function findPowerShell() {
  for (const cmd of ["pwsh", "powershell"]) {
    const result = spawnSync(cmd, ["-NoProfile", "-Command", "$PSVersionTable.PSVersion.ToString()"], {
      encoding: "utf8",
    });
    if (result.status === 0) return cmd;
  }
  return null;
}

function findBash() {
  const result = spawnSync("bash", ["--version"], { encoding: "utf8" });
  return result.status === 0 ? "bash" : null;
}

if (process.platform === "win32") {
  const fakeClaudeBin = path.join(tempRoot, "fake claude cmd bin");
  fs.mkdirSync(fakeClaudeBin, { recursive: true });
  fs.writeFileSync(path.join(fakeClaudeBin, "claude.cmd"), "@echo fake-claude 1.2.3\r\n", "utf8");
  const result = spawnSync(
    process.execPath,
    [path.join(repoRoot, "bin", "cts.js"), "doctor", "--target", repoRoot, "--json", "--no-write"],
    {
      encoding: "utf8",
      env: { ...process.env, PATH: `${fakeClaudeBin}${path.delimiter}${process.env.PATH || ""}` },
    }
  );
  assert.strictEqual(
    result.status,
    0,
    `doctor should detect Windows .cmd wrappers on PATH\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`
  );
  const report = JSON.parse(result.stdout);
  const claudeCheck = report.checks.find((check) => check.name === "claude available");
  assert.ok(claudeCheck, "doctor should report claude availability");
  assert.strictEqual(claudeCheck.status, "PASS", "doctor should treat a PATH-visible claude.cmd wrapper as available");
  assert.match(claudeCheck.detail, /fake-claude 1\.2\.3/, "doctor should report the claude.cmd version output");
}

const bash = findBash();
if (bash) {
  const crlfBenchmarkRel = `.tmp/crlf-benchmark-${process.pid}`;
  const crlfBenchmarkTarget = path.join(repoRoot, crlfBenchmarkRel);
  fs.mkdirSync(path.join(crlfBenchmarkTarget, ".token-stack"), { recursive: true });
  fs.writeFileSync(
    path.join(crlfBenchmarkTarget, ".token-stack", "benchmark.config.json"),
    JSON.stringify({
      schema_version: 1,
      tasks: [{ id: "crlf-task\r", prompt: "Run a CRLF task id smoke test." }],
    }),
    "utf8"
  );
  const crlfBenchmarkResult = spawnSync(
    bash,
    [
      "-lc",
      `CTS_TARGET_DIR='${crlfBenchmarkRel}' BENCHMARK_CONFIG='.token-stack/benchmark.config.json' bin/run-token-benchmark.sh post synthetic-only --no-write`,
    ],
    {
      cwd: repoRoot,
      encoding: "utf8",
      env: process.env,
    }
  );
  assert.strictEqual(
    crlfBenchmarkResult.status,
    0,
    `benchmark should strip CR from configured task ids before writing reports\nstdout:\n${crlfBenchmarkResult.stdout}\nstderr:\n${crlfBenchmarkResult.stderr}`
  );
  assert.match(crlfBenchmarkResult.stdout, /- crlf-task: synthetic result written/, "benchmark output should use sanitized task id");
  assert.ok(!crlfBenchmarkResult.stdout.includes("crlf-task\r"), "benchmark output should not retain CR in task id");
} else {
  console.log("Bash not found; skipped CRLF benchmark smoke test");
}

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

console.log("Windows compatibility smoke tests passed");
