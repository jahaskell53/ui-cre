#!/usr/bin/env python3
"""
Download Crexi Historical OM PDFs using the already-authenticated local Chrome session.

Run from pipeline/dagster:
  uv run python scripts/download_crexi_historical_oms.py --dry-run --limit 10
  uv run python scripts/download_crexi_historical_oms.py --accept-confidentiality-agreement --broker-agent no --limit 10

Chrome must be running with remote debugging enabled on port 9222 and logged into Crexi.
"""

from __future__ import annotations

import argparse
import asyncio
import base64
import json
import os
import sys
import time
import urllib.parse
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import boto3
import requests
import websockets
from dotenv import load_dotenv

from zillow_pipeline.lib.crexi_historical_om import (
    build_crexi_om_s3_key,
    extract_crexi_om_asset_ids,
    find_historical_om_pdf_url,
    is_pdf_bytes,
    postgrest_in_list,
)


@dataclass(frozen=True)
class CrexiOmCandidate:
    comp_id: int
    crexi_id: str
    crexi_url: str
    asset_id: str
    property_name: str | None
    address_full: str | None


class SupabaseRest:
    def __init__(self, url: str, service_key: str):
        self.url = url.rstrip("/")
        self.session = requests.Session()
        self.session.headers.update(
            {
                "apikey": service_key,
                "Authorization": f"Bearer {service_key}",
                "Content-Type": "application/json",
            }
        )

    def get(self, path: str, params: dict[str, str], retries: int = 5) -> list[dict[str, Any]]:
        last_error: Exception | None = None
        for attempt in range(retries):
            try:
                response = self.session.get(f"{self.url}/rest/v1/{path}", params=params, timeout=60)
                response.raise_for_status()
                return response.json()
            except Exception as e:
                last_error = e
                time.sleep(2**attempt)
        if last_error:
            raise last_error
        raise RuntimeError("Supabase GET failed without an exception")

    def patch_comp(self, comp_id: int, payload: dict[str, Any]) -> None:
        response = self.session.patch(
            f"{self.url}/rest/v1/crexi_api_comps",
            params={"id": f"eq.{comp_id}"},
            data=json.dumps(payload),
            headers={"Prefer": "return=minimal"},
            timeout=60,
        )
        response.raise_for_status()


def fetch_candidate_raw_rows(
    client: SupabaseRest,
    page_size: int,
    max_rows: int | None = None,
) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    last_crexi_id: str | None = None
    while True:
        params = {
            "select": "crexi_id,raw_json",
            "raw_json->source->>isCrexiOm": "eq.true",
            "order": "crexi_id.asc",
            "limit": str(page_size),
        }
        if last_crexi_id:
            params["crexi_id"] = f"gt.{last_crexi_id}"
        page = client.get("crexi_api_comp_raw_json_latest", params)
        if not page:
            break
        rows.extend(page)
        if max_rows is not None and len(rows) >= max_rows:
            return rows[:max_rows]
        if len(page) < page_size:
            break
        last_crexi_id = page[-1]["crexi_id"]
    return rows


def build_candidates(
    raw_rows: list[dict[str, Any]],
    comp_rows: list[dict[str, Any]],
    limit: int | None,
) -> list[CrexiOmCandidate]:
    comp_by_crexi_id = {row["crexi_id"]: row for row in comp_rows}
    candidates: list[CrexiOmCandidate] = []

    for raw_row in raw_rows:
        crexi_id = raw_row.get("crexi_id")
        if not isinstance(crexi_id, str):
            continue
        comp_row = comp_by_crexi_id.get(crexi_id)
        if not comp_row or comp_row.get("om_url"):
            continue
        crexi_url = comp_row.get("crexi_url") or f"https://www.crexi.com/property-records/{urllib.parse.quote(crexi_id)}"
        for asset_id in extract_crexi_om_asset_ids(raw_row.get("raw_json")):
            candidates.append(
                CrexiOmCandidate(
                    comp_id=int(comp_row["id"]),
                    crexi_id=crexi_id,
                    crexi_url=crexi_url,
                    asset_id=asset_id,
                    property_name=comp_row.get("property_name"),
                    address_full=comp_row.get("address_full"),
                )
            )
            break
        if limit is not None and len(candidates) >= limit:
            break

    return candidates


def fetch_comp_rows(
    client: SupabaseRest,
    crexi_ids: list[str],
    include_om_columns: bool = True,
) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    select = "id,crexi_id,crexi_url,property_name,address_full"
    if include_om_columns:
        select += ",om_url,attachment_urls"
    for i in range(0, len(crexi_ids), 100):
        batch = crexi_ids[i : i + 100]
        params = {"select": select, "crexi_id": postgrest_in_list(batch)}
        if include_om_columns:
            params["om_url"] = "is.null"
        rows.extend(client.get("crexi_api_comps", params))
    return rows


