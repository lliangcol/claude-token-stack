#!/usr/bin/env python3
from __future__ import annotations

import json
import os
import sys
from pathlib import Path

MODE = os.environ.get("CBM_GATE_MODE", "warn").lower()
if MODE not in {"warn", "block", "off"}:
    MODE = "warn"
PROJECT_DIR = Path(os.environ.get("CLAUDE_PROJECT_DIR", os.getcwd()))
LOG_DIR = PROJECT_DIR / ".claude" / "logs"
LOG_DIR.mkdir(parents=True, exist_ok=True)

if MODE == "off":
    sys.exit(0)

SOURCE_EXTENSIONS = (
    ".ts", ".tsx", ".js", ".jsx", ".py", ".go", ".rs", ".java", ".kt",
    ".rb", ".php", ".cs", ".cpp", ".c", ".h", ".hpp", ".swift",
    ".scala", ".sql"
)

NOISY_PATHS = (
    "node_modules/", "dist/", "build/", "coverage/", ".next/", ".nuxt/",
    "vendor/", "target/", ".git/", "package-lock.json", "pnpm-lock.yaml",
    "yarn.lock", "Cargo.lock"
)

try:
    payload = json.load(sys.stdin)
except Exception as exc:
    print(f"cbm gate: failed to parse hook payload: {exc}", file=sys.stderr)
    sys.exit(0)

tool_name = payload.get("tool_name")
tool_input = payload.get("tool_input", {}) or {}

if tool_name not in {"Read", "Grep", "Glob"}:
    sys.exit(0)

text = json.dumps(tool_input, ensure_ascii=False)
messages = []
block_reasons = []

if any(path in text for path in NOISY_PATHS):
    messages.append("Avoid reading generated/vendor/build/lock paths. Narrow the target or use code discovery first.")

if tool_name in {"Grep", "Glob"}:
    messages.append("Code discovery gate: use Codebase Memory MCP first for symbols/callers/callees, then use targeted Grep/Glob only if needed.")

if tool_name == "Read" and any(ext in text for ext in SOURCE_EXTENSIONS):
    messages.append("Read source files only after discovery; prefer necessary sections over entire files.")

def _get_string(*keys: str) -> str:
    for key in keys:
        value = tool_input.get(key)
        if isinstance(value, str):
            return value
    return ""

if tool_name == "Grep":
    path = _get_string("path", "folder", "cwd")
    glob = _get_string("glob", "include")
    pattern = _get_string("pattern", "query")
    if not path or path in {".", "./", "**", "**/*"}:
        block_reasons.append("broad Grep path")
    if glob in {"", "*", "**", "**/*", "**/*.*"}:
        block_reasons.append("broad Grep glob")
    if pattern in {"", ".", ".*"}:
        block_reasons.append("broad Grep pattern")

if tool_name == "Glob":
    pattern = _get_string("pattern", "glob")
    path = _get_string("path", "cwd")
    if pattern in {"", "*", "**", "**/*", "**/*.*", "**/*.js", "**/*.ts", "**/*.py"}:
        block_reasons.append("broad Glob pattern")
    if path in {".", "./", ""} and pattern.startswith("**/"):
        block_reasons.append("broad Glob root")

if not messages:
    sys.exit(0)

record = {"tool_name": tool_name, "tool_input": tool_input, "mode": MODE, "messages": messages, "block_reasons": block_reasons}
with open(LOG_DIR / "cbm-gate.log", "a", encoding="utf-8") as f:
    f.write(json.dumps(record, ensure_ascii=False) + "\n")

message = "Codebase Memory gate triggered:\n" + "\n".join(f"- {m}" for m in messages)

if MODE == "block" and tool_name in {"Grep", "Glob"} and block_reasons:
    print(message, file=sys.stderr)
    print("\nUse Codebase Memory MCP first, then retry with a narrower target.", file=sys.stderr)
    sys.exit(2)

print(message, file=sys.stderr)
sys.exit(0)
