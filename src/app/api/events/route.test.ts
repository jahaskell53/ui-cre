import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DELETE, GET, POST, PUT } from "./route";

const { mockGetUser, mockFrom, mockCreateMeetLink } = vi.hoisted(() => ({
    mockGetUser: vi.fn(),
    mockFrom: vi.fn(),
    mockCreateMeetLink: vi.fn(),
}));

vi.mock("@/utils/supabase/server", () => ({
    createClient: vi.fn().mockResolvedValue({
        auth: { getUser: mockGetUser },
        from: mockFrom,
    }),
}));

vi.mock("@/lib/google-meet", () => ({
    createMeetLink: mockCreateMeetLink,
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

function url(path: string, params?: Record<string, string>) {
    const u = new URL(`http://localhost${path}`);
    if (params) Object.entries(params).forEach(([k, v]) => u.searchParams.set(k, v));
    return u.toString();
}

function makeGet(params?: Record<string, string>) {
    return new NextRequest(url("/api/events", params));
}

function makePost(body: Record<string, unknown>) {
    return new NextRequest("http://localhost/api/events", {
        method: "POST",
        body: JSON.stringify(body),
    });
}

function makePut(body: Record<string, unknown>, params?: Record<string, string>) {
    return new NextRequest(url("/api/events", params), {
        method: "PUT",
        body: JSON.stringify(body),
    });
}

function makeDelete(params?: Record<string, string>) {
    return new NextRequest(url("/api/events", params), { method: "DELETE" });
}

function authAs(userId = "user-1") {
    mockGetUser.mockResolvedValue({ data: { user: { id: userId } }, error: null });
}

function noAuth() {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
}

const event = { id: "evt-1", title: "Kickoff", start_time: "2024-06-01T10:00:00Z", end_time: "2024-06-01T11:00:00Z" };

// ─── GET ──────────────────────────────────────────────────────────────────────

describe("GET /api/events", () => {
    beforeEach(() => vi.clearAllMocks());

    it("returns list of events", async () => {
        authAs();
        const mockOrder = vi.fn().mockResolvedValue({ data: [event], error: null });
        const mockSelect = vi.fn().mockReturnValue({ order: mockOrder });
        mockFrom.mockReturnValue({ select: mockSelect });

        const res = await GET(makeGet());
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body).toEqual([event]);
    });

    it("returns single event when id param is provided", async () => {
        authAs();
        const mockSingle = vi.fn().mockResolvedValue({ data: event, error: null });
        const mockEq = vi.fn().mockReturnValue({ single: mockSingle });
        const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
        mockFrom.mockReturnValue({ select: mockSelect });

        const res = await GET(makeGet({ id: "evt-1" }));
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body).toEqual(event);
    });

    it("returns 404 when event id not found", async () => {
        authAs();
        const mockSingle = vi.fn().mockResolvedValue({ data: null, error: { message: "not found" } });
        const mockEq = vi.fn().mockReturnValue({ single: mockSingle });
        const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
        mockFrom.mockReturnValue({ select: mockSelect });

        const res = await GET(makeGet({ id: "bad-id" }));
        expect(res.status).toBe(404);
    });

    it("returns 500 when DB errors on list fetch", async () => {
        authAs();
        const mockOrder = vi.fn().mockResolvedValue({ data: null, error: { message: "DB error" } });
        const mockSelect = vi.fn().mockReturnValue({ order: mockOrder });
        mockFrom.mockReturnValue({ select: mockSelect });

        const res = await GET(makeGet());
        expect(res.status).toBe(500);
    });
});

// ─── POST ─────────────────────────────────────────────────────────────────────

describe("POST /api/events — auth & validation", () => {
    beforeEach(() => vi.clearAllMocks());

    it("returns 401 when not authenticated", async () => {
        noAuth();
        const res = await POST(makePost({ title: "Test", start_time: "t", end_time: "t" }));
        expect(res.status).toBe(401);
    });

    it("returns 400 when title is missing", async () => {
        authAs();
        const res = await POST(makePost({ start_time: "2024-06-01T10:00:00Z", end_time: "2024-06-01T11:00:00Z" }));
        expect(res.status).toBe(400);
    });

    it("returns 400 when title is blank", async () => {
        authAs();
        const res = await POST(makePost({ title: "   ", start_time: "2024-06-01T10:00:00Z", end_time: "2024-06-01T11:00:00Z" }));
        expect(res.status).toBe(400);
    });

    it("returns 400 when start_time is missing", async () => {
        authAs();
        const res = await POST(makePost({ title: "Test", end_time: "2024-06-01T11:00:00Z" }));
        expect(res.status).toBe(400);
    });
});

describe("POST /api/events — happy path", () => {
    beforeEach(() => vi.clearAllMocks());

    it("creates event with meet link and returns it", async () => {
        authAs("user-1");
        mockCreateMeetLink.mockResolvedValue("https://meet.google.com/abc-def");

        const mockSingle = vi.fn().mockResolvedValue({ data: event, error: null });
        const mockSelect = vi.fn().mockReturnValue({ single: mockSingle });
        const mockInsert = vi.fn().mockReturnValue({ select: mockSelect });
        mockFrom.mockReturnValue({ insert: mockInsert });

        const res = await POST(
            makePost({
                title: "Kickoff",
                start_time: "2024-06-01T10:00:00Z",
                end_time: "2024-06-01T11:00:00Z",
            }),
        );

        expect(res.status).toBe(200);
        expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({ title: "Kickoff", meet_link: "https://meet.google.com/abc-def" }));
    });

    it("creates event with null meet_link when createMeetLink throws", async () => {
        authAs("user-1");
        mockCreateMeetLink.mockRejectedValue(new Error("Google API down"));

        const mockSingle = vi.fn().mockResolvedValue({ data: event, error: null });
        const mockSelect = vi.fn().mockReturnValue({ single: mockSingle });
        const mockInsert = vi.fn().mockReturnValue({ select: mockSelect });
        mockFrom.mockReturnValue({ insert: mockInsert });

        const res = await POST(
            makePost({
                title: "Kickoff",
                start_time: "2024-06-01T10:00:00Z",
                end_time: "2024-06-01T11:00:00Z",
            }),
        );

        expect(res.status).toBe(200);
        expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({ meet_link: null }));
    });

    it("returns 500 when DB insert fails", async () => {
        authAs("user-1");
        mockCreateMeetLink.mockResolvedValue(null);

        const mockSingle = vi.fn().mockResolvedValue({ data: null, error: { message: "DB error" } });
        const mockSelect = vi.fn().mockReturnValue({ single: mockSingle });
        const mockInsert = vi.fn().mockReturnValue({ select: mockSelect });
        mockFrom.mockReturnValue({ insert: mockInsert });

        const res = await POST(
            makePost({
                title: "Kickoff",
                start_time: "2024-06-01T10:00:00Z",
                end_time: "2024-06-01T11:00:00Z",
            }),
        );

        expect(res.status).toBe(500);
    });
});

