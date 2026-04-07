import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "./route";

const { mockGetUser, mockEnqueueEmailSync, mockDbUpdate, mockDbSelect } = vi.hoisted(() => ({
    mockGetUser: vi.fn(),
    mockEnqueueEmailSync: vi.fn(),
    mockDbUpdate: vi.fn(),
    mockDbSelect: vi.fn(),
}));

vi.mock("@/utils/supabase/server", () => ({
    createClient: vi.fn().mockResolvedValue({
        auth: { getUser: mockGetUser },
    }),
}));

vi.mock("@/utils/sqs", () => ({
    enqueueEmailSync: mockEnqueueEmailSync,
}));

// Mock the db module — returns a chainable builder that resolves to an array
vi.mock("@/db", () => ({
    db: {
        update: mockDbUpdate,
        select: mockDbSelect,
    },
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makePostRequest(body: Record<string, unknown>) {
    return new NextRequest("http://localhost/api/integrations/sync", {
        method: "POST",
        body: JSON.stringify(body),
    });
}

function makeGetRequest() {
    return new NextRequest("http://localhost/api/integrations/sync");
}

function setupUpdateChain() {
    const mockWhere = vi.fn().mockResolvedValue(undefined);
    const mockSet = vi.fn().mockReturnValue({ where: mockWhere });
    mockDbUpdate.mockReturnValue({ set: mockSet });
    return { mockSet, mockWhere };
}

// ─── POST — validation ────────────────────────────────────────────────────────

describe("POST /api/integrations/sync — validation", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("returns 400 when grantId is missing", async () => {
        const res = await POST(makePostRequest({ userId: "user-1" }));
        expect(res.status).toBe(400);
    });

    it("returns 400 when userId is missing", async () => {
        const res = await POST(makePostRequest({ grantId: "grant-1" }));
        expect(res.status).toBe(400);
    });

    it("returns 400 when both are missing", async () => {
        const res = await POST(makePostRequest({}));
        expect(res.status).toBe(400);
    });
});

// ─── POST — auth ──────────────────────────────────────────────────────────────

describe("POST /api/integrations/sync — auth", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("returns 401 when getUser errors", async () => {
        mockGetUser.mockResolvedValue({ data: { user: null }, error: { message: "Auth error" } });
        const res = await POST(makePostRequest({ grantId: "grant-1", userId: "user-1" }));
        expect(res.status).toBe(401);
    });

    it("returns 401 when no user", async () => {
        mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
        const res = await POST(makePostRequest({ grantId: "grant-1", userId: "user-1" }));
        expect(res.status).toBe(401);
    });

    it("returns 401 when userId does not match authenticated user", async () => {
        mockGetUser.mockResolvedValue({ data: { user: { id: "other-user" } }, error: null });
        const res = await POST(makePostRequest({ grantId: "grant-1", userId: "user-1" }));
        expect(res.status).toBe(401);
    });
});

// ─── POST — happy path ────────────────────────────────────────────────────────

describe("POST /api/integrations/sync — happy path", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("marks integration as syncing and enqueues job", async () => {
        mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
        const { mockSet } = setupUpdateChain();
        mockEnqueueEmailSync.mockResolvedValue(undefined);

        const res = await POST(makePostRequest({ grantId: "grant-1", userId: "user-1" }));
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.success).toBe(true);
        expect(mockSet).toHaveBeenCalledWith({ status: "syncing" });
        expect(mockEnqueueEmailSync).toHaveBeenCalledWith("grant-1", "user-1");
    });

    it("returns 500 when enqueueEmailSync throws", async () => {
        mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
        setupUpdateChain();
        mockEnqueueEmailSync.mockRejectedValue(new Error("SQS unavailable"));

        const res = await POST(makePostRequest({ grantId: "grant-1", userId: "user-1" }));
        expect(res.status).toBe(500);
    });
});

// ─── GET — auth ───────────────────────────────────────────────────────────────

describe("GET /api/integrations/sync — auth", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("returns 401 when not authenticated", async () => {
        mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
        const res = await GET(makeGetRequest());
        expect(res.status).toBe(401);
    });

    it("returns 401 when getUser errors", async () => {
        mockGetUser.mockResolvedValue({ data: { user: null }, error: { message: "Auth error" } });
        const res = await GET(makeGetRequest());
        expect(res.status).toBe(401);
    });
});

// ─── GET — happy path ─────────────────────────────────────────────────────────

describe("GET /api/integrations/sync — happy path", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("returns integrations for authenticated user", async () => {
        const integrationRows = [{ id: "int-1", status: "active" }];
        mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });

        const mockWhere = vi.fn().mockResolvedValue(integrationRows);
        const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
        mockDbSelect.mockReturnValue({ from: mockFrom });

        const res = await GET(makeGetRequest());
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.integrations).toEqual(integrationRows);
    });

    it("returns 500 when DB fetch throws", async () => {
        mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });

        const mockWhere = vi.fn().mockRejectedValue(new Error("DB error"));
        const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
        mockDbSelect.mockReturnValue({ from: mockFrom });

        const res = await GET(makeGetRequest());
        expect(res.status).toBe(500);
    });
});
