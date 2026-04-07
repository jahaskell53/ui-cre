import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const { mockGetUser, mockFrom, mockSearchArticlesWithGemini } = vi.hoisted(() => ({
    mockGetUser: vi.fn(),
    mockFrom: vi.fn(),
    mockSearchArticlesWithGemini: vi.fn(),
}));

vi.mock("@/utils/supabase/server", () => ({
    createClient: vi.fn().mockResolvedValue({
        auth: { getUser: mockGetUser },
        from: mockFrom,
    }),
}));

vi.mock("@/lib/news/search", () => ({
    searchArticlesWithGemini: mockSearchArticlesWithGemini,
}));

function makePost(body: Record<string, unknown>) {
    return new NextRequest("http://localhost/api/news/search", {
        method: "POST",
        body: JSON.stringify(body),
    });
}

function authAs(userId = "user-1") {
    mockGetUser.mockResolvedValue({ data: { user: { id: userId, email: "u@example.com" } }, error: null });
}

function noAuth() {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
}

function setupArticlesFetch(articles: unknown[] = [], error: unknown = null) {
    const mockLimit = vi.fn().mockResolvedValue({ data: articles, error });
    const mockOrder = vi.fn().mockReturnValue({ limit: mockLimit });
    const mockEq = vi.fn().mockReturnValue({ order: mockOrder });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
    mockFrom.mockReturnValue({ select: mockSelect });
}

function setupArticlesFetchWithDate(articles: unknown[] = []) {
    const mockLimit = vi.fn().mockResolvedValue({ data: articles, error: null });
    const mockOrder = vi.fn().mockReturnValue({ limit: mockLimit });
    const mockGte = vi.fn().mockReturnValue({ order: mockOrder });
    const mockEq = vi.fn().mockReturnValue({ order: mockOrder, gte: mockGte });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
    mockFrom.mockReturnValue({ select: mockSelect });
}

describe("POST /api/news/search — auth", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("returns 401 when not authenticated", async () => {
        noAuth();
        const res = await POST(makePost({ query: "multifamily" }));
        expect(res.status).toBe(401);
    });
});

describe("POST /api/news/search — validation", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("returns 400 when query is missing", async () => {
        authAs();
        const res = await POST(makePost({}));
        expect(res.status).toBe(400);
    });

    it("returns 400 when query is blank", async () => {
        authAs();
        const res = await POST(makePost({ query: "   " }));
        expect(res.status).toBe(400);
    });
});

describe("POST /api/news/search — happy path", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("returns search results from LLM", async () => {
        authAs();
        const rawArticle = {
            id: "art-1",
            title: "Multifamily Sale",
            link: "https://example.com/1",
            description: null,
            image_url: null,
            date: "2026-03-01",
            sources: { source_name: "CRE News" },
            article_counties: [{ counties: { name: "Suffolk" } }],
            article_tags: [{ tag: "multifamily" }],
        };
        setupArticlesFetch([rawArticle]);
        const searchResult = { id: "art-1", title: "Multifamily Sale", relevanceScore: 0.9 };
        mockSearchArticlesWithGemini.mockResolvedValue([searchResult]);

        const res = await POST(makePost({ query: "multifamily deals" }));
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.articles).toEqual([searchResult]);
        expect(body.totalFound).toBe(1);
        expect(body.query).toBe("multifamily deals");
    });

    it("returns 500 on DB error", async () => {
        authAs();
        setupArticlesFetch([], { message: "DB error" });

        const res = await POST(makePost({ query: "multifamily" }));
        expect(res.status).toBe(500);
    });
});
