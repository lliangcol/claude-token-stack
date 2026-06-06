#!/usr/bin/env bash
set -euo pipefail

MODE="scaffold"
DRY_RUN=0
for arg in "$@"; do
  case "$arg" in
    scaffold|tools|install-tools|all|preflight) MODE="$arg" ;;
    dry-run|--dry-run) DRY_RUN=1 ;;
    -h|--help|help) MODE="help" ;;
  esac
done

KIT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPO_ROOT="${CTS_TARGET_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"
REPORT_DIR="$REPO_ROOT/.token-stack/reports"
LOG_DIR="$REPO_ROOT/.token-stack/logs"
REPORT_FILE="$REPORT_DIR/install-report.json"
LOG_FILE="$LOG_DIR/install.log"
ALLOW_REMOTE="${TOKEN_STACK_ALLOW_REMOTE_INSTALL:-0}"
ALLOW_UNPINNED_REMOTE="${TOKEN_STACK_ALLOW_UNPINNED_REMOTE_INSTALL:-0}"
ENABLE_HEADROOM="${ENABLE_HEADROOM:-0}"
CONTEXT_MODE_NPM_SPEC="${CONTEXT_MODE_NPM_SPEC:-context-mode}"
CODEBASE_MEMORY_MCP_NPM_SPEC="${CODEBASE_MEMORY_MCP_NPM_SPEC:-codebase-memory-mcp}"
CAVEMAN_NPM_SPEC="${CAVEMAN_NPM_SPEC:-caveman}"
HEADROOM_NPM_SPEC="${HEADROOM_NPM_SPEC:-headroom}"
OS_NAME="$(uname -s 2>/dev/null || echo unknown)"
STARTED_AT="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
REPORT_ITEMS=()

if [[ "$DRY_RUN" != "1" ]]; then
  mkdir -p "$REPORT_DIR" "$LOG_DIR"
fi
cd "$REPO_ROOT"

ts() { date -u +"%Y-%m-%dT%H:%M:%SZ"; }

json_escape() {
  local s="${1-}"
  s="${s//\\/\\\\}"
  s="${s//\"/\\\"}"
  s="${s//$'\n'/\\n}"
  s="${s//$'\r'/\\r}"
  s="${s//$'\t'/\\t}"
  printf '"%s"' "$s"
}

log() {
  local line="[$(ts)] $*"
  if [[ "$DRY_RUN" == "1" ]]; then
    echo "$line"
  else
    echo "$line" | tee -a "$LOG_FILE"
  fi
}

record() {
  local component="$1" status="$2" message="$3"
  REPORT_ITEMS+=("{\"component\":$(json_escape "$component"),\"status\":$(json_escape "$status"),\"message\":$(json_escape "$message")}")
  log "$status: $component - $message"
}

is_windowsish() {
  [[ "$OS_NAME" =~ MINGW|MSYS|CYGWIN ]] || [[ "${OS:-}" == "Windows_NT" ]]
}

run_optional() {
  local component="$1"
  shift
  log "+ $*"
  if [[ "$DRY_RUN" == "1" ]]; then
    record "$component" "skipped" "dry-run: command not executed"
    return 0
  fi
  set +e
  "$@" >> "$LOG_FILE" 2>&1
  local status=$?
  set -e
  if [[ $status -eq 0 ]]; then
    record "$component" "installed" "command succeeded"
  else
    record "$component" "failed" "command failed with status $status"
  fi
  return 0
}

npm_spec_is_pinned() {
  local spec="$1"
  [[ "$spec" =~ ^(@[^/[:space:]]+/)?[^/@[:space:]]+@[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.-]+)?(\+[0-9A-Za-z.-]+)?$ ]]
}

run_optional_npm_global() {
  local component="$1" spec="$2"
  if ! npm_spec_is_pinned "$spec" && [[ "$ALLOW_UNPINNED_REMOTE" != "1" ]]; then
    record "$component" "skipped" "remote npm install requires exact semver spec such as package@1.2.3, or TOKEN_STACK_ALLOW_UNPINNED_REMOTE_INSTALL=1"
    return 0
  fi
  run_optional "$component" npm install -g "$spec"
}

