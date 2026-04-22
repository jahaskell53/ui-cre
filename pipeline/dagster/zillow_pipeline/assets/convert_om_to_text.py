"""
Convert OM PDFs stored in S3 to plain text (markdown) via Gemini 2.5 Flash.

For each loopnet_listing_details row that has an om_url but no om_text yet:
  1. Fetch the PDF bytes from the public S3 URL.
  2. Send to Gemini 2.5 Flash with a PDF-to-markdown conversion prompt.
  3. Store the resulting text in om_text and stamp om_text_extracted_at.

Listings without an om_url, or whose om_text_extracted_at is already set,
are skipped.  Re-conversion can be forced by nulling om_text_extracted_at.
"""

import os
from datetime import datetime, timezone

import requests
from google import genai
from google.genai import types as genai_types
from dagster import AssetExecutionContext, Backoff, Output, RetryPolicy, asset

from zillow_pipeline.assets.download_om_pdfs import download_om_pdfs
from zillow_pipeline.resources.supabase import SupabaseResource

_GEMINI_MODEL = "gemini-2.5-flash"

_CONVERSION_PROMPT = """
Convert the contents of this Offering Memorandum PDF to clean markdown text.

Rules:
- Preserve all numbers, percentages, dollar amounts, and financial figures exactly as written.
- Preserve section headers as markdown headings.
- Render tables as markdown tables where possible; otherwise use structured lists.
- Do not summarize, omit, or paraphrase any content — transcribe everything faithfully.
- Do not add commentary or explanation outside of what is in the document.
""".strip()


def _fetch_pdf_bytes(url: str, timeout: int = 30) -> bytes:
    """Download PDF bytes from a public S3 URL."""
    resp = requests.get(url, timeout=timeout)
    resp.raise_for_status()
    return resp.content


def _convert_pdf_to_text(pdf_bytes: bytes, api_key: str) -> str:
    """Send PDF bytes to Gemini 2.5 Flash and return the markdown text."""
    client = genai.Client(api_key=api_key)

    response = client.models.generate_content(
        model=_GEMINI_MODEL,
        contents=[
            genai_types.Part.from_bytes(data=pdf_bytes, mime_type="application/pdf"),
            _CONVERSION_PROMPT,
        ],
        config=genai_types.GenerateContentConfig(temperature=0),
    )

    return response.text.strip()


@asset(
    deps=[download_om_pdfs],
    retry_policy=RetryPolicy(
        max_retries=2,
        delay=30,
        backoff=Backoff.EXPONENTIAL,
    ),
)
def convert_om_to_text(
    context: AssetExecutionContext,
    supabase: SupabaseResource,
) -> Output[int]:
    """Convert OM PDFs to markdown text via Gemini 2.5 Flash and store in om_text."""
    api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_AI_API_KEY")
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY (or GOOGLE_AI_API_KEY) environment variable is not set")

    client = supabase.get_client()

    rows = (
        client.table("loopnet_listing_details")
        .select("id, listing_url, om_url, om_text_extracted_at")
        .not_.is_("om_url", "null")
        .is_("om_text_extracted_at", "null")
        .execute()
    ).data

    context.log.info(f"Found {len(rows)} listing(s) with om_url but no converted text")

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

    context.log.info(
        f"PDF-to-text conversion complete — updated={updated}, failed={failed}"
    )

    if failed > 0:
        raise Exception(
            f"{failed} listing(s) failed PDF-to-text conversion "
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
