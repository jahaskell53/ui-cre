import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DELETE, GET, POST } from "./route";

const { mockGetUser, mockFrom, mockAdminFrom } = vi.hoisted(() => ({
    mockGetUser: vi.fn(),
    mockFrom: vi.fn(),
    mockAdminFrom: vi.fn(),
}));

vi.mock("@/utils/supabase/server", () => ({
    createClient: vi.fn().mockResolvedValue({
        auth: { getUser: mockGetUser },
        from: mockFrom,
    }),
}));

vi.mock("@/utils/supabase/admin", () => ({
    createAdminClient: vi.fn().mockReturnValue({ from: mockAdminFrom }),
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
        const mockEq = vi.fn().mockResolvedValue({ count: 5, error: null });
        const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
        mockAdminFrom.mockReturnValue({ select: mockSelect });

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
        mockFrom.mockImplementation(() => {
            callCount++;
            if (callCount === 1) {
                // user registration check
                const mockMaybeSingle = vi.fn().mockResolvedValue({ data: { id: "reg-1", created_at: "now" }, error: null });
                const mockEq2 = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
                const mockEq1 = vi.fn().mockReturnValue({ eq: mockEq2 });
                const mockSelect = vi.fn().mockReturnValue({ eq: mockEq1 });
                return { select: mockSelect };
            }
            // count query
            const mockEq = vi.fn().mockResolvedValue({ count: 3, error: null });
            const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
            return { select: mockSelect };
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
        mockFrom.mockImplementation(() => {
            callCount++;
            if (callCount === 1) {
                const mockMaybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
                const mockEq2 = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
                const mockEq1 = vi.fn().mockReturnValue({ eq: mockEq2 });
                const mockSelect = vi.fn().mockReturnValue({ eq: mockEq1 });
                return { select: mockSelect };
            }
            const mockEq = vi.fn().mockResolvedValue({ count: 0, error: null });
            const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
            return { select: mockSelect };
        });

        const res = await GET(makeGet({ event_id: "evt-1" }));
        const body = await res.json();

        expect(body.is_registered).toBe(false);
    });

    it("returns 500 when registration check fails", async () => {
        authAs("user-1");

        const mockMaybeSingle = vi.fn().mockResolvedValue({ data: null, error: { message: "DB error" } });
        const mockEq2 = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
        const mockEq1 = vi.fn().mockReturnValue({ eq: mockEq2 });
        const mockSelect = vi.fn().mockReturnValue({ eq: mockEq1 });
        mockFrom.mockReturnValue({ select: mockSelect });

        const res = await GET(makeGet({ event_id: "evt-1" }));
        expect(res.status).toBe(500);
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
        const reg = { id: "reg-1", event_id: "evt-1", user_id: "user-1" };

        let callCount = 0;
        mockFrom.mockImplementation((table: string) => {
            if (table === "events") {
                const mockSingle = vi.fn().mockResolvedValue({ data: { id: "evt-1", start_time: "2024-06-01T10:00:00Z" }, error: null });
                const mockEq = vi.fn().mockReturnValue({ single: mockSingle });
                const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
                return { select: mockSelect };
            }
            if (table === "event_registrations") {
                const mockSingle = vi.fn().mockResolvedValue({ data: reg, error: null });
                const mockSelect = vi.fn().mockReturnValue({ single: mockSingle });
                const mockInsert = vi.fn().mockReturnValue({ select: mockSelect });
                return { insert: mockInsert };
            }
            return {};
        });

        const res = await POST(makePost({ event_id: "evt-1" }));
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.success).toBe(true);
        expect(body.registration).toEqual(reg);
    });

    it("returns 404 when event not found", async () => {
        authAs("user-1");
        mockFrom.mockImplementation(() => {
            const mockSingle = vi.fn().mockResolvedValue({ data: null, error: { message: "not found" } });
            const mockEq = vi.fn().mockReturnValue({ single: mockSingle });
            const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
            return { select: mockSelect };
        });

        const res = await POST(makePost({ event_id: "evt-1" }));
        expect(res.status).toBe(404);
    });

    it("returns 409 when already registered (duplicate key)", async () => {
        authAs("user-1");

        mockFrom.mockImplementation((table: string) => {
            if (table === "events") {
                const mockSingle = vi.fn().mockResolvedValue({ data: { id: "evt-1", start_time: "t" }, error: null });
                const mockEq = vi.fn().mockReturnValue({ single: mockSingle });
                const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
                return { select: mockSelect };
            }
            if (table === "event_registrations") {
                const mockSingle = vi.fn().mockResolvedValue({ data: null, error: { code: "23505", message: "duplicate" } });
                const mockSelect = vi.fn().mockReturnValue({ single: mockSingle });
                const mockInsert = vi.fn().mockReturnValue({ select: mockSelect });
                return { insert: mockInsert };
            }
            return {};
        });

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

        const mockEq2 = vi.fn().mockResolvedValue({ error: null });
        const mockEq1 = vi.fn().mockReturnValue({ eq: mockEq2 });
        const mockDelete = vi.fn().mockReturnValue({ eq: mockEq1 });
        mockFrom.mockReturnValue({ delete: mockDelete });

        const res = await DELETE(makeDelete({ event_id: "evt-1" }));
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.success).toBe(true);
    });

    it("returns 500 when DB delete fails", async () => {
        authAs("user-1");

        const mockEq2 = vi.fn().mockResolvedValue({ error: { message: "DB error" } });
        const mockEq1 = vi.fn().mockReturnValue({ eq: mockEq2 });
        const mockDelete = vi.fn().mockReturnValue({ eq: mockEq1 });
        mockFrom.mockReturnValue({ delete: mockDelete });

        const res = await DELETE(makeDelete({ event_id: "evt-1" }));
        expect(res.status).toBe(500);
    });
});
