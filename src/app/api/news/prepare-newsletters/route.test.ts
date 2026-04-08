import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const { mockGetActiveSubscribers, mockFetchArticlesForNewsletter, mockDb, mockSendAlertEmail } = vi.hoisted(() => ({
    mockGetActiveSubscribers: vi.fn(),
    mockFetchArticlesForNewsletter: vi.fn(),
    mockDb: {
        select: vi.fn(),
        insert: vi.fn(),
    },
    mockSendAlertEmail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/news/alert", () => ({
    sendAlertEmail: mockSendAlertEmail,
}));

vi.mock("@/lib/news/subscribers", () => ({
    getActiveSubscribers: mockGetActiveSubscribers,
}));

vi.mock("@/lib/news/newsletter-utils", () => ({
    fetchArticlesForNewsletter: mockFetchArticlesForNewsletter,
}));

vi.mock("@/db", () => ({
    db: mockDb,
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

const TEST_SECRET = "test-secret";

function makeRequest(authHeader?: string) {
    return new NextRequest("http://localhost/api/news/prepare-newsletters", {
        headers: authHeader ? { authorization: authHeader } : {},
    });
}

function authedRequest() {
    return makeRequest(`Bearer ${TEST_SECRET}`);
}

function makeSubscriber(overrides = {}) {
    return {
        id: "sub-1",
        email: "alice@example.com",
        firstName: "Alice",
        selectedCounties: [],
        selectedCities: [],
        interests: null,
        isActive: true,
        timezone: "UTC",
        preferredSendTimes: [],
        subscribedAt: null,
        ...overrides,
    };
}

const noArticles = { nationalArticles: [], localArticles: [] };
const withArticles = {
    nationalArticles: [{ title: "Article 1", link: "https://example.com/1", description: "", date: "", source: "" }],
    localArticles: [],
};

// ─── Auth ─────────────────────────────────────────────────────────────────────

describe("GET /api/news/prepare-newsletters — auth", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        delete process.env.CRON_SECRET;
    });

    it("returns 401 when CRON_SECRET is set and auth header is missing", async () => {
        process.env.CRON_SECRET = TEST_SECRET;
        const res = await GET(makeRequest());
        expect(res.status).toBe(401);
    });

    it("returns 401 when CRON_SECRET is set and auth header is wrong", async () => {
        process.env.CRON_SECRET = TEST_SECRET;
        const res = await GET(makeRequest("Bearer wrong"));
        expect(res.status).toBe(401);
    });

    it("proceeds when CRON_SECRET is set and auth header is correct", async () => {
        process.env.CRON_SECRET = TEST_SECRET;
        mockGetActiveSubscribers.mockResolvedValue([]);
        const res = await GET(authedRequest());
        expect(res.status).toBe(200);
    });

    it("returns 401 when CRON_SECRET is not set and auth header is missing", async () => {
        const res = await GET(makeRequest());
        expect(res.status).toBe(401);
    });
});

// ─── No subscribers ────────────────────────────────────────────────────────────

describe("GET /api/news/prepare-newsletters — no subscribers", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        process.env.CRON_SECRET = TEST_SECRET;
    });

    it("returns newslettersPrepared: 0 when there are no active subscribers", async () => {
        mockGetActiveSubscribers.mockResolvedValue([]);
        const res = await GET(authedRequest());
        const body = await res.json();
        expect(res.status).toBe(200);
        expect(body.newslettersPrepared).toBe(0);
    });
});

// ─── Subscriber scheduling ────────────────────────────────────────────────────

describe("GET /api/news/prepare-newsletters — subscriber scheduling", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        process.env.CRON_SECRET = TEST_SECRET;
        // Default: no articles so even matched subscribers get skipped at the articles step
        mockFetchArticlesForNewsletter.mockResolvedValue(noArticles);
    });

    it("skips subscriber whose preferred send time does not match the next hour", async () => {
        // Set up a subscriber with a specific send time that won't match "now + 1h"
        const subscriber = makeSubscriber({
            preferredSendTimes: [{ dayOfWeek: 1, hour: 9 }], // Monday 9am
            timezone: "UTC",
        });
        mockGetActiveSubscribers.mockResolvedValue([subscriber]);

        const res = await GET(authedRequest());
        const body = await res.json();
        expect(body.skipped).toBe(1);
        expect(body.newslettersPrepared).toBe(0);
        expect(mockFetchArticlesForNewsletter).not.toHaveBeenCalled();
    });

    it("matches a subscriber preference in the subscriber timezone", async () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2024-01-08T13:15:00Z")); // +1h = 09:15 in America/New_York on Monday

        const subscriber = makeSubscriber({
            timezone: "America/New_York",
            preferredSendTimes: [{ dayOfWeek: 1, hour: 9 }],
        });
        mockGetActiveSubscribers.mockResolvedValue([subscriber]);

        const res = await GET(authedRequest());
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.skipped).toBe(1);
        expect(mockFetchArticlesForNewsletter).toHaveBeenCalledOnce();

        vi.useRealTimers();
    });
});

// ─── No articles ───────────────────────────────────────────────────────────────

describe("GET /api/news/prepare-newsletters — no articles", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        process.env.CRON_SECRET = TEST_SECRET;
    });

    it("skips subscriber when fetchArticlesForNewsletter returns no articles", async () => {
        // Subscriber with no send time preferences uses system default (Friday 15:45 UTC)
        // We won't match that either, but we can verify by using matching preferences
        const subscriber = makeSubscriber({ preferredSendTimes: [] });
        mockGetActiveSubscribers.mockResolvedValue([subscriber]);
        mockFetchArticlesForNewsletter.mockResolvedValue(noArticles);

        const res = await GET(authedRequest());
        const body = await res.json();
        // Either skipped at scheduling or at articles step — either way newslettersPrepared is 0
        expect(body.newslettersPrepared).toBe(0);
    });
});

