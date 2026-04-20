from unittest.mock import MagicMock

from zillow_pipeline.lib.loopnet_om_backfill import normalize_attachment_urls, run_backfill


def test_normalize_attachment_urls():
    raw = [
        {"source_url": " https://a/x.pdf ", "url": " https://s3/x.pdf ", "description": "  OM  "},
        {"bad": True},
    ]
    assert normalize_attachment_urls(raw) == [
        {"source_url": "https://a/x.pdf", "url": "https://s3/x.pdf", "description": "OM"},
    ]


def test_run_backfill_updates_when_differs():
    rows = [
        {
            "id": "u1",
            "om_url": "https://s3/old-first.pdf",
            "attachment_urls": [
                {"source_url": "https://cdn/a.pdf", "url": "https://s3/a.pdf", "description": "Brochure"},
                {
                    "source_url": "https://cdn/b.pdf",
                    "url": "https://s3/b.pdf",
                    "description": "Offering Memorandum",
                },
            ],
        }
    ]

    client = MagicMock()
    t = MagicMock()
    sel_exec = MagicMock()
    sel_exec.execute.return_value = MagicMock(data=rows)
    select_result = MagicMock()
    select_result.range.return_value = sel_exec
    t.select.return_value = select_result
    upd_exec = MagicMock()
    upd_exec.execute.return_value = MagicMock(data=[])
    t.update.return_value.eq.return_value = upd_exec
    client.table.return_value = t

    stats = run_backfill(client, page_size=500)

    assert stats["updated"] == 1
    assert stats["unchanged"] == 0
    assert stats["skipped_no_attachment_urls"] == 0
    assert stats["errors"] == 0
    client.table.assert_called_with("loopnet_listings")
    t.update.assert_called_once_with({"om_url": "https://s3/b.pdf"})
