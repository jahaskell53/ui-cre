"""Backfill Crexi sales-trends exclusions in bounded id partitions."""

from __future__ import annotations

from supabase import Client

BATCH_SIZE = 1000


def partition_key_to_id_range(partition_key: str, *, batch_size: int = BATCH_SIZE) -> tuple[int, int]:
    """Return [start_id, end_id_exclusive) for a zero-based partition key."""
    try:
        partition_index = int(partition_key)
    except ValueError as exc:
        raise ValueError(f"Invalid partition key: {partition_key}") from exc

    if partition_index < 0:
        raise ValueError(f"Invalid partition key: {partition_key}")

    start_id = partition_index * batch_size + 1
    return start_id, start_id + batch_size


def backfill_crexi_sales_trends_exclusion_partition(
    client: Client,
    partition_key: str,
    *,
    batch_size: int = BATCH_SIZE,
) -> dict[str, int]:
    """Mark one id-range batch of one-unit Crexi sales comps as trend-excluded."""
    start_id, end_id_exclusive = partition_key_to_id_range(partition_key, batch_size=batch_size)

    result = (
        client.table("crexi_api_comps")
        .update({"exclude_from_sales_trends": True})
        .gte("id", start_id)
        .lt("id", end_id_exclusive)
        .eq("is_sales_comp", True)
        .eq("exclude_from_sales_trends", False)
        .eq("num_units", 1)
        .execute()
    )

    return {
        "start_id": start_id,
        "end_id": end_id_exclusive - 1,
        "updated": len(result.data or []),
    }
