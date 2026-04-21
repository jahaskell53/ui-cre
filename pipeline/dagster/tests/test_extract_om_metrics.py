"""Tests for the extract_om_metrics asset and helpers."""
import json
from unittest.mock import MagicMock, patch

import pytest
from dagster import build_asset_context

from zillow_pipeline.assets.extract_om_metrics import (
    ExtractOmMetricsConfig,
    _extract_metrics_from_text,
    extract_om_metrics,
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
    table_mock.eq.return_value = table_mock   # select-chain .eq() stays chainable
    table_mock.execute.return_value = MagicMock(data=rows or [])
    table_mock.update.return_value.eq.return_value.execute.return_value = MagicMock(data=[])

    return mock, client


def meta(output, key):
    return output.metadata[key].value


_SAMPLE_OM_TEXT = "# Investment Summary\n\nCap Rate: 5.50%\nPrice Per Unit: $175,000\nGRM: 11.4\nCoC Return: 8.2%"


# ---------------------------------------------------------------------------
# _extract_metrics_from_text
# ---------------------------------------------------------------------------


class TestExtractMetricsFromText:
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

            result = _extract_metrics_from_text(_SAMPLE_OM_TEXT, api_key="fake-key")

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

            result = _extract_metrics_from_text(_SAMPLE_OM_TEXT, api_key="fake-key")

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
                _extract_metrics_from_text(_SAMPLE_OM_TEXT, api_key="fake-key")


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

    def test_successful_extraction_updates_listing(self):
        rows = [
            {
                "id": "uuid-1",
                "listing_url": "https://www.loopnet.com/Listing/1/",
                "om_text": _SAMPLE_OM_TEXT,
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
            "zillow_pipeline.assets.extract_om_metrics._extract_metrics_from_text",
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

    def test_llm_failure_raises(self):
        rows = [
            {
                "id": "uuid-2",
                "listing_url": "https://www.loopnet.com/Listing/2/",
                "om_text": _SAMPLE_OM_TEXT,
                "om_metrics_extracted_at": None,
            }
        ]
        supabase, client = make_supabase(rows=rows)

        with patch.dict("os.environ", {"GEMINI_API_KEY": "fake-key"}), patch(
            "zillow_pipeline.assets.extract_om_metrics._extract_metrics_from_text",
            side_effect=ValueError("LLM error"),
        ):
            with build_asset_context() as ctx:
                with pytest.raises(Exception, match="failed metric extraction"):
                    extract_om_metrics(context=ctx, supabase=supabase)

        client.table.return_value.update.assert_not_called()

    def test_missing_api_key_raises(self):
        supabase, _ = make_supabase(rows=[{"id": "x", "listing_url": "l", "om_text": "text", "om_metrics_extracted_at": None}])
        with patch.dict("os.environ", {}, clear=True):
            with build_asset_context() as ctx:
                with pytest.raises(RuntimeError, match="GEMINI_API_KEY"):
                    extract_om_metrics(context=ctx, supabase=supabase)

    def test_listing_id_filters_to_single_row(self):
        rows = [{"id": "uuid-target", "listing_url": "https://loopnet.com/1/", "om_text": _SAMPLE_OM_TEXT, "om_metrics_extracted_at": None}]
        supabase, client = make_supabase(rows=rows)

        table_mock = client.table.return_value
        table_mock.execute.return_value = MagicMock(data=rows)

        metric_payload = {"cap_rate": "5.0%", "cost_per_door": None, "coc_return": None, "grm": None}

        with patch.dict("os.environ", {"GEMINI_API_KEY": "fake-key"}), patch(
            "zillow_pipeline.assets.extract_om_metrics._extract_metrics_from_text",
            return_value=metric_payload,
        ):
            with build_asset_context() as ctx:
                output = extract_om_metrics(
                    context=ctx,
                    config=ExtractOmMetricsConfig(listing_id="uuid-target"),
                    supabase=supabase,
                )

        assert output.value == 1
        table_mock.eq.assert_called_with("id", "uuid-target")

    def test_limit_caps_rows_processed(self):
        rows = [
            {"id": f"uuid-{i}", "listing_url": f"https://loopnet.com/{i}/", "om_text": _SAMPLE_OM_TEXT, "om_metrics_extracted_at": None}
            for i in range(5)
        ]
        supabase, client = make_supabase(rows=rows)

        metric_payload = {"cap_rate": "5.0%", "cost_per_door": None, "coc_return": None, "grm": None}

        with patch.dict("os.environ", {"GEMINI_API_KEY": "fake-key"}), patch(
            "zillow_pipeline.assets.extract_om_metrics._extract_metrics_from_text",
            return_value=metric_payload,
        ):
            with build_asset_context() as ctx:
                output = extract_om_metrics(
                    context=ctx,
                    config=ExtractOmMetricsConfig(limit=1),
                    supabase=supabase,
                )

        assert output.value == 1
        assert meta(output, "total_rows") == 1
        assert client.table.return_value.update.call_count == 1

    def test_partial_null_metrics_still_updates(self):
        rows = [
            {
                "id": "uuid-3",
                "listing_url": "https://www.loopnet.com/Listing/3/",
                "om_text": _SAMPLE_OM_TEXT,
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
            "zillow_pipeline.assets.extract_om_metrics._extract_metrics_from_text",
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
