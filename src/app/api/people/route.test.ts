import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DELETE, GET, POST, PUT } from "./route";

const { mockGetUser, mockDb, mockRecalculate } = vi.hoisted(() => ({
    mockGetUser: vi.fn(),
    mockDb: {
        select: vi.fn(),
        insert: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
    },
    mockRecalculate: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/utils/supabase/server", () => ({
    createClient: vi.fn().mockResolvedValue({
        auth: { getUser: mockGetUser },
    }),
}));

vi.mock("@/db", () => ({
    db: mockDb,
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

const personRow = {
    id: "p-1",
    userId: "user-1",
    name: "Alice",
    starred: false,
    signal: false,
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
    email: null,
    timeline: [],
    address: null,
    ownedAddresses: [],
    phone: null,
    category: null,
    addressLatitude: null,
    addressLongitude: null,
    ownedAddressesGeo: [],
    bio: null,
    birthday: null,
    linkedinUrl: null,
    twitterUrl: null,
    instagramUrl: null,
    facebookUrl: null,
    networkStrength: "MEDIUM",
};

// ─── GET ──────────────────────────────────────────────────────────────────────

describe("GET /api/people", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("returns 401 when not authenticated", async () => {
        noAuth();
        const res = await GET(makeGet());
        expect(res.status).toBe(401);
    });

    it("returns list of people", async () => {
        authAs();
        const mockOrderBy = vi.fn().mockResolvedValue([personRow]);
        const mockWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
        const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
        mockDb.select.mockReturnValue({ from: mockFrom });

        const res = await GET(makeGet());
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body[0].id).toBe("p-1");
        expect(body[0].user_id).toBe("user-1");
        expect(body[0].name).toBe("Alice");
    });

    it("returns single person when id is provided", async () => {
        authAs();
        const mockWhere = vi.fn().mockResolvedValue([personRow]);
        const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
        mockDb.select.mockReturnValue({ from: mockFrom });

        const res = await GET(makeGet({ id: "p-1" }));
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.id).toBe("p-1");
    });

    it("returns 404 when person not found by id", async () => {
        authAs();
        const mockWhere = vi.fn().mockResolvedValue([]);
        const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
        mockDb.select.mockReturnValue({ from: mockFrom });

        const res = await GET(makeGet({ id: "bad-id" }));
        expect(res.status).toBe(404);
    });

    it("returns 500 when DB throws", async () => {
        authAs();
        const mockOrderBy = vi.fn().mockRejectedValue(new Error("DB error"));
        const mockWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
        const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
        mockDb.select.mockReturnValue({ from: mockFrom });

        const res = await GET(makeGet());
        expect(res.status).toBe(500);
    });
});

// ─── POST ─────────────────────────────────────────────────────────────────────

describe("POST /api/people — auth & validation", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });
    afterEach(() => {
        vi.unstubAllGlobals();
    });

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
    beforeEach(() => {
        vi.clearAllMocks();
    });
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("creates person without address (no geocoding)", async () => {
        authAs("user-1");
        const mockReturning = vi.fn().mockResolvedValue([personRow]);
        const mockValues = vi.fn().mockReturnValue({ returning: mockReturning });
        mockDb.insert.mockReturnValue({ values: mockValues });

        const res = await POST(makePost({ name: "Alice" }));
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.name).toBe("Alice");
        expect(mockValues).toHaveBeenCalledWith(expect.objectContaining({ name: "Alice", userId: "user-1", addressLatitude: null }));
    });

    it("geocodes address when provided", async () => {
        authAs("user-1");
        stubFetchNoGeocode();

        const mockReturning = vi.fn().mockResolvedValue([personRow]);
        const mockValues = vi.fn().mockReturnValue({ returning: mockReturning });
        mockDb.insert.mockReturnValue({ values: mockValues });

        await POST(makePost({ name: "Alice", address: "123 Main St, Boston MA" }));

        expect(vi.mocked(fetch)).toHaveBeenCalled();
    });

    it("returns 500 when DB insert returns empty array", async () => {
        authAs("user-1");
        const mockReturning = vi.fn().mockResolvedValue([]);
        const mockValues = vi.fn().mockReturnValue({ returning: mockReturning });
        mockDb.insert.mockReturnValue({ values: mockValues });

        const res = await POST(makePost({ name: "Alice" }));
        expect(res.status).toBe(500);
    });
});

// ─── PUT ──────────────────────────────────────────────────────────────────────

describe("PUT /api/people", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });
    afterEach(() => {
        vi.unstubAllGlobals();
    });

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
        const updated = { ...personRow, name: "Bob" };
        const mockReturning = vi.fn().mockResolvedValue([updated]);
        const mockWhere = vi.fn().mockReturnValue({ returning: mockReturning });
        const mockSet = vi.fn().mockReturnValue({ where: mockWhere });
        mockDb.update.mockReturnValue({ set: mockSet });

        const res = await PUT(makePut({ name: "Bob" }, { id: "p-1" }));
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.name).toBe("Bob");
    });

    it("recalculates network strength when timeline is updated", async () => {
        authAs("user-1");
        const mockReturning = vi.fn().mockResolvedValue([personRow]);
        const mockWhere = vi.fn().mockReturnValue({ returning: mockReturning });
        const mockSet = vi.fn().mockReturnValue({ where: mockWhere });
        mockDb.update.mockReturnValue({ set: mockSet });

        await PUT(makePut({ timeline: [] }, { id: "p-1" }));

        expect(mockRecalculate).toHaveBeenCalledWith("user-1");
    });

    it("does not recalculate network strength when timeline is not in the update", async () => {
        authAs("user-1");
        const mockReturning = vi.fn().mockResolvedValue([personRow]);
        const mockWhere = vi.fn().mockReturnValue({ returning: mockReturning });
        const mockSet = vi.fn().mockReturnValue({ where: mockWhere });
        mockDb.update.mockReturnValue({ set: mockSet });

        await PUT(makePut({ name: "Bob" }, { id: "p-1" }));

        expect(mockRecalculate).not.toHaveBeenCalled();
    });

    it("returns 500 when DB update returns empty array", async () => {
        authAs("user-1");
        const mockReturning = vi.fn().mockResolvedValue([]);
        const mockWhere = vi.fn().mockReturnValue({ returning: mockReturning });
        const mockSet = vi.fn().mockReturnValue({ where: mockWhere });
        mockDb.update.mockReturnValue({ set: mockSet });

        const res = await PUT(makePut({ name: "Bob" }, { id: "p-1" }));
        expect(res.status).toBe(500);
    });
});

// ─── DELETE ───────────────────────────────────────────────────────────────────

describe("DELETE /api/people", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

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
        const mockWhere = vi.fn().mockResolvedValue(undefined);
        mockDb.delete.mockReturnValue({ where: mockWhere });

        const res = await DELETE(makeDelete({ id: "p-1" }));
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.success).toBe(true);
    });

    it("returns 500 when DB throws", async () => {
        authAs("user-1");
        const mockWhere = vi.fn().mockRejectedValue(new Error("DB error"));
        mockDb.delete.mockReturnValue({ where: mockWhere });

        const res = await DELETE(makeDelete({ id: "p-1" }));
        expect(res.status).toBe(500);
    });
});
