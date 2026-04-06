import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

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

// ─── Helpers ─────────────────────────────────────────────────────────────────

const params = Promise.resolve({ id: "evt-1" });

function makeRequest() {
    return new NextRequest("http://localhost/api/events/evt-1/invites");
}

function setupEventQuery(eventData: unknown, error: unknown = null) {
    const mockSingle = vi.fn().mockResolvedValue({ data: eventData, error });
    const mockEq = vi.fn().mockReturnValue({ single: mockSingle });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
    return { mockSelect };
}

function setupInvitesQuery(invites: unknown[], error: unknown = null) {
    const mockOrder = vi.fn().mockResolvedValue({ data: invites, error });
    const mockEq = vi.fn().mockReturnValue({ order: mockOrder });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
    return { mockSelect };
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
        const { mockSelect } = setupEventQuery(null, { message: "not found" });
        mockFrom.mockReturnValue({ select: mockSelect });

        const res = await GET(makeRequest(), { params });
        expect(res.status).toBe(404);
    });

    it("returns 403 when user does not own the event", async () => {
        mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
        const { mockSelect } = setupEventQuery({ id: "evt-1", user_id: "other-user" });
        mockFrom.mockReturnValue({ select: mockSelect });

        const res = await GET(makeRequest(), { params });
        expect(res.status).toBe(403);
    });
});

// ─── Happy path ───────────────────────────────────────────────────────────────

describe("GET /api/events/[id]/invites — happy path", () => {
    beforeEach(() => vi.clearAllMocks());

    it("returns invites for event owner", async () => {
        mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
        const invites = [{ id: "inv-1", event_id: "evt-1", recipient_count: 3 }];

        let callCount = 0;
        mockFrom.mockImplementation((table: string) => {
            if (table === "events") {
                const { mockSelect } = setupEventQuery({ id: "evt-1", user_id: "user-1" });
                return { select: mockSelect };
            }
            if (table === "event_invites") {
                const { mockSelect } = setupInvitesQuery(invites);
                return { select: mockSelect };
            }
            return {};
        });

        const res = await GET(makeRequest(), { params });
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body).toEqual(invites);
    });

    it("returns empty array when no invites", async () => {
        mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });

        mockFrom.mockImplementation((table: string) => {
            if (table === "events") {
                const { mockSelect } = setupEventQuery({ id: "evt-1", user_id: "user-1" });
                return { select: mockSelect };
            }
            if (table === "event_invites") {
                const { mockSelect } = setupInvitesQuery([]);
                return { select: mockSelect };
            }
            return {};
        });

        const res = await GET(makeRequest(), { params });
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body).toEqual([]);
    });

    it("returns 500 when invites fetch fails", async () => {
        mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });

        mockFrom.mockImplementation((table: string) => {
            if (table === "events") {
                const { mockSelect } = setupEventQuery({ id: "evt-1", user_id: "user-1" });
                return { select: mockSelect };
            }
            if (table === "event_invites") {
                const { mockSelect } = setupInvitesQuery([], { message: "DB error" });
                return { select: mockSelect };
            }
            return {};
        });

        const res = await GET(makeRequest(), { params });
        expect(res.status).toBe(500);
    });
});
