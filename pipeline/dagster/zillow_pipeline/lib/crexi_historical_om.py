import hashlib
import re


_HISTORICAL_OM_RE = re.compile(
    r"^https://api\.crexi\.com/assets/(?P<asset_id>[^/]+)/offering-memorandum\?(.+&)?access_token=[^&]+",
    re.IGNORECASE,
)


def extract_crexi_om_asset_ids(raw_json: object) -> list[str]:
    """Return unique Crexi sale asset IDs only for rows flagged as Historical OM rows."""
    if not isinstance(raw_json, dict):
        return []

    source = raw_json.get("source")
    if not isinstance(source, dict) or source.get("isCrexiOm") is not True:
        return []

    asset_ids = raw_json.get("crexiSalesAssetIds")
    if not isinstance(asset_ids, list):
        return []

    out: list[str] = []
    seen: set[str] = set()
    for asset_id in asset_ids:
        value = str(asset_id).strip() if asset_id is not None else ""
        if not value or value in seen:
            continue
        seen.add(value)
        out.append(value)
    return out


def build_crexi_om_s3_key(comp_id: int, crexi_id: str, asset_id: str) -> str:
    digest = hashlib.sha256(f"{crexi_id}:{asset_id}".encode("utf-8")).hexdigest()[:16]
    return f"crexi_attachments/{comp_id}/{digest}.pdf"


def find_historical_om_pdf_url(urls: list[str], asset_id: str) -> str | None:
    for url in urls:
        match = _HISTORICAL_OM_RE.match(url)
        if match and match.group("asset_id") == asset_id:
            return url
    return None


def is_pdf_bytes(content: bytes) -> bool:
    return content.lstrip().startswith(b"%PDF-")


def postgrest_in_list(values: list[str]) -> str:
    quoted = []
    for value in values:
        escaped = value.replace("\\", "\\\\").replace('"', '\\"')
        quoted.append(f'"{escaped}"')
    return f"in.({','.join(quoted)})"
