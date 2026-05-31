#!/usr/bin/env python3
from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any

args = [arg for arg in sys.argv[1:] if arg not in {"scaffold", "tools", "all"}]
dry_run = any(arg in {"dry-run", "--dry-run"} for arg in args)
args = [arg for arg in args if arg not in {"dry-run", "--dry-run"}]
root = Path(args[0]) if args else Path(".token-stack/reports")

FIELDS = [
    "input_tokens",
    "cache_creation_input_tokens",
    "cache_read_input_tokens",
    "output_tokens",
    "tool_calls",
    "raw_large_output_events",
    "blocked_commands",
    "task_success",
    "wall_time_seconds",
    "cost_usd",
    "total_cost_usd",
]


def walk(obj: Any):
    if isinstance(obj, dict):
        for key, value in obj.items():
            yield key, value
            yield from walk(value)
    elif isinstance(obj, list):
        for value in obj:
            yield from walk(value)


def add_metric(metrics: dict[str, Any], key: str, value: Any) -> None:
    if key == "task_success":
        metrics["task_success_total"] = metrics.get("task_success_total", 0) + 1
        metrics["task_success_passed"] = metrics.get("task_success_passed", 0) + (1 if bool(value) else 0)
        return
    if key == "tool_calls" and isinstance(value, list):
        value = len(value)
    if isinstance(value, bool):
        value = 1 if value else 0
    if isinstance(value, (int, float)):
        metrics[key] = metrics.get(key, 0) + value


summary: dict[str, Any] = {
    "schema_version": 1,
    "root": str(root),
    "files": [],
    "phases": {},
    "totals": {},
}

for path in sorted(root.rglob("*.json")):
    if path.name in {"metrics-collected.json", "metrics-summary.json"}:
        continue
    try:
        data = json.loads(path.read_text(encoding="utf-8", errors="ignore"))
    except Exception:
        continue

    phase = data.get("phase")
    task = data.get("task")
    try:
        rel = path.relative_to(root)
        if not phase and len(rel.parts) >= 2:
            phase = rel.parts[0]
        if not task:
            task = path.stem
    except ValueError:
        pass

    file_metrics: dict[str, Any] = {}
    for key, value in walk(data):
        if key in FIELDS:
            add_metric(file_metrics, key, value)

    if "cost_usd" not in file_metrics and "total_cost_usd" in file_metrics:
        file_metrics["cost_usd"] = file_metrics["total_cost_usd"]
    if "total_cost_usd" not in file_metrics and "cost_usd" in file_metrics:
        file_metrics["total_cost_usd"] = file_metrics["cost_usd"]

    record = {
        "path": str(path),
        "phase": phase,
        "task": task,
        "metrics": file_metrics,
    }
    summary["files"].append(record)

    for key, value in file_metrics.items():
        add_metric(summary["totals"], key, value)

    if phase:
        phase_bucket = summary["phases"].setdefault(phase, {"totals": {}, "tasks": {}})
        for key, value in file_metrics.items():
            add_metric(phase_bucket["totals"], key, value)
        if task:
            task_bucket = phase_bucket["tasks"].setdefault(task, {})
            for key, value in file_metrics.items():
                add_metric(task_bucket, key, value)

out_json = root / "metrics-collected.json"
out_md = root / "metrics-collected.md"
if not dry_run:
    root.mkdir(parents=True, exist_ok=True)
    out_json.write_text(json.dumps(summary, indent=2) + "\n", encoding="utf-8")
    lines = ["# Metrics Collected", ""]
    lines.append(f"- Files: {len(summary['files'])}")
    for key in FIELDS:
        if key == "task_success":
            total = summary["totals"].get("task_success_total", 0)
            passed = summary["totals"].get("task_success_passed", 0)
            lines.append(f"- task_success: {passed}/{total}")
        elif key in summary["totals"]:
            lines.append(f"- {key}: {summary['totals'][key]}")
    out_md.write_text("\n".join(lines) + "\n", encoding="utf-8")

print(json.dumps(summary, indent=2))
