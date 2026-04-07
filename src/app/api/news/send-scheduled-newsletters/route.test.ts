import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const { mockGetSubscriberByEmail, mockSendNewsletterToSubscriber, mockDb, mockSendAlertEmail } = vi.hoisted(() => ({
    mockGetSubscriberByEmail: vi.fn(),
    mockSendNewsletterToSubscriber: vi.fn(),
    mockDb: {
        select: vi.fn(),
        update: vi.fn(),
    },
    mockSendAlertEmail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/news/alert", () => ({
    sendAlertEmail: mockSendAlertEmail,
}));

vi.mock("@/lib/news/subscribers", () => ({
    getSubscriberByEmail: mockGetSubscriberByEmail,
}));

vi.mock("@/lib/news/newsletter-service", () => ({
    EmailService: vi.fn().mockImplementation(function () {
        return { sendNewsletterToSubscriber: mockSendNewsletterToSubscriber };
    }),
}));

vi.mock("@/lib/news/newsletter-utils", () => ({
    generateEmailContentFromArticles: vi.fn().mockReturnValue("<p>content</p>"),
    splitArticlesIntoNationalAndLocal: vi.fn().mockReturnValue({ nationalArticles: [], localArticles: [] }),
}));

vi.mock("@/db", () => ({
    db: mockDb,
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeRequest(authHeader?: string) {
    return new NextRequest("http://localhost/api/news/send-scheduled-newsletters", {
        headers: authHeader ? { authorization: authHeader } : {},
    });
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

function makeNewsletter(overrides = {}) {
    return {
        id: "nl-1",
        subscriber_email: "alice@example.com",
        scheduled_send_at: new Date(Date.now() - 1000).toISOString(),
        ...overrides,
    };
}

// Sets up mockDb to return a scheduled newsletters query result
// newsletters select: .from().where().orderBy() → scheduledNewsletters
// newsletter_articles select: .from().where() → naRows
// articles select (with joins): .from().leftJoin().leftJoin().where() → articleRows
// articleCounties, articleCities, articleTags: .from().leftJoin().where() or .from().where() → []
function setupNewslettersFetch(scheduledNewsletters: unknown[], error: unknown = null) {
    if (error) {
        mockDb.select.mockImplementation(() => {
            throw error;
        });
        const mockUpdateWhere = vi.fn().mockResolvedValue([]);
        const mockSet = vi.fn().mockReturnValue({ where: mockUpdateWhere });
        mockDb.update.mockReturnValue({ set: mockSet });
        return { mockUpdateWhere, mockSet };
    }

    let callCount = 0;
    mockDb.select.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
            // newsletters query: .from().where().orderBy()
            const mockOrderBy = vi.fn().mockResolvedValue(scheduledNewsletters);
            const mockWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
            return { from: vi.fn().mockReturnValue({ where: mockWhere }) };
        }
        // All subsequent select calls (newsletter_articles, articles, counties, cities, tags)
        // return empty arrays
        const mockWhere2 = vi.fn().mockResolvedValue([]);
        const mockLeftJoin2 = vi.fn().mockReturnValue({ where: mockWhere2 });
        const mockLeftJoin1 = vi.fn().mockReturnValue({ leftJoin: mockLeftJoin2, where: mockWhere2 });
        return { from: vi.fn().mockReturnValue({ where: mockWhere2, leftJoin: mockLeftJoin1 }) };
    });

    const mockUpdateWhere = vi.fn().mockResolvedValue([]);
    const mockSet = vi.fn().mockReturnValue({ where: mockUpdateWhere });
    mockDb.update.mockReturnValue({ set: mockSet });

    return { mockUpdateWhere, mockSet };
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

describe("GET /api/news/send-scheduled-newsletters — auth", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        delete process.env.CRON_SECRET;
    });

    it("returns 401 when CRON_SECRET is set and auth header is missing", async () => {
        process.env.CRON_SECRET = "secret";
        const res = await GET(makeRequest());
        expect(res.status).toBe(401);
    });

    it("returns 401 when CRON_SECRET is set and auth header is wrong", async () => {
        process.env.CRON_SECRET = "secret";
        const res = await GET(makeRequest("Bearer wrong"));
        expect(res.status).toBe(401);
    });

    it("proceeds when CRON_SECRET is set and auth header is correct", async () => {
        process.env.CRON_SECRET = "secret";
        setupNewslettersFetch([]);
        const res = await GET(makeRequest("Bearer secret"));
        expect(res.status).toBe(200);
    });
});

// ─── No newsletters ────────────────────────────────────────────────────────────

describe("GET /api/news/send-scheduled-newsletters — no newsletters", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        delete process.env.CRON_SECRET;
    });

    it("returns emailsSent: 0 when there are no newsletters ready", async () => {
        setupNewslettersFetch([]);
        const res = await GET(makeRequest());
        const body = await res.json();
        expect(res.status).toBe(200);
        expect(body.emailsSent).toBe(0);
    });

    it("returns 500 when DB fetch fails", async () => {
        setupNewslettersFetch([], { message: "DB error" });
        const res = await GET(makeRequest());
        expect(res.status).toBe(500);
    });
});

// ─── Subscriber not found / inactive ─────────────────────────────────────────