run_optional_npx_mcp() {
  local component="$1" server_name="$2" spec="$3"
  if ! npm_spec_is_pinned "$spec" && [[ "$ALLOW_UNPINNED_REMOTE" != "1" ]]; then
    record "$component" "skipped" "remote npx MCP add requires exact semver spec such as package@1.2.3, or TOKEN_STACK_ALLOW_UNPINNED_REMOTE_INSTALL=1"
    return 0
  fi
  run_optional "$component" claude mcp add "$server_name" -- npx -y "$spec"
}

write_report() {
  local items
  items="$(IFS=,; echo "${REPORT_ITEMS[*]}")"
  local report
  report="$(cat <<EOF_JSON
{
  "date": "$(ts)",
  "started_at": "$STARTED_AT",
  "repo_root": $(json_escape "$REPO_ROOT"),
  "kit_dir": $(json_escape "$KIT_DIR"),
  "mode": $(json_escape "$MODE"),
  "dry_run": $([[ "$DRY_RUN" == "1" ]] && echo true || echo false),
  "os": $(json_escape "$OS_NAME"),
  "allow_remote_install": $(json_escape "$ALLOW_REMOTE"),
  "allow_unpinned_remote_install": $(json_escape "$ALLOW_UNPINNED_REMOTE"),
  "enable_headroom": $(json_escape "$ENABLE_HEADROOM"),
  "items": [${items}]
}
EOF_JSON
)"
  if [[ "$DRY_RUN" == "1" ]]; then
    printf '%s\n' "$report"
  else
    mkdir -p "$REPORT_DIR"
    printf '%s\n' "$report" > "$REPORT_FILE"
    log "Wrote install report: $REPORT_FILE"
  fi
}

usage() {
  cat <<'EOF_USAGE'
Usage: install-claude-token-stack.sh {scaffold|tools|all|preflight} [--dry-run]

Modes:
  scaffold  Copy Claude Token Stack scaffold into the target repository.
  tools     Detect or optionally install supporting tools.
  all       Run scaffold and tools.

Environment:
  CTS_TARGET_DIR                      Target repository. Defaults to git root or cwd.
  TOKEN_STACK_ALLOW_REMOTE_INSTALL=1  Enable remote downloads or package installs.
  TOKEN_STACK_ALLOW_UNPINNED_REMOTE_INSTALL=1
                                      Allow remote npm/npx installs without @version pins.
  *_NPM_SPEC=package@1.2.3            Pin optional npm package specs with exact semver.
  ENABLE_HEADROOM=1                   Enable optional Headroom install/detection.

Platform notes:
  Git Bash, WSL2, macOS, and Linux can run this Bash installer directly.
  PowerShell users should run it through Git Bash or WSL2. Windows-specific
  Claude settings path repair is available at bin/fix-windows-claude-settings.ps1.
  RTK auto-install is skipped on Windows/MINGW/MSYS/Cygwin; WSL2 is recommended.
EOF_USAGE
}

safe_remote_sh() {
  local url="$1" name="$2"
  if [[ "$ALLOW_REMOTE" != "1" ]]; then
    record "$name" "skipped" "remote installer disabled; set TOKEN_STACK_ALLOW_REMOTE_INSTALL=1 to allow"
    return 0
  fi
  if ! command -v curl >/dev/null 2>&1; then
    record "$name" "failed" "curl not found"
    return 0
  fi
  if [[ "$DRY_RUN" == "1" ]]; then
    record "$name" "skipped" "dry-run: would download $url and print SHA256; execution is disabled"
    return 0
  fi
  local tmp
  tmp="$(mktemp)"
  log "Downloading $name installer to $tmp"
  if curl -fsSL "$url" -o "$tmp" >> "$LOG_FILE" 2>&1; then
    if command -v sha256sum >/dev/null 2>&1; then
      sha256sum "$tmp" | tee -a "$LOG_FILE"
    elif command -v shasum >/dev/null 2>&1; then
      shasum -a 256 "$tmp" | tee -a "$LOG_FILE"
    else
      log "SHA256 unavailable: install sha256sum or shasum to verify downloaded installers"
    fi
    rm -f "$tmp"
    record "$name" "skipped" "downloaded for audit only; unpinned remote shell execution is disabled"
  else
    rm -f "$tmp"
    record "$name" "failed" "failed to download installer from $url"
  fi
}

