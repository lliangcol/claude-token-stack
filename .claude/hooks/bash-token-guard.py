#!/usr/bin/env python3
from __future__ import annotations

import json
import os
import re
import sys
from pathlib import Path

MODE = os.environ.get("TOKEN_GUARD_MODE", "warn").lower()
if MODE not in {"warn", "block", "off"}:
    MODE = "warn"
PROJECT_DIR = Path(os.environ.get("CLAUDE_PROJECT_DIR", os.getcwd()))
LOG_DIR = PROJECT_DIR / ".claude" / "logs"
LOG_DIR.mkdir(parents=True, exist_ok=True)

if MODE == "off":
    sys.exit(0)

try:
    payload = json.load(sys.stdin)
except Exception as exc:
    print(f"token guard: failed to parse hook payload: {exc}", file=sys.stderr)
    sys.exit(0)

tool_name = payload.get("tool_name")
tool_input = payload.get("tool_input", {}) or {}
cmd = tool_input.get("command", "")

if tool_name != "Bash" or not cmd:
    sys.exit(0)

rules = [
    (r"(^|[;&|]\s*)(cat|less|more|head|tail|sed|awk|grep)\b[^;&|]*(\.env(\.|$)|\.pem\b|\.key\b|id_rsa|secret|private_key)", "Avoid reading secret-like files through shell commands. Use synthetic fixtures or redact data first."),
    (r"(^|[;&|]\s*)tree(\s|$)", "Avoid raw tree. Use targeted rg --files with a narrow path."),
    (r"(^|[;&|]\s*)ls\s+[^;&|]*\b-R\b", "Avoid ls -R. Use targeted rg --files with a narrow path."),
    (r"(^|[;&|]\s*)grep\s+[^;&|]*\b-R\b", "Avoid grep -R. Use Codebase Memory MCP first, then targeted rg."),
    (r"(^|[;&|]\s*)find\s+\.\s+-type\s+f(\s|$)", "Avoid unbounded find. Use Codebase Memory MCP or targeted rg --files."),
    (r"(^|[;&|]\s*)cat\s+.+\.(ts|tsx|js|jsx|py|go|rs|java|kt|rb|php|cs|cpp|c|h|hpp|swift|scala|sql)(\s|$)", "Avoid direct cat on source files. Use Codebase Memory MCP first, then Read only needed sections."),
    (r"(^|[;&|]\s*)docker\s+logs\b(?![^;&|]*(--tail|-n)\b)", "Avoid unbounded docker logs. Add --tail/-n or route through context-mode."),
    (r"(^|[;&|]\s*)kubectl\b[^;&|]*\slogs\b(?![^;&|]*(--tail|-n)\b)", "Avoid unbounded kubectl logs. Add --tail/-n or route through context-mode."),
]

violations = [message for pattern, message in rules if re.search(pattern, cmd, re.IGNORECASE)]

if not violations:
    sys.exit(0)

record = {"command": cmd, "violations": violations, "mode": MODE}
with open(LOG_DIR / "token-guard.log", "a", encoding="utf-8") as f:
    f.write(json.dumps(record, ensure_ascii=False) + "\n")

suggestions = [
    "targeted rg --files",
    "Codebase Memory MCP",
    "context-mode",
    "RTK, if available",
]
message = (
    "Token guard triggered:\n"
    + "\n".join(f"- {v}" for v in violations)
    + "\n\nSuggested alternatives:\n"
    + "\n".join(f"- {s}" for s in suggestions)
)

if MODE == "block":
    print(message, file=sys.stderr)
    print("\nUse targeted discovery or summarization before retrying.", file=sys.stderr)
    sys.exit(2)

print(message, file=sys.stderr)
sys.exit(0)
