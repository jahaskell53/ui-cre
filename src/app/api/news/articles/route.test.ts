import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const { mockGetUser, mockDb } = vi.hoisted(() => ({
    mockGetUser: vi.fn(),
    mockDb: {
        select: vi.fn(),
    },
}));

vi.mock("@/utils/supabase/server", () => ({
    createClient: vi.fn().mockResolvedValue({
        auth: { getUser: mockGetUser },
    }),
}));

vi.mock("@/db", () => ({
    db: mockDb,
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

describe("GET /api/news/articles", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("returns 401 when not authenticated", async () => {
        noAuth();
        const res = await GET(makeGet());
        expect(res.status).toBe(401);
    });

    it("returns transformed articles", async () => {
        authAs();

        const articleRows = [
            {
                id: "art-1",
                title: "Multifamily Sale",
                link: "https://example.com/1",
                description: "A deal",
                image_url: null,
                date: "2026-03-01",
                source_name: "CRE News",
            },
        ];

        const countyRows = [{ article_id: "art-1", county_name: "Suffolk" }];
        const tagRows = [{ article_id: "art-1", tag: "multifamily" }];

        let callCount = 0;
        mockDb.select.mockImplementation(() => {
            callCount++;
            if (callCount === 1) {
                // articles query with joins
                const mockOffset = vi.fn().mockResolvedValue(articleRows);
                const mockLimit = vi.fn().mockReturnValue({ offset: mockOffset });
                const mockOrderBy = vi.fn().mockReturnValue({ limit: mockLimit });
                const mockWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
                const mockLeftJoin = vi.fn().mockReturnValue({ where: mockWhere });
                return { from: vi.fn().mockReturnValue({ leftJoin: mockLeftJoin }) };
            } else if (callCount === 2) {
                // county rows
                const mockWhere = vi.fn().mockResolvedValue(countyRows);
                const mockLeftJoin = vi.fn().mockReturnValue({ where: mockWhere });
                return { from: vi.fn().mockReturnValue({ leftJoin: mockLeftJoin }) };
            } else {
                // tag rows
                const mockWhere = vi.fn().mockResolvedValue(tagRows);
                return { from: vi.fn().mockReturnValue({ where: mockWhere }) };
            }
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

        mockDb.select.mockImplementation(() => {
            throw new Error("DB error");
        });

        const res = await GET(makeGet());
        expect(res.status).toBe(500);
    });

    it("respects limit and offset params", async () => {
        authAs();

        let capturedLimit: number | null = null;
        let capturedOffset: number | null = null;

        mockDb.select.mockImplementation(() => {
            const mockOffset = vi.fn().mockImplementation((off: number) => {
                capturedOffset = off;
                return Promise.resolve([]);
            });
            const mockLimit = vi.fn().mockImplementation((lim: number) => {
                capturedLimit = lim;
                return { offset: mockOffset };
            });
            const mockOrderBy = vi.fn().mockReturnValue({ limit: mockLimit });
            const mockWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
            const mockLeftJoin = vi.fn().mockReturnValue({ where: mockWhere });
            return { from: vi.fn().mockReturnValue({ leftJoin: mockLeftJoin }) };
        });

        await GET(makeGet({ limit: "10", offset: "20" }));
        expect(capturedLimit).toBe(10);
        expect(capturedOffset).toBe(20);
    });
});
