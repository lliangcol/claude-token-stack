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
const noWrite = args.includes("--no-write") || args.includes("--dry-run") || args.includes("dry-run");
const outJson = path.join(target, ".token-stack", "reports", "log-analysis.json");
const outMd = path.join(target, ".token-stack", "reports", "log-analysis.md");

function collectFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && /\.(log|jsonl)$/i.test(entry.name))
    .map((entry) => path.join(dir, entry.name));
}

function bump(map, key) {
  map[key] = (map[key] || 0) + 1;
}

const files = [
  ...collectFiles(path.join(target, ".claude", "logs")),
  ...collectFiles(path.join(target, ".token-stack", "logs"))
];
const summary = {
  schema_version: 1,
  command: "analyze-logs",
  target,
  files: [],
  totals: {
    records: 0,
    violations: {},
    advisories: {},
    messages: {},
    modes: {},
    tools: {}
  }
};

for (const file of files) {
  const fileSummary = { path: path.relative(target, file).replace(/\\/g, "/"), records: 0 };
  const lines = fs.readFileSync(file, "utf8").split(/\r?\n/).filter(Boolean);
  for (const line of lines) {
    let data = null;
    try {
      data = JSON.parse(line);
    } catch {
      continue;
    }
    fileSummary.records += 1;
    summary.totals.records += 1;
    if (data.mode) bump(summary.totals.modes, String(data.mode));
    if (data.tool_name) bump(summary.totals.tools, String(data.tool_name));
    for (const value of data.violations || []) bump(summary.totals.violations, String(value));
    for (const value of data.advisories || []) bump(summary.totals.advisories, String(value));
    for (const value of data.messages || []) bump(summary.totals.messages, String(value));
  }
  summary.files.push(fileSummary);
}

const md = [
  "# Log Analysis",
  "",
  `- Target: ${target}`,
  `- Files: ${summary.files.length}`,
  `- Records: ${summary.totals.records}`,
  "",
  "## Modes",
  ...Object.entries(summary.totals.modes).map(([key, value]) => `- ${key}: ${value}`),
  "",
  "## Violations",
  ...Object.entries(summary.totals.violations).map(([key, value]) => `- ${value} x ${key}`),
  "",
  "## Advisories",
  ...Object.entries(summary.totals.advisories).map(([key, value]) => `- ${value} x ${key}`),
  "",
  "## Messages",
  ...Object.entries(summary.totals.messages).map(([key, value]) => `- ${value} x ${key}`)
].join("\n") + "\n";

if (!noWrite) {
  fs.mkdirSync(path.dirname(outJson), { recursive: true });
  fs.writeFileSync(outJson, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
  fs.writeFileSync(outMd, md, "utf8");
}

if (jsonOutput) {
  console.log(JSON.stringify(Object.assign({}, summary, { dry_run: noWrite }), null, 2));
} else {
  console.log(noWrite ? md : `Wrote log analysis: ${outJson}`);
}
