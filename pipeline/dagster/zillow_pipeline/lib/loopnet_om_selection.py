"""Shared logic for detecting which LoopNet attachment is the offering memorandum."""

import re
from urllib.parse import unquote, urlparse

# Description: legacy LoopNet OM phrasing (case-insensitive).
_OM_DESCRIPTION = re.compile(r"offering\s*memo(randum)?|\bom\b", re.IGNORECASE)
# URL path / filename: offering memo(randum) with spaces/hyphens/underscores between words;
# whole-word "om"; or "om" as a path token (e.g. .../OM_Signed.pdf).
_OM_IN_URL = re.compile(
    r"offering[-\s._]*memo(?:randum)?|\bom\b|(?<=[/._\-])om(?=[/._\-?#&]|$)",
    re.IGNORECASE,
)


def looks_like_om(source_url: str, description: str | None) -> bool:
    """True if attachment description or document URL suggests an offering memorandum."""
    desc = (description or "").strip()
    if desc and _OM_DESCRIPTION.search(desc):
        return True
    try:
        path = unquote(urlparse(source_url).path or "")
    except Exception:
        path = source_url
    path = path.strip()
    if not path:
        return False
    basename = path.rsplit("/", 1)[-1] if "/" in path else path
    combined = f"{path} {basename}"
    return bool(_OM_IN_URL.search(combined))


def pick_om_s3_url(built: list[dict[str, str]]) -> str | None:
    """First uploaded S3 URL whose source attachment looks like an OM, else None."""
    for entry in built:
        source = entry.get("source_url") or ""
        desc = entry.get("description")
        if looks_like_om(source, desc if isinstance(desc, str) else None):
            url = entry.get("url") or ""
            if url.strip():
                return url.strip()
    return None


def resolve_om_url(built: list[dict[str, str]]) -> str | None:
    """Pick OM-like S3 URL from cached rows, else first attachment URL. Empty input -> None."""
    if not built:
        return None
    picked = pick_om_s3_url(built)
    if picked:
        return picked
    first = built[0].get("url") or ""
    return first.strip() or None
