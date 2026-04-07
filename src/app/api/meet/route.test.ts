import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "./route";

const { mockGetUser, mockFrom, mockCreateMeetLink, mockIsGoogleMeetConfigured } = vi.hoisted(() => ({
    mockGetUser: vi.fn(),
    mockFrom: vi.fn(),
    mockCreateMeetLink: vi.fn(),
    mockIsGoogleMeetConfigured: vi.fn(),
}));

vi.mock("@/utils/supabase/server", () => ({
    createClient: vi.fn().mockResolvedValue({
        auth: { getUser: mockGetUser },
        from: mockFrom,
    }),
}));

vi.mock("@/lib/google-meet", () => ({
    createMeetLink: mockCreateMeetLink,
    isGoogleMeetConfigured: mockIsGoogleMeetConfigured,
}));

function makePost(body: Record<string, unknown>) {
    return new NextRequest("http://localhost/api/meet", {
        method: "POST",
        body: JSON.stringify(body),
    });
}

function authAs(userId = "user-1") {
    mockGetUser.mockResolvedValue({ data: { user: { id: userId } }, error: null });
}

function noAuth() {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
}

// ─── GET ──────────────────────────────────────────────────────────────────────

describe("GET /api/meet", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("returns configured:true when Google Meet is configured", async () => {
        mockIsGoogleMeetConfigured.mockReturnValue(true);
        const res = await GET();
        const body = await res.json();
        expect(res.status).toBe(200);
        expect(body.configured).toBe(true);
    });

    it("returns configured:false when Google Meet is not configured", async () => {
        mockIsGoogleMeetConfigured.mockReturnValue(false);
        const res = await GET();
        const body = await res.json();
        expect(body.configured).toBe(false);
    });
});

// ─── POST ─────────────────────────────────────────────────────────────────────

describe("POST /api/meet — auth", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("returns 401 when not authenticated", async () => {
        noAuth();
        const res = await POST(makePost({ title: "Meeting", start_time: "2026-03-01T10:00:00Z", end_time: "2026-03-01T11:00:00Z" }));
        expect(res.status).toBe(401);
    });
});

describe("POST /api/meet — configuration", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("returns 503 when Google Meet is not configured", async () => {
        authAs();
        mockIsGoogleMeetConfigured.mockReturnValue(false);
        const res = await POST(makePost({ title: "Meeting", start_time: "2026-03-01T10:00:00Z", end_time: "2026-03-01T11:00:00Z" }));
        expect(res.status).toBe(503);
    });
});

describe("POST /api/meet — validation", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        authAs();
        mockIsGoogleMeetConfigured.mockReturnValue(true);
    });

    it("returns 400 when title is missing", async () => {
        const res = await POST(makePost({ start_time: "2026-03-01T10:00:00Z", end_time: "2026-03-01T11:00:00Z" }));
        expect(res.status).toBe(400);
    });

    it("returns 400 when start_time is missing", async () => {
        const res = await POST(makePost({ title: "Meeting", end_time: "2026-03-01T11:00:00Z" }));
        expect(res.status).toBe(400);
    });

    it("returns 400 when dates are invalid", async () => {
        const res = await POST(makePost({ title: "Meeting", start_time: "not-a-date", end_time: "also-not" }));
        expect(res.status).toBe(400);
    });
});

describe("POST /api/meet — happy path", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        authAs();
        mockIsGoogleMeetConfigured.mockReturnValue(true);
    });

    it("returns meet_link on success", async () => {
        mockCreateMeetLink.mockResolvedValue("https://meet.google.com/abc-defg-hij");

        const res = await POST(makePost({ title: "Team Sync", start_time: "2026-03-01T10:00:00Z", end_time: "2026-03-01T11:00:00Z" }));
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.meet_link).toBe("https://meet.google.com/abc-defg-hij");
    });

    it("returns 500 when createMeetLink returns null", async () => {
        mockCreateMeetLink.mockResolvedValue(null);

        const res = await POST(makePost({ title: "Team Sync", start_time: "2026-03-01T10:00:00Z", end_time: "2026-03-01T11:00:00Z" }));
        expect(res.status).toBe(500);
    });
});
