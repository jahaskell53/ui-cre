import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const { mockGetUser, mockFrom } = vi.hoisted(() => ({
    mockGetUser: vi.fn(),
    mockFrom: vi.fn(),
}));

vi.mock("@/utils/supabase/server", () => ({
    createClient: vi.fn().mockResolvedValue({
        auth: { getUser: mockGetUser },
        from: mockFrom,
    }),
}));

function makeGet(params?: Record<string, string>) {
    const u = new URL("http://localhost/api/news/articles");
    if (params) Object.entries(params).forEach(([k, v]) => u.searchParams.set(k, v));
    return new NextRequest(u.toString());
}

function authAs(userId = "user-1") {
    mockGetUser.mockResolvedValue({ data: { user: { id: userId } }, error: null });
}

function noAuth() {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
}

const rawArticle = {
    id: "art-1",
    title: "Multifamily Sale",
    link: "https://example.com/1",
    description: "A deal",
    image_url: null,
    date: "2026-03-01",
    sources: { source_name: "CRE News" },
    article_counties: [{ counties: { name: "Suffolk" } }],
    article_tags: [{ tag: "multifamily" }],
};

describe("GET /api/news/articles", () => {
    beforeEach(() => vi.clearAllMocks());

    it("returns 401 when not authenticated", async () => {
        noAuth();
        const res = await GET(makeGet());
        expect(res.status).toBe(401);
    });

    it("returns transformed articles", async () => {
        authAs();
        const mockRange = vi.fn().mockResolvedValue({ data: [rawArticle], error: null });
        const mockOrder = vi.fn().mockReturnValue({ range: mockRange });
        const mockEq = vi.fn().mockReturnValue({ order: mockOrder });
        const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
        const mockProfileSingle = vi.fn().mockResolvedValue({ data: null });
        const mockProfileEq = vi.fn().mockReturnValue({ single: mockProfileSingle });
        const mockProfileSelect = vi.fn().mockReturnValue({ eq: mockProfileEq });

        let callCount = 0;
        mockFrom.mockImplementation(() => {
            callCount++;
            if (callCount === 1) return { select: mockProfileSelect };
            return { select: mockSelect };
        });

        const res = await GET(makeGet());
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(Array.isArray(body)).toBe(true);
        expect(body[0].id).toBe("art-1");
        expect(body[0].source_name).toBe("CRE News");
        expect(body[0].counties).toEqual(["Suffolk"]);
        expect(body[0].tags).toEqual(["multifamily"]);
    });

    it("returns 500 on DB error", async () => {
        authAs();
        const mockRange = vi.fn().mockResolvedValue({ data: null, error: { message: "DB error" } });
        const mockOrder = vi.fn().mockReturnValue({ range: mockRange });
        const mockEq = vi.fn().mockReturnValue({ order: mockOrder });
        const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
        const mockProfileSingle = vi.fn().mockResolvedValue({ data: null });
        const mockProfileEq = vi.fn().mockReturnValue({ single: mockProfileSingle });
        const mockProfileSelect = vi.fn().mockReturnValue({ eq: mockProfileEq });

        let callCount = 0;
        mockFrom.mockImplementation(() => {
            callCount++;
            if (callCount === 1) return { select: mockProfileSelect };
            return { select: mockSelect };
        });

        const res = await GET(makeGet());
        expect(res.status).toBe(500);
    });

    it("respects limit and offset params", async () => {
        authAs();
        let capturedRange: [number, number] | null = null;
        const mockRange = vi.fn().mockImplementation((from, to) => {
            capturedRange = [from, to];
            return Promise.resolve({ data: [], error: null });
        });
        const mockOrder = vi.fn().mockReturnValue({ range: mockRange });
        const mockEq = vi.fn().mockReturnValue({ order: mockOrder });
        const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
        const mockProfileSingle = vi.fn().mockResolvedValue({ data: null });
        const mockProfileEq = vi.fn().mockReturnValue({ single: mockProfileSingle });
        const mockProfileSelect = vi.fn().mockReturnValue({ eq: mockProfileEq });

        let callCount = 0;
        mockFrom.mockImplementation(() => {
            callCount++;
            if (callCount === 1) return { select: mockProfileSelect };
            return { select: mockSelect };
        });

        await GET(makeGet({ limit: "10", offset: "20" }));
        expect(capturedRange).toEqual([20, 29]);
    });
});
