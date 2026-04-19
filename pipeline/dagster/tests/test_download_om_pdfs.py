"""Tests for the download_om_pdfs asset and helper functions."""
from unittest.mock import MagicMock

import pytest
from dagster import build_asset_context

from zillow_pipeline.assets.download_om_pdfs import (
    download_om_pdfs,
    _attachment_source_urls,
    _looks_like_om,
    _pick_om_s3_url,
    _urls_fully_cached,
)


def make_supabase(rows=None):
    mock = MagicMock()
    client = MagicMock()
    mock.get_client.return_value = client
    client.table.return_value.select.return_value.execute.return_value = MagicMock(
        data=rows or []
    )
    client.table.return_value.update.return_value.eq.return_value.execute.return_value = MagicMock(data=[])
    return mock, client


def make_s3(s3_url="https://bucket.s3.us-east-1.amazonaws.com/attachments/x/y.pdf"):
    mock = MagicMock()
    mock.upload_bytes.return_value = s3_url
    return mock


def make_apify():
    mock = MagicMock()
    mock.api_token = "fake-token"
    return mock


def meta(output, key):
    return output.metadata[key].value


class TestAttachmentSourceUrls:
    def test_collects_link_and_url(self):
        pairs = _attachment_source_urls(
            [
                {"link": "https://a.com/1.pdf", "description": "A"},
                {"url": "https://a.com/2.pdf", "description": "B"},
            ]
        )
        assert pairs == [
            ("https://a.com/1.pdf", "A"),
            ("https://a.com/2.pdf", "B"),
        ]

    def test_dedupes_same_url(self):
        pairs = _attachment_source_urls(
            [
                {"link": "https://a.com/same.pdf"},
                {"link": "https://a.com/same.pdf", "description": "dup"},
            ]
        )
        assert pairs == [("https://a.com/same.pdf", None)]

    def test_skips_empty_and_non_dict(self):
        pairs = _attachment_source_urls(
            [
                {"link": ""},
                "not-a-dict",
                {"description": "no url"},
            ]
        )
        assert pairs == []


class TestLooksLikeOm:
    def test_description_offering_memorandum(self):
        assert _looks_like_om("https://x/floor.pdf", "Offering Memorandum") is True

    def test_description_floorplan_only(self):
        assert _looks_like_om("https://x/floor.pdf", "Floorplan") is False

    def test_url_path_contains_om_token(self):
        assert _looks_like_om("https://cdn.example.com/docs/OM_Signed.pdf", None) is True

    def test_url_path_offering_memo_slug(self):
        assert _looks_like_om("https://cdn.example.com/listing/offering-memorandum.pdf", None) is True


class TestPickOmS3Url:
    def test_prefers_second_when_only_second_matches(self):
        built = [
            {"source_url": "https://a/floor.pdf", "url": "https://s3/floor.pdf", "description": "Floorplan"},
            {
                "source_url": "https://a/om.pdf",
                "url": "https://s3/om.pdf",
                "description": "Offering Memorandum",
            },
        ]
        assert _pick_om_s3_url(built) == "https://s3/om.pdf"

    def test_returns_none_when_no_match(self):
        built = [
            {"source_url": "https://a/a.pdf", "url": "https://s3/a.pdf", "description": "Brochure"},
        ]
        assert _pick_om_s3_url(built) is None


class TestUrlsFullyCached:
    def test_empty_sources(self):
        assert _urls_fully_cached([], None) is False

    def test_all_sources_in_cache(self):
        cached = [
            {"source_url": "https://a.com/1.pdf", "url": "https://s3/1.pdf"},
            {"source_url": "https://a.com/2.pdf", "url": "https://s3/2.pdf"},
        ]
        assert _urls_fully_cached(["https://a.com/1.pdf", "https://a.com/2.pdf"], cached) is True

    def test_missing_source(self):
        cached = [{"source_url": "https://a.com/1.pdf", "url": "https://s3/1.pdf"}]
        assert _urls_fully_cached(["https://a.com/1.pdf", "https://a.com/2.pdf"], cached) is False

    def test_invalid_cache(self):
        assert _urls_fully_cached(["https://a.com/1.pdf"], {}) is False


