"""
Download all LoopNet listing attachments (PDFs) and upload them to S3.

For each listing attachment that has a document URL (`link` or `url`), we:
  1. Download the file via Apify's playwright-scraper actor (LoopNet CDN needs session cookies).
  2. Upload to S3 under `attachments/{listing_id}/{sha256_prefix}.pdf`.
  3. Replace `loopnet_listings.attachment_urls` with a JSON array:
     `[{ "source_url": "<original>", "url": "<s3 public url>", "description": "<optional>" }, ...]`.

`om_url` is set to the S3 URL of the first attachment that looks like an offering memorandum:
description matches the legacy regex, or the source URL path/filename suggests an OM
(whole-word / token "om" in the path, or "offering memo" style text in the URL).

If none qualify, `om_url` falls back to the first uploaded attachment URL.

Listings whose `attachment_urls` already fully cover every current attachment URL are skipped.
"""

import hashlib
import json

from dagster import AssetExecutionContext, Backoff, Output, RetryPolicy, asset

from zillow_pipeline.assets.cleaned_loopnet_listings import cleaned_loopnet_listings
from zillow_pipeline.lib.loopnet_om_selection import pick_om_s3_url
from zillow_pipeline.resources.apify import ApifyResource
from zillow_pipeline.resources.s3 import S3Resource
from zillow_pipeline.resources.supabase import SupabaseResource


def _attachment_source_urls(attachments: list) -> list[tuple[str, str | None]]:
    """Return ordered (source_url, description) for each attachment that has a URL."""
    out: list[tuple[str, str | None]] = []
    seen: set[str] = set()
    for att in attachments or []:
        if not isinstance(att, dict):
            continue
        raw = (att.get("link") or att.get("url") or "").strip()
        if not raw:
            continue
        if raw in seen:
            continue
        seen.add(raw)
        desc = att.get("description")
        out.append((raw, str(desc).strip() if desc else None))
    return out


def _urls_fully_cached(source_urls: list[str], cached: object) -> bool:
    """True when every source URL already has a matching entry in `attachment_urls`."""
    if not source_urls:
        return False
    if not isinstance(cached, list):
        return False
    indexed: dict[str, str] = {}
    for item in cached:
        if not isinstance(item, dict):
            continue
        su = item.get("source_url")
        u = item.get("url")
        if isinstance(su, str) and isinstance(u, str) and su.strip() and u.strip():
            indexed[su.strip()] = u.strip()
    return all(s in indexed and bool(indexed[s].strip()) for s in source_urls)


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
        client.table("loopnet_listing_details")
        .select("id, listing_url, attachments, om_url, attachment_urls")
        .execute()
    ).data

    uploaded_files = skipped = failed = already_done = listings_updated = 0

    for row in rows:
        listing_id = row["id"]
        listing_url = row.get("listing_url", "")

        attachments = row.get("attachments") or []
        pairs = _attachment_source_urls(attachments if isinstance(attachments, list) else [])
        source_only = [u for u, _ in pairs]

        cached = row.get("attachment_urls")
        if isinstance(cached, str):
            try:
                cached = json.loads(cached)
            except json.JSONDecodeError:
                cached = []

        if _urls_fully_cached(source_only, cached):
            already_done += 1
            context.log.debug(f"Attachments already cached, skipping: {listing_url}")
            continue

        if not pairs:
            skipped += 1
            context.log.debug(f"No attachment URLs for: {listing_url}")
            continue

        built: list[dict[str, str]] = []
        listing_failed = 0
        for source_url, description in pairs:
            digest = hashlib.sha256(source_url.encode("utf-8")).hexdigest()[:16]
            s3_key = f"attachments/{listing_id}/{digest}.pdf"
            context.log.info(f"Downloading attachment for {listing_url} from {source_url}")
            try:
                pdf_bytes = apify.download_loopnet_document(listing_url, source_url)
            except Exception as e:
                context.log.error(f"Failed to download attachment for {listing_url}: {e}")
                failed += 1
                listing_failed += 1
                continue

            try:
                s3_url = s3.upload_bytes(s3_key, pdf_bytes, content_type="application/pdf")
            except Exception as e:
                context.log.error(f"Failed to upload attachment to S3 for {listing_url}: {e}")
                failed += 1
                listing_failed += 1
                continue

            uploaded_files += 1
            entry: dict[str, str] = {"source_url": source_url, "url": s3_url}
            if description:
                entry["description"] = description
            built.append(entry)

        if not built:
            context.log.warning(f"No attachments uploaded for {listing_url} ({listing_failed} failure(s))")
            continue

        om_pick = pick_om_s3_url(built)
        om_url = om_pick if om_pick else built[0]["url"]
        payload = {"attachment_urls": built, "om_url": om_url}

        try:
            client.table("loopnet_listing_details").update(payload).eq("id", listing_id).execute()
            context.log.info(f"Stored {len(built)} attachment URL(s) for {listing_url}")
            listings_updated += 1
        except Exception as e:
            context.log.error(f"Failed to write attachment_urls for {listing_url}: {e}")
            failed += 1

    context.log.info(
        f"Attachment download complete — listings_updated={listings_updated}, "
        f"files_uploaded={uploaded_files}, skipped={skipped}, "
        f"already_done={already_done}, failed={failed}"
    )

    if failed > 0:
        raise Exception(
            f"{failed} attachment operation(s) failed "
            f"({uploaded_files} file(s) uploaded, {listings_updated} listing(s) updated, "
            f"{skipped} skipped, {already_done} already done). "
            f"Check logs above for the specific errors."
        )

    return Output(
        value=listings_updated,
        metadata={
            "listings_updated": listings_updated,
            "files_uploaded": uploaded_files,
            "skipped": skipped,
            "already_done": already_done,
            "failed": failed,
            "total_rows": len(rows),
        },
    )
