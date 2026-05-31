#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const root = path.resolve(__dirname, "..");
const args = process.argv.slice(2);
const command = args[0] || "help";
const dryRun = args.includes("dry-run") || args.includes("--dry-run");

function option(name, fallback) {
  const idx = args.indexOf(name);
  if (idx >= 0 && args[idx + 1]) return args[idx + 1];
  return fallback;
}

function passthroughArgs(startIndex = 1) {
  const out = [];
  for (let i = startIndex; i < args.length; i += 1) {
    if (args[i] === "--target") {
      i += 1;
      continue;
    }
    out.push(args[i]);
  }
  return out;
}

function targetDir() {
  return path.resolve(option("--target", process.cwd()));
}

function ensureDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function copyFile(rel, target) {
  const src = path.join(root, "templates", rel);
  const dst = path.join(target, rel);
  ensureDir(dst);
  if (dryRun) {
    console.log(`dry-run: copy ${src} -> ${dst}; existing file would be backed up first`);
    return;
  }
  if (fs.existsSync(dst)) {
    const srcContent = fs.readFileSync(src);
    const dstContent = fs.readFileSync(dst);
    if (Buffer.compare(srcContent, dstContent) === 0) {
      return;
    }
    const backupPath = `${dst}.bak.${Date.now()}`;
    fs.copyFileSync(dst, backupPath);
    console.warn(`claude-token-stack: existing ${rel} backed up to ${backupPath}`);
  }
  fs.copyFileSync(src, dst);
}

function mergeUnique(a = [], b = []) {
  const seen = new Set();
  const out = [];
  for (const item of [...a, ...b]) {
    const key = JSON.stringify(item);
    if (!seen.has(key)) {
      seen.add(key);
      out.push(item);
    }
  }
  return out;
}

function stableStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function mergeSettings(target) {
  const existingPath = path.join(target, ".claude", "settings.json");
  const templatePath = path.join(root, "templates", ".claude", "settings.json");
  if (dryRun) {
    console.log(`dry-run: merge ${templatePath} -> ${existingPath}`);
    return;
  }
  let base = {};
  let existingParsed = null;
  if (fs.existsSync(existingPath)) {
    const existingRaw = fs.readFileSync(existingPath, "utf8");
    try {
      existingParsed = JSON.parse(existingRaw);
      base = JSON.parse(JSON.stringify(existingParsed));
    } catch {
      const backupPath = `${existingPath}.bak.${Date.now()}`;
      fs.copyFileSync(existingPath, backupPath);
      console.warn(`claude-token-stack: existing settings.json is invalid JSON; backup preserved at ${backupPath}, merging from template.`);
      base = {};
    }
  }
  const next = JSON.parse(fs.readFileSync(templatePath, "utf8"));
  base.env = Object.assign({}, next.env || {}, base.env || {});
  base.permissions = base.permissions || {};
  for (const key of ["allow", "ask", "deny"]) {
    base.permissions[key] = mergeUnique(base.permissions[key], (next.permissions || {})[key]);
  }
  base.hooks = base.hooks || {};
  base.hooks.PreToolUse = mergeUnique(base.hooks.PreToolUse, (next.hooks || {}).PreToolUse);
  if (existingParsed && stableStringify(existingParsed) === stableStringify(base)) {
    return;
  }
  if (existingParsed) {
    const backupPath = `${existingPath}.bak.${Date.now()}`;
    fs.copyFileSync(existingPath, backupPath);
    console.warn(`claude-token-stack: existing .claude/settings.json backed up to ${backupPath}`);
  }
  ensureDir(existingPath);
  fs.writeFileSync(existingPath, `${JSON.stringify(base, null, 2)}\n`);
}

function appendGitignore(target) {
  const gitignorePath = path.join(target, ".gitignore");
  const entries = [".claude/logs/", ".token-stack/", "*.bak.*"];
  if (dryRun) {
    console.log(`dry-run: would append token stack ignore entries to ${gitignorePath}`);
    return;
  }
  let existing = "";
  if (fs.existsSync(gitignorePath)) {
    existing = fs.readFileSync(gitignorePath, "utf8");
  }
  const existingLines = new Set(existing.split(/\r?\n/).map((l) => l.trim()));
  const toAdd = entries.filter((e) => !existingLines.has(e));
  if (toAdd.length === 0) return;
  const addition = `\n# Claude Token Stack runtime files.\n${toAdd.join("\n")}\n`;
  fs.appendFileSync(gitignorePath, addition, "utf8");
}

function scaffold() {
  const target = targetDir();
  mergeSettings(target);
  appendGitignore(target);
  for (const rel of [
    ".claude/settings.local.unattended.example.json",
    ".claude/token-policy.md",
    ".claude/hooks/run-python-hook.js",
    ".claude/hooks/bash-token-guard.py",
    ".claude/hooks/cbm-gate.py",
    ".claude/output-styles/token-lean.md",
    "docs/claude-token-stack.md",
    "docs/claude-token-stack-rollback.md"
  ]) {
    copyFile(rel, target);
  }
  console.log(`Scaffolded claude-token-stack into ${target}`);
}

