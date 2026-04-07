import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DELETE, GET, POST, PUT } from "./route";

const { mockGetUser, mockDbSelect, mockDbInsert, mockDbUpdate, mockDbDelete } = vi.hoisted(() => ({
    mockGetUser: vi.fn(),
    mockDbSelect: vi.fn(),
    mockDbInsert: vi.fn(),
    mockDbUpdate: vi.fn(),
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
        update: mockDbUpdate,
        delete: mockDbDelete,
    },
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
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("returns 401 when not authenticated", async () => {
        noAuth();
        const res = await GET(makeGet());
        expect(res.status).toBe(401);
    });

    it("returns assignments grouped by column", async () => {
        authAs();
        const mockWhere = vi.fn().mockResolvedValue([
            { personId: "p-1", columnId: "col-a" },
            { personId: "p-2", columnId: "col-a" },
            { personId: "p-3", columnId: "col-b" },
        ]);
        const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
        mockDbSelect.mockReturnValue({ from: mockFrom });

        const res = await GET(makeGet());
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body["col-a"]).toEqual(["p-1", "p-2"]);
        expect(body["col-b"]).toEqual(["p-3"]);
    });

    it("returns empty object when no assignments", async () => {
        authAs();
        const mockWhere = vi.fn().mockResolvedValue([]);
        const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
        mockDbSelect.mockReturnValue({ from: mockFrom });

        const res = await GET(makeGet());
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body).toEqual({});
    });

    it("returns 500 when DB fetch fails", async () => {
        authAs();
        const mockWhere = vi.fn().mockRejectedValue(new Error("DB error"));
        const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
        mockDbSelect.mockReturnValue({ from: mockFrom });

        const res = await GET(makeGet());
        expect(res.status).toBe(500);
    });
});

// ─── POST ─────────────────────────────────────────────────────────────────────

describe("POST /api/people/board", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

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
        const mockWhere = vi.fn().mockResolvedValue([]);
        const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
        mockDbSelect.mockReturnValue({ from: mockFrom });

        const res = await POST(makePost({ personId: "p-1", columnId: "col-a" }));
        expect(res.status).toBe(404);
    });

    it("inserts assignment and returns it", async () => {
        authAs("user-1");
        const assignmentRow = { id: "asn-1", userId: "user-1", personId: "p-1", columnId: "col-a" };

        const mockWhere = vi.fn().mockResolvedValue([{ id: "p-1" }]);
        const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
        mockDbSelect.mockReturnValue({ from: mockFrom });

        const mockReturning = vi.fn().mockResolvedValue([assignmentRow]);
        const mockOnConflict = vi.fn().mockReturnValue({ returning: mockReturning });
        const mockValues = vi.fn().mockReturnValue({ onConflictDoNothing: mockOnConflict });
        mockDbInsert.mockReturnValue({ values: mockValues });

        const res = await POST(makePost({ personId: "p-1", columnId: "col-a" }));
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.person_id).toBe("p-1");
        expect(body.column_id).toBe("col-a");
    });
});

// ─── PUT ──────────────────────────────────────────────────────────────────────

describe("PUT /api/people/board", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

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
        const newAssignmentRow = { id: "asn-1", userId: "user-1", personId: "p-1", columnId: "col-b" };

        const mockDeleteWhere = vi.fn().mockResolvedValue(undefined);
        mockDbDelete.mockReturnValue({ where: mockDeleteWhere });

        const mockReturning = vi.fn().mockResolvedValue([newAssignmentRow]);
        const mockValues = vi.fn().mockReturnValue({ returning: mockReturning });
        mockDbInsert.mockReturnValue({ values: mockValues });

        const res = await PUT(makePut({ personId: "p-1", oldColumnId: "col-a", newColumnId: "col-b" }));
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.column_id).toBe("col-b");
    });

    it("returns 500 when insert returns empty", async () => {
        authAs("user-1");

        const mockDeleteWhere = vi.fn().mockResolvedValue(undefined);
        mockDbDelete.mockReturnValue({ where: mockDeleteWhere });

        const mockReturning = vi.fn().mockResolvedValue([]);
        const mockValues = vi.fn().mockReturnValue({ returning: mockReturning });
        mockDbInsert.mockReturnValue({ values: mockValues });

        const res = await PUT(makePut({ personId: "p-1", oldColumnId: "col-a", newColumnId: "col-b" }));
        expect(res.status).toBe(500);
    });
});

// ─── DELETE ───────────────────────────────────────────────────────────────────

describe("DELETE /api/people/board", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

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
        const mockWhere = vi.fn().mockResolvedValue(undefined);
        mockDbDelete.mockReturnValue({ where: mockWhere });

        const res = await DELETE(makeDelete({ personId: "p-1", columnId: "col-a" }));
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.success).toBe(true);
    });

    it("returns 500 on DB delete error", async () => {
        authAs("user-1");
        const mockWhere = vi.fn().mockRejectedValue(new Error("DB error"));
        mockDbDelete.mockReturnValue({ where: mockWhere });

        const res = await DELETE(makeDelete({ personId: "p-1", columnId: "col-a" }));
        expect(res.status).toBe(500);
    });
});
