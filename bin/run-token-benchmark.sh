#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="${CTS_TARGET_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"
cd "$REPO_ROOT"

AI_ENABLED=0
SYNTHETIC_ONLY=0
DRY_RUN=0
NO_WRITE=0
EXPLICIT_PHASES=()
BENCHMARK_CONFIG="${BENCHMARK_CONFIG:-.token-stack/benchmark.config.json}"

permission_mode_lc="${PERMISSION_MODE:-auto}"
permission_mode_lc="$(printf '%s\n' "$permission_mode_lc" | tr '[:upper:]' '[:lower:]')"
case "$permission_mode_lc" in
  *bypass*|*dangerously*|*skip*)
    echo "Refusing unsafe PERMISSION_MODE=${PERMISSION_MODE:-auto}" >&2
    exit 2
    ;;
esac

for arg in "$@"; do
  case "$arg" in
    baseline|post) EXPLICIT_PHASES+=("$arg") ;;
    synthetic-only) SYNTHETIC_ONLY=1 ;;
    ai-enabled) AI_ENABLED=1 ;;
    dry-run|--dry-run) DRY_RUN=1; NO_WRITE=1 ;;
    --no-write) NO_WRITE=1 ;;
    scaffold|tools|all) ;;
    *) echo "Unknown benchmark argument: $arg" >&2; exit 2 ;;
  esac
done

