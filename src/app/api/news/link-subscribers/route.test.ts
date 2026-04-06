import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "./route";

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

function makePost(authHeader?: string) {
    return new NextRequest("http://localhost/api/news/link-subscribers", {
        method: "POST",
        headers: authHeader ? { authorization: authHeader } : {},
    });
}

function makeGet() {
    return new NextRequest("http://localhost/api/news/link-subscribers");
}

function authAs(userId = "user-1", email = "user@example.com") {
    mockGetUser.mockResolvedValue({ data: { user: { id: userId, email } }, error: null });
}

function noAuth() {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
}

// ─── POST (admin) ──────────────────────────────────────────────────────────────

describe("POST /api/news/link-subscribers — auth", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        process.env.CRON_SECRET = "secret";
    });

    it("returns 401 when auth header is missing", async () => {
        const res = await POST(makePost());
        expect(res.status).toBe(401);
    });

    it("returns 401 when auth header is wrong", async () => {
        const res = await POST(makePost("Bearer wrong"));
        expect(res.status).toBe(401);
    });
});

describe("POST /api/news/link-subscribers — processing", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        process.env.CRON_SECRET = "secret";
    });

    it("returns 500 when subscriber fetch fails", async () => {
        const mockSelect = vi.fn().mockResolvedValue({ data: null, error: { message: "DB error" } });
        mockFrom.mockReturnValue({ select: mockSelect });

        const res = await POST(makePost("Bearer secret"));
        expect(res.status).toBe(500);
    });

    it("returns counts with 0 when no subscribers", async () => {
        const mockSelect = vi.fn().mockResolvedValue({ data: [], error: null });
        mockFrom.mockReturnValue({ select: mockSelect });

        const res = await POST(makePost("Bearer secret"));
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.total).toBe(0);
        expect(body.linked).toBe(0);
    });

    it("reports already_linked for subscribers with existing profile link", async () => {
        const subscribers = [{ id: "sub-1", email: "alice@example.com" }];

        let callCount = 0;
        mockFrom.mockImplementation(() => {
            callCount++;
            if (callCount === 1) {
                // get all subscribers
                return { select: vi.fn().mockResolvedValue({ data: subscribers, error: null }) };
            }
            // check existing link — found
            const mockSingle = vi.fn().mockResolvedValue({ data: { id: "prof-1", subscriber_id: "sub-1" } });
            const mockEq = vi.fn().mockReturnValue({ single: mockSingle });
            return { select: vi.fn().mockReturnValue({ eq: mockEq }) };
        });

        const res = await POST(makePost("Bearer secret"));
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.alreadyLinked).toBe(1);
        expect(body.results[0].status).toBe("already_linked");
    });
});

// ─── GET (user) ────────────────────────────────────────────────────────────────

describe("GET /api/news/link-subscribers — auth", () => {
    beforeEach(() => vi.clearAllMocks());

    it("returns 401 when not authenticated", async () => {
        noAuth();
        const res = await GET(makeGet());
        expect(res.status).toBe(401);
    });
});

describe("GET /api/news/link-subscribers — already linked", () => {
    beforeEach(() => vi.clearAllMocks());

    it("returns subscriberId when profile already has subscriber", async () => {
        authAs();
        const mockSingle = vi.fn().mockResolvedValue({ data: { subscriber_id: "sub-1" }, error: null });
        const mockEq = vi.fn().mockReturnValue({ single: mockSingle });
        mockFrom.mockReturnValue({ select: vi.fn().mockReturnValue({ eq: mockEq }) });

        const res = await GET(makeGet());
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.subscriberId).toBe("sub-1");
    });

    it("returns 500 on profile fetch error", async () => {
        authAs();
        const mockSingle = vi.fn().mockResolvedValue({ data: null, error: { message: "DB error" } });
        const mockEq = vi.fn().mockReturnValue({ single: mockSingle });
        mockFrom.mockReturnValue({ select: vi.fn().mockReturnValue({ eq: mockEq }) });

        const res = await GET(makeGet());
        expect(res.status).toBe(500);
    });
});

describe("GET /api/news/link-subscribers — linking", () => {
    beforeEach(() => vi.clearAllMocks());

    it("returns linked:false when no subscriber found for email", async () => {
        authAs("user-1", "alice@example.com");

        let callCount = 0;
        mockFrom.mockImplementation(() => {
            callCount++;
            if (callCount === 1) {
                // profile — no subscriber_id
                const mockSingle = vi.fn().mockResolvedValue({ data: { subscriber_id: null }, error: null });
                const mockEq = vi.fn().mockReturnValue({ single: mockSingle });
                return { select: vi.fn().mockReturnValue({ eq: mockEq }) };
            }
            // subscriber lookup — not found
            const mockSingle = vi.fn().mockResolvedValue({ data: null, error: { message: "not found" } });
            const mockEq = vi.fn().mockReturnValue({ single: mockSingle });
            return { select: vi.fn().mockReturnValue({ eq: mockEq }) };
        });

        const res = await GET(makeGet());
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.linked).toBe(false);
    });

    it("links subscriber to profile and returns linked:true", async () => {
        authAs("user-1", "alice@example.com");
        const subscriber = {
            id: "sub-1",
            full_name: "Alice",
            interests: ["multifamily"],
            timezone: "America/New_York",
            preferred_send_times: ["08:00"],
            is_active: true,
        };

        let callCount = 0;
        mockFrom.mockImplementation((table: string) => {
            callCount++;
            if (callCount === 1) {
                // profile fetch
                const mockSingle = vi.fn().mockResolvedValue({ data: { subscriber_id: null }, error: null });
                const mockEq = vi.fn().mockReturnValue({ single: mockSingle });
                return { select: vi.fn().mockReturnValue({ eq: mockEq }) };
            }
            if (table === "subscribers") {
                // subscriber lookup
                const mockSingle = vi.fn().mockResolvedValue({ data: subscriber, error: null });
                const mockEq = vi.fn().mockReturnValue({ single: mockSingle });
                return { select: vi.fn().mockReturnValue({ eq: mockEq }) };
            }
            // profile update
            return { update: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) }) };
        });

        const res = await GET(makeGet());
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.linked).toBe(true);
        expect(body.subscriberId).toBe("sub-1");
    });
});
