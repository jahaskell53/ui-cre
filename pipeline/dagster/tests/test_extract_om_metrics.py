"""Tests for the extract_om_metrics asset and helpers."""
import json
from unittest.mock import MagicMock, patch

import pytest
from dagster import build_asset_context

from zillow_pipeline.assets.extract_om_metrics import (
    _extract_metrics_from_pdf,
    _fetch_pdf_bytes,
    extract_om_metrics,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def make_supabase(rows=None):
    mock = MagicMock()
    client = MagicMock()
    mock.get_client.return_value = client

    # Support the chained filter calls used by the asset:
    #   .table(...).select(...).not_.is_(...).is_(...).execute()
    table_mock = MagicMock()
    client.table.return_value = table_mock
    table_mock.select.return_value = table_mock
    table_mock.not_ = table_mock
    table_mock.is_.return_value = table_mock
    table_mock.execute.return_value = MagicMock(data=rows or [])

    # update chain
    table_mock.update.return_value.eq.return_value.execute.return_value = MagicMock(data=[])

    return mock, client


def meta(output, key):
    return output.metadata[key].value


# ---------------------------------------------------------------------------
# _fetch_pdf_bytes
# ---------------------------------------------------------------------------


class TestFetchPdfBytes:
    def test_returns_bytes_on_success(self):
        with patch("zillow_pipeline.assets.extract_om_metrics.requests.get") as mock_get:
            mock_get.return_value = MagicMock(content=b"%PDF-1.4 fake", status_code=200)
            mock_get.return_value.raise_for_status = MagicMock()
            result = _fetch_pdf_bytes("https://s3.example.com/om.pdf")
        assert result == b"%PDF-1.4 fake"

    def test_raises_on_http_error(self):
        import requests as _requests

        with patch("zillow_pipeline.assets.extract_om_metrics.requests.get") as mock_get:
            mock_get.return_value.raise_for_status.side_effect = _requests.HTTPError("404")
            with pytest.raises(_requests.HTTPError):
                _fetch_pdf_bytes("https://s3.example.com/missing.pdf")


# ---------------------------------------------------------------------------
# _extract_metrics_from_pdf
# ---------------------------------------------------------------------------


class TestExtractMetricsFromPdf:
    def _make_genai_response(self, payload: dict):
        mock_response = MagicMock()
        mock_response.text = json.dumps(payload)
        return mock_response

    def test_parses_all_metrics(self):
        payload = {
            "cap_rate": "5.50%",
            "cost_per_door": "$175,000",
            "coc_return": "8.2%",
            "grm": "11.4",
        }
        with patch("google.genai.Client") as mock_client_cls:
            mock_client = MagicMock()
            mock_client_cls.return_value = mock_client
            mock_client.models.generate_content.return_value = self._make_genai_response(payload)

            result = _extract_metrics_from_pdf(b"%PDF-1.4", api_key="fake-key")

        assert result["cap_rate"] == "5.50%"
        assert result["cost_per_door"] == "$175,000"
        assert result["coc_return"] == "8.2%"
        assert result["grm"] == "11.4"

    def test_handles_null_metrics(self):
        payload = {
            "cap_rate": None,
            "cost_per_door": "$200,000",
            "coc_return": None,
            "grm": None,
        }
        with patch("google.genai.Client") as mock_client_cls:
            mock_client = MagicMock()
            mock_client_cls.return_value = mock_client
            mock_client.models.generate_content.return_value = self._make_genai_response(payload)

            result = _extract_metrics_from_pdf(b"%PDF-1.4", api_key="fake-key")

        assert result["cap_rate"] is None
        assert result["cost_per_door"] == "$200,000"

    def test_raises_on_invalid_json(self):
        with patch("google.genai.Client") as mock_client_cls:
            mock_client = MagicMock()
            mock_client_cls.return_value = mock_client
            bad_response = MagicMock()
            bad_response.text = "not valid json at all"
            mock_client.models.generate_content.return_value = bad_response

            with pytest.raises(json.JSONDecodeError):
                _extract_metrics_from_pdf(b"%PDF-1.4", api_key="fake-key")


# ---------------------------------------------------------------------------
# extract_om_metrics asset
# ---------------------------------------------------------------------------


class TestExtractOmMetricsAsset:
    def test_no_rows_returns_zero(self):
        supabase, _ = make_supabase(rows=[])
        with patch.dict("os.environ", {"GEMINI_API_KEY": "fake-key"}):
            with build_asset_context() as ctx:
                output = extract_om_metrics(context=ctx, supabase=supabase)
        assert output.value == 0
        assert meta(output, "listings_updated") == 0

    def test_skips_listing_with_no_om_url_in_result(self):
        # Supabase filter already excludes null om_url rows; if a row somehow
        # arrives without om_url, the fetch will fail but we count it as failed.
        # Here we simulate an empty result set (filter did its job).
        supabase, _ = make_supabase(rows=[])
        with patch.dict("os.environ", {"GEMINI_API_KEY": "fake-key"}):
            with build_asset_context() as ctx:
                output = extract_om_metrics(context=ctx, supabase=supabase)
        assert meta(output, "skipped") == 0
        assert meta(output, "failed") == 0

    def test_successful_extraction_updates_listing(self):
        rows = [
            {
                "id": "uuid-1",
                "listing_url": "https://www.loopnet.com/Listing/1/",
                "om_url": "https://s3.example.com/om.pdf",
                "om_metrics_extracted_at": None,
            }
        ]
        supabase, client = make_supabase(rows=rows)

        metric_payload = {
            "cap_rate": "5.25%",
            "cost_per_door": "$150,000",
            "coc_return": "7.5%",
            "grm": "12.3",
        }

        with patch.dict("os.environ", {"GEMINI_API_KEY": "fake-key"}), patch(
            "zillow_pipeline.assets.extract_om_metrics._fetch_pdf_bytes", return_value=b"%PDF-1.4"
        ), patch(
            "zillow_pipeline.assets.extract_om_metrics._extract_metrics_from_pdf",
            return_value=metric_payload,
        ):
            with build_asset_context() as ctx:
                output = extract_om_metrics(context=ctx, supabase=supabase)

        assert output.value == 1
        assert meta(output, "listings_updated") == 1
        assert meta(output, "failed") == 0

        update_kw = client.table.return_value.update.call_args[0][0]
        assert update_kw["om_cap_rate"] == "5.25%"
        assert update_kw["om_cost_per_door"] == "$150,000"
        assert update_kw["om_coc_return"] == "7.5%"
        assert update_kw["om_grm"] == "12.3"
        assert update_kw["om_metrics_extracted_at"] is not None

    def test_pdf_download_failure_raises(self):
        rows = [
            {
                "id": "uuid-2",
                "listing_url": "https://www.loopnet.com/Listing/2/",
                "om_url": "https://s3.example.com/bad.pdf",
                "om_metrics_extracted_at": None,
            }
        ]
        supabase, client = make_supabase(rows=rows)

        with patch.dict("os.environ", {"GEMINI_API_KEY": "fake-key"}), patch(
            "zillow_pipeline.assets.extract_om_metrics._fetch_pdf_bytes",
            side_effect=ConnectionError("timeout"),
        ):
            with build_asset_context() as ctx:
                with pytest.raises(Exception, match="failed metric extraction"):
                    extract_om_metrics(context=ctx, supabase=supabase)

        client.table.return_value.update.assert_not_called()

    def test_llm_failure_raises(self):
        rows = [
            {
                "id": "uuid-3",
                "listing_url": "https://www.loopnet.com/Listing/3/",
                "om_url": "https://s3.example.com/om.pdf",
                "om_metrics_extracted_at": None,
            }
        ]
        supabase, client = make_supabase(rows=rows)

        with patch.dict("os.environ", {"GEMINI_API_KEY": "fake-key"}), patch(
            "zillow_pipeline.assets.extract_om_metrics._fetch_pdf_bytes", return_value=b"%PDF-1.4"
        ), patch(
            "zillow_pipeline.assets.extract_om_metrics._extract_metrics_from_pdf",
            side_effect=ValueError("LLM error"),
        ):
            with build_asset_context() as ctx:
                with pytest.raises(Exception, match="failed metric extraction"):
                    extract_om_metrics(context=ctx, supabase=supabase)

        client.table.return_value.update.assert_not_called()

    def test_missing_api_key_raises(self):
        supabase, _ = make_supabase(rows=[{"id": "x", "listing_url": "l", "om_url": "u", "om_metrics_extracted_at": None}])
        with patch.dict("os.environ", {}, clear=True):
            with build_asset_context() as ctx:
                with pytest.raises(RuntimeError, match="GEMINI_API_KEY"):
                    extract_om_metrics(context=ctx, supabase=supabase)

    def test_partial_null_metrics_still_updates(self):
        rows = [
            {
                "id": "uuid-4",
                "listing_url": "https://www.loopnet.com/Listing/4/",
                "om_url": "https://s3.example.com/om.pdf",
                "om_metrics_extracted_at": None,
            }
        ]
        supabase, client = make_supabase(rows=rows)

        metric_payload = {
            "cap_rate": "6.0%",
            "cost_per_door": None,
            "coc_return": None,
            "grm": None,
        }

        with patch.dict("os.environ", {"GEMINI_API_KEY": "fake-key"}), patch(
            "zillow_pipeline.assets.extract_om_metrics._fetch_pdf_bytes", return_value=b"%PDF-1.4"
        ), patch(
            "zillow_pipeline.assets.extract_om_metrics._extract_metrics_from_pdf",
            return_value=metric_payload,
        ):
            with build_asset_context() as ctx:
                output = extract_om_metrics(context=ctx, supabase=supabase)

        assert output.value == 1
        update_kw = client.table.return_value.update.call_args[0][0]
        assert update_kw["om_cap_rate"] == "6.0%"
        assert update_kw["om_cost_per_door"] is None
        assert update_kw["om_coc_return"] is None
        assert update_kw["om_grm"] is None