if [[ ${#EXPLICIT_PHASES[@]} -gt 0 ]]; then
  PHASES=("${EXPLICIT_PHASES[@]}")
elif [[ "$SYNTHETIC_ONLY" == "1" ]]; then
  PHASES=(baseline post)
else
  PHASES=(post)
fi

TEMP_ROOT=""
if [[ "$NO_WRITE" == "1" ]]; then
  TEMP_ROOT="$(mktemp -d 2>/dev/null || mktemp -d -t cts-benchmark)"
  trap '[[ -n "${TEMP_ROOT:-}" ]] && rm -rf "$TEMP_ROOT"' EXIT
  REPORT_ROOT="$TEMP_ROOT/reports"
  FIXTURE_DIR="$TEMP_ROOT/fixtures"
else
  REPORT_ROOT=".token-stack/reports"
  FIXTURE_DIR=".token-stack/fixtures"
fi
mkdir -p "$REPORT_ROOT" "$FIXTURE_DIR"

python_cmd() {
  if command -v python3 >/dev/null 2>&1; then
    echo python3
  elif command -v python >/dev/null 2>&1; then
    echo python
  else
    echo "python3/python not found" >&2
    return 127
  fi
}

load_tasks() {
  local py
  py="$(python_cmd)"
  "$py" - "$BENCHMARK_CONFIG" <<'PY'
import json
import sys
from pathlib import Path

config_path = Path(sys.argv[1])
default_tasks = [
    {"id": "code-discovery", "prompt": "Find the main code entry points in this repository. Do not modify files. Prefer code graph discovery if available, then read only necessary files."},
    {"id": "test-failure", "prompt": "Run the smallest safe test or lint command available in this repo. Do not modify business code. Summarize top failure, file, line, root cause, and focused rerun command."},
    {"id": "long-log", "prompt": "Analyze .token-stack/fixtures/synthetic-long-log.txt. Return root cause, first failing component, reproduction clue, and minimal next action. Do not paste the full log."},
]
tasks = default_tasks
if config_path.exists():
    data = json.loads(config_path.read_text(encoding="utf-8"))
    configured = data.get("tasks") if isinstance(data, dict) else None
    if isinstance(configured, list) and configured:
        tasks = configured
for item in tasks:
    if isinstance(item, str):
        task_id = item
    elif isinstance(item, dict):
        task_id = item.get("id") or item.get("task")
    else:
        task_id = None
    if task_id:
        print(task_id)
PY
}

task_prompt() {
  local task="$1"
  local py
  py="$(python_cmd)"
  "$py" - "$BENCHMARK_CONFIG" "$task" <<'PY'
import json
import sys
from pathlib import Path

config_path = Path(sys.argv[1])
task = sys.argv[2]
defaults = {
    "code-discovery": "Find the main code entry points in this repository. Do not modify files. Prefer code graph discovery if available, then read only necessary files.",
    "test-failure": "Run the smallest safe test or lint command available in this repo. Do not modify business code. Summarize top failure, file, line, root cause, and focused rerun command.",
    "long-log": "Analyze .token-stack/fixtures/synthetic-long-log.txt. Return root cause, first failing component, reproduction clue, and minimal next action. Do not paste the full log.",
}
prompt = defaults.get(task, f"Run benchmark task {task}. Do not modify files. Return concise evidence, risk, and next action.")
if config_path.exists():
    data = json.loads(config_path.read_text(encoding="utf-8"))
    for item in data.get("tasks", []):
        if isinstance(item, dict) and (item.get("id") or item.get("task")) == task:
            prompt = item.get("prompt") or prompt
            break
print(prompt)
PY
}

cat > "$FIXTURE_DIR/synthetic-long-log.txt" <<'EOF_LOG'
[INFO] boot service=api env=test
[INFO] loading config
[WARN] retryable network timeout attempt=1
[WARN] retryable network timeout attempt=2
[WARN] retryable network timeout attempt=3
[ERROR] queue-worker failed to parse event file=src/workers/event-worker.ts line=184 code=E_EVENT_SCHEMA
Trace: at parseEvent src/workers/event-worker.ts:184
Trace: at handleEvent src/workers/event-worker.ts:231
Trace: at processTicksAndRejections internal/process/task_queues.js:95
EOF_LOG
for i in $(seq 1 500); do
  echo "[INFO] repeated heartbeat $i" >> "$FIXTURE_DIR/synthetic-long-log.txt"
done

TASKS=()
while IFS= read -r task_id; do
  [[ -n "$task_id" ]] && TASKS+=("$task_id")
done < <(load_tasks)
if [[ ${#TASKS[@]} -eq 0 ]]; then
  TASKS=(code-discovery test-failure long-log)
fi

synthetic_json() {
  local phase="$1"
  local task="$2"
  local out="$3"
  local py
  py="$(python_cmd)"
  "$py" - "$phase" "$task" "$out" <<'PY'
import json
import sys
from pathlib import Path

phase, task, out = sys.argv[1:4]
base = {
    "code-discovery": {
        "input_tokens": 2800,
        "cache_creation_input_tokens": 700,
        "cache_read_input_tokens": 80,
        "output_tokens": 620,
        "tool_calls": 9,
        "raw_large_output_events": 1,
        "blocked_commands": 0,
        "wall_time_seconds": 42.0,
        "cost_usd": 0.028,
    },
    "test-failure": {
        "input_tokens": 2400,
        "cache_creation_input_tokens": 600,
        "cache_read_input_tokens": 60,
        "output_tokens": 700,
        "tool_calls": 7,
        "raw_large_output_events": 1,
        "blocked_commands": 0,
        "wall_time_seconds": 36.0,
        "cost_usd": 0.026,
    },
    "long-log": {
        "input_tokens": 5200,
        "cache_creation_input_tokens": 900,
        "cache_read_input_tokens": 40,
        "output_tokens": 760,
        "tool_calls": 5,
        "raw_large_output_events": 2,
        "blocked_commands": 0,
        "wall_time_seconds": 31.0,
        "cost_usd": 0.044,
    },
}
generic = {
    "input_tokens": 2600,
    "cache_creation_input_tokens": 650,
    "cache_read_input_tokens": 70,
    "output_tokens": 650,
    "tool_calls": 6,
    "raw_large_output_events": 1,
    "blocked_commands": 0,
    "wall_time_seconds": 35.0,
    "cost_usd": 0.027,
}
post_scale = {
    "input_tokens": 0.58,
    "cache_creation_input_tokens": 0.70,
    "cache_read_input_tokens": 3.25,
    "output_tokens": 0.82,
    "tool_calls": 0.78,
    "raw_large_output_events": 0.0,
    "blocked_commands": 1.0,
    "wall_time_seconds": 0.86,
    "cost_usd": 0.60,
}
metrics = dict(base.get(task, generic))
if phase == "post":
    for key, scale in post_scale.items():
        if key == "blocked_commands":
            metrics[key] = 1 if task in {"code-discovery", "long-log"} else 0
        elif key == "raw_large_output_events":
            metrics[key] = 0
        elif isinstance(metrics[key], int):
            metrics[key] = int(round(metrics[key] * scale))
        else:
            metrics[key] = round(metrics[key] * scale, 6)
metrics["total_cost_usd"] = metrics["cost_usd"]
record = {
    "schema_version": 1,
    "mode": "synthetic-only",
    "evidence_type": "synthetic",
    "phase": phase,
    "task": task,
    "task_success": True,
    "metrics": metrics,
}
Path(out).write_text(json.dumps(record, indent=2) + "\n", encoding="utf-8")
PY
}

run_ai_task() {
  local phase="$1"
  local task="$2"
  local prompt="$3"
  local report_dir="$REPORT_ROOT/$phase"
  local out="$report_dir/$task.json"
  local err="$report_dir/$task.err"
  local start end elapsed code
  start=$(date +%s)
  set +e
  claude -p "$prompt" \
    --permission-mode "${PERMISSION_MODE:-auto}" \
    --max-turns "${BENCHMARK_MAX_TURNS:-25}" \
    --max-budget-usd "${BENCHMARK_MAX_BUDGET_USD:-5.00}" \
    --output-format json > "$out" 2> "$err"
  code=$?
  set -e
  end=$(date +%s)
  elapsed=$((end - start))
  local py
  py="$(python_cmd)"
  "$py" - "$out" "$phase" "$task" "$code" "$elapsed" <<'PY'
import json
import sys
from pathlib import Path

path, phase, task, code, elapsed = sys.argv[1:6]
p = Path(path)
try:
    data = json.loads(p.read_text(encoding="utf-8", errors="ignore"))
except Exception:
    data = {"raw_output_parse_failed": True}
data.setdefault("phase", phase)
data.setdefault("task", task)
data.setdefault("task_success", int(code) == 0)
data.setdefault("wall_time_seconds", float(elapsed))
p.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
PY
}

for phase in "${PHASES[@]}"; do
  report_dir="$REPORT_ROOT/$phase"
  mkdir -p "$report_dir"
  benchmark_md="$report_dir/benchmark.md"
  {
    echo "# Benchmark $phase"
    echo "Date: $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
    echo "Mode: $([[ "$AI_ENABLED" == "1" ]] && echo ai-enabled || echo synthetic-only)"
    echo ""
  } > "$benchmark_md"

  for task in "${TASKS[@]}"; do
    if [[ "$AI_ENABLED" == "1" && "$DRY_RUN" != "1" && "$SYNTHETIC_ONLY" != "1" ]]; then
      if ! command -v claude >/dev/null 2>&1; then
        echo "- $task: skipped; claude CLI not found" >> "$benchmark_md"
        synthetic_json "$phase" "$task" "$report_dir/$task.json"
        continue
      fi
      prompt="$(task_prompt "$task")"
      run_ai_task "$phase" "$task" "$prompt"
      echo "- $task: ai-enabled result written to $report_dir/$task.json" >> "$benchmark_md"
    else
      synthetic_json "$phase" "$task" "$report_dir/$task.json"
      echo "- $task: synthetic result written to $report_dir/$task.json" >> "$benchmark_md"
    fi
  done
done

for phase in "${PHASES[@]}"; do
  cat "$REPORT_ROOT/$phase/benchmark.md"
done
