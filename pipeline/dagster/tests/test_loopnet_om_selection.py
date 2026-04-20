from zillow_pipeline.lib.loopnet_om_selection import pick_om_s3_url, resolve_om_url


def test_resolve_om_url_prefers_pick():
    built = [
        {"source_url": "https://a/x.pdf", "url": "https://s3/x.pdf"},
        {"source_url": "https://a/om.pdf", "url": "https://s3/om.pdf", "description": "OM"},
    ]
    assert resolve_om_url(built) == "https://s3/om.pdf"


def test_resolve_om_url_fallback_first():
    built = [
        {"source_url": "https://a/a.pdf", "url": "https://s3/a.pdf", "description": "Brochure"},
    ]
    assert pick_om_s3_url(built) is None
    assert resolve_om_url(built) == "https://s3/a.pdf"


def test_resolve_om_url_empty():
    assert resolve_om_url([]) is None
