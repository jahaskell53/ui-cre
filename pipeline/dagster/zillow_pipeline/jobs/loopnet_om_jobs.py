"""
Explicit @op/@job wrappers for the OM text conversion and metric extraction
assets, so that the Dagster UI renders a proper config form (listing_id,
limit) rather than a raw YAML launchpad.

Usage in Dagster UI Launchpad:
  - Leave all fields blank to process all eligible listings.
  - Set `listing_id` to a specific UUID to process only that row (smoke test).
  - Set `limit` to 1 (or any small number) to process only the first N eligible
    rows without targeting a specific listing.
"""

from typing import Optional

from dagster import Config, OpExecutionContext, job, op

from zillow_pipeline.assets.convert_om_to_text import (
    _convert_pdf_to_text,
    _fetch_pdf_bytes,
)
from zillow_pipeline.assets.extract_om_metrics import (
    _extract_metrics_from_text,
)

import os
from datetime import datetime, timezone


class OmToTextJobConfig(Config):
    """Run config for loopnet_om_text_job. All fields are optional."""

    listing_id: Optional[str] = None
    """UUID of a specific loopnet_listings row to convert. Leave blank for all."""

    limit: Optional[int] = None
    """Max number of rows to process. Leave blank for all. Set to 1 to smoke-test."""


class OmMetricsJobConfig(Config):
    """Run config for loopnet_om_metrics_job. All fields are optional."""

    listing_id: Optional[str] = None
    """UUID of a specific loopnet_listings row to extract metrics from. Leave blank for all."""

    limit: Optional[int] = None
    """Max number of rows to process. Leave blank for all. Set to 1 to smoke-test."""


@op(required_resource_keys={"supabase"}, name="convert_om_to_text_op")
def convert_om_to_text_op(context: OpExecutionContext, config: OmToTextJobConfig) -> int:
    """Convert OM PDFs to markdown text via Gemini 2.5 Flash and store in om_text."""
    from zillow_pipeline.assets.convert_om_to_text import _GEMINI_MODEL, _CONVERSION_PROMPT
    import requests
    from google import genai
    from google.genai import types as genai_types

    api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_AI_API_KEY")
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY (or GOOGLE_AI_API_KEY) environment variable is not set")

    client = context.resources.supabase.get_client()

    query = (
        client.table("loopnet_listing_details")
        .select("id, listing_url, om_url, om_text_extracted_at")
        .not_.is_("om_url", "null")
        .is_("om_text_extracted_at", "null")
    )
    if config.listing_id:
        query = query.eq("id", config.listing_id)

    rows = query.execute().data

    if config.limit is not None:
        rows = rows[: config.limit]

    context.log.info(f"Found {len(rows)} listing(s) to convert")

    updated = failed = 0

    for row in rows:
        listing_id = row["id"]
        listing_url = row.get("listing_url", "")
        om_url = row["om_url"]

        context.log.info(f"Converting PDF to text for {listing_url}")

        try:
            pdf_bytes = _fetch_pdf_bytes(om_url)
        except Exception as e:
            context.log.error(f"Failed to download OM PDF for {listing_url}: {e}")
            failed += 1
            continue

        try:
            om_text = _convert_pdf_to_text(pdf_bytes, api_key)
        except Exception as e:
            context.log.error(f"Failed to convert PDF to text for {listing_url}: {e}")
            failed += 1
            continue

        payload = {
            "om_text": om_text,
            "om_text_extracted_at": datetime.now(timezone.utc).isoformat(),
        }

        try:
            client.table("loopnet_listing_details").update(payload).eq("id", listing_id).execute()
            context.log.info(f"Stored om_text ({len(om_text)} chars) for {listing_url}")
            updated += 1
        except Exception as e:
            context.log.error(f"Failed to write om_text for {listing_url}: {e}")
            failed += 1

    context.log.info(f"PDF-to-text conversion complete — updated={updated}, failed={failed}")

    if failed > 0:
        raise Exception(
            f"{failed} listing(s) failed PDF-to-text conversion ({updated} updated). Check logs above."
        )

    return updated


@op(required_resource_keys={"supabase"}, name="extract_om_metrics_op")
def extract_om_metrics_op(context: OpExecutionContext, config: OmMetricsJobConfig) -> int:
    """Extract investment metrics (cap rate, cost/door, CoC, GRM) from om_text via Gemini."""
    import json

    api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_AI_API_KEY")
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY (or GOOGLE_AI_API_KEY) environment variable is not set")

    client = context.resources.supabase.get_client()

    query = (
        client.table("loopnet_listing_details")
        .select("id, listing_url, om_text, om_metrics_extracted_at")
        .not_.is_("om_text", "null")
        .is_("om_metrics_extracted_at", "null")
    )
    if config.listing_id:
        query = query.eq("id", config.listing_id)

    rows = query.execute().data

    if config.limit is not None:
        rows = rows[: config.limit]

    context.log.info(f"Found {len(rows)} listing(s) to process")

    updated = failed = 0

    for row in rows:
        listing_id = row["id"]
        listing_url = row.get("listing_url", "")
        om_text = row["om_text"]

        context.log.info(f"Extracting metrics from text for {listing_url}")

        try:
            metrics = _extract_metrics_from_text(om_text, api_key)
        except Exception as e:
            context.log.error(f"Failed to extract metrics for {listing_url}: {e}")
            failed += 1
            continue

        payload = {
            "om_cap_rate": metrics.get("cap_rate"),
            "om_cost_per_door": metrics.get("cost_per_door"),
            "om_coc_return": metrics.get("coc_return"),
            "om_grm": metrics.get("grm"),
            "om_metrics_extracted_at": datetime.now(timezone.utc).isoformat(),
        }

        context.log.info(
            f"Metrics for {listing_url}: cap_rate={payload['om_cap_rate']!r}, "
            f"cost_per_door={payload['om_cost_per_door']!r}, "
            f"coc_return={payload['om_coc_return']!r}, "
            f"grm={payload['om_grm']!r}"
        )

        try:
            client.table("loopnet_listing_details").update(payload).eq("id", listing_id).execute()
            updated += 1
        except Exception as e:
            context.log.error(f"Failed to write metrics for {listing_url}: {e}")
            failed += 1

    context.log.info(f"OM metric extraction complete — updated={updated}, failed={failed}")

    if failed > 0:
        raise Exception(
            f"{failed} listing(s) failed metric extraction ({updated} updated). Check logs above."
        )

    return updated


@job(name="loopnet_om_text_job")
def loopnet_om_text_job():
    convert_om_to_text_op()


@job(name="loopnet_om_metrics_job")
def loopnet_om_metrics_job():
    extract_om_metrics_op()
