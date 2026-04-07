import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const { mockGetUser, mockDbSelect, mockDbInsert, mockSendEmail } = vi.hoisted(() => ({
    mockGetUser: vi.fn(),
    mockDbSelect: vi.fn(),
    mockDbInsert: vi.fn(),
    mockSendEmail: vi.fn(),
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
    },
}));

vi.mock("@/utils/email-service", () => ({
    EmailService: vi.fn().mockImplementation(function () {
        return { sendEmail: mockSendEmail };
    }),
}));

vi.mock("@/utils/email-templates", () => ({
    generateEventInviteEmail: vi.fn().mockReturnValue({
        subject: "You are invited",
        html: "<p>invite</p>",
        text: "invite",
    }),
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeRequest(body: Record<string, unknown>) {
    return new NextRequest("http://localhost/api/events/invite", {
        method: "POST",
        body: JSON.stringify(body),
    });
}

const validBody = {
    event_id: "evt-1",
    emails: ["alice@example.com", "bob@example.com"],
    message: "Join us!",
};

const eventRow = {
    id: "evt-1",
    userId: "user-1",
    title: "Kickoff",
    startTime: "2024-06-01T10:00:00Z",
    imageUrl: null,
};

function setupEventAndProfile() {
    let callCount = 0;
    mockDbSelect.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
            // events query
            const mockWhere = vi.fn().mockResolvedValue([eventRow]);
            return { from: vi.fn().mockReturnValue({ where: mockWhere }) };
        }
        // profiles query
        const mockWhere = vi.fn().mockResolvedValue([{ fullName: "Alice Host" }]);
        return { from: vi.fn().mockReturnValue({ where: mockWhere }) };
    });

    const mockValues = vi.fn().mockResolvedValue(undefined);
    mockDbInsert.mockReturnValue({ values: mockValues });
}

// ─── Auth & validation ────────────────────────────────────────────────────────

describe("POST /api/events/invite — auth & validation", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("returns 401 when not authenticated", async () => {
        mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
        const res = await POST(makeRequest(validBody));
        expect(res.status).toBe(401);
    });

    it("returns 400 when event_id is missing", async () => {
        mockGetUser.mockResolvedValue({ data: { user: { id: "user-1", email: "host@example.com" } }, error: null });
        const res = await POST(makeRequest({ emails: ["a@example.com"] }));
        expect(res.status).toBe(400);
    });

    it("returns 400 when emails is missing", async () => {
        mockGetUser.mockResolvedValue({ data: { user: { id: "user-1", email: "host@example.com" } }, error: null });
        const res = await POST(makeRequest({ event_id: "evt-1" }));
        expect(res.status).toBe(400);
    });

    it("returns 400 when emails is empty array", async () => {
        mockGetUser.mockResolvedValue({ data: { user: { id: "user-1", email: "host@example.com" } }, error: null });
        const res = await POST(makeRequest({ event_id: "evt-1", emails: [] }));
        expect(res.status).toBe(400);
    });

    it("returns 400 when all emails are blank after trimming", async () => {
        mockGetUser.mockResolvedValue({ data: { user: { id: "user-1", email: "host@example.com" } }, error: null });
        setupEventAndProfile();
        const res = await POST(makeRequest({ event_id: "evt-1", emails: ["  ", "  "] }));
        expect(res.status).toBe(400);
    });
});

// ─── Event not found ──────────────────────────────────────────────────────────

describe("POST /api/events/invite — event lookup", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("returns 404 when event not found", async () => {
        mockGetUser.mockResolvedValue({ data: { user: { id: "user-1", email: "host@example.com" } }, error: null });
        const mockWhere = vi.fn().mockResolvedValue([]);
        const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
        mockDbSelect.mockReturnValue({ from: mockFrom });

        const res = await POST(makeRequest(validBody));
        expect(res.status).toBe(404);
    });
});

// ─── Happy path ───────────────────────────────────────────────────────────────

describe("POST /api/events/invite — happy path", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("sends invite email and returns success", async () => {
        mockGetUser.mockResolvedValue({ data: { user: { id: "user-1", email: "host@example.com" } }, error: null });
        setupEventAndProfile();
        mockSendEmail.mockResolvedValue(true);

        const res = await POST(makeRequest(validBody));
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.success).toBe(true);
        expect(mockSendEmail).toHaveBeenCalledWith("host@example.com", expect.anything(), undefined, ["alice@example.com", "bob@example.com"]);
    });

    it("returns success=false when email send fails", async () => {
        mockGetUser.mockResolvedValue({ data: { user: { id: "user-1", email: "host@example.com" } }, error: null });
        setupEventAndProfile();
        mockSendEmail.mockResolvedValue(false);

        const res = await POST(makeRequest(validBody));
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.success).toBe(false);
    });
});
