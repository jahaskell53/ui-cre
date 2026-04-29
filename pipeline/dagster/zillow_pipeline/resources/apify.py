from dagster import ConfigurableResource
from apify_client import ApifyClient


class ApifyResource(ConfigurableResource):
    api_token: str
    # Set APIFY_ACTOR_ID to the actor you want to use
    actor_id: str
    detail_actor_id: str
    loopnet_search_actor_id: str
    loopnet_detail_actor_id: str

    def download_crexi_document(self, listing_url: str) -> tuple[str, bytes] | None:
        """
        Visit a Crexi listing page with a real browser session, discover the OM PDF
        link from the Documents section, and download it.

        Returns (document_url, pdf_bytes) for the best OM candidate found, or None if
        no PDF attachment is present.  Cloudflare protects Crexi's CDN, so a plain
        HTTP download fails — we must fetch through the same browser context that
        established the Cloudflare clearance cookies.
        """
        client = ApifyClient(self.api_token)

        # Visit the listing page, collect all PDF attachment links with their label
        # text, pick the one that looks most like an OM, then download it via
        # Playwright's APIRequestContext (shares cookies with the page, bypasses CORS).
        page_function = r"""
async function pageFunction(context) {
    const { page, log, Actor } = context;

    log.info('Listing page loaded, waiting for content to settle...');
    await page.waitForTimeout(4000);

    // Collect every anchor whose href ends with .pdf (case-insensitive)
    const rawLinks = await page.evaluate(() => {
        const anchors = Array.from(document.querySelectorAll('a[href]'));
        return anchors
            .filter(a => /\.pdf(\?.*)?$/i.test(a.href))
            .map(a => ({
                href: a.href,
                text: (a.innerText || a.textContent || '').trim(),
                title: (a.title || '').trim(),
            }));
    });

    log.info('PDF links found: ' + rawLinks.length);
    if (rawLinks.length === 0) {
        return { found: false };
    }

    // Pick the best OM candidate: prefer links whose visible text or href contains
    // offering-memo / om keywords; fall back to the first PDF link.
    const omPattern = /offering[\s\-_]*memo(?:randum)?|\bom\b|(?<=[\/._\-])om(?=[\/._\-?#&]|$)/i;
    let chosen = rawLinks.find(
        l => omPattern.test(l.text) || omPattern.test(l.title) || omPattern.test(decodeURIComponent(l.href))
    ) || rawLinks[0];

    log.info('Chosen PDF: ' + chosen.href + ' (label: "' + chosen.text + '")');

    try {
        const apiResponse = await page.context().request.get(chosen.href, {
            headers: { 'Accept': 'application/pdf,*/*;q=0.9' },
            timeout: 120000,
        });

        if (!apiResponse.ok()) {
            log.error('PDF fetch HTTP ' + apiResponse.status() + ' ' + apiResponse.statusText());
            return { found: false, error: 'HTTP ' + apiResponse.status() };
        }

        const body = await apiResponse.body();
        log.info('PDF downloaded — ' + body.length + ' bytes');

        const kvStore = await Actor.openKeyValueStore();
        await kvStore.setValue('document', body, { contentType: 'application/pdf' });

        return { found: true, documentUrl: chosen.href, label: chosen.text, size: body.length };
    } catch (e) {
        log.error('PDF fetch error: ' + e.toString());
        return { found: false, error: e.toString() };
    }
}
"""

        pre_navigation_hooks = """[
    async ({ request, session }, goToOptions) => {
        goToOptions.waitUntil = 'domcontentloaded';
    }
]"""

        run = client.actor("apify/playwright-scraper").call(
            run_input={
                "startUrls": [{"url": listing_url}],
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

        items = list(client.dataset(run["defaultDatasetId"]).iterate_items())
        success = [item for item in items if item.get("found")]
        if not success:
            not_found = [item for item in items if item.get("found") is False and not item.get("error")]
            if not_found:
                return None
            errors = [item.get("error", "unknown") for item in items if item.get("error")]
            raise ValueError(
                f"Playwright scraper failed for {listing_url}"
                + (f" (errors: {errors})" if errors else "")
            )

        item = success[0]
        document_url: str = item["documentUrl"]

        kv_store_id = run["defaultKeyValueStoreId"]
        record = client.key_value_store(kv_store_id).get_record("document")
        if not record or not record.get("value"):
            raise ValueError(f"Key-value store record empty for {listing_url}")

        return document_url, record["value"]

    def download_loopnet_document(self, listing_url: str, document_url: str) -> bytes:
        """
        Download a LoopNet CDN document (e.g. OM PDF) using a real browser session.

        A plain HTTP request to images1.loopnet.com is blocked by Akamai with 403
        even through residential proxies, because the CDN requires valid LoopNet
        session cookies. We visit the listing page first to establish those cookies,
        then use Playwright's APIRequestContext (page.context().request) to fetch
        the document. This shares cookies with the browser but runs at the Node.js
        level, bypassing CORS restrictions between origins.

        The PDF is saved to the Apify key-value store (not the dataset) to avoid
        the ~9 MB dataset item size limit — OM PDFs can be 20+ MB.
        """
        client = ApifyClient(self.api_token)

        # page.context().request.get() uses Playwright's APIRequestContext which
        # shares cookies with the browser but makes requests at the Node.js level,
        # bypassing CORS. A plain page.evaluate(fetch(...)) fails because the CDN
        # (images1.loopnet.com) is cross-origin from the listing page
        # (www.loopnet.com) and doesn't set Access-Control-Allow-Origin.
        #
        # The PDF is saved to the key-value store instead of being returned via
        # the dataset, because Apify datasets have a ~9 MB item size limit and
        # base64-encoded PDFs easily exceed that.
        page_function = """
async function pageFunction(context) {
    const { page, request, log, Actor } = context;
    const documentUrl = request.userData.documentUrl;

    log.info('Listing page loaded, waiting for cookies to settle...');
    await page.waitForTimeout(3000);
    log.info('Fetching document via APIRequestContext: ' + documentUrl);

    try {
        const apiResponse = await page.context().request.get(documentUrl, {
            headers: { 'Accept': 'application/pdf,*/*;q=0.9' },
            timeout: 120000,
        });

        if (!apiResponse.ok()) {
            log.error('Document fetch HTTP ' + apiResponse.status() + ' ' + apiResponse.statusText());
            return { error: 'HTTP ' + apiResponse.status() };
        }

        const body = await apiResponse.body();
        log.info('Document downloaded — ' + body.length + ' bytes, saving to key-value store...');

        const kvStore = await Actor.openKeyValueStore();
        await kvStore.setValue('document', body, { contentType: 'application/pdf' });

        log.info('Saved to key-value store');
        return { stored: true, size: body.length };
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

        items = list(client.dataset(run["defaultDatasetId"]).iterate_items())
        success = [item for item in items if item.get("stored")]
        if not success:
            errors = [item.get("error", "unknown") for item in items if item.get("error")]
            raise ValueError(
                f"Playwright scraper returned no data for {document_url}"
                + (f" (errors: {errors})" if errors else "")
            )

        kv_store_id = run["defaultKeyValueStoreId"]
        record = client.key_value_store(kv_store_id).get_record("document")
        if not record or not record.get("value"):
            raise ValueError(f"Key-value store record empty for {document_url}")

        return record["value"]

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

    def run_loopnet_search(self, search_urls: list[str]) -> list[dict]:
        """Scrape one or more LoopNet search-results pages and return all items."""
        client = ApifyClient(self.api_token)
        run = client.actor(self.loopnet_search_actor_id).call(
            run_input={
                "urls": search_urls,
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
