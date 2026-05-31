#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="${CTS_TARGET_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"
cd "$REPO_ROOT"

MODE="${1:-all}"
DRY_RUN=0
for arg in "$@"; do
  case "$arg" in
    scaffold|tools|all) MODE="$arg" ;;
    dry-run|--dry-run) DRY_RUN=1 ;;
  esac
done

REPORT_DIR=".token-stack/reports"
LOG_DIR=".token-stack/logs"
REPORT="$REPORT_DIR/verify-report.md"
JSON_REPORT="$REPORT_DIR/verify-report.json"
RESULTS_JSONL="$REPORT_DIR/verify-results.jsonl"
pass=0
fail=0
warn=0

mkdir -p "$REPORT_DIR" "$LOG_DIR" .claude/logs
: > "$REPORT"
: > "$RESULTS_JSONL"

json_escape() {
  local py
  py="$(python_cmd)" || return 127
  "$py" -c 'import json,sys; print(json.dumps(sys.stdin.read()))'
}

section() {
  printf "\n## %s\n" "$*" >> "$REPORT"
}

record() {
  local status="$1"
  local name="$2"
  local detail="${3:-}"
  echo "- [$status] $name${detail:+ - $detail}" >> "$REPORT"
  case "$status" in
    PASS) pass=$((pass+1)) ;;
    FAIL) fail=$((fail+1)) ;;
    WARN) warn=$((warn+1)) ;;
  esac
  local escaped_name escaped_detail
  escaped_name="$(printf "%s" "$name" | json_escape)"
  escaped_detail="$(printf "%s" "$detail" | json_escape)"
  printf '{"status":"%s","name":%s,"detail":%s}\n' "$status" "$escaped_name" "$escaped_detail" >> "$RESULTS_JSONL"
}

is_windowsish() {
  local os_name
  os_name="$(uname -s 2>/dev/null || echo unknown)"
  [[ "$os_name" =~ MINGW|MSYS|CYGWIN ]] || [[ "${OS:-}" == "Windows_NT" ]] || grep -qi microsoft /proc/version 2>/dev/null
}

python_cmd() {
  if command -v python3 >/dev/null 2>&1; then
    echo python3
  elif command -v python >/dev/null 2>&1; then
    echo python
  else
    return 1
  fi
}

node_cmd() {
  if command -v node >/dev/null 2>&1; then
    command -v node
  elif [[ -n "${CTS_NODE_PATH:-}" && -f "${CTS_NODE_PATH:-}" ]] && "$CTS_NODE_PATH" --version >/dev/null 2>&1; then
    printf '%s\n' "$CTS_NODE_PATH"
  else
    return 1
  fi
}

run_hook() {
  local script="$1"
  local node_bin=""
  node_bin="$(command -v node 2>/dev/null || true)"
  if [[ -n "$node_bin" && -f .claude/hooks/run-python-hook.js ]]; then
    "$node_bin" .claude/hooks/run-python-hook.js "$script"
  else
    local py
    py="$(python_cmd)" || return 127
    "$py" "$script"
  fi
}

echo "# Claude Token Stack Verification" >> "$REPORT"
echo "Date: $(date -u +"%Y-%m-%dT%H:%M:%SZ")" >> "$REPORT"
echo "Root: $REPO_ROOT" >> "$REPORT"

section "Files"
for f in \
  ".claude/settings.json" \
  ".claude/settings.local.unattended.example.json" \
  ".claude/token-policy.md" \
  ".claude/hooks/run-python-hook.js" \
  ".claude/hooks/bash-token-guard.py" \
  ".claude/hooks/cbm-gate.py"; do
  [[ -f "$f" ]] && record PASS "$f exists" || record FAIL "$f missing"
done
[[ -d docs ]] && record PASS "docs exists" || record FAIL "docs missing"

section "JSON"
if [[ ! -f .claude/settings.json ]]; then
  record FAIL ".claude/settings.json parse" "file missing"
