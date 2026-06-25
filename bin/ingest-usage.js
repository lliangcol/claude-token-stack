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
const root = path.resolve(target, option("--root", ".token-stack/reports"));
const outJson = path.join(target, ".token-stack", "reports", "usage-summary.json");
const outMd = path.join(target, ".token-stack", "reports", "usage-summary.md");
const METRICS = new Set([
  "input_tokens",
  "cache_creation_input_tokens",
  "cache_read_input_tokens",
  "output_tokens",
  "total_tokens",
  "cost_usd",
  "total_cost_usd",
  "tool_calls"
]);

function walkFiles(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkFiles(full, out);
    else if (/\.(json|jsonl)$/i.test(entry.name)) out.push(full);
  }
  return out;
}

function visit(value, metrics) {
  if (Array.isArray(value)) {
    for (const item of value) visit(item, metrics);
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    if (METRICS.has(key)) {
      let next = child;
      if (key === "tool_calls" && Array.isArray(child)) next = child.length;
      if (typeof next === "boolean") next = next ? 1 : 0;
      if (typeof next === "number") metrics[key] = (metrics[key] || 0) + next;
    }
    visit(child, metrics);
  }
}

function parseFile(file) {
  const text = fs.readFileSync(file, "utf8");
  if (file.endsWith(".jsonl")) {
    return text.split(/\r?\n/).filter(Boolean).map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    }).filter(Boolean);
  }
  try {
    return [JSON.parse(text)];
  } catch {
    return [];
  }
}

const files = walkFiles(root).filter((file) => !/usage-summary|metrics-summary|metrics-collected/.test(path.basename(file)));
const summary = {
  schema_version: 1,
  command: "ingest-usage",
  target,
  root,
  outputs: {
    json: outJson,
    markdown: outMd
  },
  files: [],
  totals: {}
};

for (const file of files) {
  const metrics = {};
  const records = parseFile(file);
  for (const record of records) visit(record, metrics);
  if (Object.keys(metrics).length === 0) continue;
  summary.files.push({
    path: path.relative(target, file).replace(/\\/g, "/"),
    records: records.length,
    metrics
  });
  for (const [key, value] of Object.entries(metrics)) {
    summary.totals[key] = (summary.totals[key] || 0) + value;
  }
}

if (!("cost_usd" in summary.totals) && "total_cost_usd" in summary.totals) {
  summary.totals.cost_usd = summary.totals.total_cost_usd;
}
if (!("total_cost_usd" in summary.totals) && "cost_usd" in summary.totals) {
  summary.totals.total_cost_usd = summary.totals.cost_usd;
}

const md = [
  "# Usage Summary",
  "",
  `- Target: ${target}`,
  `- Root: ${root}`,
  `- Files: ${summary.files.length}`,
  "",
  ...Object.entries(summary.totals).map(([key, value]) => `- ${key}: ${value}`)
].join("\n") + "\n";

if (!noWrite) {
  fs.mkdirSync(path.dirname(outJson), { recursive: true });
  fs.writeFileSync(outJson, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
  fs.writeFileSync(outMd, md, "utf8");
}

if (jsonOutput) {
  console.log(JSON.stringify(Object.assign({}, summary, { dry_run: noWrite }), null, 2));
} else {
  console.log(noWrite ? md : `Wrote usage summary: ${outJson}`);
}