backup_file() {
  local file="$1"
  if [[ -f "$file" ]]; then
    local backup="$file.bak.$(date +%Y%m%d%H%M%S)"
    cp "$file" "$backup"
    echo "$backup"
  fi
}

copy_template() {
  local rel="$1" component="$2"
  local src="$KIT_DIR/templates/$rel" dst="$REPO_ROOT/$rel"
  if [[ ! -f "$src" ]]; then
    record "$component" "failed" "template missing: $src"
    return 0
  fi
  if [[ "$DRY_RUN" == "1" ]]; then
    record "$component" "skipped" "dry-run: would copy $rel and backup existing file first"
    return 0
  fi
  mkdir -p "$(dirname "$dst")"
  if [[ -f "$dst" ]]; then
    if cmp -s "$src" "$dst"; then
      record "$component" "skipped" "$rel already matches template"
      return 0
    fi
    local backup=""
    backup="$(backup_file "$dst" || true)"
    cp "$src" "$dst"
    record "$component" "installed" "copied $rel; backup: $backup"
    return 0
  fi
  cp "$src" "$dst"
  record "$component" "installed" "copied $rel"
}

merge_settings() {
  local existing="$REPO_ROOT/.claude/settings.json"
  local template="$KIT_DIR/templates/.claude/settings.json"
  if [[ "$DRY_RUN" == "1" ]]; then
    record ".claude/settings.json" "skipped" "dry-run: would backup existing settings and merge template"
    return 0
  fi
  mkdir -p "$REPO_ROOT/.claude"
  local backup=""
  local py=""
  py="$(command -v python3 || command -v python || command -v py || true)"
  if [[ -z "$py" ]]; then
    if [[ -f "$existing" ]]; then
      if cmp -s "$template" "$existing"; then
        record ".claude/settings.json" "skipped" "already matches template"
        return 0
      fi
      backup="$(backup_file "$existing" || true)"
    fi
    cp "$template" "$existing"
    if [[ -n "$backup" ]]; then
      record ".claude/settings.json" "fallback" "python not found; copied template after preserving backup: $backup"
    else
      record ".claude/settings.json" "fallback" "python not found; copied template"
    fi
    return 0
  fi
  backup="$existing.bak.$(date +%Y%m%d%H%M%S)"
  set +e
  "$py" - "$existing" "$template" "$backup" <<'PY_MERGE'
import json
import os
import shutil
import sys

existing, template, backup = sys.argv[1], sys.argv[2], sys.argv[3]
base = {}
original = None
had_invalid_existing = False
if os.path.exists(existing):
    try:
        with open(existing, "r", encoding="utf-8") as fh:
            original = json.load(fh)
            base = json.loads(json.dumps(original))
    except Exception:
        base = {}
        had_invalid_existing = True

with open(template, "r", encoding="utf-8") as fh:
    next_settings = json.load(fh)

def merge_list(a, b):
    out = []
    seen = set()
    for item in (a or []) + (b or []):
        key = json.dumps(item, sort_keys=True, separators=(",", ":"))
        if key not in seen:
            seen.add(key)
            out.append(item)
    return out

token_hook_matchers = {
    "Bash": "bash-token-guard.py",
    "Read": "cbm-gate.py",
    "Grep": "cbm-gate.py",
    "Glob": "cbm-gate.py",
}

def hook_command(hook):
    return hook.get("command", "") if isinstance(hook, dict) else ""

def is_token_hook_for_matcher(entry):
    if not isinstance(entry, dict):
        return False
    matcher = entry.get("matcher")
    hook_name = token_hook_matchers.get(matcher)
    if not hook_name:
        return False
    hooks = entry.get("hooks") if isinstance(entry.get("hooks"), list) else []
    return any(hook_name in hook_command(hook) for hook in hooks)

def count_token_hooks(entries):
    counts = {matcher: 0 for matcher in token_hook_matchers}
    for entry in entries or []:
        if not isinstance(entry, dict):
            continue
        matcher = entry.get("matcher")
        hook_name = token_hook_matchers.get(matcher)
        if not hook_name:
            continue
        hooks = entry.get("hooks") if isinstance(entry.get("hooks"), list) else []
        counts[matcher] += sum(1 for hook in hooks if hook_name in hook_command(hook))
    return counts

def merge_token_pre_tool_use(existing_entries, template_entries):
    out = list(existing_entries or [])
    for entry in template_entries or []:
        if not is_token_hook_for_matcher(entry):
            out = merge_list(out, [entry])
            continue
        matcher = entry.get("matcher")
        if count_token_hooks(out).get(matcher, 0) > 0:
            continue
        out.append(entry)
    return merge_list(out, [])

base["env"] = {**(next_settings.get("env") or {}), **(base.get("env") or {})}
base["permissions"] = base.get("permissions") or {}
for key in ("allow", "ask", "deny"):
    base["permissions"][key] = merge_list(base["permissions"].get(key), (next_settings.get("permissions") or {}).get(key))
base["hooks"] = base.get("hooks") or {}
base["hooks"]["PreToolUse"] = merge_token_pre_tool_use(base["hooks"].get("PreToolUse"), (next_settings.get("hooks") or {}).get("PreToolUse"))

def canonical(value):
    return json.dumps(value, sort_keys=True, separators=(",", ":"))

if original is not None and canonical(original) == canonical(base):
    sys.exit(4)

if os.path.exists(existing):
    shutil.copy2(existing, backup)

with open(existing, "w", encoding="utf-8") as fh:
    json.dump(base, fh, indent=2)
    fh.write("\n")

if had_invalid_existing:
    sys.exit(3)
if original is None:
    sys.exit(5)
PY_MERGE
  local status=$?
  set -e
  case "$status" in
    0) record ".claude/settings.json" "installed" "merged template; backup: $backup" ;;
    3) record ".claude/settings.json" "fallback" "existing settings were invalid JSON; backup preserved at $backup and template values installed" ;;
    4) record ".claude/settings.json" "skipped" "already includes template settings" ;;
    5) record ".claude/settings.json" "installed" "created from template" ;;
    *) record ".claude/settings.json" "failed" "settings merge failed with status $status" ;;
  esac
}

