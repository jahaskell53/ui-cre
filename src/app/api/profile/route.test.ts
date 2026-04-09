import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PATCH } from "./route";

const { mockGetUser, mockDbUpdate, mockDbSelect } = vi.hoisted(() => ({
    mockGetUser: vi.fn(),
    mockDbUpdate: vi.fn(),
    mockDbSelect: vi.fn(),
}));

vi.mock("@/utils/supabase/server", () => ({
    createClient: vi.fn().mockResolvedValue({
        auth: { getUser: mockGetUser },
    }),
}));

vi.mock("@/db", () => ({
    db: {
        update: mockDbUpdate,
        select: mockDbSelect,
    },
}));

function makeRequest(body: Record<string, unknown>) {
    return new NextRequest("http://localhost/api/profile", {
        method: "PATCH",
        body: JSON.stringify(body),
    });
}

describe("PATCH /api/profile", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("returns 401 if not authenticated", async () => {
        mockGetUser.mockResolvedValue({ data: { user: null }, error: { message: "Not authenticated" } });
        const res = await PATCH(makeRequest({ full_name: "A" }));
        expect(res.status).toBe(401);
    });

    it("returns 400 when no valid fields", async () => {
        mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
        const res = await PATCH(makeRequest({}));
        expect(res.status).toBe(400);
    });

    it("updates profile and returns snake_case profile", async () => {
        mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });

        const mockSet = vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });
        mockDbUpdate.mockReturnValue({ set: mockSet });

        const mockWhere = vi.fn().mockResolvedValue([
            {
                id: "user-1",
                fullName: "Jane",
                avatarUrl: null,
                website: null,
                roles: ["Broker"],
                isAdmin: false,
                themePreference: "system",
                updatedAt: "2026-01-01T00:00:00.000Z",
                tourVisitedPages: [],
            },
        ]);
        const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
        mockDbSelect.mockReturnValue({ from: mockFrom });

        const res = await PATCH(
            makeRequest({
                full_name: "Jane",
                website: "",
                avatar_url: null,
                roles: ["Broker"],
            }),
        );
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.full_name).toBe("Jane");
        expect(body.avatar_url).toBeNull();
        expect(body.roles).toEqual(["Broker"]);
        expect(mockSet).toHaveBeenCalledWith(
            expect.objectContaining({
                fullName: "Jane",
                website: null,
                avatarUrl: null,
                roles: ["Broker"],
                updatedAt: expect.any(String),
            }),
        );
    });
});
