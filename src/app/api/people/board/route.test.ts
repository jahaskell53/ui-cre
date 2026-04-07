import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DELETE, GET, POST, PUT } from "./route";

const { mockGetUser, mockFrom, mockDb } = vi.hoisted(() => ({
    mockGetUser: vi.fn(),
    mockFrom: vi.fn(),
    mockDb: {
        select: vi.fn(),
    },
}));

vi.mock("@/utils/supabase/server", () => ({
    createClient: vi.fn().mockResolvedValue({
        auth: { getUser: mockGetUser },
        from: mockFrom,
    }),
}));

vi.mock("@/db", () => ({
    db: mockDb,
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

function url(params?: Record<string, string>) {
    const u = new URL("http://localhost/api/people/board");
    if (params) Object.entries(params).forEach(([k, v]) => u.searchParams.set(k, v));
    return u.toString();
}

function makeGet(params?: Record<string, string>) {
    return new NextRequest(url(params));
}

function makePost(body: Record<string, unknown>) {
    return new NextRequest("http://localhost/api/people/board", {
        method: "POST",
        body: JSON.stringify(body),
    });
}

function makePut(body: Record<string, unknown>) {
    return new NextRequest("http://localhost/api/people/board", {
        method: "PUT",
        body: JSON.stringify(body),
    });
}

function makeDelete(params?: Record<string, string>) {
    return new NextRequest(url(params), { method: "DELETE" });
}

function authAs(userId = "user-1") {
    mockGetUser.mockResolvedValue({ data: { user: { id: userId } }, error: null });
}

function noAuth() {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
}

// ─── GET ──────────────────────────────────────────────────────────────────────

describe("GET /api/people/board", () => {
    beforeEach(() => vi.clearAllMocks());

    it("returns 401 when not authenticated", async () => {
        noAuth();
        const res = await GET(makeGet());
        expect(res.status).toBe(401);
    });

    it("returns assignments grouped by column", async () => {
        authAs();
        const mockEq = vi.fn().mockResolvedValue({
            data: [
                { person_id: "p-1", column_id: "col-a" },
                { person_id: "p-2", column_id: "col-a" },
                { person_id: "p-3", column_id: "col-b" },
            ],
            error: null,
        });
        const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
        mockFrom.mockReturnValue({ select: mockSelect });

        const res = await GET(makeGet());
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body["col-a"]).toEqual(["p-1", "p-2"]);
        expect(body["col-b"]).toEqual(["p-3"]);
    });

    it("returns empty object when no assignments", async () => {
        authAs();
        const mockEq = vi.fn().mockResolvedValue({ data: [], error: null });
        const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
        mockFrom.mockReturnValue({ select: mockSelect });

        const res = await GET(makeGet());
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body).toEqual({});
    });

    it("returns 500 when DB fetch fails", async () => {
        authAs();
        const mockEq = vi.fn().mockResolvedValue({ data: null, error: { message: "DB error" } });
        const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
        mockFrom.mockReturnValue({ select: mockSelect });

        const res = await GET(makeGet());
        expect(res.status).toBe(500);
    });
});

// ─── POST ─────────────────────────────────────────────────────────────────────

describe("POST /api/people/board", () => {
    beforeEach(() => vi.clearAllMocks());

    it("returns 401 when not authenticated", async () => {
        noAuth();
        const res = await POST(makePost({ personId: "p-1", columnId: "col-a" }));
        expect(res.status).toBe(401);
    });

    it("returns 400 when personId or columnId is missing", async () => {
        authAs();
        const res = await POST(makePost({ personId: "p-1" }));
        expect(res.status).toBe(400);
    });

    it("returns 404 when person not found", async () => {
        authAs();
        // Drizzle select returns empty array → person not found
        const mockWhere = vi.fn().mockResolvedValue([]);
        const mockFrom2 = vi.fn().mockReturnValue({ where: mockWhere });
        mockDb.select.mockReturnValue({ from: mockFrom2 });

        const res = await POST(makePost({ personId: "p-1", columnId: "col-a" }));
        expect(res.status).toBe(404);
    });

    it("upserts assignment and returns it", async () => {
        authAs("user-1");
        const assignment = { user_id: "user-1", person_id: "p-1", column_id: "col-a" };

        // Drizzle select returns the person
        const mockWhere = vi.fn().mockResolvedValue([{ id: "p-1" }]);
        const mockFrom2 = vi.fn().mockReturnValue({ where: mockWhere });
        mockDb.select.mockReturnValue({ from: mockFrom2 });

        // Supabase upsert for board assignments
        const mockSingle = vi.fn().mockResolvedValue({ data: assignment, error: null });
        const mockSelect = vi.fn().mockReturnValue({ single: mockSingle });
        const mockUpsert = vi.fn().mockReturnValue({ select: mockSelect });
        mockFrom.mockReturnValue({ upsert: mockUpsert });

        const res = await POST(makePost({ personId: "p-1", columnId: "col-a" }));
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body).toEqual(assignment);
    });
});

