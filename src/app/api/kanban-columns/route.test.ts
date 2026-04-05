import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET, PUT } from "./route";

const { mockGetUser, mockFrom } = vi.hoisted(() => ({
    mockGetUser: vi.fn(),
    mockFrom: vi.fn(),
}));

vi.mock("@/utils/supabase/server", () => ({
    createClient: vi.fn().mockResolvedValue({
        auth: { getUser: mockGetUser },
        from: mockFrom,
    }),
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
    beforeEach(() => vi.clearAllMocks());

    it("returns 401 when not authenticated", async () => {
        noAuth();
        const res = await GET(makeGet());
        expect(res.status).toBe(401);
    });

    it("returns stored columns", async () => {
        authAs();
        const columns = ["Prospect", "Active", "Closed"];
        const mockSingle = vi.fn().mockResolvedValue({ data: { columns }, error: null });
        const mockEq = vi.fn().mockReturnValue({ single: mockSingle });
        const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
        mockFrom.mockReturnValue({ select: mockSelect });

        const res = await GET(makeGet());
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.columns).toEqual(columns);
    });

    it("returns default columns when no record exists (PGRST116)", async () => {
        authAs();
        const mockSingle = vi.fn().mockResolvedValue({ data: null, error: { code: "PGRST116" } });
        const mockEq = vi.fn().mockReturnValue({ single: mockSingle });
        const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
        mockFrom.mockReturnValue({ select: mockSelect });

        const res = await GET(makeGet());
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.columns).toEqual(DEFAULT_COLUMNS);
    });

    it("returns 500 on unexpected DB error", async () => {
        authAs();
        const mockSingle = vi.fn().mockResolvedValue({ data: null, error: { code: "XX000", message: "DB error" } });
        const mockEq = vi.fn().mockReturnValue({ single: mockSingle });
        const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
        mockFrom.mockReturnValue({ select: mockSelect });

        const res = await GET(makeGet());
        expect(res.status).toBe(500);
    });
});

// ─── PUT ──────────────────────────────────────────────────────────────────────

describe("PUT /api/kanban-columns — validation", () => {
    beforeEach(() => vi.clearAllMocks());

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
    beforeEach(() => vi.clearAllMocks());

    it("updates existing record", async () => {
        authAs("user-1");
        const newCols = ["Col A", "Col B"];

        let callCount = 0;
        mockFrom.mockImplementation(() => {
            callCount++;
            if (callCount === 1) {
                // existence check
                const mockSingle = vi.fn().mockResolvedValue({ data: { id: "kk-1" }, error: null });
                const mockEq = vi.fn().mockReturnValue({ single: mockSingle });
                const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
                return { select: mockSelect };
            }
            // update
            const mockSingle = vi.fn().mockResolvedValue({ data: { columns: newCols }, error: null });
            const mockSelect = vi.fn().mockReturnValue({ single: mockSingle });
            const mockEq = vi.fn().mockReturnValue({ select: mockSelect });
            const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq });
            return { update: mockUpdate };
        });

        const res = await PUT(makePut({ columns: newCols }));
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.columns).toEqual(newCols);
    });

    it("inserts new record when none exists", async () => {
        authAs("user-1");
        const newCols = ["Col A", "Col B"];

        let callCount = 0;
        mockFrom.mockImplementation(() => {
            callCount++;
            if (callCount === 1) {
                // existence check returns null
                const mockSingle = vi.fn().mockResolvedValue({ data: null, error: { code: "PGRST116" } });
                const mockEq = vi.fn().mockReturnValue({ single: mockSingle });
                const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
                return { select: mockSelect };
            }
            // insert
            const mockSingle = vi.fn().mockResolvedValue({ data: { columns: newCols }, error: null });
            const mockSelect = vi.fn().mockReturnValue({ single: mockSingle });
            const mockInsert = vi.fn().mockReturnValue({ select: mockSelect });
            return { insert: mockInsert };
        });

        const res = await PUT(makePut({ columns: newCols }));
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.columns).toEqual(newCols);
    });

    it("trims whitespace from column names", async () => {
        authAs("user-1");

        let callCount = 0;
        let capturedColumns: string[] | null = null;
        mockFrom.mockImplementation(() => {
            callCount++;
            if (callCount === 1) {
                const mockSingle = vi.fn().mockResolvedValue({ data: { id: "kk-1" }, error: null });
                const mockEq = vi.fn().mockReturnValue({ single: mockSingle });
                const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
                return { select: mockSelect };
            }
            const mockSingle = vi.fn().mockResolvedValue({ data: { columns: ["Col A"] }, error: null });
            const mockSelect = vi.fn().mockReturnValue({ single: mockSingle });
            const mockEq = vi.fn().mockReturnValue({ select: mockSelect });
            const mockUpdate = vi.fn().mockImplementation((data) => {
                capturedColumns = data.columns;
                return { eq: mockEq };
            });
            return { update: mockUpdate };
        });

        await PUT(makePut({ columns: ["  Col A  "] }));
        expect(capturedColumns).toEqual(["Col A"]);
    });
});
