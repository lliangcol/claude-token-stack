#!/usr/bin/env node
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const repoRoot = path.resolve(__dirname, "..", "..");

function read(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

function findPowerShell() {
  for (const cmd of ["pwsh", "powershell"]) {
    const result = spawnSync(cmd, ["-NoProfile", "-Command", "$PSVersionTable.PSVersion.ToString()"], {
      encoding: "utf8",
    });
    if (result.status === 0) return cmd;
  }
  return null;
}

const packageJson = JSON.parse(read("package.json"));
assert.strictEqual(
  packageJson.scripts["test:helpers"],
  "node tests/smoke/helper-scripts.test.js",
  "package.json should define the helper smoke test script used by CI"
);

const ciWorkflow = read(".github/workflows/ci.yml");
assert.match(ciWorkflow, /npm run test:helpers/, "CI should run helper script tests through npm");

for (const [wrapper, target] of [
  ["bin/cts-install.sh", "bin/install-claude-token-stack.sh"],
  ["bin/cts-verify.sh", "bin/verify-claude-token-stack.sh"],
  ["bin/cts-benchmark.sh", "bin/run-token-benchmark.sh"],
]) {
  const wrapperSource = read(wrapper);
  assert.match(wrapperSource, /^#!\/usr\/bin\/env bash/, `${wrapper} should be a bash helper`);
  assert.ok(wrapperSource.includes("set -euo pipefail"), `${wrapper} should fail fast`);
  assert.ok(wrapperSource.includes(`$KIT_DIR/${target}`), `${wrapper} should delegate to ${target}`);
  assert.ok(fs.existsSync(path.join(repoRoot, target)), `${wrapper} target should exist: ${target}`);

  const syntaxResult = spawnSync("bash", ["-n", path.join(repoRoot, wrapper)], { encoding: "utf8" });
  if (syntaxResult.error && syntaxResult.error.code === "ENOENT") {
    console.log(`Bash not found; skipped syntax check for ${wrapper}`);
  } else {
    assert.strictEqual(
      syntaxResult.status,
      0,
      `${wrapper} should parse as bash\nstdout:\n${syntaxResult.stdout}\nstderr:\n${syntaxResult.stderr}`
    );
  }
}

for (const [wrapper, target] of [
  ["bin/cts-fix-windows-claude-settings.ps1", "bin/fix-windows-claude-settings.ps1"],
  ["bin/cts-remove-optional-codegraph.ps1", "bin/remove-optional-codegraph.ps1"],
]) {
  const wrapperSource = read(wrapper);
  assert.ok(wrapperSource.includes(`$PSScriptRoot\\${path.basename(target)}`), `${wrapper} should delegate to ${target}`);
  assert.ok(wrapperSource.includes("@args"), `${wrapper} should forward caller arguments`);
  assert.ok(fs.existsSync(path.join(repoRoot, target)), `${wrapper} target should exist: ${target}`);

  const ps = findPowerShell();
  if (ps) {
    const wrapperPath = path.join(repoRoot, wrapper);
    const syntaxResult = spawnSync(
      ps,
      [
        "-NoProfile",
        "-Command",
        "[scriptblock]::Create((Get-Content -Raw -LiteralPath $env:CTS_PS_TEST_PATH)) | Out-Null",
      ],
      { encoding: "utf8", env: { ...process.env, CTS_PS_TEST_PATH: wrapperPath } }
    );
    assert.strictEqual(
      syntaxResult.status,
      0,
      `${wrapper} should parse as PowerShell\nstdout:\n${syntaxResult.stdout}\nstderr:\n${syntaxResult.stderr}`
    );
  } else {
    console.log(`PowerShell not found; skipped syntax check for ${wrapper}`);
  }
}

console.log("helper script smoke tests passed");
