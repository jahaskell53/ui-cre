import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DELETE, GET, POST, PUT } from "./route";

const { mockGetUser, mockFrom, mockRecalculate } = vi.hoisted(() => ({
    mockGetUser: vi.fn(),
    mockFrom: vi.fn(),
    mockRecalculate: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/utils/supabase/server", () => ({
    createClient: vi.fn().mockResolvedValue({
        auth: { getUser: mockGetUser },
        from: mockFrom,
    }),
}));

vi.mock("@/lib/network-strength", () => ({
    recalculateNetworkStrengthForUser: mockRecalculate,
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

function url(params?: Record<string, string>) {
    const u = new URL("http://localhost/api/people");
    if (params) Object.entries(params).forEach(([k, v]) => u.searchParams.set(k, v));
    return u.toString();
}

function makeGet(params?: Record<string, string>) {
    return new NextRequest(url(params));
}

function makePost(body: Record<string, unknown>) {
    return new NextRequest("http://localhost/api/people", {
        method: "POST",
        body: JSON.stringify(body),
    });
}

function makePut(body: Record<string, unknown>, params?: Record<string, string>) {
    return new NextRequest(url(params), {
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

// Stub fetch to return null geocoding result (no address features)
function stubFetchNoGeocode() {
    vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({ features: [] }),
        }),
    );
}

const person = { id: "p-1", name: "Alice", user_id: "user-1" };

// ─── GET ──────────────────────────────────────────────────────────────────────

describe("GET /api/people", () => {
    beforeEach(() => vi.clearAllMocks());

    it("returns 401 when not authenticated", async () => {
        noAuth();
        const res = await GET(makeGet());
        expect(res.status).toBe(401);
    });

    it("returns list of people", async () => {
        authAs();
        const mockOrder = vi.fn().mockResolvedValue({ data: [person], error: null });
        const mockEq = vi.fn().mockReturnValue({ order: mockOrder });
        const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
        mockFrom.mockReturnValue({ select: mockSelect });

        const res = await GET(makeGet());
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body).toEqual([person]);
    });

    it("returns single person when id is provided", async () => {
        authAs();
        const mockSingle = vi.fn().mockResolvedValue({ data: person, error: null });
        const mockEq2 = vi.fn().mockReturnValue({ single: mockSingle });
        const mockEq1 = vi.fn().mockReturnValue({ eq: mockEq2 });
        const mockSelect = vi.fn().mockReturnValue({ eq: mockEq1 });
        mockFrom.mockReturnValue({ select: mockSelect });

        const res = await GET(makeGet({ id: "p-1" }));
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body).toEqual(person);
    });

    it("returns 404 when person not found by id", async () => {
        authAs();
        const mockSingle = vi.fn().mockResolvedValue({ data: null, error: { message: "not found" } });
        const mockEq2 = vi.fn().mockReturnValue({ single: mockSingle });
        const mockEq1 = vi.fn().mockReturnValue({ eq: mockEq2 });
        const mockSelect = vi.fn().mockReturnValue({ eq: mockEq1 });
        mockFrom.mockReturnValue({ select: mockSelect });

        const res = await GET(makeGet({ id: "bad-id" }));
        expect(res.status).toBe(404);
    });

    it("returns 500 when list fetch fails", async () => {
        authAs();
        const mockOrder = vi.fn().mockResolvedValue({ data: null, error: { message: "DB error" } });
        const mockEq = vi.fn().mockReturnValue({ order: mockOrder });
        const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
        mockFrom.mockReturnValue({ select: mockSelect });

        const res = await GET(makeGet());
        expect(res.status).toBe(500);
    });
});

// ─── POST ─────────────────────────────────────────────────────────────────────

describe("POST /api/people — auth & validation", () => {
    beforeEach(() => vi.clearAllMocks());
    afterEach(() => vi.unstubAllGlobals());

    it("returns 401 when not authenticated", async () => {
        noAuth();
        const res = await POST(makePost({ name: "Alice" }));
        expect(res.status).toBe(401);
    });

    it("returns 400 when name is missing", async () => {
        authAs();
        const res = await POST(makePost({}));
        expect(res.status).toBe(400);
    });

    it("returns 400 when name is blank", async () => {
        authAs();
        const res = await POST(makePost({ name: "   " }));
        expect(res.status).toBe(400);
    });
});

describe("POST /api/people — happy path", () => {
    beforeEach(() => vi.clearAllMocks());
    afterEach(() => vi.unstubAllGlobals());

    it("creates person without address (no geocoding)", async () => {
        authAs("user-1");
        const mockSingle = vi.fn().mockResolvedValue({ data: person, error: null });
        const mockSelect = vi.fn().mockReturnValue({ single: mockSingle });
        const mockInsert = vi.fn().mockReturnValue({ select: mockSelect });
        mockFrom.mockReturnValue({ insert: mockInsert });

        const res = await POST(makePost({ name: "Alice" }));
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({ name: "Alice", user_id: "user-1", address_latitude: null }));
    });

    it("geocodes address when provided", async () => {
        authAs("user-1");
        stubFetchNoGeocode();

        const mockSingle = vi.fn().mockResolvedValue({ data: person, error: null });
        const mockSelect = vi.fn().mockReturnValue({ single: mockSingle });
        const mockInsert = vi.fn().mockReturnValue({ select: mockSelect });
        mockFrom.mockReturnValue({ insert: mockInsert });

        await POST(makePost({ name: "Alice", address: "123 Main St, Boston MA" }));

        expect(vi.mocked(fetch)).toHaveBeenCalled();
    });

    it("returns 500 when DB insert fails", async () => {
        authAs("user-1");
        const mockSingle = vi.fn().mockResolvedValue({ data: null, error: { message: "DB error" } });
        const mockSelect = vi.fn().mockReturnValue({ single: mockSingle });
        const mockInsert = vi.fn().mockReturnValue({ select: mockSelect });
        mockFrom.mockReturnValue({ insert: mockInsert });

        const res = await POST(makePost({ name: "Alice" }));
        expect(res.status).toBe(500);
    });
});

