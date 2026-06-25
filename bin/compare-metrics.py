#!/usr/bin/env python3
from __future__ import annotations

import json
import sys
from pathlib import Path
from typing import Any

raw_args = [arg for arg in sys.argv[1:] if arg not in {"scaffold", "tools", "all"}]
dry_run = any(arg in {"dry-run", "--dry-run", "--no-write"} for arg in raw_args)
args: list[str] = []
config_path: Path | None = None
i = 0
while i < len(raw_args):
    arg = raw_args[i]
    if arg in {"dry-run", "--dry-run", "--no-write"}:
        i += 1
        continue
    if arg == "--config" and i + 1 < len(raw_args):
        config_path = Path(raw_args[i + 1])
        i += 2
        continue
    args.append(arg)
    i += 1
root = Path(args[0]) if args else Path(".token-stack/reports")
if config_path is None:
    config_path = root.parent / "benchmark.config.json"

DEFAULT_TASKS = ["code-discovery", "test-failure", "long-log"]
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


def load_task_record(phase: str, task: str) -> dict[str, Any]:
    path = root / phase / f"{task}.json"
    if not path.exists():
        return {}
    try:
        return json.loads(path.read_text(encoding="utf-8", errors="ignore"))
    except Exception:
        return {}


def load_metrics(phase: str, task: str) -> dict[str, Any]:
    data = load_task_record(phase, task)
    if not data:
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


def target_dir_for_report_root(report_root: Path) -> Path:
    if report_root.name == "reports" and report_root.parent.name == ".token-stack":
        return report_root.parent.parent
    return Path.cwd()


def existing_paths(paths: list[Path]) -> list[str]:
    return [str(path) for path in paths if path.exists()]


def warning(code: str, detail: str) -> dict[str, str]:
    return {"code": code, "detail": detail}


def validate_false_positive_review(path: Path) -> dict[str, Any]:
    if not path.exists():
        return {
            "present": False,
            "valid": False,
            "path": str(path),
            "warnings": [
                warning(
                    "false_positive_review_json_missing",
                    "structured false-positive-review.json is required for machine block recommendation",
                )
            ],
        }
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:
        return {
            "present": True,
            "valid": False,
            "path": str(path),
            "warnings": [warning("false_positive_review_json_invalid", f"invalid JSON: {exc}")],
        }
    warnings: list[dict[str, str]] = []
    if not isinstance(data, dict):
        warnings.append(warning("false_positive_review_json_invalid", "review JSON must be an object"))
    else:
        if data.get("schema_version") != 1:
            warnings.append(warning("false_positive_review_json_invalid", "schema_version must be 1"))
        if not isinstance(data.get("reviewed_at"), str) or not data.get("reviewed_at"):
            warnings.append(warning("false_positive_review_json_invalid", "reviewed_at must be a non-empty string"))
        log_paths = data.get("reviewed_log_paths")
        if not isinstance(log_paths, list) or not log_paths or not all(isinstance(item, str) and item for item in log_paths):
            warnings.append(
                warning("false_positive_review_json_invalid", "reviewed_log_paths must be a non-empty string array")
            )
        for field in ["reviewed_entries", "true_positive_count", "false_positive_count", "unclear_count"]:
            value = data.get(field)
            if not isinstance(value, int) or value < 0:
                warnings.append(warning("false_positive_review_json_invalid", f"{field} must be a non-negative integer"))
        if isinstance(data.get("reviewed_entries"), int):
            total_classified = sum(data.get(field, 0) for field in [
                "true_positive_count",
                "false_positive_count",
                "unclear_count",
            ] if isinstance(data.get(field), int))
            if total_classified > data["reviewed_entries"]:
                warnings.append(
                    warning(
                        "false_positive_review_json_invalid",
                        "classified counts must not exceed reviewed_entries",
                    )
                )
    return {
        "present": True,
        "valid": len(warnings) == 0,
        "path": str(path),
        "warnings": warnings,
    }


