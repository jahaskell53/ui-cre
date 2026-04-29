"""Tests for the download_crexi_om_pdfs asset."""
from unittest.mock import MagicMock

import pytest
from dagster import build_asset_context

from zillow_pipeline.assets.download_crexi_om_pdfs import download_crexi_om_pdfs


def make_supabase(rows=None):
    mock = MagicMock()
    client = MagicMock()
    mock.get_client.return_value = client
    client.table.return_value.select.return_value.execute.return_value = MagicMock(
        data=rows or []
    )
    client.table.return_value.update.return_value.eq.return_value.execute.return_value = MagicMock(
        data=[]
    )
    return mock, client


def make_s3(s3_url="https://bucket.s3.us-east-1.amazonaws.com/crexi_attachments/1/abc.pdf"):
    mock = MagicMock()
    mock.upload_bytes.return_value = s3_url
    return mock


def make_apify():
    mock = MagicMock()
    mock.api_token = "fake-token"
    return mock


def meta(output, key):
    return output.metadata[key].value


class TestDownloadCrexiOmPdfs:
    def test_no_rows_returns_zero(self):
        supabase, _ = make_supabase(rows=[])
        s3 = make_s3()
        apify = make_apify()

        with build_asset_context() as ctx:
            output = download_crexi_om_pdfs(context=ctx, supabase=supabase, s3=s3, apify=apify)

        assert output.value == 0
        assert meta(output, "listings_updated") == 0
        assert meta(output, "total_rows") == 0

    def test_skips_row_with_no_property_link(self):
        rows = [{"id": 1, "property_link": None, "om_url": None}]
        supabase, _ = make_supabase(rows=rows)
        s3 = make_s3()
        apify = make_apify()

        with build_asset_context() as ctx:
            output = download_crexi_om_pdfs(context=ctx, supabase=supabase, s3=s3, apify=apify)

        assert meta(output, "skipped") == 1
        s3.upload_bytes.assert_not_called()
        apify.download_crexi_document.assert_not_called()

    def test_skips_row_with_empty_property_link(self):
        rows = [{"id": 2, "property_link": "   ", "om_url": None}]
        supabase, _ = make_supabase(rows=rows)
        s3 = make_s3()
        apify = make_apify()

        with build_asset_context() as ctx:
            output = download_crexi_om_pdfs(context=ctx, supabase=supabase, s3=s3, apify=apify)

        assert meta(output, "skipped") == 1
        apify.download_crexi_document.assert_not_called()

    def test_skips_row_with_om_url_already_set(self):
        rows = [
            {
                "id": 3,
                "property_link": "https://www.crexi.com/properties/12345/listing",
                "om_url": "https://bucket.s3.amazonaws.com/existing.pdf",
            }
        ]
        supabase, _ = make_supabase(rows=rows)
        s3 = make_s3()
        apify = make_apify()

        with build_asset_context() as ctx:
            output = download_crexi_om_pdfs(context=ctx, supabase=supabase, s3=s3, apify=apify)

        assert meta(output, "already_done") == 1
        assert output.value == 0
        apify.download_crexi_document.assert_not_called()
        s3.upload_bytes.assert_not_called()

    def test_skips_listing_when_no_pdf_found(self):
        rows = [
            {
                "id": 4,
                "property_link": "https://www.crexi.com/properties/99/listing",
                "om_url": None,
            }
        ]
        supabase, client = make_supabase(rows=rows)
        s3 = make_s3()
        apify = make_apify()
        apify.download_crexi_document.return_value = None

        with build_asset_context() as ctx:
            output = download_crexi_om_pdfs(context=ctx, supabase=supabase, s3=s3, apify=apify)

        assert meta(output, "skipped") == 1
        assert output.value == 0
        s3.upload_bytes.assert_not_called()
        client.table.return_value.update.assert_not_called()

    def test_downloads_and_stores_om_pdf(self):
        listing_url = "https://www.crexi.com/properties/42/listing"
        doc_url = "https://cdn.crexi.com/docs/42/om.pdf"
        s3_url = "https://bucket.s3.us-east-1.amazonaws.com/crexi_attachments/5/abc.pdf"

        rows = [{"id": 5, "property_link": listing_url, "om_url": None}]
        supabase, client = make_supabase(rows=rows)
        s3 = make_s3(s3_url=s3_url)
        apify = make_apify()
        apify.download_crexi_document.return_value = (doc_url, b"%PDF-1.4 fake content")

        with build_asset_context() as ctx:
            output = download_crexi_om_pdfs(context=ctx, supabase=supabase, s3=s3, apify=apify)

        assert output.value == 1
        assert meta(output, "listings_updated") == 1
        assert meta(output, "files_uploaded") == 1

        apify.download_crexi_document.assert_called_once_with(listing_url)
        s3.upload_bytes.assert_called_once()
        s3_key_arg = s3.upload_bytes.call_args[0][0]
        assert s3_key_arg.startswith("crexi_attachments/5/")
        assert s3_key_arg.endswith(".pdf")

        update_kw = client.table.return_value.update.call_args[0][0]
        assert update_kw["om_url"] == s3_url
        assert update_kw["attachment_urls"] == [{"source_url": doc_url, "url": s3_url}]

    def test_apify_failure_counts_as_failed_and_raises(self):
        rows = [
            {
                "id": 6,
                "property_link": "https://www.crexi.com/properties/6/listing",
                "om_url": None,
            }
        ]
        supabase, client = make_supabase(rows=rows)
        s3 = make_s3()
        apify = make_apify()
        apify.download_crexi_document.side_effect = ConnectionError("Cloudflare blocked")

        with build_asset_context() as ctx:
            with pytest.raises(Exception, match="Crexi OM operation"):
                download_crexi_om_pdfs(context=ctx, supabase=supabase, s3=s3, apify=apify)

        s3.upload_bytes.assert_not_called()
        client.table.return_value.update.assert_not_called()

    def test_s3_upload_failure_counts_as_failed_and_raises(self):
        rows = [
            {
                "id": 7,
                "property_link": "https://www.crexi.com/properties/7/listing",
                "om_url": None,
            }
        ]
        supabase, client = make_supabase(rows=rows)
        s3 = make_s3()
        s3.upload_bytes.side_effect = RuntimeError("S3 quota exceeded")
        apify = make_apify()
        apify.download_crexi_document.return_value = (
            "https://cdn.crexi.com/docs/7/om.pdf",
            b"%PDF-fake",
        )

        with build_asset_context() as ctx:
            with pytest.raises(Exception, match="Crexi OM operation"):
                download_crexi_om_pdfs(context=ctx, supabase=supabase, s3=s3, apify=apify)

        client.table.return_value.update.assert_not_called()

    def test_multiple_rows_mixed_outcomes(self):
        rows = [
            {
                "id": 10,
                "property_link": "https://www.crexi.com/properties/10/listing",
                "om_url": "https://s3/existing.pdf",
            },
            {
                "id": 11,
                "property_link": None,
                "om_url": None,
            },
            {
                "id": 12,
                "property_link": "https://www.crexi.com/properties/12/listing",
                "om_url": None,
            },
        ]
        supabase, client = make_supabase(rows=rows)
        s3 = make_s3()
        apify = make_apify()
        apify.download_crexi_document.return_value = (
            "https://cdn.crexi.com/docs/12/om.pdf",
            b"%PDF-1.4",
        )

        with build_asset_context() as ctx:
            output = download_crexi_om_pdfs(context=ctx, supabase=supabase, s3=s3, apify=apify)

        assert output.value == 1
        assert meta(output, "already_done") == 1
        assert meta(output, "skipped") == 1
        assert meta(output, "listings_updated") == 1
        assert meta(output, "total_rows") == 3
        apify.download_crexi_document.assert_called_once()
