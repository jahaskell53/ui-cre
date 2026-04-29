"""
Download OM PDFs for active Crexi listings and upload them to S3.

For each row in ``crexi_active_listings`` that has a ``property_link`` and whose
``om_url`` is not yet set, we:

  1. Visit the Crexi listing page via Apify's playwright-scraper (Cloudflare blocks
     direct HTTP requests, so we need a real browser session with cookies).
  2. Discover all PDF attachment links on the page and pick the best OM candidate.
  3. Download the PDF through the same browser context and upload it to S3 under
     ``crexi_attachments/{listing_id}/{sha256_prefix}.pdf``.
  4. Write ``om_url`` (S3 public URL) and ``attachment_urls`` back to the row.

Rows whose ``om_url`` is already set are skipped.
Rows with no ``property_link`` are skipped.
"""

import hashlib

from dagster import AssetExecutionContext, Backoff, Output, RetryPolicy, asset

from zillow_pipeline.resources.apify import ApifyResource
from zillow_pipeline.resources.s3 import S3Resource
from zillow_pipeline.resources.supabase import SupabaseResource


@asset(
    retry_policy=RetryPolicy(
        max_retries=2,
        delay=30,
        backoff=Backoff.EXPONENTIAL,
    ),
)
def download_crexi_om_pdfs(
    context: AssetExecutionContext,
    supabase: SupabaseResource,
    s3: S3Resource,
    apify: ApifyResource,
) -> Output[int]:
    client = supabase.get_client()

    rows = (
        client.table("crexi_active_listings")
        .select("id, property_link, om_url")
        .execute()
    ).data

    uploaded = skipped = failed = already_done = listings_updated = 0

    for row in rows:
        listing_id = row["id"]
        listing_url = (row.get("property_link") or "").strip()

        if not listing_url:
            skipped += 1
            context.log.debug(f"No property_link for crexi_active_listings id={listing_id}, skipping")
            continue

        if row.get("om_url"):
            already_done += 1
            context.log.debug(f"om_url already set for {listing_url}, skipping")
            continue

        context.log.info(f"Fetching OM PDF for {listing_url}")
        try:
            result = apify.download_crexi_document(listing_url)
        except Exception as e:
            context.log.error(f"Failed to fetch OM PDF for {listing_url}: {e}")
            failed += 1
            continue

        if result is None:
            context.log.info(f"No PDF found on listing page: {listing_url}")
            skipped += 1
            continue

        document_url, pdf_bytes = result

        digest = hashlib.sha256(document_url.encode("utf-8")).hexdigest()[:16]
        s3_key = f"crexi_attachments/{listing_id}/{digest}.pdf"

        try:
            s3_url = s3.upload_bytes(s3_key, pdf_bytes, content_type="application/pdf")
        except Exception as e:
            context.log.error(f"Failed to upload PDF to S3 for {listing_url}: {e}")
            failed += 1
            continue

        uploaded += 1
        attachment_entry = {"source_url": document_url, "url": s3_url}
        payload = {
            "om_url": s3_url,
            "attachment_urls": [attachment_entry],
        }

        try:
            client.table("crexi_active_listings").update(payload).eq("id", listing_id).execute()
            context.log.info(f"Stored om_url for {listing_url}")
            listings_updated += 1
        except Exception as e:
            context.log.error(f"Failed to write om_url for {listing_url}: {e}")
            failed += 1

    context.log.info(
        f"Crexi OM download complete — listings_updated={listings_updated}, "
        f"files_uploaded={uploaded}, skipped={skipped}, "
        f"already_done={already_done}, failed={failed}"
    )

    if failed > 0:
        raise Exception(
            f"{failed} Crexi OM operation(s) failed "
            f"({uploaded} file(s) uploaded, {listings_updated} listing(s) updated, "
            f"{skipped} skipped, {already_done} already done). "
            f"Check logs above for the specific errors."
        )

    return Output(
        value=listings_updated,
        metadata={
            "listings_updated": listings_updated,
            "files_uploaded": uploaded,
            "skipped": skipped,
            "already_done": already_done,
            "failed": failed,
            "total_rows": len(rows),
        },
    )