def promotion_evidence(report_root: Path) -> dict[str, Any]:
    target = target_dir_for_report_root(report_root)
    verify_report = report_root / "verify-report.json"
    hook_logs = [
        target / ".claude" / "logs" / "token-guard.log",
        target / ".claude" / "logs" / "cbm-gate.log",
    ]
    false_positive_review_json = report_root / "false-positive-review.json"
    false_positive_review_unstructured = [
        report_root / "false-positive-review.md",
        report_root / "false-positive-review.txt",
    ]
    false_positive_review_paths = existing_paths([false_positive_review_json, *false_positive_review_unstructured])
    false_positive_review_validation = validate_false_positive_review(false_positive_review_json)
    evidence = {
        "metrics_summary_current_output": True,
        "metrics_summary_path": str(report_root / "metrics-summary.json"),
        "verify_report": verify_report.exists(),
        "verify_report_path": str(verify_report),
        "hook_logs": bool(existing_paths(hook_logs)),
        "hook_log_paths": existing_paths(hook_logs),
        "false_positive_review": false_positive_review_validation["valid"],
        "false_positive_review_artifact": bool(false_positive_review_paths),
        "false_positive_review_json": false_positive_review_validation["present"],
        "false_positive_review_json_valid": false_positive_review_validation["valid"],
        "false_positive_review_paths": false_positive_review_paths,
        "warnings": false_positive_review_validation["warnings"],
    }
    evidence["complete"] = bool(
        evidence["verify_report"]
        and evidence["hook_logs"]
        and evidence["false_positive_review"]
    )
    return evidence


def configured_tasks() -> list[str]:
    tasks: list[str] = []
    if config_path and config_path.exists():
        try:
            data = json.loads(config_path.read_text(encoding="utf-8"))
            configured = data.get("tasks") if isinstance(data, dict) else None
            if isinstance(configured, list):
                for item in configured:
                    if isinstance(item, str):
                        tasks.append(item)
                    elif isinstance(item, dict):
                        task = item.get("id") or item.get("task")
                        if isinstance(task, str):
                            tasks.append(task)
        except Exception:
            pass
    if not tasks:
        tasks.extend(DEFAULT_TASKS)
    for phase in ("baseline", "post"):
        phase_dir = root / phase
        if phase_dir.exists():
            for path in sorted(phase_dir.glob("*.json")):
                if path.stem not in tasks and path.name not in {"metrics-summary.json", "metrics-collected.json"}:
                    tasks.append(path.stem)
    return tasks


TASKS = configured_tasks()
tasks: dict[str, Any] = {}
totals = {"baseline": {}, "post": {}}
evidence_modes: set[str] = set()
evidence_types: set[str] = set()
for task in TASKS:
    for phase in ["baseline", "post"]:
        record = load_task_record(phase, task)
        mode = record.get("mode")
        if isinstance(mode, str):
            evidence_modes.add(mode)
        evidence_type = record.get("evidence_type")
        if isinstance(evidence_type, str):
            evidence_types.add(evidence_type)
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
synthetic_only = (bool(evidence_types) and evidence_types <= {"synthetic"}) or (
    not evidence_types and bool(evidence_modes) and evidence_modes <= {"synthetic-only"}
)
representative_evidence = bool(evidence_types & {"real", "mixed"})
promotion = promotion_evidence(root)
promotion_evidence_present = bool(promotion["complete"] and representative_evidence)
recommend_enter_block = bool(
    success_ok
    and raw_not_worse
    and cost_not_worse
    and has_blocks
    and representative_evidence
    and promotion_evidence_present
)

summary = {
    "schema_version": 1,
    "root": str(root),
    "config": str(config_path) if config_path else None,
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
    "evidence_types": sorted(evidence_types),
    "evidence_modes": sorted(evidence_modes),
    "promotion_evidence": promotion,
    "recommend_enter_block": recommend_enter_block,
    "recommendation_reason": {
        "post_task_success_all_passed": success_ok,
        "raw_large_output_events_not_worse": raw_not_worse,
        "cost_not_worse": cost_not_worse,
        "post_has_blocked_commands": has_blocks,
        "has_real_or_mixed_evidence_type": bool(evidence_types & {"real", "mixed"}),
        "verify_report_present": promotion["verify_report"],
        "hook_logs_present": promotion["hook_logs"],
        "false_positive_review_present": promotion["false_positive_review"],
        "promotion_evidence_present": promotion_evidence_present,
        "representative_evidence": representative_evidence,
    },
}

lines = ["# Metrics Summary", ""]
lines.append(f"- recommend_enter_block: {str(recommend_enter_block).lower()}")
lines.append(f"- cost_change_usd: {summary['cost_change_usd']}")
lines.append(f"- cost_change_pct: {summary['cost_change_pct']}")
if evidence_modes:
    lines.append(f"- evidence_modes: {', '.join(sorted(evidence_modes))}")
if evidence_types:
    lines.append(f"- evidence_types: {', '.join(sorted(evidence_types))}")
if not evidence_types:
    lines.append("- recommendation_note: evidence_type real or mixed is required to recommend block mode")
elif synthetic_only:
    lines.append("- recommendation_note: synthetic evidence cannot recommend block mode")
if not promotion["complete"]:
    lines.append("- promotion_evidence_note: verify-report.json, hook logs, and valid false-positive-review.json are required before recommending block mode")
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
