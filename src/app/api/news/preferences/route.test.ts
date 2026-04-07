import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET, PUT } from "./route";

const { mockGetUser, mockDbSelect, mockDbInsert, mockDbUpdate, mockDbDelete } = vi.hoisted(() => ({
    mockGetUser: vi.fn(),
    mockDbSelect: vi.fn(),
    mockDbInsert: vi.fn(),
    mockDbUpdate: vi.fn(),
    mockDbDelete: vi.fn(),
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
        update: mockDbUpdate,
        delete: mockDbDelete,
    },
}));

function makePut(body: Record<string, unknown>) {
    return new NextRequest("http://localhost/api/news/preferences", {
        method: "PUT",
        body: JSON.stringify(body),
    });
}

function authAs(userId = "user-1", email = "user@example.com") {
    mockGetUser.mockResolvedValue({ data: { user: { id: userId, email } }, error: null });
}

function noAuth() {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
}

// ─── GET ──────────────────────────────────────────────────────────────────────

describe("GET /api/news/preferences", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("returns 401 when not authenticated", async () => {
        noAuth();
        const res = await GET();
        expect(res.status).toBe(401);
    });

    it("returns preferences without location data when no subscriber_id", async () => {
        authAs();
        const profileRow = {
            newsletterActive: true,
            newsletterInterests: ["multifamily"],
            newsletterTimezone: "America/New_York",
            newsletterPreferredSendTimes: ["08:00"],
            newsletterSubscribedAt: "2026-01-01",
            subscriberId: null,
        };
        const mockWhere = vi.fn().mockResolvedValue([profileRow]);
        const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
        mockDbSelect.mockReturnValue({ from: mockFrom });

        const res = await GET();
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.newsletter_active).toBe(true);
        expect(body.counties).toEqual([]);
        expect(body.cities).toEqual([]);
    });

    it("returns 500 on DB error (empty profile rows)", async () => {
        authAs();
        const mockWhere = vi.fn().mockResolvedValue([]);
        const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
        mockDbSelect.mockReturnValue({ from: mockFrom });

        const res = await GET();
        expect(res.status).toBe(500);
    });

    it("fetches counties and cities when subscriber_id is present", async () => {
        authAs();
        const profileRow = {
            newsletterActive: true,
            newsletterInterests: [],
            newsletterTimezone: "America/New_York",
            newsletterPreferredSendTimes: [],
            newsletterSubscribedAt: null,
            subscriberId: "sub-1",
        };

        let callCount = 0;
        mockDbSelect.mockImplementation(() => {
            callCount++;
            if (callCount === 1) {
                // profiles
                const mockWhere = vi.fn().mockResolvedValue([profileRow]);
                return { from: vi.fn().mockReturnValue({ where: mockWhere }) };
            }
            if (callCount === 2) {
                // subscriber_counties join
                const mockWhere = vi.fn().mockResolvedValue([{ countyName: "Suffolk" }]);
                const mockInnerJoin = vi.fn().mockReturnValue({ where: mockWhere });
                return { from: vi.fn().mockReturnValue({ innerJoin: mockInnerJoin }) };
            }
            // subscriber_cities join
            const mockWhere = vi.fn().mockResolvedValue([{ cityName: "Boston", cityState: "Massachusetts", cityStateAbbr: "MA" }]);
            const mockInnerJoin = vi.fn().mockReturnValue({ where: mockWhere });
            return { from: vi.fn().mockReturnValue({ innerJoin: mockInnerJoin }) };
        });

        const res = await GET();
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.counties).toEqual(["Suffolk"]);
        expect(body.cities[0].name).toBe("Boston");
    });
});

// ─── PUT ──────────────────────────────────────────────────────────────────────

describe("PUT /api/news/preferences — auth", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("returns 401 when not authenticated", async () => {
        noAuth();
        const res = await PUT(makePut({ newsletter_active: true }));
        expect(res.status).toBe(401);
    });
});

describe("PUT /api/news/preferences — existing subscriber", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("updates profile and subscriber when subscriber_id exists", async () => {
        authAs();

        const mockProfileUpdateWhere = vi.fn().mockResolvedValue(undefined);
        const mockProfileUpdateSet = vi.fn().mockReturnValue({ where: mockProfileUpdateWhere });

        const mockSubscriberUpdateWhere = vi.fn().mockResolvedValue(undefined);
        const mockSubscriberUpdateSet = vi.fn().mockReturnValue({ where: mockSubscriberUpdateWhere });

        const mockDeleteWhere = vi.fn().mockResolvedValue(undefined);
        mockDbDelete.mockReturnValue({ where: mockDeleteWhere });

        let updateCallCount = 0;
        mockDbUpdate.mockImplementation(() => {
            updateCallCount++;
            if (updateCallCount === 1) return { set: mockProfileUpdateSet };
            return { set: mockSubscriberUpdateSet };
        });

        let selectCallCount = 0;
        mockDbSelect.mockImplementation(() => {
            selectCallCount++;
            if (selectCallCount === 1) {
                // current profile
                const mockWhere = vi.fn().mockResolvedValue([{ subscriberId: "sub-1", fullName: "Alice" }]);
                return { from: vi.fn().mockReturnValue({ where: mockWhere }) };
            }
            return { from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }) };
        });

        const res = await PUT(makePut({ newsletter_active: true, newsletter_timezone: "America/New_York" }));
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.success).toBe(true);
    });

    it("returns 500 when profile update fails", async () => {
        authAs();

        let selectCallCount = 0;
        mockDbSelect.mockImplementation(() => {
            selectCallCount++;
            if (selectCallCount === 1) {
                const mockWhere = vi.fn().mockResolvedValue([{ subscriberId: null, fullName: "Alice" }]);
                return { from: vi.fn().mockReturnValue({ where: mockWhere }) };
            }
            return { from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }) };
        });

        mockDbUpdate.mockReturnValue({
            set: vi.fn().mockReturnValue({ where: vi.fn().mockRejectedValue(new Error("DB fail")) }),
        });

        const res = await PUT(makePut({ newsletter_active: false }));
        expect(res.status).toBe(500);
    });
});

describe("PUT /api/news/preferences — new subscriber creation", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("creates subscriber when enabling newsletter with no existing subscriber", async () => {
        authAs("user-1", "alice@example.com");

        let selectCallCount = 0;
        mockDbSelect.mockImplementation(() => {
            selectCallCount++;
            if (selectCallCount === 1) {
                // current profile — no subscriber_id
                const mockWhere = vi.fn().mockResolvedValue([{ subscriberId: null, fullName: "Alice" }]);
                return { from: vi.fn().mockReturnValue({ where: mockWhere }) };
            }
            if (selectCallCount === 2) {
                // check existing subscriber by email — none found
                const mockWhere = vi.fn().mockResolvedValue([]);
                return { from: vi.fn().mockReturnValue({ where: mockWhere }) };
            }
            return { from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }) };
        });

        // insert new subscriber
        const mockReturning = vi.fn().mockResolvedValue([{ id: "new-sub-1" }]);
        const mockValues = vi.fn().mockReturnValue({ returning: mockReturning });
        mockDbInsert.mockReturnValue({ values: mockValues });

        // profile update
        const mockUpdateWhere = vi.fn().mockResolvedValue(undefined);
        const mockUpdateSet = vi.fn().mockReturnValue({ where: mockUpdateWhere });
        mockDbUpdate.mockReturnValue({ set: mockUpdateSet });

        const res = await PUT(makePut({ newsletter_active: true }));
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.success).toBe(true);
    });
});
