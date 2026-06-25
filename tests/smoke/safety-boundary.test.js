#!/usr/bin/env node
const assert = require("assert");
const fs = require("fs");
const path = require("path");

const repoRoot = path.resolve(__dirname, "..", "..");

function walkFiles(dir, predicate, output = []) {
  if (!fs.existsSync(dir)) return output;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkFiles(fullPath, predicate, output);
    } else if (predicate(fullPath)) {
      output.push(fullPath);
    }
  }
  return output.sort();
}

function fencedCodeLines(markdown) {
  const lines = markdown.split(/\r?\n/);
  const codeLines = [];
  let inFence = false;
  for (const line of lines) {
    if (/^\s*```/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) codeLines.push(line);
  }
  return codeLines;
}

const unsafePipeShellPattern = /\b(?:curl|wget)\b[^\n|]*\|\s*(?:sh|bash)\b/i;
const dangerousPermissionBypassPattern = /\bdangerously-skip-permissions\b/i;
const requiredToolDocBoundaries = [
  [
    "docs/tools/headroom.md",
    [
      "explicit proxy experiment",
      "ENABLE_HEADROOM=1",
      "reviewed what request metadata and content could pass through the proxy",
      "Keep Headroom disabled for normal scaffold, verification, benchmark, and demo flows.",
    ],
  ],
  [
    "docs/tools/codebase-memory-mcp.md",
    [
      "repository-local index by default",
      "Do not configure hidden remote indexing, telemetry, or source upload",
      "owner-approved data path",
      "Keep one primary code discovery MCP per repository",
    ],
  ],
  [
    "docs/release/v0.1.0-rc-checklist.md",
    [
      "Do not mark these items as completed unless a maintainer has performed them in GitHub or the target channel.",
      "npm test",
      "npm pack --dry-run",
      "synthetic/demo evidence is wiring proof, not real savings proof",
      "no npm publish is required for this RC checklist",
      "Not a fixed savings claim. Evidence first, block later.",
      "real savings should come from baseline/post case reports",
    ],
  ],
];

const markdownSafetyFiles = [
  "README.md",
  "README_zh-CN.md",
  "SECURITY.md",
  "ARCHITECTURE.md",
  "ROADMAP.md",
  ...walkFiles(path.join(repoRoot, "docs"), (filePath) => filePath.endsWith(".md")).map((filePath) =>
    path.relative(repoRoot, filePath)
  ),
];

for (const rel of markdownSafetyFiles) {
  const codeLines = fencedCodeLines(fs.readFileSync(path.join(repoRoot, rel), "utf8"));
  assert.ok(
    !codeLines.some((line) => unsafePipeShellPattern.test(line)),
    `${rel} must not include executable curl/wget pipe-shell examples`
  );
  assert.ok(
    !codeLines.some((line) => dangerousPermissionBypassPattern.test(line)),
    `${rel} must not include dangerously-skip-permissions examples in executable blocks`
  );
}

for (const filePath of walkFiles(path.join(repoRoot, "bin"), (candidate) => /\.(js|py|ps1|sh)$/.test(candidate))) {
  const rel = path.relative(repoRoot, filePath);
  const body = fs.readFileSync(filePath, "utf8");
  assert.ok(!unsafePipeShellPattern.test(body), `${rel} must not execute curl/wget piped into a shell`);
  assert.ok(!dangerousPermissionBypassPattern.test(body), `${rel} must not use dangerously-skip-permissions`);
}

for (const [rel, requiredPhrases] of requiredToolDocBoundaries) {
  const body = fs.readFileSync(path.join(repoRoot, rel), "utf8");
  for (const phrase of requiredPhrases) {
    assert.ok(body.includes(phrase), `${rel} should preserve local-first tool boundary: ${phrase}`);
  }
}

console.log("safety boundary smoke tests passed");
