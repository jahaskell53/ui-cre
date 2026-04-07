import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DELETE, GET, POST } from "./route";

const { mockGetUser, mockDbSelect, mockDbInsert, mockDbDelete } = vi.hoisted(() => ({
    mockGetUser: vi.fn(),
    mockDbSelect: vi.fn(),
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
        select: mockDbSelect,
        insert: mockDbInsert,
        delete: mockDbDelete,
    },
}));

function makeGetRequest(params?: Record<string, string>) {
    const url = new URL("http://localhost/api/posts");
    if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    return new NextRequest(url.toString());
}

function makePostRequest(body: Record<string, unknown>) {
    return new NextRequest("http://localhost/api/posts", {
        method: "POST",
        body: JSON.stringify(body),
    });
}

function makeDeleteRequest(params?: Record<string, string>) {
    const url = new URL("http://localhost/api/posts");
    if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    return new NextRequest(url.toString(), { method: "DELETE" });
}

describe("GET /api/posts", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("returns list of posts", async () => {
        const mockOrderBy = vi.fn().mockResolvedValue([
            {
                id: "post-1",
                userId: "user-1",
                type: "post",
                content: "Hello",
                fileUrl: null,
                createdAt: "2024-01-01",
                updatedAt: "2024-01-01",
                profile: { fullName: "Alice", avatarUrl: null },
            },
        ]);
        const mockLeftJoin = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
        const mockFrom = vi.fn().mockReturnValue({ leftJoin: mockLeftJoin });
        mockDbSelect.mockReturnValue({ from: mockFrom });

        // Second select for likes
        const mockLikesWhere = vi.fn().mockResolvedValue([]);
        const mockLikesFrom = vi.fn().mockReturnValue({ where: mockLikesWhere });

        // Third select for comments
        const mockCommentsWhere = vi.fn().mockResolvedValue([]);
        const mockCommentsFrom = vi.fn().mockReturnValue({ where: mockCommentsWhere });

        let selectCallCount = 0;
        mockDbSelect.mockImplementation(() => {
            selectCallCount++;
            if (selectCallCount === 1) {
                return { from: mockFrom };
            }
            if (selectCallCount === 2) {
                return { from: mockLikesFrom };
            }
            return { from: mockCommentsFrom };
        });

        const res = await GET(makeGetRequest());
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(Array.isArray(body)).toBe(true);
    });
});

describe("POST /api/posts", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("returns 401 if not authenticated", async () => {
        mockGetUser.mockResolvedValue({ data: { user: null }, error: { message: "Not authenticated" } });
        const res = await POST(makePostRequest({ content: "Hello" }));
        expect(res.status).toBe(401);
    });

    it("returns 400 if content is missing", async () => {
        mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
        const res = await POST(makePostRequest({}));
        expect(res.status).toBe(400);
    });

    it("creates post successfully", async () => {
        mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });

        const mockPost = { id: "post-1", userId: "user-1", type: "post", content: "Hello", fileUrl: null, createdAt: "now", updatedAt: "now" };
        const mockReturning = vi.fn().mockResolvedValue([mockPost]);
        const mockValues = vi.fn().mockReturnValue({ returning: mockReturning });
        mockDbInsert.mockReturnValue({ values: mockValues });

        const res = await POST(makePostRequest({ content: "Hello" }));
        const body = await res.json();

        expect(res.status).toBe(201);
        expect(body.id).toBe("post-1");
        expect(body.content).toBe("Hello");
    });
});

describe("DELETE /api/posts", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("returns 401 if not authenticated", async () => {
        mockGetUser.mockResolvedValue({ data: { user: null }, error: { message: "Not authenticated" } });
        const res = await DELETE(makeDeleteRequest({ id: "post-1" }));
        expect(res.status).toBe(401);
    });

    it("returns 400 if id is missing", async () => {
        mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
        const res = await DELETE(makeDeleteRequest());
        expect(res.status).toBe(400);
    });

    it("deletes post successfully", async () => {
        mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });

        const mockReturning = vi.fn().mockResolvedValue([{ id: "post-1" }]);
        const mockWhere = vi.fn().mockReturnValue({ returning: mockReturning });
        mockDbDelete.mockReturnValue({ where: mockWhere });

        const res = await DELETE(makeDeleteRequest({ id: "post-1" }));
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.success).toBe(true);
    });

    it("returns 404 when post not found", async () => {
        mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });

        const mockReturning = vi.fn().mockResolvedValue([]);
        const mockWhere = vi.fn().mockReturnValue({ returning: mockReturning });
        mockDbDelete.mockReturnValue({ where: mockWhere });

        const res = await DELETE(makeDeleteRequest({ id: "nonexistent" }));
        expect(res.status).toBe(404);
    });
});
