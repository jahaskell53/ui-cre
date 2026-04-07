import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DELETE } from "./route";

const { mockGetUser, mockRevokeGrant, mockDbSelect, mockDbDelete } = vi.hoisted(() => ({
    mockGetUser: vi.fn(),
    mockRevokeGrant: vi.fn(),
    mockDbSelect: vi.fn(),
    mockDbDelete: vi.fn(),
}));

vi.mock("@/utils/supabase/server", () => ({
    createClient: vi.fn().mockResolvedValue({
        auth: { getUser: mockGetUser },
    }),
}));

vi.mock("@/lib/nylas/client", () => ({
    revokeGrant: mockRevokeGrant,
}));

vi.mock("@/db", () => ({
    db: {
        select: mockDbSelect,
        delete: mockDbDelete,
    },
}));

function makeDelete(id: string) {
    return new NextRequest(`http://localhost/api/integrations/${id}`, { method: "DELETE" });
}

function params(id: string) {
    return { params: Promise.resolve({ id }) };
}

function authAs(userId = "user-1") {
    mockGetUser.mockResolvedValue({ data: { user: { id: userId } }, error: null });
}

function noAuth() {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
}

describe("DELETE /api/integrations/[id]", () => {
    beforeEach(() => vi.clearAllMocks());

    it("returns 401 when not authenticated", async () => {
        noAuth();
        const res = await DELETE(makeDelete("integ-1"), params("integ-1"));
        expect(res.status).toBe(401);
    });

    it("returns 404 when integration not found", async () => {
        authAs();
        // select returns empty array → no integration found
        const mockWhere = vi.fn().mockResolvedValue([]);
        const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
        mockDbSelect.mockReturnValue({ from: mockFrom });

        const res = await DELETE(makeDelete("bad-id"), params("bad-id"));
        expect(res.status).toBe(404);
    });

    it("revokes grant and deletes integration on success", async () => {
        authAs();
        const integration = { id: "integ-1", nylasGrantId: "grant-abc", userId: "user-1" };

        // select returns integration
        const mockSelectWhere = vi.fn().mockResolvedValue([integration]);
        const mockSelectFrom = vi.fn().mockReturnValue({ where: mockSelectWhere });
        mockDbSelect.mockReturnValue({ from: mockSelectFrom });

        // delete chain
        const mockDeleteWhere = vi.fn().mockResolvedValue(undefined);
        mockDbDelete.mockReturnValue({ where: mockDeleteWhere });

        mockRevokeGrant.mockResolvedValue(undefined);

        const res = await DELETE(makeDelete("integ-1"), params("integ-1"));
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.success).toBe(true);
        expect(mockRevokeGrant).toHaveBeenCalledWith("grant-abc");
        expect(mockDbDelete).toHaveBeenCalled();
    });

    it("returns 500 when delete throws", async () => {
        authAs();
        const integration = { id: "integ-1", nylasGrantId: "grant-abc", userId: "user-1" };

        const mockSelectWhere = vi.fn().mockResolvedValue([integration]);
        const mockSelectFrom = vi.fn().mockReturnValue({ where: mockSelectWhere });
        mockDbSelect.mockReturnValue({ from: mockSelectFrom });

        const mockDeleteWhere = vi.fn().mockRejectedValue(new Error("delete failed"));
        mockDbDelete.mockReturnValue({ where: mockDeleteWhere });

        mockRevokeGrant.mockResolvedValue(undefined);

        const res = await DELETE(makeDelete("integ-1"), params("integ-1"));
        expect(res.status).toBe(500);
    });
});