append_gitignore() {
  local file="$REPO_ROOT/.gitignore"
  local entries=(".claude/logs/" ".token-stack/" "*.bak.*")
  if [[ "$DRY_RUN" == "1" ]]; then
    record ".gitignore" "skipped" "dry-run: would create or append token stack ignore entries"
    return 0
  fi
  touch "$file"
  local changed=0 entry
  for entry in "${entries[@]}"; do
    if ! grep -Fxq "$entry" "$file"; then
      if [[ $changed -eq 0 ]]; then
        printf '\n# Claude Token Stack runtime files.\n' >> "$file"
      fi
      printf '%s\n' "$entry" >> "$file"
      changed=1
    fi
  done
  if [[ $changed -eq 1 ]]; then
    record ".gitignore" "installed" "appended token stack ignore entries"
  else
    record ".gitignore" "skipped" "all token stack ignore entries already present"
  fi
}

preflight() {
  record "preflight.git" "$([[ -n "$(command -v git || true)" ]] && echo installed || echo skipped)" "$(command -v git || echo "git not found")"
  record "preflight.node" "$([[ -n "$(command -v node || true)" ]] && echo installed || echo skipped)" "$(command -v node || echo "node not found")"
  record "preflight.npm" "$([[ -n "$(command -v npm || true)" ]] && echo installed || echo skipped)" "$(command -v npm || echo "npm not found")"
  record "preflight.python" "$([[ -n "$(command -v python3 || command -v python || command -v py || true)" ]] && echo installed || echo skipped)" "$(command -v python3 || command -v python || command -v py || echo "python not found")"
  record "preflight.claude" "$([[ -n "$(command -v claude || true)" ]] && echo installed || echo skipped)" "$(command -v claude || echo "claude not found")"
}

