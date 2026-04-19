"""Tests for the download_om_pdfs asset and helper functions."""
from unittest.mock import MagicMock, patch

import pytest
from dagster import build_asset_context

from zillow_pipeline.assets.download_om_pdfs import (
    download_om_pdfs,
    _find_om_url,
    _is_om_attachment,
)


# ─── Helpers ─────────────────────────────────────────────────────────────────

def make_supabase(rows=None):
    mock = MagicMock()
    client = MagicMock()
    mock.get_client.return_value = client
    client.table.return_value.select.return_value.execute.return_value = MagicMock(
        data=rows or []
    )
    client.table.return_value.update.return_value.eq.return_value.execute.return_value = MagicMock(data=[])
    return mock, client


def make_s3(s3_url="https://bucket.s3.us-east-1.amazonaws.com/om/abc.pdf"):
    mock = MagicMock()
    mock.upload_bytes.return_value = s3_url
    return mock


def make_apify():
    mock = MagicMock()
    mock.api_token = "fake-token"
    return mock


def meta(output, key):
    return output.metadata[key].value


# ─── _is_om_attachment ────────────────────────────────────────────────────────

class TestIsOmAttachment:
    def test_offering_memorandum(self):
        assert _is_om_attachment({"description": "Offering Memorandum"}) is True

    def test_offering_memo(self):
        assert _is_om_attachment({"description": "Offering Memo"}) is True

    def test_om_exact(self):
        assert _is_om_attachment({"description": "OM"}) is True

    def test_om_case_insensitive(self):
        assert _is_om_attachment({"description": "offering memorandum"}) is True

    def test_non_om_attachment(self):
        assert _is_om_attachment({"description": "Floorplan"}) is False

    def test_empty_description(self):
        assert _is_om_attachment({"description": ""}) is False

    def test_no_description_key(self):
        assert _is_om_attachment({}) is False

    def test_partial_match_in_longer_text(self):
        assert _is_om_attachment({"description": "1745 Market Street OM"}) is True


# ─── _find_om_url ─────────────────────────────────────────────────────────────

class TestFindOmUrl:
    def test_returns_link_from_om_attachment(self):
        attachments = [
            {"link": "https://example.com/om.pdf", "description": "Offering Memorandum"},
        ]
        assert _find_om_url(attachments) == "https://example.com/om.pdf"

    def test_returns_none_for_non_om(self):
        attachments = [
            {"link": "https://example.com/floorplan.pdf", "description": "Floorplan"},
        ]
        assert _find_om_url(attachments) is None

    def test_returns_first_om_when_multiple(self):
        attachments = [
            {"link": "https://example.com/first.pdf", "description": "Offering Memorandum"},
            {"link": "https://example.com/second.pdf", "description": "OM"},
        ]
        assert _find_om_url(attachments) == "https://example.com/first.pdf"

    def test_skips_non_om_to_find_om(self):
        attachments = [
            {"link": "https://example.com/floorplan.pdf", "description": "Floorplan"},
            {"link": "https://example.com/om.pdf", "description": "Offering Memo"},
        ]
        assert _find_om_url(attachments) == "https://example.com/om.pdf"

    def test_none_attachments(self):
        assert _find_om_url(None) is None

    def test_empty_attachments(self):
        assert _find_om_url([]) is None

    def test_attachment_without_link(self):
        attachments = [{"description": "Offering Memorandum"}]
        assert _find_om_url(attachments) is None

    def test_uses_url_key_as_fallback(self):
        attachments = [{"url": "https://example.com/om.pdf", "description": "Offering Memorandum"}]
        assert _find_om_url(attachments) == "https://example.com/om.pdf"


# ─── Asset-level tests ────────────────────────────────────────────────────────

