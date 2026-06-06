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
const presetName = option("--name", args.find((arg) => ["soft", "balanced", "strict"].includes(arg)) || "soft");
const jsonOutput = args.includes("--json");
const noWrite = args.includes("--no-write") || args.includes("--dry-run") || args.includes("dry-run");
const settingsPath = path.join(target, ".claude", "settings.json");

const PRESETS = {
  soft: {
    TOKEN_GUARD_MODE: "warn",
    CBM_GATE_MODE: "warn",
    CBM_GATE_BLOCK_TOOLS: "Grep,Glob"
  },
  balanced: {
    TOKEN_GUARD_MODE: "block",
    CBM_GATE_MODE: "warn",
    CBM_GATE_BLOCK_TOOLS: "Grep,Glob"
  },
  strict: {
    TOKEN_GUARD_MODE: "block",
    CBM_GATE_MODE: "block",
    CBM_GATE_BLOCK_TOOLS: "Read,Grep,Glob"
  }
};

if (!Object.prototype.hasOwnProperty.call(PRESETS, presetName)) {
  console.error(`Unknown preset: ${presetName}. Use soft, balanced, or strict.`);
  process.exit(2);
}

if (!fs.existsSync(settingsPath)) {
  console.error(`Missing settings file: ${settingsPath}. Run scaffold first.`);
  process.exit(2);
}

let settings;
try {
  settings = JSON.parse(fs.readFileSync(settingsPath, "utf8"));
} catch (exc) {
  console.error(`Invalid settings JSON: ${exc.message}`);
  process.exit(2);
}

const before = Object.assign({}, settings.env || {});
settings.env = Object.assign({}, settings.env || {}, PRESETS[presetName]);
const after = Object.assign({}, settings.env);
const changed = JSON.stringify(before) !== JSON.stringify(after);
const backup = `${settingsPath}.bak.${Date.now()}`;

if (!noWrite && changed) {
  fs.copyFileSync(settingsPath, backup);
  fs.writeFileSync(settingsPath, `${JSON.stringify(settings, null, 2)}\n`, "utf8");
}

const report = {
  schema_version: 1,
  command: "preset",
  target,
  preset: presetName,
  dry_run: noWrite,
  changed,
  settings_path: settingsPath,
  backup: changed && !noWrite ? backup : null,
  env_before: before,
  env_after: after,
  warning: presetName === "strict" ? "strict enables Read blocking; review hook logs before applying to a team default" : ""
};

if (jsonOutput) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log(`# Preset ${presetName}`);
  console.log("");
  console.log(`- Target: ${target}`);
  console.log(`- Changed: ${changed}`);
  console.log(`- Dry run: ${noWrite}`);
  if (report.backup) console.log(`- Backup: ${report.backup}`);
  if (report.warning) console.log(`- Warning: ${report.warning}`);
}
