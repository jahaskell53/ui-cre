import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DELETE, GET } from "./route";

const { mockGetUser, mockFrom, mockDeleteUser, mockRevokeGrant, mockDbSelect } = vi.hoisted(() => ({
    mockGetUser: vi.fn(),
    mockFrom: vi.fn(),
    mockDeleteUser: vi.fn(),
    mockRevokeGrant: vi.fn(),
    mockDbSelect: vi.fn(),
}));

vi.mock("@/utils/supabase/server", () => ({
    createClient: vi.fn().mockResolvedValue({
        auth: { getUser: mockGetUser },
        from: mockFrom,
    }),
}));

vi.mock("@/utils/supabase/admin", () => ({
    createAdminClient: vi.fn().mockReturnValue({
        auth: { admin: { deleteUser: mockDeleteUser } },
    }),
}));

vi.mock("@/lib/nylas/client", () => ({
    revokeGrant: mockRevokeGrant,
}));

vi.mock("@/db", () => ({
    db: {
        select: mockDbSelect,
    },
}));

function makeGet(params?: Record<string, string>) {
    const u = new URL("http://localhost/api/users");
    if (params) Object.entries(params).forEach(([k, v]) => u.searchParams.set(k, v));
    return new NextRequest(u.toString());
}

function makeDelete() {
    return new NextRequest("http://localhost/api/users", { method: "DELETE" });
}

// ─── GET ──────────────────────────────────────────────────────────────────────

describe("GET /api/users", () => {
    beforeEach(() => vi.clearAllMocks());

    it("returns 400 when user id is missing", async () => {
        mockGetUser.mockResolvedValue({ data: { user: null } });
        const res = await GET(makeGet());
        expect(res.status).toBe(400);
    });

    it("returns profile for given user id", async () => {
        mockGetUser.mockResolvedValue({ data: { user: null } });
        const profile = { id: "user-1", full_name: "Alice", avatar_url: null, website: null, roles: [] };
        const mockSingle = vi.fn().mockResolvedValue({ data: profile, error: null });
        const mockEq = vi.fn().mockReturnValue({ single: mockSingle });
        const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
        mockFrom.mockReturnValue({ select: mockSelect });

        const res = await GET(makeGet({ id: "user-1" }));
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body).toEqual(profile);
    });

    it("returns 404 when profile not found", async () => {
        mockGetUser.mockResolvedValue({ data: { user: null } });
        const mockSingle = vi.fn().mockResolvedValue({ data: null, error: { message: "not found" } });
        const mockEq = vi.fn().mockReturnValue({ single: mockSingle });
        const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
        mockFrom.mockReturnValue({ select: mockSelect });

        const res = await GET(makeGet({ id: "bad-id" }));
        expect(res.status).toBe(404);
    });
});

// ─── DELETE ───────────────────────────────────────────────────────────────────

describe("DELETE /api/users", () => {
    beforeEach(() => vi.clearAllMocks());

    it("returns 401 when not authenticated", async () => {
        mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
        const res = await DELETE(makeDelete());
        expect(res.status).toBe(401);
    });

    it("deletes user with no integrations", async () => {
        mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });

        // Drizzle select chain returns empty array
        const mockWhere = vi.fn().mockResolvedValue([]);
        const mockFrom2 = vi.fn().mockReturnValue({ where: mockWhere });
        mockDbSelect.mockReturnValue({ from: mockFrom2 });

        mockDeleteUser.mockResolvedValue({ error: null });

        const res = await DELETE(makeDelete());
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.success).toBe(true);
        expect(mockRevokeGrant).not.toHaveBeenCalled();
    });

    it("revokes Nylas grants before deleting user", async () => {
        mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });

        const mockWhere = vi.fn().mockResolvedValue([{ nylasGrantId: "grant-abc" }]);
        const mockFrom2 = vi.fn().mockReturnValue({ where: mockWhere });
        mockDbSelect.mockReturnValue({ from: mockFrom2 });

        mockRevokeGrant.mockResolvedValue(undefined);
        mockDeleteUser.mockResolvedValue({ error: null });

        await DELETE(makeDelete());

        expect(mockRevokeGrant).toHaveBeenCalledWith("grant-abc");
    });

    it("continues deleting even when revokeGrant throws", async () => {
        mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });

        const mockWhere = vi.fn().mockResolvedValue([{ nylasGrantId: "grant-abc" }]);
        const mockFrom2 = vi.fn().mockReturnValue({ where: mockWhere });
        mockDbSelect.mockReturnValue({ from: mockFrom2 });

        mockRevokeGrant.mockRejectedValue(new Error("Nylas down"));
        mockDeleteUser.mockResolvedValue({ error: null });

        const res = await DELETE(makeDelete());
        expect(res.status).toBe(200);
    });

    it("returns 500 when auth delete fails", async () => {
        mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });

        const mockWhere = vi.fn().mockResolvedValue([]);
        const mockFrom2 = vi.fn().mockReturnValue({ where: mockWhere });
        mockDbSelect.mockReturnValue({ from: mockFrom2 });

        mockDeleteUser.mockResolvedValue({ error: { message: "delete failed" } });

        const res = await DELETE(makeDelete());
        expect(res.status).toBe(500);
    });
});