elif command -v node >/dev/null 2>&1 && node -e "JSON.parse(require('fs').readFileSync('.claude/settings.json','utf8'))" >/dev/null 2>&1; then
  record PASS ".claude/settings.json parse"
else
  py="$(python_cmd || true)"
  if [[ -n "${py:-}" ]] && "$py" -m json.tool .claude/settings.json >/dev/null 2>&1; then
    record PASS ".claude/settings.json parse"
  else
    record FAIL ".claude/settings.json parse" "invalid JSON"
  fi
fi

section "Hook executability"
node_bin="$(node_cmd 2>/dev/null || true)"
settings_uses_node_runner=0
if [[ -f .claude/settings.json ]] && grep -q 'run-python-hook\.js' .claude/settings.json; then
  settings_uses_node_runner=1
fi
if [[ -n "${node_bin:-}" && -f .claude/hooks/run-python-hook.js ]]; then
  "$node_bin" --check .claude/hooks/run-python-hook.js >/dev/null 2>&1 && record PASS "run-python-hook.js executable by node" || record FAIL "run-python-hook.js executable by node"
elif [[ "$settings_uses_node_runner" == "1" ]]; then
  record FAIL "run-python-hook.js executable by node" "settings require node runner but node was not found"
else
  record WARN "run-python-hook.js executable by node" "node not found or runner missing"
fi
py="$(python_cmd || true)"
for hook in .claude/hooks/bash-token-guard.py .claude/hooks/cbm-gate.py; do
  if [[ -n "${py:-}" && -f "$hook" ]] && "$py" -m py_compile "$hook" >/dev/null 2>&1; then
    record PASS "$hook executable by python"
  else
    record FAIL "$hook executable by python"
  fi
done

section "Hook smoke tests"
if [[ "$DRY_RUN" == "1" ]]; then
  record WARN "hook smoke tests" "dry-run selected"
else
  chmod +x .claude/hooks/*.py .claude/hooks/*.js 2>/dev/null || true
  token_payload="$LOG_DIR/token_guard_payload.json"
  cbm_payload="$LOG_DIR/cbm_payload.json"
  printf '%s\n' '{"tool_name":"Bash","tool_input":{"command":"tree"}}' > "$token_payload"
  printf '%s\n' '{"tool_name":"Grep","tool_input":{"pattern":"TODO","path":".","glob":"**/*"}}' > "$cbm_payload"

  set +e
  TOKEN_GUARD_MODE=warn CLAUDE_PROJECT_DIR="$REPO_ROOT" run_hook .claude/hooks/bash-token-guard.py < "$token_payload" > "$LOG_DIR/token_guard_warn.out" 2> "$LOG_DIR/token_guard_warn.err"
  code=$?
  set -e
  [[ $code -eq 0 ]] && record PASS "bash-token-guard warn exits 0" || record FAIL "bash-token-guard warn exits 0" "actual exit $code"

  set +e
  TOKEN_GUARD_MODE=block CLAUDE_PROJECT_DIR="$REPO_ROOT" run_hook .claude/hooks/bash-token-guard.py < "$token_payload" > "$LOG_DIR/token_guard_block.out" 2> "$LOG_DIR/token_guard_block.err"
  code=$?
  set -e
  [[ $code -eq 2 ]] && record PASS "bash-token-guard block exits 2" || record FAIL "bash-token-guard block exits 2" "actual exit $code"

  set +e
  CBM_GATE_MODE=warn CLAUDE_PROJECT_DIR="$REPO_ROOT" run_hook .claude/hooks/cbm-gate.py < "$cbm_payload" > "$LOG_DIR/cbm_warn.out" 2> "$LOG_DIR/cbm_warn.err"
  code=$?
  set -e
  [[ $code -eq 0 ]] && record PASS "cbm-gate warn exits 0" || record FAIL "cbm-gate warn exits 0" "actual exit $code"

  set +e
  CBM_GATE_MODE=block CLAUDE_PROJECT_DIR="$REPO_ROOT" run_hook .claude/hooks/cbm-gate.py < "$cbm_payload" > "$LOG_DIR/cbm_block.out" 2> "$LOG_DIR/cbm_block.err"
  code=$?
  set -e
  [[ $code -eq 2 ]] && record PASS "cbm-gate block exits 2 for wide Grep" || record FAIL "cbm-gate block exits 2 for wide Grep" "actual exit $code"
