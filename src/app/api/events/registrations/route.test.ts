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

// ─── Helpers ─────────────────────────────────────────────────────────────────

function url(params?: Record<string, string>) {
    const u = new URL("http://localhost/api/events/registrations");
    if (params) Object.entries(params).forEach(([k, v]) => u.searchParams.set(k, v));
    return u.toString();
}

function makeGet(params?: Record<string, string>) {
    return new NextRequest(url(params));
}

function makePost(body: Record<string, unknown>) {
    return new NextRequest("http://localhost/api/events/registrations", {
        method: "POST",
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

describe("GET /api/events/registrations — validation", () => {
    beforeEach(() => vi.clearAllMocks());

    it("returns 400 when event_id is missing", async () => {
        noAuth();
        const res = await GET(makeGet());
        expect(res.status).toBe(400);
    });
});

describe("GET /api/events/registrations — unauthenticated", () => {
    beforeEach(() => vi.clearAllMocks());

    it("returns count without registration status for unauthenticated users", async () => {
        noAuth();
        const mockWhere = vi.fn().mockResolvedValue([{ value: 5 }]);
        const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
        mockDbSelect.mockReturnValue({ from: mockFrom });

        const res = await GET(makeGet({ event_id: "evt-1" }));
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.is_registered).toBe(false);
        expect(body.count).toBe(5);
        expect(body.registration).toBeNull();
    });
});

describe("GET /api/events/registrations — authenticated", () => {
    beforeEach(() => vi.clearAllMocks());

    it("returns is_registered=true when user is registered", async () => {
        authAs("user-1");

        let callCount = 0;
        mockDbSelect.mockImplementation(() => {
            callCount++;
            if (callCount === 1) {
                // user registration check
                const mockWhere = vi.fn().mockResolvedValue([{ id: "reg-1", createdAt: "now" }]);
                return { from: vi.fn().mockReturnValue({ where: mockWhere }) };
            }
            // count query
            const mockWhere = vi.fn().mockResolvedValue([{ value: 3 }]);
            return { from: vi.fn().mockReturnValue({ where: mockWhere }) };
        });

        const res = await GET(makeGet({ event_id: "evt-1" }));
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.is_registered).toBe(true);
        expect(body.count).toBe(3);
    });

    it("returns is_registered=false when user is not registered", async () => {
        authAs("user-1");

        let callCount = 0;
        mockDbSelect.mockImplementation(() => {
            callCount++;
            if (callCount === 1) {
                const mockWhere = vi.fn().mockResolvedValue([]);
                return { from: vi.fn().mockReturnValue({ where: mockWhere }) };
            }
            const mockWhere = vi.fn().mockResolvedValue([{ value: 0 }]);
            return { from: vi.fn().mockReturnValue({ where: mockWhere }) };
        });

        const res = await GET(makeGet({ event_id: "evt-1" }));
        const body = await res.json();

        expect(body.is_registered).toBe(false);
    });
});

// ─── POST ─────────────────────────────────────────────────────────────────────

describe("POST /api/events/registrations — auth & validation", () => {
    beforeEach(() => vi.clearAllMocks());

    it("returns 401 when not authenticated", async () => {
        noAuth();
        const res = await POST(makePost({ event_id: "evt-1" }));
        expect(res.status).toBe(401);
    });

    it("returns 400 when event_id is missing", async () => {
        authAs();
        const res = await POST(makePost({}));
        expect(res.status).toBe(400);
    });
});

describe("POST /api/events/registrations — happy path", () => {
    beforeEach(() => vi.clearAllMocks());

    it("registers user and returns registration", async () => {
        authAs("user-1");
        const reg = { id: "reg-1", eventId: "evt-1", userId: "user-1", createdAt: "now" };

        mockDbSelect.mockImplementation(() => {
            const mockWhere = vi.fn().mockResolvedValue([{ id: "evt-1", startTime: "2024-06-01T10:00:00Z" }]);
            return { from: vi.fn().mockReturnValue({ where: mockWhere }) };
        });

        const mockReturning = vi.fn().mockResolvedValue([reg]);
        const mockValues = vi.fn().mockReturnValue({ returning: mockReturning });
        mockDbInsert.mockReturnValue({ values: mockValues });

        const res = await POST(makePost({ event_id: "evt-1" }));
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.success).toBe(true);
        expect(body.registration.id).toBe("reg-1");
    });

    it("returns 404 when event not found", async () => {
        authAs("user-1");
        mockDbSelect.mockImplementation(() => {
            const mockWhere = vi.fn().mockResolvedValue([]);
            return { from: vi.fn().mockReturnValue({ where: mockWhere }) };
        });

        const res = await POST(makePost({ event_id: "evt-1" }));
        expect(res.status).toBe(404);
    });

    it("returns 409 when already registered (duplicate key)", async () => {
        authAs("user-1");

        mockDbSelect.mockImplementation(() => {
            const mockWhere = vi.fn().mockResolvedValue([{ id: "evt-1", startTime: "t" }]);
            return { from: vi.fn().mockReturnValue({ where: mockWhere }) };
        });

        const mockReturning = vi.fn().mockRejectedValue(Object.assign(new Error("duplicate"), { code: "23505" }));
        const mockValues = vi.fn().mockReturnValue({ returning: mockReturning });
        mockDbInsert.mockReturnValue({ values: mockValues });

        const res = await POST(makePost({ event_id: "evt-1" }));
        expect(res.status).toBe(409);
    });
});

// ─── DELETE ───────────────────────────────────────────────────────────────────

describe("DELETE /api/events/registrations", () => {
    beforeEach(() => vi.clearAllMocks());

    it("returns 401 when not authenticated", async () => {
        noAuth();
        const res = await DELETE(makeDelete({ event_id: "evt-1" }));
        expect(res.status).toBe(401);
    });

    it("returns 400 when event_id is missing", async () => {
        authAs();
        const res = await DELETE(makeDelete());
        expect(res.status).toBe(400);
    });

    it("unregisters user and returns success", async () => {
        authAs("user-1");

        const mockWhere = vi.fn().mockResolvedValue(undefined);
        mockDbDelete.mockReturnValue({ where: mockWhere });

        const res = await DELETE(makeDelete({ event_id: "evt-1" }));
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.success).toBe(true);
    });

    it("returns 500 on DB delete error", async () => {
        authAs("user-1");

        const mockWhere = vi.fn().mockRejectedValue(new Error("DB error"));
        mockDbDelete.mockReturnValue({ where: mockWhere });

        const res = await DELETE(makeDelete({ event_id: "evt-1" }));
        expect(res.status).toBe(500);
    });
});
