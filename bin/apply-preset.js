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

function printJson(value) {
  console.log(JSON.stringify(value, null, 2));
}

function fail(code, message, extra = {}) {
  if (jsonOutput) {
    printJson({
      schema_version: 1,
      command: "preset",
      target,
      preset: presetName,
      settings_path: settingsPath,
      error: {
        code,
        message,
        ...extra
      }
    });
  } else {
    console.error(message);
  }
  process.exit(2);
}

if (!Object.prototype.hasOwnProperty.call(PRESETS, presetName)) {
  fail("unknown_preset", `Unknown preset: ${presetName}. Use soft, balanced, or strict.`, {
    allowed: Object.keys(PRESETS)
  });
}

if (!fs.existsSync(settingsPath)) {
  fail("settings_missing", `Missing settings file: ${settingsPath}. Run scaffold first.`);
}

let settings;
try {
  settings = JSON.parse(fs.readFileSync(settingsPath, "utf8"));
} catch (exc) {
  fail("invalid_settings_json", `Invalid settings JSON: ${exc.message}`);
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
  printJson(report);
} else {
  console.log(`# Preset ${presetName}`);
  console.log("");
  console.log(`- Target: ${target}`);
  console.log(`- Changed: ${changed}`);
  console.log(`- Dry run: ${noWrite}`);
  if (report.backup) console.log(`- Backup: ${report.backup}`);
  if (report.warning) console.log(`- Warning: ${report.warning}`);
}