// ─── PUT ──────────────────────────────────────────────────────────────────────

describe("PUT /api/people/board", () => {
    beforeEach(() => vi.clearAllMocks());

    it("returns 401 when not authenticated", async () => {
        noAuth();
        const res = await PUT(makePut({ personId: "p-1", oldColumnId: "col-a", newColumnId: "col-b" }));
        expect(res.status).toBe(401);
    });

    it("returns 400 when required fields are missing", async () => {
        authAs();
        const res = await PUT(makePut({ personId: "p-1", oldColumnId: "col-a" }));
        expect(res.status).toBe(400);
    });

    it("moves person to new column", async () => {
        authAs("user-1");
        const newAssignment = { user_id: "user-1", person_id: "p-1", column_id: "col-b" };

        let deleteCallCount = 0;
        mockFrom.mockImplementation((table: string) => {
            if (table === "people_board_assignments") {
                if (deleteCallCount === 0) {
                    deleteCallCount++;
                    const mockEq3 = vi.fn().mockResolvedValue({ error: null });
                    const mockEq2 = vi.fn().mockReturnValue({ eq: mockEq3 });
                    const mockEq1 = vi.fn().mockReturnValue({ eq: mockEq2 });
                    const mockDelete = vi.fn().mockReturnValue({ eq: mockEq1 });
                    return { delete: mockDelete };
                }
                const mockSingle = vi.fn().mockResolvedValue({ data: newAssignment, error: null });
                const mockSelect = vi.fn().mockReturnValue({ single: mockSingle });
                const mockInsert = vi.fn().mockReturnValue({ select: mockSelect });
                return { insert: mockInsert };
            }
            return {};
        });

        const res = await PUT(makePut({ personId: "p-1", oldColumnId: "col-a", newColumnId: "col-b" }));
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.column_id).toBe("col-b");
    });

    it("returns 500 when delete fails", async () => {
        authAs("user-1");
        const mockEq3 = vi.fn().mockResolvedValue({ error: { message: "DB error" } });
        const mockEq2 = vi.fn().mockReturnValue({ eq: mockEq3 });
        const mockEq1 = vi.fn().mockReturnValue({ eq: mockEq2 });
        const mockDelete = vi.fn().mockReturnValue({ eq: mockEq1 });
        mockFrom.mockReturnValue({ delete: mockDelete });

        const res = await PUT(makePut({ personId: "p-1", oldColumnId: "col-a", newColumnId: "col-b" }));
        expect(res.status).toBe(500);
    });
});

// ─── DELETE ───────────────────────────────────────────────────────────────────

describe("DELETE /api/people/board", () => {
    beforeEach(() => vi.clearAllMocks());

    it("returns 401 when not authenticated", async () => {
        noAuth();
        const res = await DELETE(makeDelete({ personId: "p-1", columnId: "col-a" }));
        expect(res.status).toBe(401);
    });

    it("returns 400 when personId or columnId is missing", async () => {
        authAs();
        const res = await DELETE(makeDelete({ personId: "p-1" }));
        expect(res.status).toBe(400);
    });

    it("deletes assignment and returns success", async () => {
        authAs("user-1");
        const mockEq3 = vi.fn().mockResolvedValue({ error: null });
        const mockEq2 = vi.fn().mockReturnValue({ eq: mockEq3 });
        const mockEq1 = vi.fn().mockReturnValue({ eq: mockEq2 });
        const mockDelete = vi.fn().mockReturnValue({ eq: mockEq1 });
        mockFrom.mockReturnValue({ delete: mockDelete });

        const res = await DELETE(makeDelete({ personId: "p-1", columnId: "col-a" }));
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.success).toBe(true);
    });

    it("returns 500 when DB delete fails", async () => {
        authAs("user-1");
        const mockEq3 = vi.fn().mockResolvedValue({ error: { message: "DB error" } });
        const mockEq2 = vi.fn().mockReturnValue({ eq: mockEq3 });
        const mockEq1 = vi.fn().mockReturnValue({ eq: mockEq2 });
        const mockDelete = vi.fn().mockReturnValue({ eq: mockEq1 });
        mockFrom.mockReturnValue({ delete: mockDelete });

        const res = await DELETE(makeDelete({ personId: "p-1", columnId: "col-a" }));
        expect(res.status).toBe(500);
    });
});
