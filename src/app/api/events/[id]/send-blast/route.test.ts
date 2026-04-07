import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const { mockGetUser, mockDbSelect, mockDbInsert, mockGetUserById, mockSendEmail } = vi.hoisted(() => ({
    mockGetUser: vi.fn(),
    mockDbSelect: vi.fn(),
    mockDbInsert: vi.fn(),
    mockGetUserById: vi.fn(),
    mockSendEmail: vi.fn(),
}));

vi.mock("@/utils/supabase/server", () => ({
    createClient: vi.fn().mockResolvedValue({
        auth: { getUser: mockGetUser },
    }),
}));

vi.mock("@/utils/supabase/admin", () => ({
    createAdminClient: vi.fn().mockReturnValue({
        auth: { admin: { getUserById: mockGetUserById } },
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

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeRequest(body: Record<string, unknown>) {
    return new NextRequest("http://localhost/api/events/evt-1/send-blast", {
        method: "POST",
        body: JSON.stringify(body),
    });
}

const params = Promise.resolve({ id: "evt-1" });

const validBody = { subject: "Test Subject", message: "Hello attendees!" };

// ─── Auth & validation ────────────────────────────────────────────────────────

describe("POST /api/events/[id]/send-blast — auth & validation", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("returns 401 when not authenticated", async () => {
        mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
        const res = await POST(makeRequest(validBody), { params });
        expect(res.status).toBe(401);
    });

    it("returns 400 when subject is missing", async () => {
        mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
        const res = await POST(makeRequest({ message: "Hello" }), { params });
        expect(res.status).toBe(400);
    });

    it("returns 400 when message is missing", async () => {
        mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
        const res = await POST(makeRequest({ subject: "Hi" }), { params });
        expect(res.status).toBe(400);
    });
});

// ─── Event ownership ──────────────────────────────────────────────────────────

describe("POST /api/events/[id]/send-blast — event ownership", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("returns 404 when event not found", async () => {
        mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
        const mockWhere = vi.fn().mockResolvedValue([]);
        const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
        mockDbSelect.mockReturnValue({ from: mockFrom });

        const res = await POST(makeRequest(validBody), { params });
        expect(res.status).toBe(404);
    });

    it("returns 403 when user does not own the event", async () => {
        mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
        const mockWhere = vi.fn().mockResolvedValue([{ id: "evt-1", title: "Kickoff", userId: "other-user" }]);
        const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
        mockDbSelect.mockReturnValue({ from: mockFrom });

        const res = await POST(makeRequest(validBody), { params });
        expect(res.status).toBe(403);
    });
});

// ─── Registrations ────────────────────────────────────────────────────────────

describe("POST /api/events/[id]/send-blast — registrations", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("returns 400 when no registered attendees", async () => {
        mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });

        let callCount = 0;
        mockDbSelect.mockImplementation(() => {
            callCount++;
            if (callCount === 1) {
                const mockWhere = vi.fn().mockResolvedValue([{ id: "evt-1", title: "Kickoff", userId: "user-1" }]);
                return { from: vi.fn().mockReturnValue({ where: mockWhere }) };
            }
            const mockWhere = vi.fn().mockResolvedValue([]);
            return { from: vi.fn().mockReturnValue({ where: mockWhere }) };
        });

        const res = await POST(makeRequest(validBody), { params });
        expect(res.status).toBe(400);
    });

    it("returns 400 when no valid email addresses found", async () => {
        mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
        mockGetUserById.mockResolvedValue({ data: { user: null }, error: { message: "not found" } });

        let callCount = 0;
        mockDbSelect.mockImplementation(() => {
            callCount++;
            if (callCount === 1) {
                const mockWhere = vi.fn().mockResolvedValue([{ id: "evt-1", title: "Kickoff", userId: "user-1" }]);
                return { from: vi.fn().mockReturnValue({ where: mockWhere }) };
            }
            const mockWhere = vi.fn().mockResolvedValue([{ userId: "u1" }]);
            return { from: vi.fn().mockReturnValue({ where: mockWhere }) };
        });

        const res = await POST(makeRequest(validBody), { params });
        expect(res.status).toBe(400);
    });
});

// ─── Happy path ───────────────────────────────────────────────────────────────

describe("POST /api/events/[id]/send-blast — happy path", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("sends emails and returns counts", async () => {
        mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
        mockGetUserById
            .mockResolvedValueOnce({ data: { user: { email: "a@example.com" } }, error: null })
            .mockResolvedValueOnce({ data: { user: { email: "b@example.com" } }, error: null });
        mockSendEmail.mockResolvedValue(true);

        const mockReturning = vi.fn().mockResolvedValue([{ id: "blast-1" }]);
        const mockValues = vi.fn().mockReturnValue({ returning: mockReturning });
        mockDbInsert.mockReturnValue({ values: mockValues });

        let callCount = 0;
        mockDbSelect.mockImplementation(() => {
            callCount++;
            if (callCount === 1) {
                const mockWhere = vi.fn().mockResolvedValue([{ id: "evt-1", title: "Kickoff", userId: "user-1" }]);
                return { from: vi.fn().mockReturnValue({ where: mockWhere }) };
            }
            const mockWhere = vi.fn().mockResolvedValue([{ userId: "u1" }, { userId: "u2" }]);
            return { from: vi.fn().mockReturnValue({ where: mockWhere }) };
        });

        const res = await POST(makeRequest(validBody), { params });
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.sent).toBe(2);
        expect(body.failed).toBe(0);
        expect(body.total).toBe(2);
        expect(body.blast_id).toBe("blast-1");
    });

    it("counts failed emails correctly", async () => {
        mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
        mockGetUserById
            .mockResolvedValueOnce({ data: { user: { email: "a@example.com" } }, error: null })
            .mockResolvedValueOnce({ data: { user: { email: "b@example.com" } }, error: null });
        mockSendEmail.mockResolvedValueOnce(true).mockResolvedValueOnce(false);

        const mockReturning = vi.fn().mockResolvedValue([{ id: "blast-1" }]);
        const mockValues = vi.fn().mockReturnValue({ returning: mockReturning });
        mockDbInsert.mockReturnValue({ values: mockValues });

        let callCount = 0;
        mockDbSelect.mockImplementation(() => {
            callCount++;
            if (callCount === 1) {
                const mockWhere = vi.fn().mockResolvedValue([{ id: "evt-1", title: "Kickoff", userId: "user-1" }]);
                return { from: vi.fn().mockReturnValue({ where: mockWhere }) };
            }
            const mockWhere = vi.fn().mockResolvedValue([{ userId: "u1" }, { userId: "u2" }]);
            return { from: vi.fn().mockReturnValue({ where: mockWhere }) };
        });

        const res = await POST(makeRequest(validBody), { params });
        const body = await res.json();

        expect(body.sent).toBe(1);
        expect(body.failed).toBe(1);
    });
});
