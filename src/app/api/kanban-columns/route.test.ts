import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET, PUT } from "./route";

const { mockGetUser, mockDbSelect, mockDbInsert, mockDbUpdate } = vi.hoisted(() => ({
    mockGetUser: vi.fn(),
    mockDbSelect: vi.fn(),
    mockDbInsert: vi.fn(),
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
        insert: mockDbInsert,
        update: mockDbUpdate,
    },
}));

function makeGet() {
    return new NextRequest("http://localhost/api/kanban-columns");
}

function makePut(body: Record<string, unknown>) {
    return new NextRequest("http://localhost/api/kanban-columns", {
        method: "PUT",
        body: JSON.stringify(body),
    });
}

function authAs(userId = "user-1") {
    mockGetUser.mockResolvedValue({ data: { user: { id: userId } }, error: null });
}

function noAuth() {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
}

const DEFAULT_COLUMNS = ["Active Prospecting", "Offering Memorandum", "Underwriting", "Due Diligence", "Closed/Archive"];

// ─── GET ──────────────────────────────────────────────────────────────────────

describe("GET /api/kanban-columns", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("returns 401 when not authenticated", async () => {
        noAuth();
        const res = await GET(makeGet());
        expect(res.status).toBe(401);
    });

    it("returns stored columns", async () => {
        authAs();
        const columns = ["Prospect", "Active", "Closed"];
        const mockWhere = vi.fn().mockResolvedValue([{ columns }]);
        const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
        mockDbSelect.mockReturnValue({ from: mockFrom });

        const res = await GET(makeGet());
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.columns).toEqual(columns);
    });

    it("returns default columns when no record exists", async () => {
        authAs();
        const mockWhere = vi.fn().mockResolvedValue([]);
        const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
        mockDbSelect.mockReturnValue({ from: mockFrom });

        const res = await GET(makeGet());
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.columns).toEqual(DEFAULT_COLUMNS);
    });

    it("returns 500 on DB error", async () => {
        authAs();
        const mockWhere = vi.fn().mockRejectedValue(new Error("DB error"));
        const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
        mockDbSelect.mockReturnValue({ from: mockFrom });

        const res = await GET(makeGet());
        expect(res.status).toBe(500);
    });
});

// ─── PUT ──────────────────────────────────────────────────────────────────────

describe("PUT /api/kanban-columns — validation", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("returns 401 when not authenticated", async () => {
        noAuth();
        const res = await PUT(makePut({ columns: ["A"] }));
        expect(res.status).toBe(401);
    });

    it("returns 400 when columns is not an array", async () => {
        authAs();
        const res = await PUT(makePut({ columns: "not an array" }));
        expect(res.status).toBe(400);
    });

    it("returns 400 when columns array is empty", async () => {
        authAs();
        const res = await PUT(makePut({ columns: [] }));
        expect(res.status).toBe(400);
    });

    it("returns 400 when a column is blank", async () => {
        authAs();
        const res = await PUT(makePut({ columns: ["Valid", "  "] }));
        expect(res.status).toBe(400);
    });
});

describe("PUT /api/kanban-columns — upsert", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("updates existing record", async () => {
        authAs("user-1");
        const newCols = ["Col A", "Col B"];

        // existence check — found
        const mockExistWhere = vi.fn().mockResolvedValue([{ id: "kk-1" }]);
        const mockExistFrom = vi.fn().mockReturnValue({ where: mockExistWhere });
        mockDbSelect.mockReturnValue({ from: mockExistFrom });

        // update
        const mockUpdateReturning = vi.fn().mockResolvedValue([{ columns: newCols }]);
        const mockUpdateWhere = vi.fn().mockReturnValue({ returning: mockUpdateReturning });
        const mockUpdateSet = vi.fn().mockReturnValue({ where: mockUpdateWhere });
        mockDbUpdate.mockReturnValue({ set: mockUpdateSet });

        const res = await PUT(makePut({ columns: newCols }));
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.columns).toEqual(newCols);
    });

    it("inserts new record when none exists", async () => {
        authAs("user-1");
        const newCols = ["Col A", "Col B"];

        // existence check — not found
        const mockExistWhere = vi.fn().mockResolvedValue([]);
        const mockExistFrom = vi.fn().mockReturnValue({ where: mockExistWhere });
        mockDbSelect.mockReturnValue({ from: mockExistFrom });

        // insert
        const mockInsertReturning = vi.fn().mockResolvedValue([{ columns: newCols }]);
        const mockInsertValues = vi.fn().mockReturnValue({ returning: mockInsertReturning });
        mockDbInsert.mockReturnValue({ values: mockInsertValues });

        const res = await PUT(makePut({ columns: newCols }));
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.columns).toEqual(newCols);
    });

    it("trims whitespace from column names", async () => {
        authAs("user-1");

        const mockExistWhere = vi.fn().mockResolvedValue([{ id: "kk-1" }]);
        const mockExistFrom = vi.fn().mockReturnValue({ where: mockExistWhere });
        mockDbSelect.mockReturnValue({ from: mockExistFrom });

        let capturedColumns: string[] | undefined;
        const mockUpdateReturning = vi.fn().mockResolvedValue([{ columns: ["Col A"] }]);
        const mockUpdateWhere = vi.fn().mockReturnValue({ returning: mockUpdateReturning });
        const mockUpdateSet = vi.fn().mockImplementation((data) => {
            capturedColumns = data.columns;
            return { where: mockUpdateWhere };
        });
        mockDbUpdate.mockReturnValue({ set: mockUpdateSet });

        await PUT(makePut({ columns: ["  Col A  "] }));
        expect(capturedColumns).toEqual(["Col A"]);
    });
});
