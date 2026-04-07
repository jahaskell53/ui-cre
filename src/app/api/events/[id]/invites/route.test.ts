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
    return new NextRequest("http://localhost/api/events/evt-1/invites");
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

describe("GET /api/events/[id]/invites — auth", () => {
    beforeEach(() => vi.clearAllMocks());

    it("returns 401 when not authenticated", async () => {
        mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
        const res = await GET(makeRequest(), { params });
        expect(res.status).toBe(401);
    });
});

// ─── Event ownership ──────────────────────────────────────────────────────────

describe("GET /api/events/[id]/invites — event ownership", () => {
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

describe("GET /api/events/[id]/invites — happy path", () => {
    beforeEach(() => vi.clearAllMocks());

    it("returns invites for event owner", async () => {
        mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
        const inviteRow = { id: "inv-1", eventId: "evt-1", userId: "user-1", message: null, recipientCount: 3, createdAt: "now", recipientEmails: [] };

        let callCount = 0;
        mockDbSelect.mockImplementation(() => {
            callCount++;
            if (callCount === 1) {
                const mockWhere = vi.fn().mockResolvedValue([{ id: "evt-1", userId: "user-1" }]);
                return { from: vi.fn().mockReturnValue({ where: mockWhere }) };
            }
            const mockOrderBy = vi.fn().mockResolvedValue([inviteRow]);
            const mockWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
            return { from: vi.fn().mockReturnValue({ where: mockWhere }) };
        });

        const res = await GET(makeRequest(), { params });
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body[0].id).toBe("inv-1");
        expect(body[0].event_id).toBe("evt-1");
        expect(body[0].recipient_count).toBe(3);
    });

    it("returns empty array when no invites", async () => {
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