class TestDownloadOmPdfs:
    def test_no_rows_returns_zero(self):
        supabase, _ = make_supabase(rows=[])
        s3 = make_s3()
        apify = make_apify()

        with build_asset_context() as ctx:
            output = download_om_pdfs(context=ctx, supabase=supabase, s3=s3, apify=apify)

        assert output.value == 0
        assert meta(output, "uploaded") == 0

    def test_skips_row_already_has_om_url(self):
        rows = [
            {
                "id": "uuid-1",
                "listing_url": "https://www.loopnet.com/Listing/1/",
                "attachments": [{"link": "https://cdn.example.com/om.pdf", "description": "Offering Memorandum"}],
                "om_url": "https://bucket.s3.amazonaws.com/om/uuid-1.pdf",
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

    def test_skips_row_without_om_attachment(self):
        rows = [
            {
                "id": "uuid-2",
                "listing_url": "https://www.loopnet.com/Listing/2/",
                "attachments": [{"link": "https://cdn.example.com/floorplan.pdf", "description": "Floorplan"}],
                "om_url": None,
            }
        ]
        supabase, _ = make_supabase(rows=rows)
        s3 = make_s3()
        apify = make_apify()

        with build_asset_context() as ctx:
            output = download_om_pdfs(context=ctx, supabase=supabase, s3=s3, apify=apify)

        assert output.value == 0
        assert meta(output, "skipped") == 1
        s3.upload_bytes.assert_not_called()

    def test_downloads_and_uploads_om(self):
        rows = [
            {
                "id": "uuid-3",
                "listing_url": "https://www.loopnet.com/Listing/3/",
                "attachments": [{"link": "https://cdn.example.com/om.pdf", "description": "Offering Memorandum"}],
                "om_url": None,
            }
        ]
        supabase, client = make_supabase(rows=rows)
        s3 = make_s3(s3_url="https://bucket.s3.us-east-1.amazonaws.com/om/uuid-3.pdf")
        apify = make_apify()

        fake_pdf = b"%PDF-1.4 fake content"
        with patch("zillow_pipeline.assets.download_om_pdfs._download", return_value=fake_pdf):
            with build_asset_context() as ctx:
                output = download_om_pdfs(context=ctx, supabase=supabase, s3=s3, apify=apify)

        assert output.value == 1
        assert meta(output, "uploaded") == 1
        assert meta(output, "failed") == 0
        s3.upload_bytes.assert_called_once_with(
            "om/uuid-3.pdf", fake_pdf, content_type="application/pdf"
        )
        client.table.return_value.update.assert_called_once_with(
            {"om_url": "https://bucket.s3.us-east-1.amazonaws.com/om/uuid-3.pdf"}
        )

    def test_download_failure_raises(self):
        rows = [
            {
                "id": "uuid-4",
                "listing_url": "https://www.loopnet.com/Listing/4/",
                "attachments": [{"link": "https://cdn.example.com/om.pdf", "description": "Offering Memorandum"}],
                "om_url": None,
            }
        ]
        supabase, client = make_supabase(rows=rows)
        s3 = make_s3()
        apify = make_apify()

        with patch("zillow_pipeline.assets.download_om_pdfs._download", side_effect=ConnectionError("timeout")):
            with build_asset_context() as ctx:
                with pytest.raises(Exception, match="1 OM"):
                    download_om_pdfs(context=ctx, supabase=supabase, s3=s3, apify=apify)

        s3.upload_bytes.assert_not_called()

    def test_s3_upload_failure_raises(self):
        rows = [
            {
                "id": "uuid-5",
                "listing_url": "https://www.loopnet.com/Listing/5/",
                "attachments": [{"link": "https://cdn.example.com/om.pdf", "description": "Offering Memorandum"}],
                "om_url": None,
            }
        ]
        supabase, client = make_supabase(rows=rows)
        s3 = make_s3()
        s3.upload_bytes.side_effect = RuntimeError("S3 error")
        apify = make_apify()

        fake_pdf = b"%PDF fake"
        with patch("zillow_pipeline.assets.download_om_pdfs._download", return_value=fake_pdf):
            with build_asset_context() as ctx:
                with pytest.raises(Exception, match="1 OM"):
                    download_om_pdfs(context=ctx, supabase=supabase, s3=s3, apify=apify)

        client.table.return_value.update.assert_not_called()

    def test_mixed_rows(self):
        """One already done, one skipped (no OM), one uploaded."""
        rows = [
            {
                "id": "uuid-6",
                "listing_url": "https://www.loopnet.com/Listing/6/",
                "attachments": [],
                "om_url": "https://bucket.s3.amazonaws.com/om/uuid-6.pdf",
            },
            {
                "id": "uuid-7",
                "listing_url": "https://www.loopnet.com/Listing/7/",
                "attachments": [{"link": "https://cdn.example.com/floor.pdf", "description": "Floorplan"}],
                "om_url": None,
            },
            {
                "id": "uuid-8",
                "listing_url": "https://www.loopnet.com/Listing/8/",
                "attachments": [{"link": "https://cdn.example.com/om.pdf", "description": "Offering Memo"}],
                "om_url": None,
            },
        ]
        supabase, _ = make_supabase(rows=rows)
        s3 = make_s3()
        apify = make_apify()

        fake_pdf = b"%PDF fake"
        with patch("zillow_pipeline.assets.download_om_pdfs._download", return_value=fake_pdf):
            with build_asset_context() as ctx:
                output = download_om_pdfs(context=ctx, supabase=supabase, s3=s3, apify=apify)

        assert meta(output, "already_done") == 1
        assert meta(output, "skipped") == 1
        assert meta(output, "uploaded") == 1
        assert output.value == 1
