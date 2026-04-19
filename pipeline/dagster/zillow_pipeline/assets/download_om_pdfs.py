"""
Download Offering Memorandum PDFs from loopnet_listings and upload them to S3.

For each listing that has an attachment whose description contains "om",
"offering memo", or "offering memorandum" (case-insensitive), we:
  1. Download the PDF via Apify's playwright-scraper actor.
     Plain HTTP requests (even through residential proxies) return 403 from
     Akamai because the CDN requires valid LoopNet session cookies. The
     playwright actor visits the listing page first to establish the session,
     then fetches the document URL in the same browser context.
  2. Upload the PDF to S3 under the key `om/{listing_id}.pdf`.
  3. Write the public S3 URL back to `loopnet_listings.om_url`.

Listings that already have `om_url` set are skipped.
"""

import re

from dagster import AssetExecutionContext, Backoff, Output, RetryPolicy, asset

from zillow_pipeline.assets.cleaned_loopnet_listings import cleaned_loopnet_listings
from zillow_pipeline.resources.apify import ApifyResource
from zillow_pipeline.resources.s3 import S3Resource
from zillow_pipeline.resources.supabase import SupabaseResource


_OM_KEYWORDS = re.compile(r"offering\s*memo(randum)?|\bom\b", re.IGNORECASE)


def _is_om_attachment(attachment: dict) -> bool:
    description = attachment.get("description") or ""
    return bool(_OM_KEYWORDS.search(description.strip()))


def _find_om_url(attachments: list) -> str | None:
    """Return the first attachment link that looks like an OM, or None."""
    for att in attachments or []:
        if _is_om_attachment(att):
            link = att.get("link") or att.get("url") or ""
            if link:
                return link
    return None


@asset(
    deps=[cleaned_loopnet_listings],
    retry_policy=RetryPolicy(
        max_retries=2,
        delay=30,
        backoff=Backoff.EXPONENTIAL,
    ),
)
def download_om_pdfs(
    context: AssetExecutionContext,
    supabase: SupabaseResource,
    s3: S3Resource,
    apify: ApifyResource,
) -> Output[int]:
    client = supabase.get_client()

    rows = (
        client.table("loopnet_listings")
        .select("id, listing_url, attachments, om_url")
        .execute()
    ).data

    uploaded = skipped = failed = already_done = 0

    for row in rows:
        listing_id = row["id"]
        listing_url = row.get("listing_url", "")

        if row.get("om_url"):
            already_done += 1
            context.log.debug(f"Already has om_url, skipping: {listing_url}")
            continue

        attachments = row.get("attachments") or []
        om_source_url = _find_om_url(attachments)

        if not om_source_url:
            skipped += 1
            context.log.debug(f"No OM attachment found for: {listing_url}")
            continue

        context.log.info(f"Downloading OM for {listing_url} from {om_source_url}")
        try:
            pdf_bytes = apify.download_loopnet_document(listing_url, om_source_url)
        except Exception as e:
            context.log.error(f"Failed to download OM for {listing_url}: {e}")
            failed += 1
            continue

        s3_key = f"om/{listing_id}.pdf"
        try:
            s3_url = s3.upload_bytes(s3_key, pdf_bytes, content_type="application/pdf")
        except Exception as e:
            context.log.error(f"Failed to upload OM to S3 for {listing_url}: {e}")
            failed += 1
            continue

        try:
            client.table("loopnet_listings").update({"om_url": s3_url}).eq("id", listing_id).execute()
            context.log.info(f"Stored OM URL {s3_url} for {listing_url}")
            uploaded += 1
        except Exception as e:
            context.log.error(f"Failed to write om_url to DB for {listing_url}: {e}")
            failed += 1

    context.log.info(
        f"OM download complete — uploaded={uploaded}, skipped={skipped}, "
        f"already_done={already_done}, failed={failed}"
    )

    if failed > 0:
        raise Exception(
            f"{failed} OM(s) failed to download/upload "
            f"({uploaded} uploaded, {skipped} skipped, {already_done} already done). "
            f"Check logs above for the specific errors."
        )

    return Output(
        value=uploaded,
        metadata={
            "uploaded": uploaded,
            "skipped": skipped,
            "already_done": already_done,
            "failed": failed,
            "total_rows": len(rows),
        },
    )
