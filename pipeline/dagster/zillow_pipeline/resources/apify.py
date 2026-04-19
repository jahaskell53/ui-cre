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
        even through residential proxies, because the CDN requires valid LoopNet
        session cookies. We visit the listing page first to establish those cookies,
        then use page.evaluate() to fetch the document URL from inside the browser
        (which automatically sends the cookies), and return the raw bytes.
        """
        import base64

        client = ApifyClient(self.api_token)

        page_function = """
async function pageFunction(context) {
    const { page, request, log } = context;
    const documentUrl = request.userData.documentUrl;

    // Listing page is already loaded — wait for cookies to settle
    await page.waitForTimeout(3000);

    // Fetch the PDF from inside the browser so session cookies are included
    const base64 = await page.evaluate(async (url) => {
        try {
            const resp = await fetch(url, {
                credentials: 'include',
                headers: { 'Accept': 'application/pdf,*/*;q=0.9' },
            });
            if (!resp.ok) return null;
            const buf = await resp.arrayBuffer();
            const bytes = new Uint8Array(buf);
            let bin = '';
            for (let i = 0; i < bytes.byteLength; i++) {
                bin += String.fromCharCode(bytes[i]);
            }
            return btoa(bin);
        } catch (e) {
            return null;
        }
    }, documentUrl);

    if (!base64) {
        log.error('Browser fetch returned null for: ' + documentUrl);
        return null;
    }

    return { base64 };
}
"""

        run = client.actor("apify/playwright-scraper").call(
            run_input={
                "startUrls": [{"url": listing_url, "userData": {"documentUrl": document_url}}],
                "pageFunction": page_function,
                "proxyConfiguration": {
                    "useApifyProxy": True,
                    "apifyProxyGroups": ["RESIDENTIAL"],
                    "apifyProxyCountry": "US",
                },
                "maxRequestsPerCrawl": 1,
            }
        )

        items = [item for item in client.dataset(run["defaultDatasetId"]).iterate_items() if item.get("base64")]
        if not items:
            raise ValueError(f"Playwright scraper returned no data for {document_url}")

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
