#!/usr/bin/env bash
set -euo pipefail

KIT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROMPT_FILE="$KIT_DIR/prompts/AGENT_MASTER_PROMPT.md"
PERMISSION_MODE="${PERMISSION_MODE:-auto}"
MAX_TURNS="${MAX_TURNS:-80}"
MAX_BUDGET_USD="${MAX_BUDGET_USD:-15.00}"
BEST_EFFORT="${BEST_EFFORT:-0}"
REPORT_DIR=".token-stack/reports"
mkdir -p "$REPORT_DIR"

permission_mode_lc="${PERMISSION_MODE,,}"
case "$permission_mode_lc" in
  *bypass*|*dangerously*|*skip*)
    echo "Refusing unsafe PERMISSION_MODE=$PERMISSION_MODE" >&2
    exit 2
    ;;
esac

echo "This is an advanced example runner, not the default entrypoint." | tee "$REPORT_DIR/advanced-unattended-runner.log"

if ! command -v claude >/dev/null 2>&1; then
  echo "Claude CLI not found. Running script-only scaffold." | tee -a "$REPORT_DIR/advanced-unattended-runner.log"
  bash "$KIT_DIR/bin/install-claude-token-stack.sh" all
  exit $?
fi

if [[ ! -f "$PROMPT_FILE" ]]; then
  echo "Missing prompt file: $PROMPT_FILE" >&2
  exit 1
fi

set +e
claude -p "$(cat "$PROMPT_FILE")" \
  --permission-mode "$PERMISSION_MODE" \
  --max-turns "$MAX_TURNS" \
  --max-budget-usd "$MAX_BUDGET_USD" \
  --output-format stream-json \
  --verbose \
  --include-partial-messages \
  > "$REPORT_DIR/advanced-unattended-agent-run.stream.jsonl"
status=$?
set -e

if [[ $status -ne 0 ]]; then
  echo "Agent runner exited with status $status. Falling back to script-only scaffold." | tee -a "$REPORT_DIR/advanced-unattended-runner.log"
  if ! bash "$KIT_DIR/bin/install-claude-token-stack.sh" all; then
    if [[ "$BEST_EFFORT" == "1" ]]; then
      echo "BEST_EFFORT=1: continuing after script-only scaffold failure." | tee -a "$REPORT_DIR/advanced-unattended-runner.log"
    else
      exit 1
    fi
  fi
fi

if bash "$KIT_DIR/bin/verify-claude-token-stack.sh"; then
  exit 0
fi

if [[ "$BEST_EFFORT" == "1" ]]; then
  echo "BEST_EFFORT=1: verification failed but runner is returning success." | tee -a "$REPORT_DIR/advanced-unattended-runner.log"
  exit 0
fi

exit 1
