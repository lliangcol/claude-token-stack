#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const args = process.argv.slice(2);

function option(name, fallback) {
  const idx = args.indexOf(name);
  if (idx >= 0 && args[idx + 1]) return args[idx + 1];
  return fallback;
}

const target = path.resolve(option("--target", process.cwd()));
const jsonOutput = args.includes("--json");
const settingsFiles = [
  path.join(target, ".claude", "settings.json"),
  path.join(target, ".codex", "hooks.json")
];
const tokenHookMatchers = {
  Bash: "bash-token-guard.py",
  Read: "cbm-gate.py",
  Grep: "cbm-gate.py",
  Glob: "cbm-gate.py"
};

function add(findings, status, code, file, detail, matcher = "") {
  findings.push({ status, code, file, matcher, detail });
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function commandText(hook) {
  if (!hook || typeof hook !== "object") return "";
  const command = typeof hook.command === "string" ? hook.command : "";
  const argsText = Array.isArray(hook.args) ? hook.args.join(" ") : "";
  return `${command}${argsText ? ` ${argsText}` : ""}`.trim();
}

function hookEntries(settings) {
  return (((settings || {}).hooks || {}).PreToolUse || []).filter((entry) => entry && typeof entry === "object");
}

function auditFile(file, findings) {
  if (!fs.existsSync(file)) {
    add(findings, "WARN", "settings_missing", path.relative(target, file), "settings file not found");
    return;
  }
  let settings;
  try {
    settings = readJson(file);
    add(findings, "PASS", "settings_json", path.relative(target, file), "valid JSON");
  } catch (exc) {
    add(findings, "FAIL", "settings_json", path.relative(target, file), exc.message);
    return;
  }

  const counts = Object.fromEntries(Object.keys(tokenHookMatchers).map((matcher) => [matcher, 0]));
  for (const entry of hookEntries(settings)) {
    const matcher = entry.matcher || "";
    for (const hook of entry.hooks || []) {
      const command = commandText(hook);
      if (!command) {
        add(findings, "WARN", "hook_command_missing", path.relative(target, file), "hook has no command", matcher);
        continue;
      }
      if (command.includes("node -e")) {
        add(findings, "WARN", "node_eval_hook", path.relative(target, file), "hook uses inline node -e command", matcher);
      }
      if (/\b(curl|wget)\b[^|;&]*\|\s*(sh|bash)\b/i.test(command)) {
        add(findings, "FAIL", "remote_shell_pipe", path.relative(target, file), "hook command pipes remote content into a shell", matcher);
      }
      for (const [expectedMatcher, hookName] of Object.entries(tokenHookMatchers)) {
        if (matcher === expectedMatcher && command.includes(hookName)) {
          counts[matcher] += 1;
        }
      }
      const hookRefs = [...command.matchAll(/\.claude[\\/]+hooks[\\/]+([A-Za-z0-9_.-]+)/g)].map((match) => match[1]);
      for (const hookName of hookRefs) {
        if (!fs.existsSync(path.join(target, ".claude", "hooks", hookName))) {
          add(findings, "WARN", "hook_target_missing", path.relative(target, file), `.claude/hooks/${hookName} is referenced but missing`, matcher);
        }
      }
    }
  }

  for (const [matcher, count] of Object.entries(counts)) {
    if (count === 0) {
      add(findings, "WARN", "token_hook_missing", path.relative(target, file), "token hook not configured", matcher);
    } else if (count === 1) {
      add(findings, "PASS", "token_hook_count", path.relative(target, file), "exactly one token hook", matcher);
    } else {
      add(findings, "WARN", "token_hook_duplicate", path.relative(target, file), `duplicate token hooks: ${count}`, matcher);
    }
  }

  const env = settings.env && typeof settings.env === "object" ? settings.env : {};
  for (const name of ["TOKEN_GUARD_MODE", "CBM_GATE_MODE"]) {
    const value = String(env[name] || "").toLowerCase();
    if (value && !["warn", "block", "off"].includes(value)) {
      add(findings, "WARN", "invalid_mode", path.relative(target, file), `${name}=${value}`, "");
    }
  }
}

const findings = [];
for (const file of settingsFiles) {
  auditFile(file, findings);
}

const totals = findings.reduce((acc, finding) => {
  acc[finding.status] = (acc[finding.status] || 0) + 1;
  return acc;
}, {});
const report = {
  schema_version: 1,
  command: "audit-hooks",
  target,
  findings,
  totals
};

if (jsonOutput) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log("# Hook Audit");
  console.log("");
  console.log(`- Target: ${target}`);
  console.log(`- PASS: ${totals.PASS || 0}`);
  console.log(`- WARN: ${totals.WARN || 0}`);
  console.log(`- FAIL: ${totals.FAIL || 0}`);
  console.log("");
  for (const finding of findings) {
    console.log(`- [${finding.status}] ${finding.code} ${finding.file}${finding.matcher ? ` matcher=${finding.matcher}` : ""} - ${finding.detail}`);
  }
}

process.exit((totals.FAIL || 0) > 0 ? 1 : 0);