function runScript(script, extraArgs = []) {
  ensureBashAvailable();
  const target = targetDir();
  ensureExistingTargetDir(target);
  const scriptPath = path.join(root, "bin", script);
  const bashTarget = toBashPath(target);
  const scriptArgs = extraArgs.map(shellQuote).join(" ");
  const nodeDir = process.platform === "win32" ? winAbsoluteToBash(path.dirname(process.execPath)) : path.dirname(process.execPath);
  const nodePath = process.platform === "win32" ? winAbsoluteToBash(process.execPath) : process.execPath;
  const pathExport = nodeDir ? `export PATH=${shellQuote(nodeDir)}:"$PATH"; ` : "";
  const commandLine = `${pathExport}cd ${shellQuote(bashTarget)} && CTS_TARGET_DIR=${shellQuote(bashTarget)} CTS_NODE_PATH=${shellQuote(nodePath)} ${shellQuote(toBashPath(scriptPath))}${scriptArgs ? ` ${scriptArgs}` : ""}`;
  const result = spawnSync("bash", ["-lc", commandLine], {
    cwd: root,
    stdio: "inherit",
    env: Object.assign({}, process.env, { CTS_TARGET_DIR: toBashPath(target), CTS_NODE_PATH: nodePath }),
    shell: false
  });
  if (result.error) {
    console.error(result.error.message);
    process.exit(2);
  }
  process.exit(result.status ?? 2);
}

function ensureBashAvailable() {
  const result = spawnSync("bash", ["--version"], {
    encoding: "utf8",
    shell: false
  });
  if (result.error && result.error.code === "ENOENT") {
    console.error("claude-token-stack: this command uses Bash scripts. Install Git Bash/WSL2, or use scaffold/collect-metrics/compare-metrics only from native PowerShell.");
    process.exit(2);
  }
  if (result.error) {
    console.error(result.error.message);
    process.exit(2);
  }
}

function shellQuote(value) {
  return `'${String(value).replace(/'/g, "'\\''")}'`;
}

function toBashPath(filePath) {
  if (process.platform !== "win32") return filePath;
  const pwd = spawnSync("bash", ["-lc", "pwd"], {
    cwd: root,
    encoding: "utf8",
    shell: false
  });
  const absolute = path.resolve(filePath);
  const relative = path.relative(path.resolve(root), absolute);
  const isUnderRoot = relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
  if (!pwd.error && pwd.status === 0 && pwd.stdout.trim()) {
    if (isUnderRoot) {
      const rootBashPath = pwd.stdout.trim();
      return relative === "" ? rootBashPath : `${rootBashPath}/${relative.replace(/\\/g, "/")}`;
    }
  }
  const normalized = absolute.replace(/\\/g, "/");
  const match = normalized.match(/^([A-Za-z]):\/(.*)$/);
  if (!match) return normalized;
  return `/${match[1].toLowerCase()}/${match[2]}`;
}

function winAbsoluteToBash(filePath) {
  const normalized = path.resolve(filePath).replace(/\\/g, "/");
  const match = normalized.match(/^([A-Za-z]):\/(.*)$/);
  if (!match) return normalized;
  return `${bashDrivePrefix(match[1])}/${match[2]}`;
}

function bashDrivePrefix(driveLetter) {
  const pwd = spawnSync("bash", ["-lc", "pwd"], {
    cwd: root,
    encoding: "utf8",
    shell: false
  });
  const drive = driveLetter.toLowerCase();
  if (!pwd.error && pwd.status === 0 && pwd.stdout.trim().startsWith("/mnt/")) {
    return `/mnt/${drive}`;
  }
  return `/${drive}`;
}

function runPython(script, extraArgs = []) {
  const target = targetDir();
  ensureExistingTargetDir(target);
  const scriptPath = path.join(root, "bin", script);
  const candidates = process.platform === "win32" ? ["python", "py", "python3"] : ["python3", "python"];
  for (const cmd of candidates) {
    const result = spawnSync(cmd, [scriptPath, ...extraArgs], {
      cwd: target,
      stdio: "inherit",
      env: Object.assign({}, process.env, { CTS_TARGET_DIR: target }),
      shell: false
    });
    if (result.error && result.error.code === "ENOENT") continue;
    if (result.error) {
      console.error(result.error.message);
      process.exit(2);
    }
    process.exit(result.status ?? 2);
  }
  console.error(`Python not found. Tried: ${candidates.join(", ")}`);
  process.exit(2);
}

function ensureExistingTargetDir(target) {
  if (!fs.existsSync(target)) {
    console.error(`Target directory does not exist: ${target}`);
    process.exit(2);
  }
  if (!fs.statSync(target).isDirectory()) {
    console.error(`Target is not a directory: ${target}`);
    process.exit(2);
  }
}

switch (command) {
  case "scaffold":
    scaffold();
    break;
  case "verify":
    runScript("verify-claude-token-stack.sh", passthroughArgs());
    break;
  case "benchmark":
    runScript("run-token-benchmark.sh", passthroughArgs());
    break;
  case "collect-metrics":
    runPython("collect-metrics.py", passthroughArgs());
    break;
  case "compare-metrics":
    runPython("compare-metrics.py", passthroughArgs());
    break;
  case "tools":
  case "install-tools":
    runScript("install-claude-token-stack.sh", ["tools", ...passthroughArgs()]);
    break;
  case "all":
    runScript("install-claude-token-stack.sh", ["all", ...passthroughArgs()]);
    break;
  case "advanced-unattended":
    runScript("cts-run-agent-unattended.sh");
    break;
  case "help":
  default:
    console.log("Usage: claude-token-stack <scaffold|verify|benchmark|collect-metrics|compare-metrics|tools|all|advanced-unattended> [--target DIR] [dry-run|--dry-run]");
    break;
}
