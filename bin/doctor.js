#!/usr/bin/env node
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const repoRoot = path.resolve(__dirname, "..");
const args = process.argv.slice(2);

function option(name, fallback) {
  const idx = args.indexOf(name);
  if (idx >= 0 && args[idx + 1]) return args[idx + 1];
  return fallback;
}

const target = path.resolve(option("--target", process.cwd()));
const jsonOutput = args.includes("--json");

function run(cmd, runArgs = [], options = {}) {
  return spawnSync(cmd, runArgs, {
    encoding: "utf8",
    shell: false,
    cwd: options.cwd || target,
    input: options.input,
    env: Object.assign({}, process.env, options.env || {})
  });
}

function commandVersion(candidates, versionArgs = ["--version"]) {
  for (const cmd of candidates) {
    const result = run(cmd, versionArgs);
    if (result.error && result.error.code === "ENOENT") continue;
    if (result.error) return { found: false, command: cmd, error: result.error.message };
    const text = `${result.stdout || ""}${result.stderr || ""}`.split(/\r?\n/).find(Boolean) || "";
    return { found: result.status === 0, command: cmd, version: text.trim(), status: result.status };
  }
  return { found: false, command: candidates[0], error: "not found" };
}

function npmVersion() {
  if (process.env.npm_execpath && fs.existsSync(process.env.npm_execpath)) {
    const result = run(process.execPath, [process.env.npm_execpath, "--version"], { cwd: repoRoot });
    if (result.status === 0) {
      return { found: true, command: "npm", version: result.stdout.trim() };
    }
  }
  if (process.platform === "win32") {
    const result = run("cmd.exe", ["/d", "/s", "/c", "npm --version"], { cwd: repoRoot });
    if (!result.error && result.status === 0) {
      return { found: true, command: "npm", version: result.stdout.trim() };
    }
    return { found: false, command: "npm", error: result.error ? result.error.message : (result.stderr || "npm not found").trim() };
  }
  return commandVersion(["npm"]);
}

