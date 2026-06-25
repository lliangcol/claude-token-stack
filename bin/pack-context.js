#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const args = process.argv.slice(2);

function option(name, fallback) {
  const idx = args.indexOf(name);
  if (idx >= 0 && args[idx + 1]) return args[idx + 1];
  return fallback;
}

const target = path.resolve(option("--target", process.cwd()));
const budget = Number(option("--budget", "60000"));
const outPath = path.resolve(target, option("--out", ".token-stack/context/context-pack.md"));
const manifestPath = outPath.replace(/\.md$/i, ".manifest.json");
const jsonOutput = args.includes("--json");
const noWrite = args.includes("--no-write") || args.includes("--dry-run") || args.includes("dry-run");

function printJson(value) {
  console.log(JSON.stringify(value, null, 2));
}

function fail(code, message, extra = {}) {
  if (jsonOutput) {
    printJson({
      schema_version: 1,
      command: "pack-context",
      target,
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

if (!Number.isFinite(budget) || budget <= 0) {
  fail("invalid_budget", `--budget must be a positive number, got: ${option("--budget", "60000")}`, {
    budget: option("--budget", "60000")
  });
}

const TEXT_EXTENSIONS = new Set([
  ".js", ".jsx", ".ts", ".tsx", ".py", ".go", ".rs", ".java", ".kt", ".rb", ".php", ".cs",
  ".cpp", ".c", ".h", ".hpp", ".swift", ".scala", ".sql", ".json", ".md", ".yml", ".yaml",
  ".toml", ".ini", ".sh", ".ps1", ".css", ".html", ".txt"
]);
const IGNORE_PARTS = new Set([".git", "node_modules", ".token-stack", ".claude/logs", "dist", "build", "coverage", "__pycache__"]);
const SECRET_PATTERNS = [
  [
    /\b([A-Za-z_][A-Za-z0-9_]*)(\s*[:=]\s*)["']?[^"'\s]+/g,
    (match, key, separator) => /TOKEN|SECRET|PASSWORD|PRIVATE_KEY|API_KEY/i.test(key) ? `${key}${separator}[REDACTED]` : match
  ],
  [/(-----BEGIN [A-Z ]*PRIVATE KEY-----)[\s\S]*?(-----END [A-Z ]*PRIVATE KEY-----)/g, "$1\n[REDACTED]\n$2"]
];

function rel(file) {
  return path.relative(target, file).replace(/\\/g, "/");
}

function isIgnored(relativePath) {
  const parts = relativePath.split("/");
  return parts.some((part, idx) => {
    const prefix = parts.slice(0, idx + 1).join("/");
    return IGNORE_PARTS.has(part) || IGNORE_PARTS.has(prefix);
  });
}

function gitFiles() {
  const result = spawnSync("git", ["ls-files"], { cwd: target, encoding: "utf8", shell: false });
  if (result.status !== 0) return null;
  return result.stdout.split(/\r?\n/).filter(Boolean).map((name) => path.join(target, name));
}

function walk(dir, out = []) {
  for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, item.name);
    const relative = rel(full);
    if (isIgnored(relative)) continue;
    if (item.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

function redact(text) {
  let next = text;
  for (const [pattern, replacement] of SECRET_PATTERNS) {
    next = next.replace(pattern, replacement);
  }
  return next;
}

function languageFor(file) {
  const ext = path.extname(file).slice(1).toLowerCase();
  return ext || "text";
}

const candidates = (gitFiles() || walk(target))
  .filter((file) => fs.existsSync(file) && fs.statSync(file).isFile())
  .map((file) => ({ file, relative: rel(file), size: fs.statSync(file).size }))
  .filter((item) => !isIgnored(item.relative))
  .filter((item) => TEXT_EXTENSIONS.has(path.extname(item.file).toLowerCase()))
  .filter((item) => item.size <= 200000)
  .sort((a, b) => a.relative.localeCompare(b.relative));

const selected = [];
let used = 0;
for (const item of candidates) {
  let text;
  try {
    text = fs.readFileSync(item.file, "utf8");
  } catch {
    continue;
  }
  const redacted = redact(text);
  const clipped = redacted.length > 16000 ? `${redacted.slice(0, 16000)}\n\n[TRUNCATED]\n` : redacted;
  const blockCost = clipped.length + item.relative.length + 64;
  if (selected.length > 0 && used + blockCost > budget) {
    continue;
  }
  selected.push({ relative: item.relative, bytes: item.size, chars: clipped.length, content: clipped });
  used += blockCost;
  if (used >= budget) break;
}

const manifest = {
  schema_version: 1,
  command: "pack-context",
  target,
  budget_chars: budget,
  used_chars: used,
  selected_files: selected.map(({ relative, bytes, chars }) => ({ path: relative, bytes, chars })),
  skipped_files: Math.max(candidates.length - selected.length, 0),
  redaction: "basic secret-like assignment and private-key block redaction"
};

const lines = [
  "# Claude Token Stack Context Pack",
  "",
  `- Target: ${target}`,
  `- Budget chars: ${budget}`,
  `- Used chars: ${used}`,
  `- Files: ${selected.length}`,
  "",
  "## Manifest",
  "",
  "```json",
  JSON.stringify(manifest, null, 2),
  "```",
  ""
];

for (const file of selected) {
  lines.push(`## ${file.relative}`, "", `\`\`\`${languageFor(file.relative)}`, file.content.replace(/\s+$/g, ""), "```", "");
}

const markdown = `${lines.join("\n")}\n`;
if (!noWrite) {
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, markdown, "utf8");
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
}

if (jsonOutput) {
  console.log(JSON.stringify(Object.assign({}, manifest, { dry_run: noWrite, out: outPath, manifest: manifestPath }), null, 2));
} else if (noWrite) {
  console.log(markdown);
} else {
  console.log(`Wrote context pack: ${outPath}`);
  console.log(`Wrote manifest: ${manifestPath}`);
}