class TestDownloadOmPdfs:
    def test_no_rows_returns_zero(self):
        supabase, _ = make_supabase(rows=[])
        s3 = make_s3()
        apify = make_apify()

        with build_asset_context() as ctx:
            output = download_om_pdfs(context=ctx, supabase=supabase, s3=s3, apify=apify)

        assert output.value == 0
        assert meta(output, "listings_updated") == 0

    def test_skips_when_fully_cached(self):
        rows = [
            {
                "id": "uuid-1",
                "listing_url": "https://www.loopnet.com/Listing/1/",
                "attachments": [{"link": "https://cdn.example.com/a.pdf", "description": "A"}],
                "om_url": "https://bucket.s3.amazonaws.com/old.pdf",
                "attachment_urls": [
                    {"source_url": "https://cdn.example.com/a.pdf", "url": "https://bucket.s3.amazonaws.com/a.pdf"}
                ],
            }
        ]
        supabase, _ = make_supabase(rows=rows)
        s3 = make_s3()
        apify = make_apify()

        with build_asset_context() as ctx:
            output = download_om_pdfs(context=ctx, supabase=supabase, s3=s3, apify=apify)

        assert output.value == 0
        assert meta(output, "already_done") == 1
        s3.upload_bytes.assert_not_called()

    def test_skips_no_attachment_urls(self):
        rows = [
            {
                "id": "uuid-2",
                "listing_url": "https://www.loopnet.com/Listing/2/",
                "attachments": [],
                "om_url": None,
                "attachment_urls": [],
            }
        ]
        supabase, _ = make_supabase(rows=rows)
        s3 = make_s3()
        apify = make_apify()

        with build_asset_context() as ctx:
            output = download_om_pdfs(context=ctx, supabase=supabase, s3=s3, apify=apify)

        assert meta(output, "skipped") == 1
        s3.upload_bytes.assert_not_called()

    def test_downloads_all_attachments(self):
        rows = [
            {
                "id": "uuid-3",
                "listing_url": "https://www.loopnet.com/Listing/3/",
                "attachments": [
                    {"link": "https://cdn.example.com/one.pdf", "description": "Floorplan"},
                    {"link": "https://cdn.example.com/two.pdf", "description": "Offering Memorandum"},
                ],
                "om_url": None,
                "attachment_urls": [],
            }
        ]
        supabase, client = make_supabase(rows=rows)
        s3 = make_s3()
        apify = make_apify()
        apify.download_loopnet_document.return_value = b"%PDF-1.4"

        call_urls = []

        def upload_side_effect(key, data, content_type="application/pdf"):
            call_urls.append(key)
            return f"https://bucket.s3.us-east-1.amazonaws.com/{key}"

        s3.upload_bytes.side_effect = upload_side_effect

        with build_asset_context() as ctx:
            output = download_om_pdfs(context=ctx, supabase=supabase, s3=s3, apify=apify)

        assert output.value == 1
        assert meta(output, "listings_updated") == 1
        assert meta(output, "files_uploaded") == 2
        assert apify.download_loopnet_document.call_count == 2

        update_kw = client.table.return_value.update.call_args[0][0]
        assert "attachment_urls" in update_kw
        assert len(update_kw["attachment_urls"]) == 2
        assert update_kw["attachment_urls"][0]["source_url"] == "https://cdn.example.com/one.pdf"
        assert update_kw["attachment_urls"][0]["description"] == "Floorplan"
        assert update_kw["om_url"] == update_kw["attachment_urls"][1]["url"]

    def test_om_url_falls_back_to_first_when_no_om_match(self):
        rows = [
            {
                "id": "uuid-3b",
                "listing_url": "https://www.loopnet.com/Listing/3b/",
                "attachments": [
                    {"link": "https://cdn.example.com/brochure.pdf", "description": "Brochure"},
                    {"link": "https://cdn.example.com/rent_roll.pdf", "description": "Rent roll"},
                ],
                "om_url": None,
                "attachment_urls": [],
            }
        ]
        supabase, client = make_supabase(rows=rows)
        s3 = make_s3()
        apify = make_apify()
        apify.download_loopnet_document.return_value = b"%PDF-1.4"

        def upload_side_effect(key, data, content_type="application/pdf"):
            return f"https://bucket.s3.us-east-1.amazonaws.com/{key}"

        s3.upload_bytes.side_effect = upload_side_effect

        with build_asset_context() as ctx:
            download_om_pdfs(context=ctx, supabase=supabase, s3=s3, apify=apify)

        update_kw = client.table.return_value.update.call_args[0][0]
        assert update_kw["om_url"] == update_kw["attachment_urls"][0]["url"]

    def test_download_failure_raises(self):
        rows = [
            {
                "id": "uuid-4",
                "listing_url": "https://www.loopnet.com/Listing/4/",
                "attachments": [{"link": "https://cdn.example.com/om.pdf", "description": "Doc"}],
                "om_url": None,
                "attachment_urls": [],
            }
        ]
        supabase, _ = make_supabase(rows=rows)
        s3 = make_s3()
        apify = make_apify()
        apify.download_loopnet_document.side_effect = ConnectionError("timeout")

        with build_asset_context() as ctx:
            with pytest.raises(Exception, match="attachment operation"):
                download_om_pdfs(context=ctx, supabase=supabase, s3=s3, apify=apify)

        s3.upload_bytes.assert_not_called()

    def test_s3_upload_failure_raises(self):
        rows = [
            {
                "id": "uuid-5",
                "listing_url": "https://www.loopnet.com/Listing/5/",
                "attachments": [{"link": "https://cdn.example.com/om.pdf", "description": "Doc"}],
                "om_url": None,
                "attachment_urls": [],
            }
        ]
        supabase, client = make_supabase(rows=rows)
        s3 = make_s3()
        s3.upload_bytes.side_effect = RuntimeError("S3 error")
        apify = make_apify()
        apify.download_loopnet_document.return_value = b"%PDF fake"

        with build_asset_context() as ctx:
            with pytest.raises(Exception, match="attachment operation"):
                download_om_pdfs(context=ctx, supabase=supabase, s3=s3, apify=apify)

        client.table.return_value.update.assert_not_called()