// ─── PUT ──────────────────────────────────────────────────────────────────────

describe("PUT /api/events", () => {
    beforeEach(() => vi.clearAllMocks());

    it("returns 401 when not authenticated", async () => {
        noAuth();
        const res = await PUT(makePut({ title: "New" }, { id: "evt-1" }));
        expect(res.status).toBe(401);
    });

    it("returns 400 when event id is missing", async () => {
        authAs();
        const res = await PUT(makePut({ title: "New" }));
        expect(res.status).toBe(400);
    });

    it("returns 400 when no fields to update", async () => {
        authAs();
        const res = await PUT(makePut({}, { id: "evt-1" }));
        expect(res.status).toBe(400);
    });

    it("updates event and returns it", async () => {
        authAs("user-1");
        const updated = { ...event, title: "Updated" };
        const mockSingle = vi.fn().mockResolvedValue({ data: updated, error: null });
        const mockSelect = vi.fn().mockReturnValue({ single: mockSingle });
        const mockEq2 = vi.fn().mockReturnValue({ select: mockSelect });
        const mockEq1 = vi.fn().mockReturnValue({ eq: mockEq2 });
        const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq1 });
        mockFrom.mockReturnValue({ update: mockUpdate });

        const res = await PUT(makePut({ title: "Updated" }, { id: "evt-1" }));
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.title).toBe("Updated");
    });

    it("returns 500 when DB update fails", async () => {
        authAs("user-1");
        const mockSingle = vi.fn().mockResolvedValue({ data: null, error: { message: "DB error" } });
        const mockSelect = vi.fn().mockReturnValue({ single: mockSingle });
        const mockEq2 = vi.fn().mockReturnValue({ select: mockSelect });
        const mockEq1 = vi.fn().mockReturnValue({ eq: mockEq2 });
        const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq1 });
        mockFrom.mockReturnValue({ update: mockUpdate });

        const res = await PUT(makePut({ title: "Updated" }, { id: "evt-1" }));
        expect(res.status).toBe(500);
    });
});

// ─── DELETE ───────────────────────────────────────────────────────────────────

describe("DELETE /api/events", () => {
    beforeEach(() => vi.clearAllMocks());

    it("returns 401 when not authenticated", async () => {
        noAuth();
        const res = await DELETE(makeDelete({ id: "evt-1" }));
        expect(res.status).toBe(401);
    });

    it("returns 400 when event id is missing", async () => {
        authAs();
        const res = await DELETE(makeDelete());
        expect(res.status).toBe(400);
    });

    it("deletes event and returns success", async () => {
        authAs("user-1");
        const mockEq2 = vi.fn().mockResolvedValue({ error: null });
        const mockEq1 = vi.fn().mockReturnValue({ eq: mockEq2 });
        const mockDelete = vi.fn().mockReturnValue({ eq: mockEq1 });
        mockFrom.mockReturnValue({ delete: mockDelete });

        const res = await DELETE(makeDelete({ id: "evt-1" }));
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

        const res = await DELETE(makeDelete({ id: "evt-1" }));
        expect(res.status).toBe(500);
    });
});
