#!/usr/bin/env node
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const repoRoot = path.resolve(__dirname, "..", "..");
const readmeEn = fs.readFileSync(path.join(repoRoot, "README.md"), "utf8");
const readmeZh = fs.readFileSync(path.join(repoRoot, "README_zh-CN.md"), "utf8");
const cliPath = path.join(repoRoot, "bin", "cts.js");

const helpResult = spawnSync(process.execPath, [cliPath, "help"], { encoding: "utf8" });
assert.strictEqual(helpResult.status, 0, `help command failed\nstdout:\n${helpResult.stdout}\nstderr:\n${helpResult.stderr}`);
assert.strictEqual(helpResult.stderr, "", "help output should keep stderr clean");

function wordsFrom(text) {
  return text.match(/[a-z][a-z-]*/g) || [];
}

const jsonSection = /JSON\/no-write commands:\n([\s\S]*?)\n\n/.exec(helpResult.stdout);
const bashLine = /Scaffold and Bash-backed commands:\n\s*([^\n]+)/.exec(helpResult.stdout);
assert.ok(jsonSection, "help output should include JSON/no-write command section");
assert.ok(bashLine, "help output should include Scaffold and Bash-backed command section");

const documentedCommands = [
  ...wordsFrom(jsonSection[1]),
  ...wordsFrom(bashLine[1]),
  "events record",
];

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function assertCommandRows(markdown, label) {
  for (const command of documentedCommands) {
    assert.match(
      markdown,
      new RegExp(`\\|\\s*\`${escapeRegex(command)}\`\\s*\\|`),
      `${label} README should document ${command} in the command behavior table`
    );
  }
}

function commandRows(markdown, heading) {
  return commandTable(markdown, heading).map((row) => row.command);
}

function commandTable(markdown, heading) {
  const headingIndex = markdown.indexOf(heading);
  assert.ok(headingIndex >= 0, `README should include ${heading}`);
  const tableStart = markdown.indexOf("| Command", headingIndex);
  const zhTableStart = markdown.indexOf("| 命令", headingIndex);
  const start = tableStart >= 0 && (zhTableStart < 0 || tableStart < zhTableStart) ? tableStart : zhTableStart;
  assert.ok(start >= 0, `${heading} should include a command table`);
  const rows = markdown.slice(start).split(/\r?\n/).filter((line) => line.startsWith("|"));
  return rows
    .slice(2)
    .map((line) => {
      const cells = line.split("|").slice(1, -1).map((cell) => cell.trim());
      const commandMatch = /^`([^`]+)`$/.exec(cells[0] || "");
      if (!commandMatch) return null;
      return { command: commandMatch[1], cells };
    })
    .filter(Boolean);
}

function assertRowMarkers(markdown, heading, expectedByCommand, label) {
  const rows = new Map(commandTable(markdown, heading).map((row) => [row.command, row.cells.join(" ")]));
  for (const [command, markers] of Object.entries(expectedByCommand)) {
    const row = rows.get(command);
    assert.ok(row, `${label} README should include command row ${command}`);
    for (const marker of markers) {
      assert.ok(row.includes(marker), `${label} README ${command} row should include ${marker}`);
    }
  }
}

assert.match(readmeEn, /## Command Behavior/);
assert.match(readmeZh, /## 命令行为/);

assertCommandRows(readmeEn, "English");
assertCommandRows(readmeZh, "Chinese");
assert.deepStrictEqual(
  commandRows(readmeZh, "## 命令行为"),
  commandRows(readmeEn, "## Command Behavior"),
  "English and Chinese README command tables should stay in the same order"
);
assertRowMarkers(
  readmeEn,
  "## Command Behavior",
  {
    scaffold: [".claude/", ".gitignore", "--dry-run", "--no-write", "--json"],
    verify: [".token-stack/reports/verify-report.*", ".claude/logs/", "--no-write", "--json only covers CLI preflight errors"],
    benchmark: [".token-stack/reports/", ".token-stack/fixtures/", "--dry-run", "dry-run", "--json only covers CLI preflight errors"],
    "validate-artifacts": [".token-stack/reports/artifact-validation.json", ".md", ".html", "JSON/no-write command"],
    tools: [".token-stack/reports/install-report.json", ".token-stack/logs/install.log", "--dry-run", "--json only covers CLI preflight errors"],
  },
  "English"
);
assertRowMarkers(
  readmeZh,
  "## 命令行为",
  {
    scaffold: [".claude/", ".gitignore", "--dry-run", "--no-write", "--json"],
    verify: [".token-stack/reports/verify-report.*", ".claude/logs/", "--no-write", "--json 仅覆盖 CLI preflight 错误"],
    benchmark: [".token-stack/reports/", ".token-stack/fixtures/", "--dry-run", "dry-run", "--json 仅覆盖 CLI preflight 错误"],
    "validate-artifacts": [".token-stack/reports/artifact-validation.json", ".md", ".html", "JSON/no-write 命令"],
    tools: [".token-stack/reports/install-report.json", ".token-stack/logs/install.log", "--dry-run", "--json 仅覆盖 CLI preflight 错误"],
  },
  "Chinese"
);

for (const marker of [
  "--json only covers CLI preflight errors",
  "target_missing",
  "target_not_directory",
  "bash_missing",
  "python_missing",
]) {
  assert.ok(readmeEn.includes(marker), `English README should include ${marker}`);
}

for (const marker of [
  "--json 仅覆盖 CLI preflight 错误",
  "target_missing",
  "target_not_directory",
  "bash_missing",
  "python_missing",
]) {
  assert.ok(readmeZh.includes(marker), `Chinese README should include ${marker}`);
}

assert.ok(readmeEn.includes("JSON/no-write commands"), "English README should name JSON/no-write command class");
assert.ok(readmeZh.includes("JSON/no-write 命令"), "Chinese README should name JSON/no-write command class");
assert.ok(readmeEn.includes("Bash-backed"), "English README should name Bash-backed command class");
assert.ok(readmeZh.includes("Bash-backed"), "Chinese README should name Bash-backed command class");

console.log("README command matrix smoke tests passed");
