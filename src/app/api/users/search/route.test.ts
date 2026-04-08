import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const { mockGetUser, mockDbSelect, mockDbLimit, mockDbWhere, mockDbFrom } = vi.hoisted(() => {
    const mockDbLimit = vi.fn();
    const mockDbWhere = vi.fn();
    const mockDbFrom = vi.fn();
    return {
        mockGetUser: vi.fn(),
        mockDbSelect: vi.fn(),
        mockDbLimit,
        mockDbWhere,
        mockDbFrom,
    };
});

vi.mock("@/utils/supabase/server", () => ({
    createClient: vi.fn().mockResolvedValue({
        auth: { getUser: mockGetUser },
    }),
}));

vi.mock("@/db", () => ({
    db: {
        select: mockDbSelect,
    },
}));

describe("GET /api/users/search", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockDbLimit.mockResolvedValue([
            {
                id: "other-1",
                fullName: "Jane",
                avatarUrl: null,
                website: null,
                roles: null,
            },
        ]);
        mockDbWhere.mockReturnValue({ limit: mockDbLimit });
        mockDbFrom.mockReturnValue({ where: mockDbWhere });
        mockDbSelect.mockReturnValue({ from: mockDbFrom });
        mockGetUser.mockResolvedValue({ data: { user: { id: "user-123" } }, error: null });
    });

    it("returns 401 if not authenticated", async () => {
        mockGetUser.mockResolvedValue({ data: { user: null }, error: { message: "nope" } });
        const req = new NextRequest("http://localhost/api/users/search?q=john");
        const res = await GET(req);
        expect(res.status).toBe(401);
    });

    it("returns [] for empty query", async () => {
        const req = new NextRequest("http://localhost/api/users/search?q=%20");
        const res = await GET(req);
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body).toEqual([]);
        expect(mockDbSelect).not.toHaveBeenCalled();
    });

    it("returns 400 for invalid limit", async () => {
        const req = new NextRequest("http://localhost/api/users/search?q=john&limit=0");
        const res = await GET(req);
        expect(res.status).toBe(400);
        expect(mockDbLimit).not.toHaveBeenCalled();
    });

    it("uses default limit 20 when limit omitted", async () => {
        const req = new NextRequest("http://localhost/api/users/search?q=john");
        const res = await GET(req);
        expect(res.status).toBe(200);
        expect(mockDbLimit).toHaveBeenCalledWith(20);
        const body = await res.json();
        expect(body).toEqual([
            {
                id: "other-1",
                full_name: "Jane",
                avatar_url: null,
                website: null,
                roles: null,
            },
        ]);
    });

    it("respects limit query param up to 50", async () => {
        const req = new NextRequest("http://localhost/api/users/search?q=john&limit=5");
        const res = await GET(req);
        expect(res.status).toBe(200);
        expect(mockDbLimit).toHaveBeenCalledWith(5);

        mockDbLimit.mockResolvedValueOnce([]);
        const reqCap = new NextRequest("http://localhost/api/users/search?q=john&limit=999");
        await GET(reqCap);
        expect(mockDbLimit).toHaveBeenCalledWith(50);
    });

    it("excludes current user from results", async () => {
        mockDbLimit.mockResolvedValueOnce([
            { id: "user-123", fullName: "Self", avatarUrl: null, website: null, roles: null },
            { id: "other-1", fullName: "Jane", avatarUrl: null, website: null, roles: null },
        ]);
        const req = new NextRequest("http://localhost/api/users/search?q=j");
        const res = await GET(req);
        const body = await res.json();
        expect(body.map((r: { id: string }) => r.id)).toEqual(["other-1"]);
    });
});