// ─── PUT ──────────────────────────────────────────────────────────────────────

describe("PUT /api/people", () => {
    beforeEach(() => vi.clearAllMocks());
    afterEach(() => vi.unstubAllGlobals());

    it("returns 401 when not authenticated", async () => {
        noAuth();
        const res = await PUT(makePut({ name: "Bob" }, { id: "p-1" }));
        expect(res.status).toBe(401);
    });

    it("returns 400 when person id is missing", async () => {
        authAs();
        const res = await PUT(makePut({ name: "Bob" }));
        expect(res.status).toBe(400);
    });

    it("returns 400 when no fields to update", async () => {
        authAs();
        const res = await PUT(makePut({}, { id: "p-1" }));
        expect(res.status).toBe(400);
    });

    it("updates person and returns it", async () => {
        authAs("user-1");
        const updated = { ...person, name: "Bob" };
        const mockSingle = vi.fn().mockResolvedValue({ data: updated, error: null });
        const mockSelect = vi.fn().mockReturnValue({ single: mockSingle });
        const mockEq2 = vi.fn().mockReturnValue({ select: mockSelect });
        const mockEq1 = vi.fn().mockReturnValue({ eq: mockEq2 });
        const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq1 });
        mockFrom.mockReturnValue({ update: mockUpdate });

        const res = await PUT(makePut({ name: "Bob" }, { id: "p-1" }));
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.name).toBe("Bob");
    });

    it("recalculates network strength when timeline is updated", async () => {
        authAs("user-1");
        const mockSingle = vi.fn().mockResolvedValue({ data: person, error: null });
        const mockSelect = vi.fn().mockReturnValue({ single: mockSingle });
        const mockEq2 = vi.fn().mockReturnValue({ select: mockSelect });
        const mockEq1 = vi.fn().mockReturnValue({ eq: mockEq2 });
        const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq1 });
        mockFrom.mockReturnValue({ update: mockUpdate });

        await PUT(makePut({ timeline: [] }, { id: "p-1" }));

        expect(mockRecalculate).toHaveBeenCalledWith(expect.anything(), "user-1");
    });

    it("does not recalculate network strength when timeline is not in the update", async () => {
        authAs("user-1");
        const mockSingle = vi.fn().mockResolvedValue({ data: person, error: null });
        const mockSelect = vi.fn().mockReturnValue({ single: mockSingle });
        const mockEq2 = vi.fn().mockReturnValue({ select: mockSelect });
        const mockEq1 = vi.fn().mockReturnValue({ eq: mockEq2 });
        const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq1 });
        mockFrom.mockReturnValue({ update: mockUpdate });

        await PUT(makePut({ name: "Bob" }, { id: "p-1" }));

        expect(mockRecalculate).not.toHaveBeenCalled();
    });

    it("returns 500 when DB update fails", async () => {
        authAs("user-1");
        const mockSingle = vi.fn().mockResolvedValue({ data: null, error: { message: "DB error" } });
        const mockSelect = vi.fn().mockReturnValue({ single: mockSingle });
        const mockEq2 = vi.fn().mockReturnValue({ select: mockSelect });
        const mockEq1 = vi.fn().mockReturnValue({ eq: mockEq2 });
        const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq1 });
        mockFrom.mockReturnValue({ update: mockUpdate });

        const res = await PUT(makePut({ name: "Bob" }, { id: "p-1" }));
        expect(res.status).toBe(500);
    });
});

// ─── DELETE ───────────────────────────────────────────────────────────────────

describe("DELETE /api/people", () => {
    beforeEach(() => vi.clearAllMocks());

    it("returns 401 when not authenticated", async () => {
        noAuth();
        const res = await DELETE(makeDelete({ id: "p-1" }));
        expect(res.status).toBe(401);
    });

    it("returns 400 when person id is missing", async () => {
        authAs();
        const res = await DELETE(makeDelete());
        expect(res.status).toBe(400);
    });

    it("deletes person and returns success", async () => {
        authAs("user-1");
        const mockEq2 = vi.fn().mockResolvedValue({ error: null });
        const mockEq1 = vi.fn().mockReturnValue({ eq: mockEq2 });
        const mockDelete = vi.fn().mockReturnValue({ eq: mockEq1 });
        mockFrom.mockReturnValue({ delete: mockDelete });

        const res = await DELETE(makeDelete({ id: "p-1" }));
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

        const res = await DELETE(makeDelete({ id: "p-1" }));
        expect(res.status).toBe(500);
    });
});
