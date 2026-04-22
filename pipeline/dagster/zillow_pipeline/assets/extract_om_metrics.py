"""
Extract priority investment metrics from om_text stored in loopnet_listings.

For each row that has om_text but has not yet had metrics extracted:
  1. Send the plain text to Gemini 2.5 Flash requesting structured JSON output.
  2. Parse cap rate, cost per door, cash-on-cash return, and GRM.
  3. Write the extracted values back to loopnet_listings and stamp om_metrics_extracted_at.

Listings without om_text, or whose om_metrics_extracted_at is already set,
are skipped.  Re-extraction can be forced by nulling om_metrics_extracted_at.
"""

import json
import os
from datetime import datetime, timezone

from google import genai
from google.genai import types as genai_types
from dagster import AssetExecutionContext, Backoff, Output, RetryPolicy, asset

from zillow_pipeline.assets.convert_om_to_text import convert_om_to_text
from zillow_pipeline.resources.supabase import SupabaseResource

_GEMINI_MODEL = "gemini-2.5-flash"

_EXTRACTION_PROMPT = """
You are a commercial real estate analyst. Extract the following investment metrics
from this Offering Memorandum text. Return ONLY a JSON object with these exact keys:

{
  "cap_rate": "<value as a string like '5.25%' or null if not found>",
  "cost_per_door": "<value as a string like '$150,000' or null if not found>",
  "coc_return": "<cash-on-cash return as a string like '7.5%' or null if not found>",
  "grm": "<Gross Rent Multiplier as a string like '12.3' or null if not found>"
}

Rules:
- Preserve the original formatting from the document (e.g. include % signs, $ signs).
- If a metric appears multiple times, prefer the value from the executive summary or
  investment highlights section.
- If a metric is genuinely absent from the document, use null (not an empty string).
- Do not invent or estimate values that are not in the document.
- Return only the JSON object, no markdown fences, no explanation.
""".strip()


def _extract_metrics_from_text(om_text: str, api_key: str) -> dict:
    """Call Gemini 2.5 Flash with the OM text and return parsed metric dict."""
    client = genai.Client(api_key=api_key)

    response = client.models.generate_content(
        model=_GEMINI_MODEL,
        contents=[_EXTRACTION_PROMPT, om_text],
        config=genai_types.GenerateContentConfig(
            response_mime_type="application/json",
            temperature=0,
        ),
    )

    raw = response.text.strip()
    return json.loads(raw)


@asset(
    deps=[convert_om_to_text],
    retry_policy=RetryPolicy(
        max_retries=2,
        delay=30,
        backoff=Backoff.EXPONENTIAL,
    ),
)
def extract_om_metrics(
    context: AssetExecutionContext,
    supabase: SupabaseResource,
) -> Output[int]:
    """Extract investment metrics (cap rate, cost/door, CoC, GRM) from om_text via Gemini."""
    api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_AI_API_KEY")
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY (or GOOGLE_AI_API_KEY) environment variable is not set")

    client = supabase.get_client()

    rows = (
        client.table("loopnet_listing_details")
        .select("id, listing_url, om_text, om_metrics_extracted_at")
        .not_.is_("om_text", "null")
        .is_("om_metrics_extracted_at", "null")
        .execute()
    ).data

    context.log.info(f"Found {len(rows)} listing(s) with om_text but no extracted metrics")

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

    context.log.info(
        f"OM metric extraction complete — updated={updated}, failed={failed}"
    )

    if failed > 0:
        raise Exception(
            f"{failed} listing(s) failed metric extraction "
            f"({updated} updated). Check logs above."
        )

    return Output(
        value=updated,
        metadata={
            "listings_updated": updated,
            "failed": failed,
            "total_rows": len(rows),
        },
    )
