from zillow_pipeline.lib.loopnet_om_selection import looks_like_om, pick_om_s3_url, resolve_om_url


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


# PDF-only filtering tests


def test_looks_like_om_rejects_svg():
    assert looks_like_om("https://images1.loopnet.com/i2/abc/image.svg", "Floor Plan") is False


def test_looks_like_om_rejects_doc():
    assert looks_like_om("https://images1.loopnet.com/d2/abc/document.doc", "Listing Description") is False


def test_looks_like_om_rejects_docx():
    assert looks_like_om("https://images1.loopnet.com/d2/abc/document.docx", "Offering Memorandum") is False


def test_looks_like_om_rejects_image_jpg():
    assert looks_like_om("https://images1.loopnet.com/d2/abc/photo.jpg", "OM") is False


def test_looks_like_om_rejects_image_png():
    assert looks_like_om("https://images1.loopnet.com/d2/abc/photo.png", "Offering Memo") is False


def test_looks_like_om_rejects_no_extension():
    assert looks_like_om("https://images1.loopnet.com/d2/abc/document", "Offering Memorandum") is False


def test_looks_like_om_accepts_pdf():
    assert looks_like_om("https://images1.loopnet.com/d2/abc/om.pdf", "Offering Memorandum") is True


def test_looks_like_om_accepts_pdf_with_query_string():
    assert looks_like_om("https://cdn.loopnet.com/d2/abc/om.pdf?v=2", "Offering Memorandum") is True


def test_pick_om_s3_url_skips_non_pdf_source():
    # source_url is .doc even though description matches OM — should be skipped
    built = [
        {
            "source_url": "https://images1.loopnet.com/d2/abc/document.doc",
            "url": "https://s3/doc.pdf",
            "description": "Offering Memorandum",
        }
    ]
    assert pick_om_s3_url(built) is None


def test_pick_om_s3_url_skips_svg_floor_plan():
    built = [
        {
            "source_url": "https://images1.loopnet.com/i2/abc/image.svg",
            "url": "https://s3/floor.pdf",
            "description": "Floor Plan",
        }
    ]
    assert pick_om_s3_url(built) is None


def test_resolve_om_url_skips_non_pdf_fallback():
    # Only attachment has a non-PDF source_url — resolve_om_url should return None
    built = [
        {
            "source_url": "https://images1.loopnet.com/i2/abc/image.svg",
            "url": "https://s3/floor.pdf",
            "description": "Floor Plan",
        }
    ]
    assert resolve_om_url(built) is None


def test_resolve_om_url_fallback_skips_non_pdf_picks_pdf():
    # First entry is non-PDF, second is a real PDF — fallback should pick the PDF
    built = [
        {
            "source_url": "https://images1.loopnet.com/i2/abc/image.svg",
            "url": "https://s3/floor.pdf",
            "description": "Floor Plan",
        },
        {
            "source_url": "https://images1.loopnet.com/d2/def/brochure.pdf",
            "url": "https://s3/brochure.pdf",
            "description": "Brochure",
        },
    ]
    assert resolve_om_url(built) == "https://s3/brochure.pdf"