function add(checks, status, name, detail = "") {
  checks.push({ status, name, detail });
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function compareFile(checks, rel, targetRel = rel) {
  const src = path.join(repoRoot, "templates", rel);
  const dst = path.join(target, targetRel);
  if (!fs.existsSync(src)) {
    add(checks, "FAIL", `${rel} template`, "template missing");
    return;
  }
  if (!fs.existsSync(dst)) {
    add(checks, "WARN", `${targetRel} dogfood sync`, "target file missing");
    return;
  }
  const same = fs.readFileSync(src).equals(fs.readFileSync(dst));
  add(checks, same ? "PASS" : "WARN", `${targetRel} dogfood sync`, same ? "matches template" : `differs from templates/${rel}`);
}

function findPython() {
  const candidates = process.platform === "win32" ? ["python", "py", "python3"] : ["python3", "python"];
  for (const cmd of candidates) {
    const result = run(cmd, ["--version"], { cwd: repoRoot });
    if (result.error && result.error.code === "ENOENT") continue;
    if (result.status === 0) return cmd;
  }
  return null;
}

function hookSample(checks) {
  const python = findPython();
  const node = commandVersion(["node"]).found;
  if (!python || !node) {
    add(checks, "WARN", "hook behavior sample", "node or python unavailable");
    return;
  }
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "cts-doctor-hook-"));
  try {
    const result = run(
      process.execPath,
      [
        path.join(repoRoot, "templates", ".claude", "hooks", "run-python-hook.js"),
        path.join(repoRoot, "templates", ".claude", "hooks", "bash-token-guard.py")
      ],
      {
        cwd: repoRoot,
        input: JSON.stringify({ tool_name: "Bash", tool_input: { command: "ls -R" } }),
        env: { CLAUDE_PROJECT_DIR: tempDir, TOKEN_GUARD_MODE: "block" }
      }
    );
    add(checks, result.status === 2 ? "PASS" : "FAIL", "hook blocks ls -R sample", `exit=${result.status}`);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

const checks = [];

if (!fs.existsSync(target)) {
  add(checks, "FAIL", "target exists", target);
} else {
  add(checks, "PASS", "target exists", target);
}

for (const [name, candidates] of [
  ["git", ["git"]],
  ["node", ["node"]],
  ["npm", ["npm"]],
  ["python", process.platform === "win32" ? ["python", "py", "python3"] : ["python3", "python"]],
  ["bash", ["bash"]],
  ["claude", ["claude"]]
]) {
  const version = name === "npm" ? npmVersion() : commandVersion(candidates);
  if (name === "bash" || name === "claude") {
    add(checks, version.found ? "PASS" : "WARN", `${name} available`, version.version || version.error || "");
  } else {
    add(checks, version.found ? "PASS" : "FAIL", `${name} available`, version.version || version.error || "");
  }
}

for (const rel of [
  "package.json",
  "templates/.claude/settings.json",
  "templates/.mcp.local.example.json",
  "templates/.claude/hooks/run-python-hook.js",
  "templates/.claude/hooks/bash-token-guard.py",
  "templates/.claude/hooks/cbm-gate.py"
]) {
  const filePath = path.join(repoRoot, rel);
  add(checks, fs.existsSync(filePath) ? "PASS" : "FAIL", `${rel} exists`);
}

for (const rel of ["package.json", "templates/.claude/settings.json", ".claude/settings.json", ".codex/hooks.json"]) {
  const filePath = path.join(repoRoot, rel);
  if (!fs.existsSync(filePath)) {
    add(checks, "WARN", `${rel} JSON parse`, "file missing");
    continue;
  }
  try {
    readJson(filePath);
    add(checks, "PASS", `${rel} JSON parse`);
  } catch (exc) {
    add(checks, "FAIL", `${rel} JSON parse`, exc.message);
  }
}

compareFile(checks, ".claude/hooks/run-python-hook.js");
compareFile(checks, ".claude/hooks/bash-token-guard.py");
compareFile(checks, ".claude/hooks/cbm-gate.py");
compareFile(checks, ".claude/settings.json");
if (fs.existsSync(path.join(target, ".codex"))) {
  compareFile(checks, ".claude/hooks/run-python-hook.js", ".codex/hooks/run-python-hook.js");
  compareFile(checks, ".claude/hooks/bash-token-guard.py", ".codex/hooks/bash-token-guard.py");
  compareFile(checks, ".claude/hooks/cbm-gate.py", ".codex/hooks/cbm-gate.py");
}

const python = findPython();
if (python) {
  const result = run(python, [
    "-m",
    "py_compile",
    path.join(repoRoot, "templates", ".claude", "hooks", "bash-token-guard.py"),
    path.join(repoRoot, "templates", ".claude", "hooks", "cbm-gate.py"),
    path.join(repoRoot, "bin", "collect-metrics.py"),
    path.join(repoRoot, "bin", "compare-metrics.py")
  ], { cwd: repoRoot });
  add(checks, result.status === 0 ? "PASS" : "FAIL", "python compile", result.stderr.trim());
}

hookSample(checks);

const settingsPath = path.join(repoRoot, "templates", ".claude", "settings.json");
if (fs.existsSync(settingsPath)) {
  const raw = fs.readFileSync(settingsPath, "utf8");
  add(checks, raw.includes("node -e") ? "WARN" : "PASS", "hook command shell surface", raw.includes("node -e") ? "node -e found" : "uses runner command");
}

const totals = checks.reduce((acc, check) => {
  acc[check.status] = (acc[check.status] || 0) + 1;
  return acc;
}, {});

const report = {
  schema_version: 1,
  command: "doctor",
  target,
  platform: process.platform,
  arch: process.arch,
  node: process.version,
  checks,
  totals
};

if (jsonOutput) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log("# Claude Token Stack Doctor");
  console.log("");
  console.log(`- Target: ${target}`);
  console.log(`- Platform: ${process.platform}/${process.arch}`);
  console.log(`- PASS: ${totals.PASS || 0}`);
  console.log(`- WARN: ${totals.WARN || 0}`);
  console.log(`- FAIL: ${totals.FAIL || 0}`);
  console.log("");
  for (const check of checks) {
    console.log(`- [${check.status}] ${check.name}${check.detail ? ` - ${check.detail}` : ""}`);
  }
}

process.exit((totals.FAIL || 0) > 0 ? 1 : 0);
