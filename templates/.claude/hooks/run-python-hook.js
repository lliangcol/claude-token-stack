#!/usr/bin/env node
const { spawnSync } = require("child_process");
const path = require("path");
const fs = require("fs");

const hookPath = process.argv[2];
if (!hookPath) {
  console.error("missing hook path");
  process.exit(2);
}

const normalizedHookPath = path.resolve(hookPath);
const candidates = process.platform === "win32"
  ? ["python", "py", "python3"]
  : ["python3", "python"];
const payload = fs.readFileSync(0);

for (const cmd of candidates) {
  const result = spawnSync(cmd, [normalizedHookPath], {
    input: payload,
    stdio: ["pipe", "inherit", "inherit"],
    env: process.env,
    shell: false
  });

  if (result.error && result.error.code === "ENOENT") {
    continue;
  }

  if (typeof result.status === "number") {
    process.exit(result.status);
  }

  if (result.error) {
    console.error(result.error.message);
    process.exit(2);
  }
}

console.error("Python not found. Tried: " + candidates.join(", "));
process.exit(2);