describe("GET /api/news/send-scheduled-newsletters — inactive subscriber", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        delete process.env.CRON_SECRET;
    });

    it("marks newsletter as failed when subscriber is not found", async () => {
        const { mockSet } = setupNewslettersFetch([makeNewsletter()]);
        mockGetSubscriberByEmail.mockResolvedValue(null);

        const res = await GET(makeRequest());
        const body = await res.json();

        expect(body.errors).toBe(1);
        expect(body.emailsSent).toBe(0);
        expect(mockSet).toHaveBeenCalledWith({ status: "failed" });
    });

    it("marks newsletter as failed when subscriber is inactive", async () => {
        const { mockSet } = setupNewslettersFetch([makeNewsletter()]);
        mockGetSubscriberByEmail.mockResolvedValue(makeSubscriber({ isActive: false }));

        const res = await GET(makeRequest());
        const body = await res.json();

        expect(body.errors).toBe(1);
        expect(mockSet).toHaveBeenCalledWith({ status: "failed" });
    });
});

// ─── Happy path ────────────────────────────────────────────────────────────────

describe("GET /api/news/send-scheduled-newsletters — happy path", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        delete process.env.CRON_SECRET;
    });

    it("sends email and marks newsletter as sent", async () => {
        const { mockSet } = setupNewslettersFetch([makeNewsletter()]);
        mockGetSubscriberByEmail.mockResolvedValue(makeSubscriber());
        mockSendNewsletterToSubscriber.mockResolvedValue(true);

        const res = await GET(makeRequest());
        const body = await res.json();

        expect(body.emailsSent).toBe(1);
        expect(body.errors).toBe(0);
        expect(mockSet).toHaveBeenCalledWith(expect.objectContaining({ status: "sent" }));
    });

    it("marks newsletter as failed when email send returns false", async () => {
        const { mockSet } = setupNewslettersFetch([makeNewsletter()]);
        mockGetSubscriberByEmail.mockResolvedValue(makeSubscriber());
        mockSendNewsletterToSubscriber.mockResolvedValue(false);

        const res = await GET(makeRequest());
        const body = await res.json();

        expect(body.errors).toBe(1);
        expect(body.emailsSent).toBe(0);
        expect(mockSet).toHaveBeenCalledWith({ status: "failed" });
    });

    it("processes multiple newsletters and returns correct counts", async () => {
        setupNewslettersFetch([
            makeNewsletter({ id: "nl-1", subscriber_email: "a@example.com" }),
            makeNewsletter({ id: "nl-2", subscriber_email: "b@example.com" }),
            makeNewsletter({ id: "nl-3", subscriber_email: "c@example.com" }),
        ]);
        mockGetSubscriberByEmail.mockResolvedValue(makeSubscriber());
        mockSendNewsletterToSubscriber.mockResolvedValueOnce(true).mockResolvedValueOnce(false).mockResolvedValueOnce(true);

        const res = await GET(makeRequest());
        const body = await res.json();

        expect(body.emailsSent).toBe(2);
        expect(body.errors).toBe(1);
        expect(body.totalNewsletters).toBe(3);
    });
});

// ─── Per-newsletter error isolation ──────────────────────────────────────────

describe("GET /api/news/send-scheduled-newsletters — error isolation", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        delete process.env.CRON_SECRET;
    });

    it("marks newsletter as failed and continues when processing throws", async () => {
        setupNewslettersFetch([
            makeNewsletter({ id: "nl-1", subscriber_email: "a@example.com" }),
            makeNewsletter({ id: "nl-2", subscriber_email: "b@example.com" }),
        ]);
        mockGetSubscriberByEmail.mockRejectedValueOnce(new Error("unexpected crash")).mockResolvedValueOnce(makeSubscriber());
        mockSendNewsletterToSubscriber.mockResolvedValue(true);

        const res = await GET(makeRequest());
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.emailsSent).toBe(1);
        expect(body.errors).toBe(1);
    });

    it("alerts when a newsletter fails and status update also throws", async () => {
        setupNewslettersFetch([makeNewsletter()]);

        // Override update mock to throw on the second call (inside the catch block)
        let updateCallCount = 0;
        const mockUpdateWhere = vi.fn().mockImplementation(() => {
            updateCallCount++;
            if (updateCallCount >= 1) {
                throw new Error("status update failed");
            }
            return Promise.resolve([]);
        });
        const mockSet = vi.fn().mockReturnValue({ where: mockUpdateWhere });
        mockDb.update.mockReturnValue({ set: mockSet });

        mockGetSubscriberByEmail.mockRejectedValue(new Error("unexpected crash"));

        const res = await GET(makeRequest());
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.emailsSent).toBe(0);
        expect(body.errors).toBe(1);
        expect(mockSendAlertEmail).toHaveBeenCalledWith("⚠️ Newsletter send failures: 1/1", expect.stringContaining("Failed: 1"));
    });
});

describe("GET /api/news/send-scheduled-newsletters — top-level error handling", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        delete process.env.CRON_SECRET;
    });

    it("sends an alert when the cron crashes before processing newsletters", async () => {
        mockDb.select.mockImplementation(() => {
            throw new Error("query crashed");
        });

        const res = await GET(makeRequest());
        const body = await res.json();

        expect(res.status).toBe(500);
        expect(body.error).toBe("Internal server error");
        expect(mockSendAlertEmail).toHaveBeenCalledWith("🚨 Newsletter send cron crashed", expect.stringContaining("query crashed"));
    });
});
