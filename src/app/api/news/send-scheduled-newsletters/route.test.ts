import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const { mockGetSubscriberByEmail, mockSendNewsletterToSubscriber, mockFrom, mockSendAlertEmail } = vi.hoisted(() => ({
    mockGetSubscriberByEmail: vi.fn(),
    mockSendNewsletterToSubscriber: vi.fn(),
    mockFrom: vi.fn(),
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

vi.mock("@/utils/supabase/admin", () => ({
    createAdminClient: vi.fn().mockReturnValue({ from: mockFrom }),
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
        newsletter_articles: [],
        ...overrides,
    };
}

// Sets up mockFrom to return a scheduled newsletters query result
function setupNewslettersFetch(newsletters: unknown[], error: unknown = null) {
    const mockOrder = vi.fn().mockResolvedValue({ data: newsletters, error });
    const mockLte = vi.fn().mockReturnValue({ order: mockOrder });
    const mockEq = vi.fn().mockReturnValue({ lte: mockLte });
    const mockNewslettersSelect = vi.fn().mockReturnValue({ eq: mockEq });

    const mockUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
    });

    mockFrom.mockImplementation((table: string) => {
        if (table === "newsletters") return { select: mockNewslettersSelect, update: mockUpdate };
        return {};
    });

    return { mockUpdate };
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
        const { mockUpdate } = setupNewslettersFetch([makeNewsletter()]);
        mockGetSubscriberByEmail.mockResolvedValue(null);

        const res = await GET(makeRequest());
        const body = await res.json();

        expect(body.errors).toBe(1);
        expect(body.emailsSent).toBe(0);
        expect(mockUpdate).toHaveBeenCalledWith({ status: "failed" });
    });

    it("marks newsletter as failed when subscriber is inactive", async () => {
        const { mockUpdate } = setupNewslettersFetch([makeNewsletter()]);
        mockGetSubscriberByEmail.mockResolvedValue(makeSubscriber({ isActive: false }));

        const res = await GET(makeRequest());
        const body = await res.json();

        expect(body.errors).toBe(1);
        expect(mockUpdate).toHaveBeenCalledWith({ status: "failed" });
    });
});

// ─── Happy path ────────────────────────────────────────────────────────────────

describe("GET /api/news/send-scheduled-newsletters — happy path", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        delete process.env.CRON_SECRET;
    });

    it("sends email and marks newsletter as sent", async () => {
        const { mockUpdate } = setupNewslettersFetch([makeNewsletter()]);
        mockGetSubscriberByEmail.mockResolvedValue(makeSubscriber());
        mockSendNewsletterToSubscriber.mockResolvedValue(true);

        const res = await GET(makeRequest());
        const body = await res.json();

        expect(body.emailsSent).toBe(1);
        expect(body.errors).toBe(0);
        expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ status: "sent" }));
    });

    it("marks newsletter as failed when email send returns false", async () => {
        const { mockUpdate } = setupNewslettersFetch([makeNewsletter()]);
        mockGetSubscriberByEmail.mockResolvedValue(makeSubscriber());
        mockSendNewsletterToSubscriber.mockResolvedValue(false);

        const res = await GET(makeRequest());
        const body = await res.json();

        expect(body.errors).toBe(1);
        expect(body.emailsSent).toBe(0);
        expect(mockUpdate).toHaveBeenCalledWith({ status: "failed" });
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
});