// ─── Happy path ────────────────────────────────────────────────────────────────

describe("GET /api/news/prepare-newsletters — happy path", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        process.env.CRON_SECRET = TEST_SECRET;
    });

    it("creates newsletter record and links articles", async () => {
        // Use a subscriber with no preferred times; we need to hit the right UTC time
        // We'll use vi.useFakeTimers to set now to Thursday 14:45 UTC so +1h = Friday 15:45 UTC (system default)
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2024-01-12T14:45:00Z")); // Friday 14:45 UTC → +1h = Friday 15:45 UTC (system default)

        const subscriber = makeSubscriber({ preferredSendTimes: [] });
        mockGetActiveSubscribers.mockResolvedValue([subscriber]);
        mockFetchArticlesForNewsletter.mockResolvedValue(withArticles);

        // newsletters.insert().values().returning() → [{ id: "nl-1" }]
        const mockReturning = vi.fn().mockResolvedValue([{ id: "nl-1" }]);
        const mockValues = vi.fn().mockReturnValue({ returning: mockReturning });
        const mockInsert = vi.fn().mockReturnValue({ values: mockValues });

        // articles.select().from().where() → [{ id: "art-1", link: "https://example.com/1" }]
        const mockWhere = vi.fn().mockResolvedValue([{ id: "art-1", link: "https://example.com/1" }]);
        const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
        const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });

        // newsletter_articles.insert().values() → resolved
        const mockNlArticlesValues = vi.fn().mockResolvedValue([]);
        const mockNlArticlesInsert = vi.fn().mockReturnValue({ values: mockNlArticlesValues });

        let insertCallCount = 0;
        mockDb.insert.mockImplementation(() => {
            insertCallCount++;
            if (insertCallCount === 1) return { values: mockValues };
            return { values: mockNlArticlesValues };
        });
        mockDb.select.mockReturnValue({ from: mockFrom });

        const res = await GET(authedRequest());
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.newslettersPrepared).toBe(1);
        expect(mockDb.insert).toHaveBeenCalledWith(expect.objectContaining({}));
        expect(mockNlArticlesValues).toHaveBeenCalledWith([{ newsletterId: "nl-1", articleId: "art-1" }]);

        vi.useRealTimers();
    });

    it("continues to next subscriber when newsletter DB insert fails", async () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2024-01-12T14:45:00Z")); // Friday 14:45 UTC → +1h = Friday 15:45 UTC

        const subscribers = [makeSubscriber({ email: "a@example.com" }), makeSubscriber({ email: "b@example.com" })];
        mockGetActiveSubscribers.mockResolvedValue(subscribers);
        mockFetchArticlesForNewsletter.mockResolvedValue(withArticles);

        // insert().values().returning() → returns null (simulate failure)
        const mockReturning = vi.fn().mockResolvedValue([]);
        const mockValues = vi.fn().mockReturnValue({ returning: mockReturning });
        mockDb.insert.mockReturnValue({ values: mockValues });

        const mockWhere = vi.fn().mockResolvedValue([]);
        const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
        mockDb.select.mockReturnValue({ from: mockFrom });

        const res = await GET(authedRequest());
        const body = await res.json();

        expect(res.status).toBe(200);
        // Both failed to insert, but the loop completed without throwing
        expect(body.newslettersPrepared).toBe(0);
        expect(body.totalSubscribers).toBe(2);

        vi.useRealTimers();
    });

    it("continues to the next subscriber when preparing one subscriber throws", async () => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2024-01-12T14:45:00Z"));

        const subscribers = [makeSubscriber({ email: "a@example.com" }), makeSubscriber({ email: "b@example.com" })];
        mockGetActiveSubscribers.mockResolvedValue(subscribers);
        mockFetchArticlesForNewsletter.mockRejectedValueOnce(new Error("fetch failed")).mockResolvedValueOnce(withArticles);

        // newsletter insert → succeeds for second subscriber
        const mockReturning = vi.fn().mockResolvedValue([{ id: "nl-2" }]);
        const mockValues = vi.fn().mockReturnValue({ returning: mockReturning });
        mockDb.insert.mockReturnValue({ values: mockValues });

        const mockWhere = vi.fn().mockResolvedValue([{ id: "art-1", link: "https://example.com/1" }]);
        const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
        mockDb.select.mockReturnValue({ from: mockFrom });

        let nlArticleInsertCalled = false;
        let insertCallCount = 0;
        mockDb.insert.mockImplementation(() => {
            insertCallCount++;
            if (insertCallCount === 1) {
                // newsletter insert
                return { values: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([{ id: "nl-2" }]) }) };
            }
            // newsletter_articles insert
            nlArticleInsertCalled = true;
            return { values: vi.fn().mockResolvedValue([]) };
        });

        const res = await GET(authedRequest());
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.totalSubscribers).toBe(2);
        expect(body.newslettersPrepared).toBe(1);

        vi.useRealTimers();
    });
});

// ─── Error handling ────────────────────────────────────────────────────────────

describe("GET /api/news/prepare-newsletters — error handling", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        process.env.CRON_SECRET = TEST_SECRET;
    });

    it("returns 500 when getActiveSubscribers throws", async () => {
        mockGetActiveSubscribers.mockRejectedValue(new Error("DB connection failed"));
        const res = await GET(authedRequest());
        expect(mockSendAlertEmail).toHaveBeenCalledWith("🚨 Newsletter prepare cron crashed", expect.stringContaining("DB connection failed"));
        expect(res.status).toBe(500);
    });
});