fi

section "Tools"
mcp_list=""
if command -v claude >/dev/null 2>&1; then
  record PASS "claude CLI found" "$(claude --version 2>/dev/null | head -n 1 || true)"
  if claude mcp list > "$LOG_DIR/claude-mcp-list.log" 2>&1; then
    mcp_list="$(cat "$LOG_DIR/claude-mcp-list.log")"
    record PASS "claude mcp list"
  else
    mcp_list="$(cat "$LOG_DIR/claude-mcp-list.log" 2>/dev/null || true)"
    record WARN "claude mcp list" "command failed"
  fi
else
  record WARN "claude CLI found" "claude CLI not found"
fi

if printf "%s" "$mcp_list" | grep -Eiq 'context-mode|context_mode'; then
  record PASS "context-mode MCP connected"
else
  record WARN "context-mode MCP connected" "not found in claude mcp list"
fi

if command -v codebase-memory-mcp >/dev/null 2>&1 || printf "%s" "$mcp_list" | grep -Eiq 'codebase-memory-mcp|codebase_memory'; then
  record PASS "codebase-memory-mcp found"
else
  record WARN "codebase-memory-mcp found" "command not found and not listed by claude mcp"
fi

if [[ -z "$mcp_list" ]]; then
  record WARN "codegraph duplicate absent" "claude mcp list unavailable"
elif printf "%s" "$mcp_list" | grep -Eiq '(^|[^[:alnum:]_-])codegraph([^[:alnum:]_-]|$)' && printf "%s" "$mcp_list" | grep -Eiq 'codebase-memory-mcp|codebase_memory'; then
  record WARN "codegraph duplicate absent" "codegraph and codebase-memory-mcp both found; prefer codebase-memory-mcp and remove optional codegraph"
else
  record PASS "codegraph duplicate absent"
fi

if command -v rtk >/dev/null 2>&1; then
  record PASS "rtk found" "$(rtk --version 2>/dev/null | head -n 1 || true)"
elif is_windowsish; then
  record WARN "rtk found" "skipped on Windows/MINGW64"
else
  record WARN "rtk found" "rtk not found"
fi

if [[ "${ENABLE_HEADROOM:-0}" == "1" ]]; then
  if command -v headroom >/dev/null 2>&1; then
    record PASS "headroom found" "$(headroom --version 2>/dev/null | head -n 1 || true)"
  else
    record WARN "headroom found" "ENABLE_HEADROOM=1 but headroom command not found"
  fi
else
  record PASS "headroom disabled" "set ENABLE_HEADROOM=1 to require it"
fi

py="$(python_cmd || true)"
if [[ -z "${py:-}" ]]; then
  record WARN "json-report" "python not found; JSON report skipped"
else
  "$py" - "$RESULTS_JSONL" "$JSON_REPORT" "$pass" "$fail" "$warn" "$REPORT" <<'PY'
import json
import sys
from pathlib import Path

jsonl, out, passed, failed, warned, report = sys.argv[1:7]
checks = []
for line in Path(jsonl).read_text(encoding="utf-8").splitlines():
    if line.strip():
        checks.append(json.loads(line))
payload = {
    "schema_version": 1,
    "pass": int(passed),
    "fail": int(failed),
    "warn": int(warned),
    "report": report,
    "checks": checks,
}
Path(out).write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
PY
fi

printf "\n## Summary\n" >> "$REPORT"
echo "- PASS: $pass" >> "$REPORT"
echo "- FAIL: $fail" >> "$REPORT"
echo "- WARN: $warn" >> "$REPORT"
echo "- JSON: $JSON_REPORT" >> "$REPORT"

cat "$REPORT"
[[ $fail -gt 0 ]] && exit 1 || exit 0
