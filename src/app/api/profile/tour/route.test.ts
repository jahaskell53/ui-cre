import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PATCH } from "./route";

const { mockGetUser, mockDbSelect, mockDbUpdate } = vi.hoisted(() => ({
    mockGetUser: vi.fn(),
    mockDbSelect: vi.fn(),
    mockDbUpdate: vi.fn(),
}));

vi.mock("@/utils/supabase/server", () => ({
    createClient: vi.fn().mockResolvedValue({
        auth: { getUser: mockGetUser },
    }),
}));

vi.mock("@/db", () => ({
    db: {
        select: mockDbSelect,
        update: mockDbUpdate,
    },
}));

function makeRequest(body: Record<string, unknown>) {
    return new NextRequest("http://localhost/api/profile/tour", {
        method: "PATCH",
        body: JSON.stringify(body),
    });
}

describe("PATCH /api/profile/tour", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("returns 401 if not authenticated", async () => {
        mockGetUser.mockResolvedValue({ data: { user: null }, error: { message: "Not authenticated" } });
        const res = await PATCH(makeRequest({ path: "/dashboard" }));
        expect(res.status).toBe(401);
    });

    it("returns 400 if path is missing", async () => {
        mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
        const res = await PATCH(makeRequest({}));
        expect(res.status).toBe(400);
    });

    it("adds new path and returns updated list", async () => {
        mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });

        const mockWhere = vi.fn().mockResolvedValue([{ tourVisitedPages: ["/home"] }]);
        const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
        mockDbSelect.mockReturnValue({ from: mockFrom });

        const mockSet = vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });
        mockDbUpdate.mockReturnValue({ set: mockSet });

        const res = await PATCH(makeRequest({ path: "/dashboard" }));
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.tour_visited_pages).toContain("/home");
        expect(body.tour_visited_pages).toContain("/dashboard");
    });

    it("does not duplicate paths already visited", async () => {
        mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });

        const mockWhere = vi.fn().mockResolvedValue([{ tourVisitedPages: ["/home", "/dashboard"] }]);
        const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
        mockDbSelect.mockReturnValue({ from: mockFrom });

        const res = await PATCH(makeRequest({ path: "/home" }));
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.tour_visited_pages).toEqual(["/home", "/dashboard"]);
        expect(mockDbUpdate).not.toHaveBeenCalled();
    });
});
