#!/usr/bin/env node
const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const repoRoot = path.resolve(__dirname, "..", "..");
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "cts package install "));

function run(cmd, args, options = {}) {
  return spawnSync(cmd, args, {
    cwd: options.cwd || repoRoot,
    encoding: "utf8",
    shell: false,
    timeout: 120000,
    env: Object.assign({}, process.env, { NO_COLOR: "1" }, options.env || {})
  });
}

function runInstalledCts(consumerRoot, args) {
  return run("npm", ["exec", "--offline", "--", "cts", ...args], { cwd: consumerRoot });
}

try {
  const packRoot = path.join(tempRoot, "pack out");
  const consumerRoot = path.join(tempRoot, "consumer project");
  const targetRoot = path.join(tempRoot, "target repo");
  fs.mkdirSync(packRoot, { recursive: true });
  fs.mkdirSync(consumerRoot, { recursive: true });
  fs.mkdirSync(targetRoot, { recursive: true });
  fs.writeFileSync(path.join(consumerRoot, "package.json"), JSON.stringify({ private: true }, null, 2), "utf8");

  const packResult = run("npm", ["pack", "--json", "--pack-destination", packRoot]);
  assert.strictEqual(
    packResult.status,
    0,
    `npm pack --json should pass\nstdout:\n${packResult.stdout}\nstderr:\n${packResult.stderr}\nerror:\n${packResult.error}`
  );
  const packJson = JSON.parse(packResult.stdout);
  assert.ok(Array.isArray(packJson) && packJson.length === 1, "npm pack JSON should contain one package entry");
  const packedFilename = packJson[0].filename;
  const tarballPath = path.isAbsolute(packedFilename)
    ? packedFilename
    : path.join(packRoot, path.basename(packedFilename));
  assert.ok(fs.existsSync(tarballPath), `tarball should exist at ${tarballPath}`);

  const installResult = run(
    "npm",
    ["install", "--offline", "--ignore-scripts", "--no-audit", "--no-fund", tarballPath],
    { cwd: consumerRoot }
  );
  assert.strictEqual(
    installResult.status,
    0,
    `local tarball install should pass\nstdout:\n${installResult.stdout}\nstderr:\n${installResult.stderr}\nerror:\n${installResult.error}`
  );

  const helpResult = runInstalledCts(consumerRoot, ["--help"]);
  assert.strictEqual(
    helpResult.status,
    0,
    `installed cts --help should pass\nstdout:\n${helpResult.stdout}\nstderr:\n${helpResult.stderr}\nerror:\n${helpResult.error}`
  );
  assert.match(helpResult.stdout, /Usage: claude-token-stack <command> \[options\]/);
  assert.match(helpResult.stdout, /JSON\/no-write commands:/);
  assert.match(helpResult.stdout, /Scaffold and Bash-backed commands:/);

  const validateResult = runInstalledCts(consumerRoot, [
    "validate-artifacts",
    "--target",
    targetRoot,
    "--json",
    "--no-write"
  ]);
  assert.strictEqual(
    validateResult.status,
    0,
    `installed validate-artifacts should pass\nstdout:\n${validateResult.stdout}\nstderr:\n${validateResult.stderr}\nerror:\n${validateResult.error}`
  );
  assert.strictEqual(validateResult.stderr, "", "installed validate-artifacts --json --no-write should keep stderr clean");
  const validatePayload = JSON.parse(validateResult.stdout);
  assert.strictEqual(validatePayload.command, "validate-artifacts");
  assert.strictEqual(validatePayload.target, targetRoot);
  assert.ok(validatePayload.groups, "validate-artifacts JSON should include grouped findings");
} finally {
  fs.rmSync(tempRoot, { recursive: true, force: true });
}

console.log("package install smoke tests passed");
