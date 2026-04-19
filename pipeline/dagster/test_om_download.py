"""
Local test script for the OM download Playwright scraper.

Usage:
    APIFY_TOKEN=... .venv/bin/python test_om_download.py [listing_url] [document_url]

Defaults to the known-failing 1745 Market St listing.
"""

import base64
import os
import sys

from apify_client import ApifyClient


LISTING_URL = "https://www.loopnet.com/Listing/1745-Market-St-San-Francisco-CA/40109404/"
DOCUMENT_URL = "https://images1.loopnet.com/d2/HKUvyINhw3UuqBq1333gJ7z-fPOsKWlSpqDLVej1WRE/document.pdf"


def test_download(listing_url: str, document_url: str) -> None:
    token = os.environ.get("APIFY_TOKEN")
    if not token:
        print("ERROR: Set APIFY_TOKEN env var")
        sys.exit(1)

    client = ApifyClient(token)

    page_function = """
async function pageFunction(context) {
    const { page, request, log } = context;
    const documentUrl = request.userData.documentUrl;

    log.info('Listing page loaded, waiting for cookies to settle...');
    await page.waitForTimeout(3000);
    log.info('Fetching document via APIRequestContext: ' + documentUrl);

    try {
        const apiResponse = await page.context().request.get(documentUrl, {
            headers: { 'Accept': 'application/pdf,*/*;q=0.9' },
        });

        if (!apiResponse.ok()) {
            log.error('Document fetch HTTP ' + apiResponse.status() + ' ' + apiResponse.statusText());
            return { error: 'HTTP ' + apiResponse.status() };
        }

        const body = await apiResponse.body();
        log.info('Document downloaded — ' + body.length + ' bytes');
        return { base64: body.toString('base64'), size: body.length };
    } catch (e) {
        log.error('Document fetch error: ' + e.toString());
        return { error: e.toString() };
    }
}
"""

    pre_navigation_hooks = """[
    async ({ request, session }, goToOptions) => {
        goToOptions.waitUntil = 'domcontentloaded';
    }
]"""

    print(f"Listing URL:  {listing_url}")
    print(f"Document URL: {document_url}")
    print("Starting Apify playwright-scraper run...")

    run = client.actor("apify/playwright-scraper").call(
        run_input={
            "startUrls": [{"url": listing_url, "userData": {"documentUrl": document_url}}],
            "pageFunction": page_function,
            "preNavigationHooks": pre_navigation_hooks,
            "proxyConfiguration": {
                "useApifyProxy": True,
                "apifyProxyGroups": ["RESIDENTIAL"],
                "apifyProxyCountry": "US",
            },
            "maxRequestsPerCrawl": 1,
            "maxRequestRetries": 8,
            "useSessionPool": True,
            "sessionPoolOptions": {"maxPoolSize": 1},
        },
        timeout_secs=300,
    )

    print(f"\nRun ID: {run['id']}")
    print(f"Status: {run['status']}")

    log_client = client.run(run["id"])
    print("\n=== ACTOR LOG ===")
    log_text = log_client.log().get()
    if log_text:
        for line in log_text.strip().split("\n"):
            print(f"  {line}")

    print("\n=== DATASET ITEMS ===")
    items = list(client.dataset(run["defaultDatasetId"]).iterate_items())
    for item in items:
        if "base64" in item and item["base64"]:
            pdf_bytes = base64.b64decode(item["base64"])
            print(f"  SUCCESS: Got PDF — {len(pdf_bytes)} bytes")
            with open("test_om.pdf", "wb") as f:
                f.write(pdf_bytes)
            print("  Saved to test_om.pdf")
        elif "error" in item:
            print(f"  ERROR: {item.get('error')}")
        elif item.get("#error"):
            msgs = item.get("#debug", {}).get("errorMessages", [])
            print(f"  CRAWL ERROR: {msgs[-1][:200] if msgs else 'unknown'}")
        else:
            print(f"  Item: {item}")

    if not items:
        print("  No items in dataset!")
    elif not any(i.get("base64") for i in items):
        print("\n  FAILED — no PDF data returned")
        sys.exit(1)


if __name__ == "__main__":
    listing = sys.argv[1] if len(sys.argv) > 1 else LISTING_URL
    doc = sys.argv[2] if len(sys.argv) > 2 else DOCUMENT_URL
    test_download(listing, doc)
