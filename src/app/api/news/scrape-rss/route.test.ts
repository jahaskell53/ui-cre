import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const { mockGetRssFeeds, mockFrom, mockParseURL } = vi.hoisted(() => ({
    mockGetRssFeeds: vi.fn(),
    mockFrom: vi.fn(),
    mockParseURL: vi.fn(),
}));

vi.mock("@/lib/news/news-sources", () => ({
    getRssFeeds: mockGetRssFeeds,
    sanitizeImageUrl: vi.fn((url: string) => url || ""),
}));

vi.mock("@/lib/news/counties", () => ({
    getCountyIds: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/utils/supabase/server", () => ({
    createClient: vi.fn().mockResolvedValue({ from: mockFrom }),
}));

// Mock rss-parser so no real network calls are made
vi.mock("rss-parser", () => ({
    default: vi.fn().mockImplementation(function () {
        return { parseURL: mockParseURL };
    }),
}));

function makeRequest(authHeader?: string) {
    return new Request("http://localhost/api/news/scrape-rss", {
        headers: authHeader ? { authorization: authHeader } : {},
    });
}

function setupSourceAndArticleMocks() {
    const mockSourceSingle = vi.fn().mockResolvedValue({ data: { source_name: "CRE News" }, error: null });
    const mockSourceEq = vi.fn().mockReturnValue({ single: mockSourceSingle });
    const mockSourceSelect = vi.fn().mockReturnValue({ eq: mockSourceEq });
    const mockSourceUpsert = vi.fn().mockResolvedValue({ error: null });

    const mockArticleSingle = vi.fn().mockResolvedValue({ data: { id: "art-1" }, error: null });
    const mockArticleSelect = vi.fn().mockReturnValue({ single: mockArticleSingle });
    const mockArticleUpsert = vi.fn().mockReturnValue({ select: mockArticleSelect });

    mockFrom.mockImplementation((table: string) => {
        if (table === "sources") {
            return { select: mockSourceSelect, upsert: mockSourceUpsert };
        }

        if (table === "articles") {
            return { upsert: mockArticleUpsert };
        }

        return {};
    });

    return { mockArticleUpsert };
}

describe("GET /api/news/scrape-rss — auth", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        delete process.env.CRON_SECRET;
        mockParseURL.mockResolvedValue({ items: [] });
    });

    it("returns 401 when CRON_SECRET is set and header is missing", async () => {
        process.env.CRON_SECRET = "secret";
        const res = await GET(makeRequest());
        expect(res.status).toBe(401);
    });

    it("returns 401 when auth header is wrong", async () => {
        process.env.CRON_SECRET = "secret";
        const res = await GET(makeRequest("Bearer wrong"));
        expect(res.status).toBe(401);
    });
});

describe("GET /api/news/scrape-rss — processing", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        process.env.CRON_SECRET = "secret";
        mockParseURL.mockResolvedValue({ items: [] });

        // Default supabase mock: sources select + single for source name lookup
        const mockSingle = vi.fn().mockResolvedValue({ data: null, error: null });
        const mockEq = vi.fn().mockReturnValue({ single: mockSingle });
        const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
        const mockUpsert = vi.fn().mockResolvedValue({ error: null });
        mockFrom.mockReturnValue({ select: mockSelect, upsert: mockUpsert });
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("returns ok:true with 0 loaded when no RSS feeds configured", async () => {
        mockGetRssFeeds.mockResolvedValue([]);

        const res = await GET(makeRequest("Bearer secret"));
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.ok).toBe(true);
        expect(body.results.rss.loaded).toBe(0);
    });

    it("returns ok:true even when RSS feed fetch fails", async () => {
        mockGetRssFeeds.mockRejectedValue(new Error("network error"));

        const res = await GET(makeRequest("Bearer secret"));
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.ok).toBe(true);
        expect(body.results.rss.loaded).toBe(0);
    });

    it("skips feeds without URLs before attempting to parse them", async () => {
        mockGetRssFeeds.mockResolvedValue([{ sourceId: "src-1", sourceName: "Missing URL", url: null }]);

        const res = await GET(makeRequest("Bearer secret"));
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.results.rss.loaded).toBe(0);
        expect(mockParseURL).not.toHaveBeenCalled();
    });

    it("uses feed-provided images and snippets when saving parsed articles", async () => {
        mockGetRssFeeds.mockResolvedValue([{ sourceId: "crenews", sourceName: "CRE News", url: "https://crenews.com/rss" }]);
        const { mockArticleUpsert } = setupSourceAndArticleMocks();

        mockParseURL.mockResolvedValue({
            items: [
                {
                    title: "Office tower sold",
                    link: "https://crenews.com/office-tower",
                    pubDate: "2026-03-01T12:00:00Z",
                    contentSnippet: "A downtown tower traded hands.",
                    mediaContent: [{ $: { type: "image/jpeg", url: "https://cdn.example.com/tower.jpg" } }],
                },
            ],
        });

        const res = await GET(makeRequest("Bearer secret"));
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.results.rss.loaded).toBe(1);
        expect(mockParseURL).toHaveBeenCalledWith("https://crenews.com/rss");
        expect(mockArticleUpsert).toHaveBeenCalledWith(
            expect.objectContaining({
                link: "https://crenews.com/office-tower",
                title: "Office tower sold",
                source_id: "crenews",
                description: "A downtown tower traded hands.",
                image_url: "https://cdn.example.com/tower.jpg",
                is_categorized: false,
            }),
            { onConflict: "link", ignoreDuplicates: true },
        );
    });

    it("falls back to the article Open Graph image when the feed has none", async () => {
        mockGetRssFeeds.mockResolvedValue([{ sourceId: "crenews", sourceName: "CRE News", url: "https://crenews.com/rss" }]);
        const { mockArticleUpsert } = setupSourceAndArticleMocks();

        mockParseURL.mockResolvedValue({
            items: [
                {
                    title: "Multifamily deal closed",
                    link: "https://crenews.com/multifamily-deal",
                    pubDate: "2026-03-02T09:00:00Z",
                    description: "<p>A major Boston deal closed.</p>",
                },
            ],
        });

        const mockFetch = vi.fn().mockResolvedValue({
            text: () => Promise.resolve('<html><head><meta property="og:image" content="https://cdn.example.com/deal.jpg" /></head></html>'),
        });
        vi.stubGlobal("fetch", mockFetch);

        const res = await GET(makeRequest("Bearer secret"));
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.results.rss.loaded).toBe(1);
        expect(mockFetch).toHaveBeenCalledWith(
            "https://crenews.com/multifamily-deal",
            expect.objectContaining({
                headers: { "User-Agent": "Mozilla/5.0 (compatible; NewsBot/1.0)" },
            }),
        );
        expect(mockArticleUpsert).toHaveBeenCalledWith(
            expect.objectContaining({
                image_url: "https://cdn.example.com/deal.jpg",
                description: "A major Boston deal closed.",
            }),
            { onConflict: "link", ignoreDuplicates: true },
        );
    });

    it("includes timings in response", async () => {
        mockGetRssFeeds.mockResolvedValue([]);

        const res = await GET(makeRequest("Bearer secret"));
        const body = await res.json();

        expect(body.timings).toBeDefined();
        expect(typeof body.timings.total).toBe("number");
    });
});
