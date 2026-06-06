#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const root = path.resolve(__dirname, "..");
const args = process.argv.slice(2);
const command = args[0] || "help";
const dryRun = args.includes("dry-run") || args.includes("--dry-run");
const jsonOutput = args.includes("--json");
const tokenHookMatchers = {
  Bash: "bash-token-guard.py",
  Read: "cbm-gate.py",
  Grep: "cbm-gate.py",
  Glob: "cbm-gate.py"
};
const tokenHookNames = new Set(["run-python-hook.js", "bash-token-guard.py", "cbm-gate.py"]);

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
    if (args[i] === "--json") {
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

function readJsonFile(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function hookCommand(hook) {
  return hook && typeof hook.command === "string" ? hook.command : "";
}

function isTokenHookForMatcher(item) {
  const matcher = item && item.matcher;
  if (!Object.prototype.hasOwnProperty.call(tokenHookMatchers, matcher)) return false;
  return (item.hooks || []).some((hook) => hookCommand(hook).includes(tokenHookMatchers[matcher]));
}

function countTokenHooks(settings) {
  const counts = {};
  for (const matcher of Object.keys(tokenHookMatchers)) counts[matcher] = 0;
  const entries = (((settings || {}).hooks || {}).PreToolUse || []);
  for (const entry of entries) {
    const matcher = entry && entry.matcher;
    if (!Object.prototype.hasOwnProperty.call(counts, matcher)) continue;
    for (const hook of entry.hooks || []) {
      const commandText = hookCommand(hook);
      if (commandText.includes(tokenHookMatchers[matcher])) {
        counts[matcher] += 1;
      }
    }
  }
  return counts;
}

function mergeTokenPreToolUse(existing = [], template = [], decisions = []) {
  const out = [...existing];
  const existingSettings = { hooks: { PreToolUse: out } };
  for (const item of template) {
    if (!isTokenHookForMatcher(item)) {
      out.push(item);
      continue;
    }
    const matcher = item.matcher;
    const counts = countTokenHooks(existingSettings);
    if (counts[matcher] > 0) {
      decisions.push({
        matcher,
        action: "skipped",
        reason: "existing_token_hook",
        existing: counts[matcher],
        template_hook: tokenHookMatchers[matcher]
      });
      continue;
    }
    out.push(item);
    decisions.push({
      matcher,
      action: "added",
      reason: "missing_token_hook",
      existing: 0,
      template_hook: tokenHookMatchers[matcher]
    });
  }
  return out;
}

function reportPathExists(target, rel) {
  return fs.existsSync(path.join(target, rel));
}

function blockEvidence(target) {
  const verifyReport = reportPathExists(target, path.join(".token-stack", "reports", "verify-report.json"));
  const metricsSummary = reportPathExists(target, path.join(".token-stack", "reports", "metrics-summary.json"));
  const tokenLog = reportPathExists(target, path.join(".claude", "logs", "token-guard.log"));
  const cbmLog = reportPathExists(target, path.join(".claude", "logs", "cbm-gate.log"));
  return { verify_report: verifyReport, metrics_summary: metricsSummary, hook_logs: tokenLog || cbmLog };
}

function missingHookTargets(settings, target, plannedTemplateFiles = []) {
  const planned = new Set(plannedTemplateFiles.map((rel) => path.normalize(rel)));
  const missing = [];
  const entries = (((settings || {}).hooks || {}).PreToolUse || []);
  for (const entry of entries) {
    for (const hook of entry.hooks || []) {
      const commandText = hookCommand(hook);
      const names = new Set();
      for (const name of tokenHookNames) {
        if (commandText.includes(name)) names.add(name);
      }
      for (const name of names) {
        const rel = path.join(".claude", "hooks", name);
        const abs = path.join(target, rel);
        if (!fs.existsSync(abs) && !planned.has(path.normalize(rel))) {
          missing.push({ matcher: entry.matcher || "", file: rel, command_hook: name });
        }
      }
    }
  }
  return missing;
}

function analyzeTokenSettings(settings, target, options = {}) {
  const env = Object.assign({}, (settings || {}).env || {});
  const counts = countTokenHooks(settings);
  const evidence = blockEvidence(target);
  const risks = [];
  const envChecks = {};
  for (const name of ["TOKEN_GUARD_MODE", "CBM_GATE_MODE", "CBM_GATE_BLOCK_TOOLS"]) {
    envChecks[name] = env[name] || "";
  }

  for (const [matcher, count] of Object.entries(counts)) {
    if (count > 1) {
      risks.push({
        status: "WARN",
        code: "duplicate_token_hook",
        matcher,
        detail: `${count} token hooks configured for ${matcher}`
      });
    }
  }

  for (const item of missingHookTargets(settings, target, options.plannedTemplateFiles || [])) {
    risks.push({
      status: "WARN",
      code: "missing_hook_target",
      matcher: item.matcher,
      file: item.file,
      detail: `${item.command_hook} is referenced but ${item.file} does not exist`
    });
  }

  for (const name of ["TOKEN_GUARD_MODE", "CBM_GATE_MODE"]) {
    if (String(env[name] || "").toLowerCase() === "block" && (!evidence.verify_report || !evidence.metrics_summary)) {
      risks.push({
        status: "WARN",
        code: "block_without_evidence",
        env: name,
        evidence,
        detail: `${name}=block but verify-report.json and metrics-summary.json were not both found`
      });
    }
  }

  const blockTools = String(env.CBM_GATE_BLOCK_TOOLS || "");
  if (blockTools) {
    const tools = blockTools.split(",").map((item) => item.trim()).filter(Boolean);
    const unknown = tools.filter((tool) => !["Read", "Grep", "Glob"].includes(tool));
    if (unknown.length > 0) {
      risks.push({
        status: "WARN",
        code: "unknown_cbm_gate_block_tool",
        tools: unknown,
        detail: `unknown CBM_GATE_BLOCK_TOOLS entries: ${unknown.join(",")}`
      });
    }
    if (tools.includes("Read")) {
      risks.push({
        status: "WARN",
        code: "read_block_enabled",
        detail: "CBM_GATE_BLOCK_TOOLS includes Read; keep Read in warn unless false positives are reviewed"
      });
    }
  }

  return {
    env: envChecks,
    token_hooks: Object.fromEntries(Object.entries(counts).map(([matcher, count]) => [
      matcher,
      { count, status: count === 0 ? "new" : count === 1 ? "existing" : "duplicate" }
    ])),
    evidence,
    risks
  };
}

function scaffoldTemplateFiles() {
  return [
    ".mcp.local.example.json",
    ".claude/settings.local.unattended.example.json",
    ".claude/token-policy.md",
    ".claude/hooks/run-python-hook.js",
    ".claude/hooks/bash-token-guard.py",
    ".claude/hooks/cbm-gate.py",
    ".claude/output-styles/token-lean.md",
    "docs/claude-token-stack.md",
    "docs/claude-token-stack-rollback.md",
    "docs/context-pack-template.md",
    "docs/mcp-local-smoke.md"
  ];
}

function buildScaffoldPlan(target, existingSettings, mergedSettings, hookDecisions, options = {}) {
  const templateFiles = scaffoldTemplateFiles();
  const plan = [];
  const settingsPath = path.join(target, ".claude", "settings.json");
  const existingSettingsExists = Boolean(options.existingSettingsExists || existingSettings);
  const invalidExistingSettings = Boolean(options.invalidExistingSettings);
  plan.push({
    action: existingSettingsExists ? "merge" : "create",
    path: ".claude/settings.json",
    backup_required: Boolean(
      existingSettingsExists && (invalidExistingSettings || stableStringify(existingSettings) !== stableStringify(mergedSettings))
    ),
    invalid_existing_json: invalidExistingSettings,
    hook_decisions: hookDecisions
  });
  const gitignorePath = path.join(target, ".gitignore");
  plan.push({
    action: fs.existsSync(gitignorePath) ? "append" : "create",
    path: ".gitignore",
    entries: [".claude/logs/", ".token-stack/", "*.bak.*"]
  });
  for (const rel of templateFiles) {
    const dst = path.join(target, rel);
    let action = "copy";
    if (fs.existsSync(dst)) {
      const src = path.join(root, "templates", rel);
      action = Buffer.compare(fs.readFileSync(src), fs.readFileSync(dst)) === 0 ? "skip" : "replace";
    }
    plan.push({ action, path: rel, backup_required: action === "replace" });
  }
  return { settings_path: settingsPath, plan };
}

function printScaffoldPlan(planPayload) {
  if (jsonOutput) {
    console.log(`${JSON.stringify(planPayload, null, 2)}`);
    return;
  }
  console.log(`dry-run: scaffold plan for ${planPayload.target}`);
  for (const item of planPayload.plan) {
    const backup = item.backup_required ? " backup=yes" : "";
    console.log(`PLAN ${item.action} ${item.path}${backup}`);
    if (item.path === ".claude/settings.json") {
      for (const decision of item.hook_decisions || []) {
        console.log(`HOOK ${decision.matcher} ${decision.action} ${decision.reason}`);
      }
    }
  }
  for (const [matcher, info] of Object.entries(planPayload.token_settings.token_hooks)) {
    console.log(`HOOK_STATUS ${matcher} ${info.status} count=${info.count}`);
  }
  for (const risk of planPayload.risks) {
    console.log(`${risk.status} ${risk.code}${risk.matcher ? ` matcher=${risk.matcher}` : ""}${risk.env ? ` env=${risk.env}` : ""} ${risk.detail || ""}`);
  }
}

function mergeSettings(target) {
  const existingPath = path.join(target, ".claude", "settings.json");
  const templatePath = path.join(root, "templates", ".claude", "settings.json");
  let base = {};
  let existingParsed = null;
  const existingSettingsExists = fs.existsSync(existingPath);
  let invalidExistingSettings = false;
  if (existingSettingsExists) {
    const existingRaw = fs.readFileSync(existingPath, "utf8");
    try {
      existingParsed = JSON.parse(existingRaw);
      base = JSON.parse(JSON.stringify(existingParsed));
    } catch {
      invalidExistingSettings = true;
      const backupPath = `${existingPath}.bak.${Date.now()}`;
      if (!dryRun) {
        fs.copyFileSync(existingPath, backupPath);
        console.warn(`claude-token-stack: existing settings.json is invalid JSON; backup preserved at ${backupPath}, merging from template.`);
      }
      base = {};
    }
  }
  const next = readJsonFile(templatePath);
  base.env = Object.assign({}, next.env || {}, base.env || {});
  base.permissions = base.permissions || {};
  for (const key of ["allow", "ask", "deny"]) {
    base.permissions[key] = mergeUnique(base.permissions[key], (next.permissions || {})[key]);
  }
  base.hooks = base.hooks || {};
  const hookDecisions = [];
  base.hooks.PreToolUse = mergeUnique(
    mergeTokenPreToolUse(base.hooks.PreToolUse, (next.hooks || {}).PreToolUse, hookDecisions),
    []
  );
  if (dryRun) {
    const planDetails = buildScaffoldPlan(target, existingParsed, base, hookDecisions, {
      existingSettingsExists,
      invalidExistingSettings
    });
    const tokenSettings = analyzeTokenSettings(base, target, { plannedTemplateFiles: scaffoldTemplateFiles() });
    const existingCounts = countTokenHooks(existingParsed || {});
    for (const matcher of Object.keys(tokenHookMatchers)) {
      const count = existingCounts[matcher] || 0;
      tokenSettings.token_hooks[matcher] = {
        count,
        planned_count: count + hookDecisions.filter((item) => item.matcher === matcher && item.action === "added").length,
        status: count === 0 ? "new" : count === 1 ? "existing" : "duplicate"
      };
      if (count > 1 && !tokenSettings.risks.some((risk) => risk.code === "duplicate_token_hook" && risk.matcher === matcher)) {
        tokenSettings.risks.push({
          status: "WARN",
          code: "duplicate_token_hook",
          matcher,
          detail: `${count} existing token hooks configured for ${matcher}`
        });
      }
    }
    if (invalidExistingSettings) {
      tokenSettings.risks.push({
        status: "WARN",
        code: "invalid_settings_json",
        file: ".claude/settings.json",
        detail: "existing .claude/settings.json is invalid JSON and would be backed up before template merge"
      });
    }
    printScaffoldPlan({
      schema_version: 1,
      command: "scaffold",
      dry_run: true,
      target,
      settings_path: planDetails.settings_path,
      plan: planDetails.plan,
      token_settings: tokenSettings,
      risks: tokenSettings.risks
    });
    return;
  }
  for (const decision of hookDecisions.filter((item) => item.action === "skipped")) {
    console.warn(`claude-token-stack: ${decision.matcher} token hook already exists; skipped template hook`);
  }
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
  if (dryRun) {
    if (!jsonOutput) {
      console.log(`Dry-run scaffolded claude-token-stack into ${target}`);
    }
    return;
  }
  appendGitignore(target);
  for (const rel of scaffoldTemplateFiles()) {
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

function runNodeTool(script, extraArgs = args.slice(1)) {
  const target = targetDir();
  ensureExistingTargetDir(target);
  const scriptPath = path.join(root, "bin", script);
  const result = spawnSync(process.execPath, [scriptPath, ...extraArgs], {
    cwd: root,
    stdio: "inherit",
    env: Object.assign({}, process.env, { CTS_TARGET_DIR: target }),
    shell: false
  });
  if (result.error) {
    console.error(result.error.message);
    process.exit(2);
  }
  process.exit(result.status ?? 2);
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
  case "doctor":
    runNodeTool("doctor.js");
    break;
  case "audit-hooks":
    runNodeTool("audit-hooks.js");
    break;
  case "pack-context":
    runNodeTool("pack-context.js");
    break;
  case "analyze-logs":
    runNodeTool("analyze-logs.js");
    break;
  case "ingest-usage":
    runNodeTool("ingest-usage.js");
    break;
  case "events":
    runNodeTool("event-store.js");
    break;
  case "preset":
  case "presets":
    runNodeTool("apply-preset.js");
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
    console.log("Usage: claude-token-stack <scaffold|verify|benchmark|collect-metrics|compare-metrics|doctor|audit-hooks|pack-context|analyze-logs|ingest-usage|events|preset|tools|all|advanced-unattended> [--target DIR] [dry-run|--dry-run|--no-write|--json]");
    break;
}
