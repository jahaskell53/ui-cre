import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "./route";

const { mockGetUser, mockDb } = vi.hoisted(() => ({
    mockGetUser: vi.fn(),
    mockDb: {
        select: vi.fn(),
        update: vi.fn(),
    },
}));

vi.mock("@/utils/supabase/server", () => ({
    createClient: vi.fn().mockResolvedValue({
        auth: { getUser: mockGetUser },
    }),
}));

vi.mock("@/db", () => ({
    db: mockDb,
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
        mockDb.select.mockImplementation(() => {
            throw new Error("DB error");
        });

        const res = await POST(makePost("Bearer secret"));
        expect(res.status).toBe(500);
    });

    it("returns counts with 0 when no subscribers", async () => {
        // db.select().from()  → []
        const mockFrom = vi.fn().mockResolvedValue([]);
        mockDb.select.mockReturnValue({ from: mockFrom });

        const res = await POST(makePost("Bearer secret"));
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.total).toBe(0);
        expect(body.linked).toBe(0);
    });

    it("reports already_linked for subscribers with existing profile link", async () => {
        const subscriberList = [
            { id: "sub-1", email: "alice@example.com", fullName: "Alice", isActive: true, interests: null, timezone: null, preferredSendTimes: null },
        ];

        let callCount = 0;
        mockDb.select.mockImplementation(() => {
            callCount++;
            if (callCount === 1) {
                // get all subscribers
                return { from: vi.fn().mockResolvedValue(subscriberList) };
            }
            // check existing link — found
            const mockWhere = vi.fn().mockResolvedValue([{ id: "prof-1", subscriberId: "sub-1" }]);
            return { from: vi.fn().mockReturnValue({ where: mockWhere }) };
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
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("returns 401 when not authenticated", async () => {
        noAuth();
        const res = await GET(makeGet());
        expect(res.status).toBe(401);
    });
});

describe("GET /api/news/link-subscribers — already linked", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("returns subscriberId when profile already has subscriber", async () => {
        authAs();
        const mockWhere = vi.fn().mockResolvedValue([{ subscriberId: "sub-1" }]);
        mockDb.select.mockReturnValue({ from: vi.fn().mockReturnValue({ where: mockWhere }) });

        const res = await GET(makeGet());
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.subscriberId).toBe("sub-1");
    });

    it("returns 500 on profile fetch error", async () => {
        authAs();
        mockDb.select.mockImplementation(() => {
            throw new Error("DB error");
        });

        const res = await GET(makeGet());
        expect(res.status).toBe(500);
    });
});

describe("GET /api/news/link-subscribers — linking", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("returns linked:false when no subscriber found for email", async () => {
        authAs("user-1", "alice@example.com");

        let callCount = 0;
        mockDb.select.mockImplementation(() => {
            callCount++;
            if (callCount === 1) {
                // profile — no subscriber_id
                const mockWhere = vi.fn().mockResolvedValue([{ subscriberId: null }]);
                return { from: vi.fn().mockReturnValue({ where: mockWhere }) };
            }
            // subscriber lookup — not found
            const mockWhere = vi.fn().mockResolvedValue([]);
            return { from: vi.fn().mockReturnValue({ where: mockWhere }) };
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
            fullName: "Alice",
            interests: "multifamily",
            timezone: "America/New_York",
            preferredSendTimes: [{ dayOfWeek: 1, hour: 8 }],
            isActive: true,
        };

        let callCount = 0;
        mockDb.select.mockImplementation(() => {
            callCount++;
            if (callCount === 1) {
                // profile fetch
                const mockWhere = vi.fn().mockResolvedValue([{ subscriberId: null }]);
                return { from: vi.fn().mockReturnValue({ where: mockWhere }) };
            }
            // subscriber lookup
            const mockWhere = vi.fn().mockResolvedValue([subscriber]);
            return { from: vi.fn().mockReturnValue({ where: mockWhere }) };
        });

        // profile update
        const mockUpdateWhere = vi.fn().mockResolvedValue([]);
        const mockSet = vi.fn().mockReturnValue({ where: mockUpdateWhere });
        mockDb.update.mockReturnValue({ set: mockSet });

        const res = await GET(makeGet());
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.linked).toBe(true);
        expect(body.subscriberId).toBe("sub-1");
    });
});
