#!/usr/bin/env node
const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const repoRoot = path.resolve(__dirname, "..", "..");
const runner = path.join(repoRoot, "templates", ".claude", "hooks", "run-python-hook.js");
const bashGuard = path.join(repoRoot, "templates", ".claude", "hooks", "bash-token-guard.py");
const cbmGate = path.join(repoRoot, "templates", ".claude", "hooks", "cbm-gate.py");
const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), "cts hook smoke space "));
const projectHooksDir = path.join(projectDir, ".claude", "hooks");
fs.mkdirSync(projectHooksDir, { recursive: true });
for (const hookFile of [runner, bashGuard, cbmGate]) {
  fs.copyFileSync(hookFile, path.join(projectHooksDir, path.basename(hookFile)));
}

function findPowerShell() {
  for (const cmd of ["pwsh", "powershell"]) {
    const result = spawnSync(cmd, ["-NoProfile", "-Command", "$PSVersionTable.PSVersion.ToString()"], {
      encoding: "utf8",
    });
    if (result.status === 0) return cmd;
  }
  return null;
}

function runHook(hookPath, payload, extraEnv = {}) {
  return spawnSync(process.execPath, [runner, hookPath], {
    cwd: repoRoot,
    input: JSON.stringify(payload),
    encoding: "utf8",
    env: {
      ...process.env,
      CLAUDE_PROJECT_DIR: projectDir,
      ...extraEnv,
    },
  });
}

function assertStatus(label, result, expected) {
  assert.strictEqual(
    result.status,
    expected,
    `${label}: expected exit ${expected}, got ${result.status}\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`
  );
}

const bashTreePayload = {
  tool_name: "Bash",
  tool_input: { command: "tree" },
};

assertStatus(
  "warn tree",
  runHook(bashGuard, bashTreePayload, { TOKEN_GUARD_MODE: "warn" }),
  0
);

assertStatus(
  "block tree",
  runHook(bashGuard, bashTreePayload, { TOKEN_GUARD_MODE: "block" }),
  2
);

assertStatus(
  "block secret-like shell read",
  runHook(
    bashGuard,
    { tool_name: "Bash", tool_input: { command: "cat .env" } },
    { TOKEN_GUARD_MODE: "block" }
  ),
  2
);

assertStatus(
  "block ls -R",
  runHook(
    bashGuard,
    { tool_name: "Bash", tool_input: { command: "ls -R" } },
    { TOKEN_GUARD_MODE: "block" }
  ),
  2
);

assertStatus(
  "block grep -R",
  runHook(
    bashGuard,
    { tool_name: "Bash", tool_input: { command: "grep -R TODO ." } },
    { TOKEN_GUARD_MODE: "block" }
  ),
  2
);

assertStatus(
  "block mode test command advisory stays non-blocking",
  runHook(
    bashGuard,
    { tool_name: "Bash", tool_input: { command: "npm test" } },
    { TOKEN_GUARD_MODE: "block" }
  ),
  0
);

const tokenLog = path.join(projectDir, ".claude", "logs", "token-guard.log");
assert.ok(fs.existsSync(tokenLog), "token guard log should be generated");
assert.match(fs.readFileSync(tokenLog, "utf8"), /tree/);
assert.match(fs.readFileSync(tokenLog, "utf8"), /\.env/);
assert.match(fs.readFileSync(tokenLog, "utf8"), /ls -R/);
assert.match(fs.readFileSync(tokenLog, "utf8"), /grep -R/);
assert.match(fs.readFileSync(tokenLog, "utf8"), /advisories/);

assertStatus(
  "cbm warn",
  runHook(
    cbmGate,
    { tool_name: "Read", tool_input: { file_path: "src/index.js" } },
    { CBM_GATE_MODE: "warn" }
  ),
  0
);

assertStatus(
  "cbm block broad Grep",
  runHook(
    cbmGate,
    { tool_name: "Grep", tool_input: { pattern: "TODO", path: ".", glob: "**/*" } },
    { CBM_GATE_MODE: "block" }
  ),
  2
);

const cbmFalsePositive = runHook(
  cbmGate,
  { tool_name: "Read", tool_input: { file_path: "README.md", note: "src/index.js" } },
  { CBM_GATE_MODE: "warn" }
);
assertStatus("cbm ignores non-path source-like strings", cbmFalsePositive, 0);
assert.strictEqual(cbmFalsePositive.stderr, "", "source-like strings outside path fields should not warn");

assertStatus(
  "cbm block tools keeps Read warn by default",
  runHook(
    cbmGate,
    { tool_name: "Read", tool_input: { file_path: "src/index.js" } },
    { CBM_GATE_MODE: "block" }
  ),
  0
);

assertStatus(
  "cbm block tools can opt into Read",
  runHook(
    cbmGate,
    { tool_name: "Read", tool_input: { file_path: "src/index.js" } },
    { CBM_GATE_MODE: "block", CBM_GATE_BLOCK_TOOLS: "Read,Grep,Glob" }
  ),
  2
);

const cbmLog = path.join(projectDir, ".claude", "logs", "cbm-gate.log");
assert.ok(fs.existsSync(cbmLog), "cbm gate log should be generated");
assert.match(fs.readFileSync(cbmLog, "utf8"), /Codebase Memory/);

const templateSettings = JSON.parse(
  fs.readFileSync(path.join(repoRoot, "templates", ".claude", "settings.json"), "utf8")
);
const bashSettingsCommand = templateSettings.hooks.PreToolUse.find((entry) => entry.matcher === "Bash").hooks[0].command;
assert.ok(!bashSettingsCommand.includes("$CLAUDE_PROJECT_DIR/"), "settings command should not require shell env expansion");
assert.ok(!bashSettingsCommand.includes("node -e"), "settings command should avoid inline node -e shell payloads");

const ps = findPowerShell();
if (ps) {
  assertStatus(
    "PowerShell settings command",
    spawnSync(ps, ["-NoProfile", "-Command", bashSettingsCommand], {
      cwd: projectDir,
      input: JSON.stringify(bashTreePayload),
      encoding: "utf8",
      env: {
        ...process.env,
        CLAUDE_PROJECT_DIR: projectDir,
        TOKEN_GUARD_MODE: "block",
      },
    }),
    2
  );
} else {
  console.log("PowerShell not found; skipped settings command shell smoke test");
}

const spacedDir = path.join(projectDir, "hooks with spaces");
fs.mkdirSync(spacedDir, { recursive: true });
const spacedHook = path.join(spacedDir, "cbm gate copy.py");
fs.copyFileSync(cbmGate, spacedHook);
assertStatus(
  "hook path with spaces",
  runHook(
    spacedHook,
    { tool_name: "Read", tool_input: { file_path: "src/index.js" } },
    { CBM_GATE_MODE: "warn" }
  ),
  0
);

console.log("hook smoke tests passed");
