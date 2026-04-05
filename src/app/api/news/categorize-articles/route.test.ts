import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const { mockFrom, mockCheckRelevance, mockGetCountyCategories, mockGetCityCategories, mockGetArticleTags, mockGetCountyIds } = vi.hoisted(() => ({
    mockFrom: vi.fn(),
    mockCheckRelevance: vi.fn(),
    mockGetCountyCategories: vi.fn(),
    mockGetCityCategories: vi.fn(),
    mockGetArticleTags: vi.fn(),
    mockGetCountyIds: vi.fn(),
}));

vi.mock("@/utils/supabase/server", () => ({
    createClient: vi.fn().mockResolvedValue({ from: mockFrom }),
}));

vi.mock("@/lib/news/categorization", () => ({
    checkArticleRelevance: mockCheckRelevance,
    getCountyCategories: mockGetCountyCategories,
    getCityCategories: mockGetCityCategories,
    getArticleTags: mockGetArticleTags,
}));

vi.mock("@/lib/news/counties", () => ({
    getCountyIds: mockGetCountyIds,
}));

function makeRequest(authHeader?: string) {
    return new Request("http://localhost/api/news/categorize-articles", {
        headers: authHeader ? { authorization: authHeader } : {},
    });
}

function setupArticlesFetch(articles: unknown[], error: unknown = null) {
    const mockLimit = vi.fn().mockResolvedValue({ data: articles, error });
    const mockOrder = vi.fn().mockReturnValue({ limit: mockLimit });
    const mockEq2 = vi.fn().mockReturnValue({ order: mockOrder });
    const mockEq1 = vi.fn().mockReturnValue({ eq: mockEq2 });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq1 });

    const mockIn = vi.fn().mockResolvedValue({ error: null });
    const mockUpdate = vi.fn().mockReturnValue({ in: mockIn, eq: vi.fn().mockResolvedValue({ error: null }) });
    const mockUpsert = vi.fn().mockResolvedValue({ error: null });

    mockFrom.mockImplementation(() => ({
        select: mockSelect,
        update: mockUpdate,
        upsert: mockUpsert,
    }));

    return { mockUpdate };
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

describe("GET /api/news/categorize-articles — auth", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        delete process.env.CRON_SECRET;
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

    it("proceeds when auth header is correct", async () => {
        process.env.CRON_SECRET = "secret";
        setupArticlesFetch([]);
        const res = await GET(makeRequest("Bearer secret"));
        expect(res.status).toBe(200);
    });
});

// ─── No articles ──────────────────────────────────────────────────────────────

describe("GET /api/news/categorize-articles — no articles", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        process.env.CRON_SECRET = "secret";
    });

    it("returns ok:true with processed:0 when no articles to categorize", async () => {
        setupArticlesFetch([]);
        const res = await GET(makeRequest("Bearer secret"));
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.ok).toBe(true);
        expect(body.results.processed).toBe(0);
    });

    it("returns 500 when DB fetch fails", async () => {
        setupArticlesFetch([], { message: "DB error" });
        const res = await GET(makeRequest("Bearer secret"));
        expect(res.status).toBe(500);
    });
});

// ─── Relevance filtering ──────────────────────────────────────────────────────

describe("GET /api/news/categorize-articles — relevance filtering", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        process.env.CRON_SECRET = "secret";
    });

    it("marks all articles as irrelevant and returns without categorizing", async () => {
        const articles = [
            { id: "a1", title: "Irrelevant", description: null, link: "http://example.com/1" },
            { id: "a2", title: "Also irrelevant", description: null, link: "http://example.com/2" },
        ];
        setupArticlesFetch(articles);
        mockCheckRelevance.mockResolvedValue([false, false]);

        const res = await GET(makeRequest("Bearer secret"));
        const body = await res.json();

        expect(body.ok).toBe(true);
        expect(body.results.relevant).toBe(0);
        expect(body.results.irrelevant).toBe(2);
        expect(mockGetCountyCategories).not.toHaveBeenCalled();
    });
});

// ─── Happy path ───────────────────────────────────────────────────────────────

describe("GET /api/news/categorize-articles — happy path", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        process.env.CRON_SECRET = "secret";
    });

    it("categorizes relevant articles and returns counts", async () => {
        const articles = [{ id: "a1", title: "CRE Deal", description: "Multifamily sale", link: "http://example.com/1" }];
        setupArticlesFetch(articles);
        mockCheckRelevance.mockResolvedValue([true]);
        mockGetCountyCategories.mockResolvedValue([["Suffolk"]]);
        mockGetCityCategories.mockResolvedValue([["Boston"]]);
        mockGetArticleTags.mockResolvedValue([["multifamily"]]);
        mockGetCountyIds.mockResolvedValue(["county-1"]);

        const res = await GET(makeRequest("Bearer secret"));
        const body = await res.json();

        expect(body.ok).toBe(true);
        expect(body.results.processed).toBe(1);
        expect(body.results.relevant).toBe(1);
        expect(body.results.categorized).toBe(1);
    });

    it("includes timings in response", async () => {
        const articles = [{ id: "a1", title: "CRE Deal", description: null, link: "http://example.com/1" }];
        setupArticlesFetch(articles);
        mockCheckRelevance.mockResolvedValue([true]);
        mockGetCountyCategories.mockResolvedValue([[]]);
        mockGetCityCategories.mockResolvedValue([[]]);
        mockGetArticleTags.mockResolvedValue([[]]);
        mockGetCountyIds.mockResolvedValue([]);

        const res = await GET(makeRequest("Bearer secret"));
        const body = await res.json();

        expect(body.timings).toBeDefined();
        expect(typeof body.timings.relevance).toBe("number");
    });
});
