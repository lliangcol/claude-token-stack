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

TASKS = ["code-discovery", "test-failure", "long-log"]
METRICS = [
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


def load_metrics(phase: str, task: str) -> dict[str, Any]:
    path = root / phase / f"{task}.json"
    if not path.exists():
        return {}
    try:
        data = json.loads(path.read_text(encoding="utf-8", errors="ignore"))
    except Exception:
        return {}
    metrics: dict[str, Any] = {}
    for key, value in walk(data):
        if key not in METRICS:
            continue
        if key == "task_success":
            metrics[key] = bool(value)
        elif key == "tool_calls" and isinstance(value, list):
            metrics[key] = metrics.get(key, 0) + len(value)
        elif isinstance(value, bool):
            metrics[key] = metrics.get(key, 0) + (1 if value else 0)
        elif isinstance(value, (int, float)):
            metrics[key] = metrics.get(key, 0) + value
    if "cost_usd" not in metrics and "total_cost_usd" in metrics:
        metrics["cost_usd"] = metrics["total_cost_usd"]
    if "total_cost_usd" not in metrics and "cost_usd" in metrics:
        metrics["total_cost_usd"] = metrics["cost_usd"]
    return metrics


def delta(base: Any, post: Any) -> Any:
    if isinstance(base, bool) or isinstance(post, bool):
        return {"baseline": base, "post": post}
    if isinstance(base, (int, float)) and isinstance(post, (int, float)):
        return post - base
    return None


def pct(base: Any, post: Any) -> str:
    if isinstance(base, bool) or isinstance(post, bool):
        return "n/a"
    if not isinstance(base, (int, float)) or not isinstance(post, (int, float)) or base == 0:
        return "n/a"
    return f"{((post - base) / base) * 100:+.1f}%"


def cache_hit_rate(metrics: dict[str, Any]) -> float | None:
    read = metrics.get("cache_read_input_tokens", 0)
    create = metrics.get("cache_creation_input_tokens", 0)
    if not isinstance(read, (int, float)) or not isinstance(create, (int, float)):
        return None
    total = read + create
    return None if total <= 0 else read / total


tasks: dict[str, Any] = {}
totals = {"baseline": {}, "post": {}}
for task in TASKS:
    base = load_metrics("baseline", task)
    post = load_metrics("post", task)
    comparison = {}
    for metric in METRICS:
        comparison[metric] = {
            "baseline": base.get(metric),
            "post": post.get(metric),
            "delta": delta(base.get(metric), post.get(metric)),
            "change_pct": pct(base.get(metric), post.get(metric)),
        }
        for phase, source in (("baseline", base), ("post", post)):
            value = source.get(metric)
            if isinstance(value, bool):
                totals[phase][metric] = totals[phase].get(metric, 0) + (1 if value else 0)
            elif isinstance(value, (int, float)):
                totals[phase][metric] = totals[phase].get(metric, 0) + value
    tasks[task] = {
        "baseline": base,
        "post": post,
        "comparison": comparison,
        "cache_hit_rate": {
            "baseline": cache_hit_rate(base),
            "post": cache_hit_rate(post),
        },
    }

cost_base = totals["baseline"].get("cost_usd", totals["baseline"].get("total_cost_usd", 0))
cost_post = totals["post"].get("cost_usd", totals["post"].get("total_cost_usd", 0))
success_ok = totals["post"].get("task_success", 0) == len(TASKS)
raw_not_worse = totals["post"].get("raw_large_output_events", 0) <= totals["baseline"].get("raw_large_output_events", 0)
cost_not_worse = cost_post <= cost_base if cost_base else False
has_blocks = totals["post"].get("blocked_commands", 0) > 0
recommend_enter_block = bool(success_ok and raw_not_worse and cost_not_worse and has_blocks)

summary = {
    "schema_version": 1,
    "root": str(root),
    "tasks": tasks,
    "totals": {
        "baseline": totals["baseline"],
        "post": totals["post"],
        "delta": {m: delta(totals["baseline"].get(m), totals["post"].get(m)) for m in METRICS},
    },
    "cache_hit_rate": {
        "baseline": cache_hit_rate(totals["baseline"]),
        "post": cache_hit_rate(totals["post"]),
    },
    "cost_change_usd": cost_post - cost_base,
    "cost_change_pct": pct(cost_base, cost_post),
    "recommend_enter_block": recommend_enter_block,
    "recommendation_reason": {
        "post_task_success_all_passed": success_ok,
        "raw_large_output_events_not_worse": raw_not_worse,
        "cost_not_worse": cost_not_worse,
        "post_has_blocked_commands": has_blocks,
    },
}

lines = ["# Metrics Summary", ""]
lines.append(f"- recommend_enter_block: {str(recommend_enter_block).lower()}")
lines.append(f"- cost_change_usd: {summary['cost_change_usd']}")
lines.append(f"- cost_change_pct: {summary['cost_change_pct']}")
for phase in ["baseline", "post"]:
    hit = summary["cache_hit_rate"][phase]
    lines.append(f"- {phase}_cache_hit_rate: {'n/a' if hit is None else f'{hit * 100:.1f}%'}")
lines.append("")
lines.append("| task | metric | baseline | post | delta | change |")
lines.append("|---|---|---:|---:|---:|---:|")
for task in TASKS:
    for metric in METRICS:
        row = tasks[task]["comparison"][metric]
        lines.append(
            f"| {task} | {metric} | {row['baseline'] if row['baseline'] is not None else 'n/a'} | "
            f"{row['post'] if row['post'] is not None else 'n/a'} | "
            f"{row['delta'] if row['delta'] is not None else 'n/a'} | {row['change_pct']} |"
        )

out_json = root / "metrics-summary.json"
out_md = root / "metrics-summary.md"
if not dry_run:
    root.mkdir(parents=True, exist_ok=True)
    out_json.write_text(json.dumps(summary, indent=2) + "\n", encoding="utf-8")
    out_md.write_text("\n".join(lines) + "\n", encoding="utf-8")

print(json.dumps(summary, indent=2))
