import pytest

from zillow_pipeline.lib.crexi_historical_om import (
    build_crexi_om_s3_key,
    extract_crexi_om_asset_ids,
    find_historical_om_pdf_url,
    is_pdf_bytes,
    postgrest_in_list,
)


def test_extracts_sales_asset_ids_only_for_crexi_om_rows():
    raw_json = {
        "source": {"isCrexi": True, "isCrexiOm": True},
        "crexiSalesAssetIds": ["1625848", 1625848, None, " 584294 "],
    }

    assert extract_crexi_om_asset_ids(raw_json) == ["1625848", "584294"]


def test_rejects_non_om_crexi_source_rows():
    raw_json = {
        "source": {"isCrexi": True},
        "crexiSalesAssetIds": ["1625848"],
    }

    assert extract_crexi_om_asset_ids(raw_json) == []


def test_builds_stable_crexi_om_s3_key():
    key = build_crexi_om_s3_key(
        comp_id=181149,
        crexi_id="0009ede258645009ae88726dc89df0d5b7f4707e",
        asset_id="1625848",
    )

    assert key.startswith("crexi_attachments/181149/")
    assert key.endswith(".pdf")
    assert key == build_crexi_om_s3_key(
        comp_id=181149,
        crexi_id="0009ede258645009ae88726dc89df0d5b7f4707e",
        asset_id="1625848",
    )


def test_finds_matching_historical_om_pdf_url():
    urls = [
        "https://api.crexi.com/assets/999/offering-memorandum?access_token=abc",
        "https://api.crexi.com/assets/1625848/offering-memorandum?access_token=def",
    ]

    assert (
        find_historical_om_pdf_url(urls, asset_id="1625848")
        == "https://api.crexi.com/assets/1625848/offering-memorandum?access_token=def"
    )


def test_requires_access_token_on_historical_om_pdf_url():
    urls = ["https://api.crexi.com/assets/1625848/offering-memorandum"]

    assert find_historical_om_pdf_url(urls, asset_id="1625848") is None


@pytest.mark.parametrize(
    ("content", "expected"),
    [
        (b"%PDF-1.7\n...", True),
        (b"  \n%PDF-1.4\n...", True),
        (b"{\"error\":\"unauthorized\"}", False),
        (b"", False),
    ],
)
def test_identifies_pdf_bytes(content, expected):
    assert is_pdf_bytes(content) is expected


def test_postgrest_in_list_escapes_values():
    assert postgrest_in_list(["abc", "SALES~123", 'needs"quote']) == 'in.("abc","SALES~123","needs\\"quote")'