scaffold() {
  if [[ "$DRY_RUN" == "1" ]]; then
    record ".claude/" "skipped" "dry-run: would create .claude"
    record ".token-stack directories" "skipped" "dry-run: would create .token-stack/reports and .token-stack/logs"
  else
    mkdir -p "$REPO_ROOT/.claude" "$REPORT_DIR" "$LOG_DIR" "$REPO_ROOT/.token-stack/tmp"
    record ".claude/" "installed" "created or already present"
    record ".token-stack directories" "installed" "created reports, logs, and tmp roots"
  fi
  merge_settings
  copy_template ".mcp.local.example.json" ".mcp.local.example.json"
  copy_template ".claude/settings.local.unattended.example.json" ".claude/settings.local.unattended.example.json"
  copy_template ".claude/token-policy.md" ".claude/token-policy.md"
  copy_template ".claude/hooks/run-python-hook.js" ".claude/hooks/run-python-hook.js"
  copy_template ".claude/hooks/bash-token-guard.py" ".claude/hooks/bash-token-guard.py"
  copy_template ".claude/hooks/cbm-gate.py" ".claude/hooks/cbm-gate.py"
  copy_template ".claude/output-styles/token-lean.md" ".claude/output-styles/token-lean.md"
  copy_template "docs/claude-token-stack.md" "docs/claude-token-stack.md"
  copy_template "docs/claude-token-stack-rollback.md" "docs/claude-token-stack-rollback.md"
  copy_template "docs/context-pack-template.md" "docs/context-pack-template.md"
  copy_template "docs/mcp-local-smoke.md" "docs/mcp-local-smoke.md"
  append_gitignore
  if [[ "$DRY_RUN" != "1" ]]; then
    chmod +x "$REPO_ROOT/.claude/hooks/"*.py "$REPO_ROOT/.claude/hooks/"*.js 2>/dev/null || true
  fi
}

install_context_mode() {
  if command -v context-mode >/dev/null 2>&1; then
    record "context-mode" "installed" "detected $(command -v context-mode)"
    return 0
  fi
  if command -v claude >/dev/null 2>&1 && command -v npx >/dev/null 2>&1; then
    if [[ "$ALLOW_REMOTE" == "1" ]]; then
      run_optional_npx_mcp "context-mode" context-mode "$CONTEXT_MODE_NPM_SPEC"
    else
      record "context-mode" "skipped" "remote MCP add disabled; set TOKEN_STACK_ALLOW_REMOTE_INSTALL=1 to install via npx"
    fi
  else
    record "context-mode" "skipped" "claude or npx not found; install manually if desired"
  fi
}

configure_codebase_memory_mcp() {
  run_optional "codebase-memory-mcp install" codebase-memory-mcp install
  if [[ "${RUN_CBM_INDEX:-0}" == "1" ]]; then
    run_optional "codebase-memory-mcp index" codebase-memory-mcp index "$REPO_ROOT"
  else
    record "codebase-memory-mcp index" "skipped" "RUN_CBM_INDEX is not 1"
  fi
}

install_codebase_memory_mcp() {
  if command -v codebase-memory-mcp >/dev/null 2>&1; then
    record "codebase-memory-mcp" "installed" "detected $(command -v codebase-memory-mcp)"
    configure_codebase_memory_mcp
  elif [[ "$ALLOW_REMOTE" == "1" && -n "$(command -v npm || true)" ]]; then
    run_optional_npm_global "codebase-memory-mcp" "$CODEBASE_MEMORY_MCP_NPM_SPEC"
    hash -r 2>/dev/null || true
    if command -v codebase-memory-mcp >/dev/null 2>&1; then
      record "codebase-memory-mcp" "installed" "detected after npm install: $(command -v codebase-memory-mcp)"
      configure_codebase_memory_mcp
    else
      record "codebase-memory-mcp install" "skipped" "npm install attempted, but codebase-memory-mcp was not found on PATH"
    fi
  else
    record "codebase-memory-mcp" "skipped" "not found; remote npm install disabled or npm unavailable"
  fi
}

