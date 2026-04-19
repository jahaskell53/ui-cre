from dagster import ConfigurableResource
from apify_client import ApifyClient


class ApifyResource(ConfigurableResource):
    api_token: str
    # Set APIFY_ACTOR_ID to the actor you want to use
    actor_id: str
    detail_actor_id: str
    loopnet_search_actor_id: str
    loopnet_detail_actor_id: str

    def download_loopnet_document(self, listing_url: str, document_url: str) -> bytes:
        """
        Download a LoopNet CDN document (e.g. OM PDF) using a real browser session.

        A plain HTTP request to images1.loopnet.com is blocked by Akamai with 403
        even through residential proxies, because it requires valid LoopNet session
        cookies. We use the Apify playwright-scraper actor to visit the listing page
        first (which sets the cookies), then fetch the document URL in the same
        browser context and return the raw bytes.
        """
        client = ApifyClient(self.api_token)

        page_function = """
async function pageFunction(context) {
    const { page, request } = context;
    const data = request.userData;

    if (data.phase === 'listing') {
        // Just load the listing page to establish session cookies, then navigate to doc
        await page.waitForTimeout(2000);
        const response = await page.goto(data.documentUrl, { waitUntil: 'networkidle', timeout: 60000 });
        const buffer = await response.buffer();
        return { base64: buffer.toString('base64') };
    }
}
"""

        run = client.actor("apify/playwright-scraper").call(
            run_input={
                "startUrls": [{"url": listing_url, "userData": {"phase": "listing", "documentUrl": document_url}}],
                "pageFunction": page_function,
                "proxyConfiguration": {
                    "useApifyProxy": True,
                    "apifyProxyGroups": ["RESIDENTIAL"],
                    "apifyProxyCountry": "US",
                },
                "launchContext": {
                    "launchOptions": {"headless": True},
                },
                "maxRequestsPerCrawl": 1,
            }
        )

        items = list(client.dataset(run["defaultDatasetId"]).iterate_items())
        if not items or not items[0].get("base64"):
            raise ValueError(f"Playwright scraper returned no data for {document_url}")

        import base64
        return base64.b64decode(items[0]["base64"])

    def run_zillow_search(self, zip_code: str) -> list[dict]:
        client = ApifyClient(self.api_token)
        run = client.actor(self.actor_id).call(
            run_input={
                "zipCodes": [zip_code],
                "daysOnZillow": "",
                "forRent": True,
                "forSaleByAgent": False,
                "forSaleByOwner": False,
                "sold": False,
            }
        )
        return list(client.dataset(run["defaultDatasetId"]).iterate_items())

    def run_zillow_detail(self, detail_url: str) -> list[dict]:
        client = ApifyClient(self.api_token)
        run = client.actor(self.detail_actor_id).call(
            run_input={"startUrls": [{"url": detail_url}], "type": "FOR_RENT"}
        )
        return list(client.dataset(run["defaultDatasetId"]).iterate_items())

    def run_loopnet_search(self, search_url: str) -> list[dict]:
        client = ApifyClient(self.api_token)
        run = client.actor(self.loopnet_search_actor_id).call(
            run_input={
                "urls": [search_url],
                "ignore_url_failures": True,
                "max_retries_per_url": 2,
                "proxy": {
                    "useApifyProxy": True,
                    "apifyProxyGroups": ["RESIDENTIAL"],
                    "apifyProxyCountry": "US",
                },
            }
        )
        return list(client.dataset(run["defaultDatasetId"]).iterate_items())

    def run_loopnet_detail(self, listing_url: str) -> list[dict]:
        client = ApifyClient(self.api_token)
        run = client.actor(self.loopnet_detail_actor_id).call(
            run_input={
                "startUrls": [{"url": listing_url}],
                "downloadImages": False,
                "enablePriceMonitoring": False,
                "includeListingDetails": False,
                "monitoringMode": False,
                "moreResults": False,
                "proxy": {
                    "useApifyProxy": True,
                    "apifyProxyGroups": ["RESIDENTIAL"],
                },
            }
        )
        return list(client.dataset(run["defaultDatasetId"]).iterate_items())
