import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const { mockGetUser, mockDbSelect } = vi.hoisted(() => ({
    mockGetUser: vi.fn(),
    mockDbSelect: vi.fn(),
}));

vi.mock("@/utils/supabase/server", () => ({
    createClient: vi.fn().mockResolvedValue({
        auth: { getUser: mockGetUser },
    }),
}));

vi.mock("@/db", () => ({
    db: {
        select: mockDbSelect,
    },
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

const params = Promise.resolve({ id: "evt-1" });

function makeRequest() {
    return new NextRequest("http://localhost/api/events/evt-1/blasts");
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

describe("GET /api/events/[id]/blasts — auth", () => {
    beforeEach(() => vi.clearAllMocks());

    it("returns 401 when not authenticated", async () => {
        mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
        const res = await GET(makeRequest(), { params });
        expect(res.status).toBe(401);
    });
});

// ─── Event ownership ──────────────────────────────────────────────────────────

describe("GET /api/events/[id]/blasts — event ownership", () => {
    beforeEach(() => vi.clearAllMocks());

    it("returns 404 when event not found", async () => {
        mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
        const mockWhere = vi.fn().mockResolvedValue([]);
        const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
        mockDbSelect.mockReturnValue({ from: mockFrom });

        const res = await GET(makeRequest(), { params });
        expect(res.status).toBe(404);
    });

    it("returns 403 when user does not own the event", async () => {
        mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
        const mockWhere = vi.fn().mockResolvedValue([{ id: "evt-1", userId: "other-user" }]);
        const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
        mockDbSelect.mockReturnValue({ from: mockFrom });

        const res = await GET(makeRequest(), { params });
        expect(res.status).toBe(403);
    });
});

// ─── Happy path ───────────────────────────────────────────────────────────────

describe("GET /api/events/[id]/blasts — happy path", () => {
    beforeEach(() => vi.clearAllMocks());

    it("returns blasts for event owner", async () => {
        mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
        const blastRow = {
            id: "blast-1",
            eventId: "evt-1",
            userId: "user-1",
            subject: "s",
            message: "m",
            recipientCount: 5,
            sentCount: 5,
            failedCount: 0,
            createdAt: "now",
        };

        let callCount = 0;
        mockDbSelect.mockImplementation(() => {
            callCount++;
            if (callCount === 1) {
                const mockWhere = vi.fn().mockResolvedValue([{ id: "evt-1", userId: "user-1" }]);
                return { from: vi.fn().mockReturnValue({ where: mockWhere }) };
            }
            const mockOrderBy = vi.fn().mockResolvedValue([blastRow]);
            const mockWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
            return { from: vi.fn().mockReturnValue({ where: mockWhere }) };
        });

        const res = await GET(makeRequest(), { params });
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body[0].id).toBe("blast-1");
        expect(body[0].event_id).toBe("evt-1");
    });

    it("returns empty array when no blasts", async () => {
        mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });

        let callCount = 0;
        mockDbSelect.mockImplementation(() => {
            callCount++;
            if (callCount === 1) {
                const mockWhere = vi.fn().mockResolvedValue([{ id: "evt-1", userId: "user-1" }]);
                return { from: vi.fn().mockReturnValue({ where: mockWhere }) };
            }
            const mockOrderBy = vi.fn().mockResolvedValue([]);
            const mockWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
            return { from: vi.fn().mockReturnValue({ where: mockWhere }) };
        });

        const res = await GET(makeRequest(), { params });
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body).toEqual([]);
    });

    it("returns 500 on DB error", async () => {
        mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });

        let callCount = 0;
        mockDbSelect.mockImplementation(() => {
            callCount++;
            if (callCount === 1) {
                const mockWhere = vi.fn().mockResolvedValue([{ id: "evt-1", userId: "user-1" }]);
                return { from: vi.fn().mockReturnValue({ where: mockWhere }) };
            }
            const mockOrderBy = vi.fn().mockRejectedValue(new Error("DB error"));
            const mockWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
            return { from: vi.fn().mockReturnValue({ where: mockWhere }) };
        });

        const res = await GET(makeRequest(), { params });
        expect(res.status).toBe(500);
    });
});