inspect_codegraph_dedupe() {
  if ! command -v claude >/dev/null 2>&1; then
    record "codegraph dedupe" "skipped" "claude CLI not found; cannot inspect MCP list"
    return 0
  fi
  local mcp_list
  mcp_list="$(claude mcp list 2>&1 || true)"
  local has_codegraph=0 has_codebase=0
  if printf "%s" "$mcp_list" | grep -Eiq '(^|[^[:alnum:]_-])codegraph([^[:alnum:]_-]|$)'; then
    has_codegraph=1
  fi
  if printf "%s" "$mcp_list" | grep -Eiq 'codebase-memory-mcp|codebase_memory'; then
    has_codebase=1
  fi
  if [[ "$has_codegraph" == "1" && "$has_codebase" == "1" ]]; then
    record "codegraph dedupe" "skipped" "duplicate codegraph MCP detected; prefer codebase-memory-mcp and run bin/remove-optional-codegraph.ps1 or claude mcp remove codegraph"
  elif [[ "$has_codegraph" == "1" ]]; then
    record "codegraph dedupe" "skipped" "codegraph is present, but codebase-memory-mcp was not detected in claude mcp list"
  else
    record "codegraph dedupe" "installed" "no duplicate codegraph MCP detected"
  fi
}

install_caveman() {
  if command -v caveman >/dev/null 2>&1; then
    record "Caveman" "installed" "detected $(command -v caveman)"
  elif [[ "$ALLOW_REMOTE" == "1" && -n "$(command -v npm || true)" ]]; then
    run_optional_npm_global "Caveman" "$CAVEMAN_NPM_SPEC"
    if ! command -v caveman >/dev/null 2>&1; then
      record "Caveman fallback" "fallback" "using .claude/output-styles/token-lean.md"
    fi
  else
    record "Caveman" "fallback" "remote install disabled or npm unavailable; using token-lean output style"
  fi
}

install_rtk() {
  if command -v rtk >/dev/null 2>&1; then
    record "RTK" "installed" "detected $(command -v rtk)"
  elif is_windowsish; then
    record "RTK" "skipped" "Windows/MINGW/MSYS/Cygwin auto-install skipped; use WSL2 or manual native installation"
  else
    safe_remote_sh "https://raw.githubusercontent.com/rtk-ai/rtk/refs/heads/master/install.sh" "RTK"
  fi
}

install_headroom() {
  if [[ "$ENABLE_HEADROOM" != "1" ]]; then
    record "Headroom" "skipped" "disabled by default; set ENABLE_HEADROOM=1 to enable detection/install"
    return 0
  fi
  if command -v headroom >/dev/null 2>&1; then
    record "Headroom" "installed" "detected $(command -v headroom)"
  elif [[ "$ALLOW_REMOTE" == "1" && -n "$(command -v npm || true)" ]]; then
    run_optional_npm_global "Headroom" "$HEADROOM_NPM_SPEC"
  else
    record "Headroom" "skipped" "enabled but not found; remote install disabled or npm unavailable"
  fi
}

install_tools() {
  log "Checking optional tools. Remote install allowed: $ALLOW_REMOTE"
  install_context_mode
  install_codebase_memory_mcp
  inspect_codegraph_dedupe
  install_caveman
  install_rtk
  install_headroom
}

case "$MODE" in
  preflight) preflight; write_report ;;
  scaffold) preflight; scaffold; write_report ;;
  tools|install-tools) install_tools; write_report ;;
  all)
    preflight
    scaffold
    install_tools
    if bash "$KIT_DIR/bin/verify-claude-token-stack.sh"; then
      write_report
    else
      record "verify" "failed" "verification script returned non-zero"
      write_report
      exit 1
    fi
    ;;
  help) usage ;;
  *) usage >&2; exit 2 ;;
esac