def load_failed_crexi_ids(path: str | None, retry_failed: bool) -> set[str]:
    if retry_failed or not path:
        return set()
    failure_path = Path(path)
    if not failure_path.exists():
        return set()
    out: set[str] = set()
    for line in failure_path.read_text().splitlines():
        if not line.strip():
            continue
        try:
            item = json.loads(line)
        except json.JSONDecodeError:
            continue
        crexi_id = item.get("crexi_id")
        if isinstance(crexi_id, str) and crexi_id:
            out.add(crexi_id)
    return out


def record_failed_candidate(path: str | None, candidate: CrexiOmCandidate, error: Exception) -> None:
    if not path:
        return
    failure_path = Path(path)
    failure_path.parent.mkdir(parents=True, exist_ok=True)
    with failure_path.open("a") as f:
        f.write(
            json.dumps(
                {
                    "crexi_id": candidate.crexi_id,
                    "comp_id": candidate.comp_id,
                    "asset_id": candidate.asset_id,
                    "property_name": candidate.property_name,
                    "error": str(error),
                    "failed_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                },
                sort_keys=True,
            )
            + "\n"
        )


def collect_candidates(
    client: SupabaseRest,
    page_size: int,
    limit: int | None,
    skip_crexi_ids: set[str],
) -> list[CrexiOmCandidate]:
    candidates: list[CrexiOmCandidate] = []
    last_crexi_id: str | None = None

    while True:
        params = {
            "select": "crexi_id,raw_json",
            "raw_json->source->>isCrexiOm": "eq.true",
            "order": "crexi_id.asc",
            "limit": str(page_size),
        }
        if last_crexi_id:
            params["crexi_id"] = f"gt.{last_crexi_id}"
        raw_rows = client.get("crexi_api_comp_raw_json_latest", params)
        if not raw_rows:
            break

        filtered_raw_rows = [
            row
            for row in raw_rows
            if isinstance(row.get("crexi_id"), str)
            and row["crexi_id"] not in skip_crexi_ids
            and extract_crexi_om_asset_ids(row.get("raw_json"))
        ]
        if filtered_raw_rows:
            comp_rows = fetch_comp_rows(client, [row["crexi_id"] for row in filtered_raw_rows])
            for candidate in build_candidates(filtered_raw_rows, comp_rows, None):
                if candidate.crexi_id in skip_crexi_ids:
                    continue
                candidates.append(candidate)
                if limit is not None and len(candidates) >= limit:
                    return candidates

        if len(raw_rows) < page_size:
            break
        last_crexi_id = raw_rows[-1]["crexi_id"]

    return candidates


class ChromeTab:
    def __init__(self, websocket_url: str):
        self.websocket_url = websocket_url
        self.next_id = 1
        self.ws = None
        self.seen_urls: list[str] = []

    async def __aenter__(self):
        self.ws = await websockets.connect(self.websocket_url, max_size=32 * 1024 * 1024)
        await self.call("Page.enable")
        await self.call("Runtime.enable")
        await self.call("Network.enable")
        return self

    async def __aexit__(self, exc_type, exc, tb):
        if self.ws:
            await self.ws.close()

    async def call(self, method: str, params: dict[str, Any] | None = None) -> dict[str, Any]:
        if not self.ws:
            raise RuntimeError("Chrome websocket is not connected")
        msg_id = self.next_id
        self.next_id += 1
        await self.ws.send(json.dumps({"id": msg_id, "method": method, "params": params or {}}))
        while True:
            message = json.loads(await self.ws.recv())
            method = message.get("method")
            if method == "Network.requestWillBeSent":
                url = message.get("params", {}).get("request", {}).get("url")
                if isinstance(url, str):
                    self.seen_urls.append(url)
            elif method == "Network.responseReceived":
                response = message.get("params", {}).get("response", {})
                url = response.get("url")
                mime_type = response.get("mimeType")
                if isinstance(url, str) and (mime_type == "application/pdf" or "offering-memorandum" in url or "/flyer" in url):
                    self.seen_urls.append(url)
            if message.get("id") == msg_id:
                if "error" in message:
                    raise RuntimeError(message["error"])
                return message.get("result", {})

    async def evaluate(self, expression: str) -> Any:
        result = await self.call(
            "Runtime.evaluate",
            {"expression": expression, "awaitPromise": True, "returnByValue": True},
        )
        remote = result.get("result", {})
        if "exceptionDetails" in result:
            raise RuntimeError(result["exceptionDetails"])
        return remote.get("value")

    async def navigate(self, url: str) -> None:
        await self.call("Page.navigate", {"url": url})
        deadline = time.monotonic() + 45
        while time.monotonic() < deadline:
            state = await self.evaluate("document.readyState")
            if state in ("interactive", "complete"):
                return
            await asyncio.sleep(0.5)
        raise TimeoutError(f"Timed out loading {url}")


def create_chrome_target(debug_url: str) -> str:
    response = requests.put(f"{debug_url.rstrip('/')}/json/new?about:blank", timeout=10)
    response.raise_for_status()
    return response.json()["webSocketDebuggerUrl"]


def list_chrome_urls(debug_url: str) -> list[str]:
    response = requests.get(f"{debug_url.rstrip('/')}/json", timeout=10)
    response.raise_for_status()
    return [target.get("url", "") for target in response.json()]


async def reveal_pdf_url(
    debug_url: str,
    candidate: CrexiOmCandidate,
    broker_agent: str,
    link_timeout: int,
    pdf_timeout: int,
) -> tuple[str, bytes]:
    websocket_url = create_chrome_target(debug_url)
    async with ChromeTab(websocket_url) as tab:
        await tab.navigate(candidate.crexi_url)
        deadline = time.monotonic() + link_timeout
        while time.monotonic() < deadline:
            clicked = await tab.evaluate(
                r"""
(() => {
  const text = document.body.innerText || '';
  if (/Select which/i.test(text)) {
    const view = [...document.querySelectorAll('button,a,[role="button"]')]
      .find((el) => /^view$/i.test((el.innerText || el.textContent || '').trim()) && el.offsetParent !== null);
    if (view) {
      view.click();
      return true;
    }
  }
  const nodes = [...document.querySelectorAll('button,a,[role="button"]')];
  const node = nodes.find((el) => /Historical\s+(OM|Flyer)/i.test((el.innerText || el.textContent || '').trim()) && el.offsetParent !== null);
  if (!node) return false;
  node.click();
  return true;
})()
"""
            )
            if clicked:
                break
            await asyncio.sleep(1)
        else:
            raise RuntimeError(f"Historical OM link not found for {candidate.crexi_url}")

        deadline = time.monotonic() + pdf_timeout
        while time.monotonic() < deadline:
            await tab.evaluate(
                f"""
(() => {{
  const clickButton = (patterns) => {{
    const buttons = [...document.querySelectorAll('button,[role="button"],input[type="button"],input[type="submit"]')];
    const button = buttons.find((el) => {{
      const text = (el.innerText || el.value || '').trim();
      return patterns.some((pattern) => pattern.test(text));
    }});
    if (button) button.click();
    return Boolean(button);
  }};
  if (/Are you a Broker\\/Agent\\?/i.test(document.body.innerText || '')) {{
    clickButton([{"/^yes$/i" if broker_agent == "yes" else "/^no$/i"}]);
  }}
  clickButton([/accept/i, /agree/i, /continue/i, /^view$/i, /view\\s+om/i, /download/i]);
}})()
"""
            )
            pdf_url = find_historical_om_pdf_url(tab.seen_urls + list_chrome_urls(debug_url), candidate.asset_id)
            if pdf_url:
                return pdf_url, await fetch_pdf_bytes_in_browser(tab, pdf_url)
            await asyncio.sleep(1)

    raise TimeoutError(f"Timed out waiting for generated OM PDF URL for asset {candidate.asset_id}")


async def fetch_pdf_bytes_in_browser(tab: ChromeTab, pdf_url: str) -> bytes:
    result = await tab.evaluate(
        f"""
(async () => {{
  const response = await fetch({json.dumps(pdf_url)}, {{
    credentials: 'include',
    headers: {{ 'Accept': 'application/pdf,*/*;q=0.9' }},
  }});
  if (!response.ok) {{
    return {{ ok: false, status: response.status, text: (await response.text()).slice(0, 500) }};
  }}
  const bytes = new Uint8Array(await response.arrayBuffer());
  let binary = '';
  for (let i = 0; i < bytes.length; i += 32768) {{
    binary += String.fromCharCode(...bytes.subarray(i, i + 32768));
  }}
  return {{
    ok: true,
    status: response.status,
    contentType: response.headers.get('content-type'),
    base64: btoa(binary),
  }};
}})()
"""
    )
    if not isinstance(result, dict) or not result.get("ok"):
        raise RuntimeError(f"Browser PDF fetch failed: {result}")
    return base64.b64decode(result["base64"])


def upload_pdf_to_s3(key: str, content: bytes) -> str:
    bucket = os.environ["AWS_S3_BUCKET"]
    region = os.environ.get("AWS_REGION", "us-east-1")
    client = boto3.client(
        "s3",
        region_name=region,
        aws_access_key_id=os.environ["AWS_ACCESS_KEY_ID"],
        aws_secret_access_key=os.environ["AWS_SECRET_ACCESS_KEY"],
    )
    client.put_object(Bucket=bucket, Key=key, Body=content, ContentType="application/pdf")
    return f"https://{bucket}.s3.{region}.amazonaws.com/{key}"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("--limit", type=int, default=None, help="Maximum number of PDFs to process")
    parser.add_argument("--page-size", type=int, default=20, help="Raw-row page size")
    parser.add_argument("--link-timeout", type=int, default=30, help="Seconds to wait for the page document link")
    parser.add_argument("--pdf-timeout", type=int, default=45, help="Seconds to wait for the generated PDF request")
    parser.add_argument(
        "--failure-log",
        default="/tmp/crexi_historical_om_failures.jsonl",
        help="JSONL file of failed crexi_ids to skip on later runs",
    )
    parser.add_argument("--retry-failed", action="store_true", help="Ignore the failure log and retry failed rows")
    parser.add_argument("--dry-run", action="store_true", help="Print candidates without clicking or writing")
    parser.add_argument("--chrome-debug-url", default="http://127.0.0.1:9222")
    parser.add_argument(
        "--accept-confidentiality-agreement",
        action="store_true",
        help="Required for live runs because Crexi shows a CA before Historical OM access",
    )
    parser.add_argument("--broker-agent", choices=["yes", "no"], help="Answer to Crexi's Broker/Agent prompt")
    return parser.parse_args()


def main() -> int:
    load_dotenv()
    args = parse_args()
    if not args.dry_run and (not args.accept_confidentiality_agreement or not args.broker_agent):
        print(
            "Live runs require --accept-confidentiality-agreement and --broker-agent yes|no.",
            file=sys.stderr,
        )
        return 2

    supabase_url = os.environ.get("SUPABASE_URL") or os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
    service_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not supabase_url or not service_key:
        print("SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.", file=sys.stderr)
        return 2

    supabase = SupabaseRest(supabase_url, service_key)
    skip_crexi_ids = load_failed_crexi_ids(args.failure_log, args.retry_failed)
    candidates = collect_candidates(supabase, args.page_size, args.limit, skip_crexi_ids)

    print(f"Found {len(candidates)} candidate Historical OM row(s).")
    if skip_crexi_ids and not args.retry_failed:
        print(f"Skipped {len(skip_crexi_ids)} previously failed crexi_id(s) from {args.failure_log}.")
    if args.dry_run:
        for candidate in candidates[: args.limit]:
            print(f"{candidate.comp_id}\t{candidate.asset_id}\t{candidate.property_name or ''}\t{candidate.crexi_url}")
        return 0

    updated = failed = 0
    for candidate in candidates:
        print(f"Processing crexi_api_comps.id={candidate.comp_id} asset={candidate.asset_id} {candidate.property_name or ''}")
        try:
            pdf_url, pdf_bytes = asyncio.run(
                reveal_pdf_url(
                    args.chrome_debug_url,
                    candidate,
                    args.broker_agent,
                    args.link_timeout,
                    args.pdf_timeout,
                )
            )
            if not is_pdf_bytes(pdf_bytes):
                raise RuntimeError(f"Historical OM response was not a PDF for asset {candidate.asset_id}")

            s3_key = build_crexi_om_s3_key(candidate.comp_id, candidate.crexi_id, candidate.asset_id)
            s3_url = upload_pdf_to_s3(s3_key, pdf_bytes)
            supabase.patch_comp(
                candidate.comp_id,
                {
                    "om_url": s3_url,
                    "attachment_urls": [
                        {
                            "source_url": pdf_url.split("?", 1)[0],
                            "url": s3_url,
                            "description": "Historical Flyer" if "/flyer" in pdf_url else "Historical OM",
                            "asset_id": candidate.asset_id,
                        }
                    ],
                },
            )
            updated += 1
            print(f"Stored Historical OM for crexi_api_comps.id={candidate.comp_id}: {s3_url}")
        except Exception as e:
            failed += 1
            record_failed_candidate(args.failure_log, candidate, e)
            print(
                f"Failed crexi_api_comps.id={candidate.comp_id} asset={candidate.asset_id}: {e}",
                file=sys.stderr,
            )
            continue

    print(f"Done. Updated {updated} row(s), failed {failed} row(s).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
