import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const { mockGetRssFeeds, mockDb, mockParseURL } = vi.hoisted(() => ({
    mockGetRssFeeds: vi.fn(),
    mockDb: {
        select: vi.fn(),
        insert: vi.fn(),
    },
    mockParseURL: vi.fn(),
}));

vi.mock("@/lib/news/news-sources", () => ({
    getRssFeeds: mockGetRssFeeds,
    sanitizeImageUrl: vi.fn((url: string) => url || ""),
}));

vi.mock("@/lib/news/counties", () => ({
    getCountyIds: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/db", () => ({
    db: mockDb,
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
    // insert().values().onConflictDoNothing() for sources and articles
    let mockInsertValues: ReturnType<typeof vi.fn>;
    const mockInsertOnConflict = vi.fn().mockResolvedValue([]);
    const mockReturningOnConflict = vi.fn().mockResolvedValue([{ id: "art-1" }]);
    const mockReturning = vi.fn().mockReturnValue({ onConflictDoNothing: mockReturningOnConflict });
    mockInsertValues = vi.fn().mockReturnValue({
        onConflictDoNothing: mockInsertOnConflict,
        returning: mockReturning,
    });
    mockDb.insert.mockReturnValue({ values: mockInsertValues });

    // select().from().where() → source name lookup
    const mockSourceWhere = vi.fn().mockResolvedValue([{ sourceName: "CRE News" }]);
    const mockSourceFrom = vi.fn().mockReturnValue({ where: mockSourceWhere });
    mockDb.select.mockReturnValue({ from: mockSourceFrom });

    return { mockInsertValues, mockReturning };
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

        // Default DB mock: sources lookup returns null, articles upsert returns nothing
        const mockInsertOnConflict = vi.fn().mockResolvedValue([]);
        const mockReturningOnConflict = vi.fn().mockResolvedValue([]);
        const mockReturning = vi.fn().mockReturnValue({ onConflictDoNothing: mockReturningOnConflict });
        const mockValues = vi.fn().mockReturnValue({
            onConflictDoNothing: mockInsertOnConflict,
            returning: mockReturning,
        });
        mockDb.insert.mockReturnValue({ values: mockValues });

        const mockSourceWhere = vi.fn().mockResolvedValue([]);
        const mockSourceFrom = vi.fn().mockReturnValue({ where: mockSourceWhere });
        mockDb.select.mockReturnValue({ from: mockSourceFrom });
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
        const { mockInsertValues } = setupSourceAndArticleMocks();

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
        expect(mockInsertValues).toHaveBeenCalledWith(
            expect.objectContaining({
                link: "https://crenews.com/office-tower",
                title: "Office tower sold",
                sourceId: "crenews",
                description: "A downtown tower traded hands.",
                imageUrl: "https://cdn.example.com/tower.jpg",
                isCategorized: false,
            }),
        );
    });

    it("falls back to the article Open Graph image when the feed has none", async () => {
        mockGetRssFeeds.mockResolvedValue([{ sourceId: "crenews", sourceName: "CRE News", url: "https://crenews.com/rss" }]);
        const { mockInsertValues } = setupSourceAndArticleMocks();

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
        expect(mockInsertValues).toHaveBeenCalledWith(
            expect.objectContaining({
                imageUrl: "https://cdn.example.com/deal.jpg",
                description: "A major Boston deal closed.",
            }),
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
