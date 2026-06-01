from __future__ import annotations


def classify_order_status(status: str) -> str:
    normalized = status.strip().lower()
    if normalized in {"paid", "shipped", "delivered"}:
        return "active"
    if normalized in {"cancelled", "refunded"}:
        return "closed"
    return "review"


def summarize_order(order_id: str, status: str) -> dict[str, str]:
    return {
        "order_id": order_id,
        "status": status,
        "bucket": classify_order_status(status),
    }
