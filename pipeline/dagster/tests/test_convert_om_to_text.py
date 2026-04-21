"""Tests for the convert_om_to_text asset and helpers."""
from unittest.mock import MagicMock, patch

import pytest
from dagster import build_asset_context

from zillow_pipeline.assets.convert_om_to_text import (
    _convert_pdf_to_text,
    _fetch_pdf_bytes,
    convert_om_to_text,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def make_supabase(rows=None):
    mock = MagicMock()
    client = MagicMock()
    mock.get_client.return_value = client

    table_mock = MagicMock()
    client.table.return_value = table_mock
    table_mock.select.return_value = table_mock
    table_mock.not_ = table_mock
    table_mock.is_.return_value = table_mock
    table_mock.execute.return_value = MagicMock(data=rows or [])
    table_mock.update.return_value.eq.return_value.execute.return_value = MagicMock(data=[])

    return mock, client


def meta(output, key):
    return output.metadata[key].value


# ---------------------------------------------------------------------------
# _fetch_pdf_bytes
# ---------------------------------------------------------------------------


class TestFetchPdfBytes:
    def test_returns_bytes_on_success(self):
        with patch("zillow_pipeline.assets.convert_om_to_text.requests.get") as mock_get:
            mock_get.return_value = MagicMock(content=b"%PDF-1.4 fake", status_code=200)
            mock_get.return_value.raise_for_status = MagicMock()
            result = _fetch_pdf_bytes("https://s3.example.com/om.pdf")
        assert result == b"%PDF-1.4 fake"

    def test_raises_on_http_error(self):
        import requests as _requests

        with patch("zillow_pipeline.assets.convert_om_to_text.requests.get") as mock_get:
            mock_get.return_value.raise_for_status.side_effect = _requests.HTTPError("404")
            with pytest.raises(_requests.HTTPError):
                _fetch_pdf_bytes("https://s3.example.com/missing.pdf")


# ---------------------------------------------------------------------------
# _convert_pdf_to_text
# ---------------------------------------------------------------------------


class TestConvertPdfToText:
    def test_returns_text(self):
        with patch("google.genai.Client") as mock_client_cls:
            mock_client = MagicMock()
            mock_client_cls.return_value = mock_client
            mock_response = MagicMock()
            mock_response.text = "# Offering Memorandum\n\nCap Rate: 5.5%"
            mock_client.models.generate_content.return_value = mock_response

            result = _convert_pdf_to_text(b"%PDF-1.4", api_key="fake-key")

        assert result == "# Offering Memorandum\n\nCap Rate: 5.5%"

    def test_strips_whitespace(self):
        with patch("google.genai.Client") as mock_client_cls:
            mock_client = MagicMock()
            mock_client_cls.return_value = mock_client
            mock_response = MagicMock()
            mock_response.text = "  some text  \n"
            mock_client.models.generate_content.return_value = mock_response

            result = _convert_pdf_to_text(b"%PDF-1.4", api_key="fake-key")

        assert result == "some text"


# ---------------------------------------------------------------------------
# convert_om_to_text asset
# ---------------------------------------------------------------------------


class TestConvertOmToTextAsset:
    def test_no_rows_returns_zero(self):
        supabase, _ = make_supabase(rows=[])
        with patch.dict("os.environ", {"GEMINI_API_KEY": "fake-key"}):
            with build_asset_context() as ctx:
                output = convert_om_to_text(context=ctx, supabase=supabase)
        assert output.value == 0
        assert meta(output, "listings_updated") == 0

    def test_successful_conversion_updates_listing(self):
        rows = [
            {
                "id": "uuid-1",
                "listing_url": "https://www.loopnet.com/Listing/1/",
                "om_url": "https://s3.example.com/om.pdf",
                "om_text_extracted_at": None,
            }
        ]
        supabase, client = make_supabase(rows=rows)

        with patch.dict("os.environ", {"GEMINI_API_KEY": "fake-key"}), patch(
            "zillow_pipeline.assets.convert_om_to_text._fetch_pdf_bytes", return_value=b"%PDF-1.4"
        ), patch(
            "zillow_pipeline.assets.convert_om_to_text._convert_pdf_to_text",
            return_value="# Offering Memorandum\n\nCap Rate: 5.5%",
        ):
            with build_asset_context() as ctx:
                output = convert_om_to_text(context=ctx, supabase=supabase)

        assert output.value == 1
        assert meta(output, "listings_updated") == 1
        assert meta(output, "failed") == 0

        update_kw = client.table.return_value.update.call_args[0][0]
        assert update_kw["om_text"] == "# Offering Memorandum\n\nCap Rate: 5.5%"
        assert update_kw["om_text_extracted_at"] is not None

    def test_pdf_download_failure_raises(self):
        rows = [
            {
                "id": "uuid-2",
                "listing_url": "https://www.loopnet.com/Listing/2/",
                "om_url": "https://s3.example.com/bad.pdf",
                "om_text_extracted_at": None,
            }
        ]
        supabase, client = make_supabase(rows=rows)

        with patch.dict("os.environ", {"GEMINI_API_KEY": "fake-key"}), patch(
            "zillow_pipeline.assets.convert_om_to_text._fetch_pdf_bytes",
            side_effect=ConnectionError("timeout"),
        ):
            with build_asset_context() as ctx:
                with pytest.raises(Exception, match="failed PDF-to-text conversion"):
                    convert_om_to_text(context=ctx, supabase=supabase)

        client.table.return_value.update.assert_not_called()

    def test_llm_failure_raises(self):
        rows = [
            {
                "id": "uuid-3",
                "listing_url": "https://www.loopnet.com/Listing/3/",
                "om_url": "https://s3.example.com/om.pdf",
                "om_text_extracted_at": None,
            }
        ]
        supabase, client = make_supabase(rows=rows)

        with patch.dict("os.environ", {"GEMINI_API_KEY": "fake-key"}), patch(
            "zillow_pipeline.assets.convert_om_to_text._fetch_pdf_bytes", return_value=b"%PDF-1.4"
        ), patch(
            "zillow_pipeline.assets.convert_om_to_text._convert_pdf_to_text",
            side_effect=ValueError("LLM error"),
        ):
            with build_asset_context() as ctx:
                with pytest.raises(Exception, match="failed PDF-to-text conversion"):
                    convert_om_to_text(context=ctx, supabase=supabase)

        client.table.return_value.update.assert_not_called()

    def test_missing_api_key_raises(self):
        supabase, _ = make_supabase(rows=[{"id": "x", "listing_url": "l", "om_url": "u", "om_text_extracted_at": None}])
        with patch.dict("os.environ", {}, clear=True):
            with build_asset_context() as ctx:
                with pytest.raises(RuntimeError, match="GEMINI_API_KEY"):
                    convert_om_to_text(context=ctx, supabase=supabase)
