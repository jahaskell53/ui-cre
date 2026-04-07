import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DELETE, POST } from "./route";

const { mockGetUser, mockDbInsert, mockDbDelete } = vi.hoisted(() => ({
    mockGetUser: vi.fn(),
    mockDbInsert: vi.fn(),
    mockDbDelete: vi.fn(),
}));

vi.mock("@/utils/supabase/server", () => ({
    createClient: vi.fn().mockResolvedValue({
        auth: { getUser: mockGetUser },
    }),
}));

vi.mock("@/db", () => ({
    db: {
        insert: mockDbInsert,
        delete: mockDbDelete,
    },
}));

function makePostRequest(body: Record<string, unknown>) {
    return new NextRequest("http://localhost/api/likes", {
        method: "POST",
        body: JSON.stringify(body),
    });
}

function makeDeleteRequest(params?: Record<string, string>) {
    const url = new URL("http://localhost/api/likes");
    if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    return new NextRequest(url.toString(), { method: "DELETE" });
}

describe("POST /api/likes", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("returns 401 if not authenticated", async () => {
        mockGetUser.mockResolvedValue({ data: { user: null }, error: { message: "Not authenticated" } });
        const res = await POST(makePostRequest({ post_id: "post-1" }));
        expect(res.status).toBe(401);
    });

    it("returns 400 if post_id is missing", async () => {
        mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
        const res = await POST(makePostRequest({}));
        expect(res.status).toBe(400);
    });

    it("creates like successfully", async () => {
        mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });

        const mockReturning = vi.fn().mockResolvedValue([{ postId: "post-1", userId: "user-1" }]);
        const mockOnConflict = vi.fn().mockReturnValue({ returning: mockReturning });
        const mockValues = vi.fn().mockReturnValue({ onConflictDoNothing: mockOnConflict });
        mockDbInsert.mockReturnValue({ values: mockValues });

        const res = await POST(makePostRequest({ post_id: "post-1" }));
        const body = await res.json();

        expect(res.status).toBe(201);
        expect(body.success).toBe(true);
    });
});

describe("DELETE /api/likes", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("returns 401 if not authenticated", async () => {
        mockGetUser.mockResolvedValue({ data: { user: null }, error: { message: "Not authenticated" } });
        const res = await DELETE(makeDeleteRequest({ post_id: "post-1" }));
        expect(res.status).toBe(401);
    });

    it("returns 400 if post_id is missing", async () => {
        mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
        const res = await DELETE(makeDeleteRequest());
        expect(res.status).toBe(400);
    });

    it("deletes like successfully", async () => {
        mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });

        const mockWhere = vi.fn().mockResolvedValue(undefined);
        mockDbDelete.mockReturnValue({ where: mockWhere });

        const res = await DELETE(makeDeleteRequest({ post_id: "post-1" }));
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.success).toBe(true);
    });
});
