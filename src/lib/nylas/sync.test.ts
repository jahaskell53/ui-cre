import { beforeEach, describe, expect, it, vi } from "vitest";
import { NylasRateLimitError } from "./client";
import { syncAllContacts } from "./sync";

const { mockGetMessages, mockGetCalendarEvents, mockFrom, mockRecalculateNetworkStrength } = vi.hoisted(() => ({
    mockGetMessages: vi.fn(),
    mockGetCalendarEvents: vi.fn(),
    mockFrom: vi.fn(),
    mockRecalculateNetworkStrength: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("./client", async (importOriginal) => {
    const real = await importOriginal<any>();
    return {
        ...real,
        getMessages: mockGetMessages,
        getCalendarEvents: mockGetCalendarEvents,
    };
});

vi.mock("./config", () => ({
    NYLAS_SYNC_CONFIG: { emailLimit: 100, calendarLimit: 100 },
}));

vi.mock("@/utils/supabase/admin", () => ({
    createAdminClient: vi.fn().mockReturnValue({ from: mockFrom }),
}));

vi.mock("@/lib/news/gemini", () => ({
    makeGeminiCall: vi.fn(),
}));

vi.mock("../../../instrumentation", () => ({
    getLangfuseClient: vi.fn().mockReturnValue(null),
}));

vi.mock("@/lib/network-strength", () => ({
    recalculateNetworkStrengthForUser: mockRecalculateNetworkStrength,
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeRateLimitError(retryAfterMs = 60_000, itemsCollected = 0) {
    return new NylasRateLimitError("Rate limited", 429, retryAfterMs, itemsCollected);
}

/**
 * Sets up mockFrom for integration queries only (rate-limit/error tests where
 * syncEmailContacts/syncCalendarContacts throw before reaching their own DB calls).
 */
function setupIntegrationSupabase(
    integration: Record<string, unknown> = {
        id: "int-1",
        email_address: null,
        first_sync_at: null,
        last_sync_at: null,
    },
) {
    const mockSingle = vi.fn().mockResolvedValue({ data: integration, error: null });
    const mockSelectEq = vi.fn().mockReturnValue({ single: mockSingle });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockSelectEq });
    const mockUpdateEq = vi.fn().mockResolvedValue({ error: null });
    const mockUpdate = vi.fn().mockReturnValue({ eq: mockUpdateEq });

    mockFrom.mockImplementation((table: string) => {
        if (table === "integrations") return { select: mockSelect, update: mockUpdate };
        return {};
    });

    return { mockUpdate, mockUpdateEq, mockSelect, mockSingle };
}

/**
 * Sets up mockFrom for the full successful sync path (empty messages/events).
 * Handles the 'people' table query inside syncCalendarContacts.
 */
function setupSuccessSupabase(
    integration: Record<string, unknown> = {
        id: "int-1",
        email_address: null, // null → syncEmailContacts returns 0 via early return
        first_sync_at: null,
        last_sync_at: null,
    },
) {
    // people table: syncCalendarContacts always fetches existing people
    const mockPeopleIn = vi.fn().mockResolvedValue({ data: [], error: null });
    const mockPeopleEq = vi.fn().mockReturnValue({ in: mockPeopleIn });
    const mockPeopleSelect = vi.fn().mockReturnValue({ eq: mockPeopleEq });

    // integrations table: select and update
    const mockSingle = vi.fn().mockResolvedValue({ data: integration, error: null });
    const mockSelectEq = vi.fn().mockReturnValue({ single: mockSingle });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockSelectEq });
    const mockUpdateEq = vi.fn().mockResolvedValue({ error: null });
    const mockUpdate = vi.fn().mockReturnValue({ eq: mockUpdateEq });

    mockFrom.mockImplementation((table: string) => {
        if (table === "integrations") return { select: mockSelect, update: mockUpdate };
        if (table === "people") return { select: mockPeopleSelect };
        return {};
    });

    return { mockUpdate };
}

// ─── Rate limit handling ──────────────────────────────────────────────────────

describe("syncAllContacts — rate limit handling", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockRecalculateNetworkStrength.mockResolvedValue(undefined);
    });

    it("marks integration as rate_limited when email sync hits rate limit", async () => {
        const { mockUpdate } = setupIntegrationSupabase();
        mockGetMessages.mockRejectedValue(makeRateLimitError(30_000));
        mockGetCalendarEvents.mockRejectedValue(makeRateLimitError(30_000));

        const result = await syncAllContacts("grant-1", "user-1");

        expect(result.rateLimited).toBe(true);
        expect(result.retryAfterMs).toBe(30_000);
        expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ status: "rate_limited" }));
    });

    it("marks integration as rate_limited when only calendar sync is rate limited", async () => {
        setupIntegrationSupabase();
        // Email sync succeeds (messages = [], returns 0 via early return since email_address is null)
        mockGetMessages.mockResolvedValue([]);
        mockGetCalendarEvents.mockRejectedValue(makeRateLimitError(45_000));

        const result = await syncAllContacts("grant-1", "user-1");

        expect(result.rateLimited).toBe(true);
        expect(result.retryAfterMs).toBe(45_000);
    });

    it("uses the longer retry delay when both email and calendar are rate limited", async () => {
        setupIntegrationSupabase();
        mockGetMessages.mockRejectedValue(makeRateLimitError(30_000));
        mockGetCalendarEvents.mockRejectedValue(makeRateLimitError(90_000));

        const result = await syncAllContacts("grant-1", "user-1");

        expect(result.rateLimited).toBe(true);
        expect(result.retryAfterMs).toBe(90_000);
    });
});

// ─── Error propagation ────────────────────────────────────────────────────────

describe("syncAllContacts — error propagation", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("marks integration as error and rethrows when email sync throws", async () => {
        const { mockUpdate } = setupIntegrationSupabase();
        const crash = new Error("Nylas API down");
        mockGetMessages.mockRejectedValue(crash);

        await expect(syncAllContacts("grant-1", "user-1")).rejects.toThrow("Nylas API down");
        expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ status: "error" }));
    });

    it("marks integration as error and rethrows when calendar sync throws", async () => {
        const { mockUpdate } = setupIntegrationSupabase();
        mockGetMessages.mockResolvedValue([]);
        mockGetCalendarEvents.mockRejectedValue(new Error("Calendar fetch failed"));

        await expect(syncAllContacts("grant-1", "user-1")).rejects.toThrow("Calendar fetch failed");
        expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ status: "error" }));
    });
});

// ─── Successful sync ──────────────────────────────────────────────────────────

describe("syncAllContacts — successful sync", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockRecalculateNetworkStrength.mockResolvedValue(undefined);
    });

    it("updates integration to active with last_sync_at on success", async () => {
        const { mockUpdate } = setupSuccessSupabase({
            id: "int-1",
            email_address: null,
            first_sync_at: "2024-01-01T00:00:00Z",
            last_sync_at: "2024-01-10T00:00:00Z",
        });
        mockGetMessages.mockResolvedValue([]);
        mockGetCalendarEvents.mockResolvedValue([]);

        const result = await syncAllContacts("grant-1", "user-1");

        expect(result.rateLimited).toBeFalsy();
        expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ status: "active", last_sync_at: expect.any(String), sync_error: null }));
    });

    it("sets first_sync_at when this is the first sync", async () => {
        const { mockUpdate } = setupSuccessSupabase({
            id: "int-1",
            email_address: null,
            first_sync_at: null,
            last_sync_at: null,
        });
        mockGetMessages.mockResolvedValue([]);
        mockGetCalendarEvents.mockResolvedValue([]);

        await syncAllContacts("grant-1", "user-1");

        expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ first_sync_at: expect.any(String) }));
    });

    it("does not overwrite first_sync_at on subsequent syncs", async () => {
        const { mockUpdate } = setupSuccessSupabase({
            id: "int-1",
            email_address: null,
            first_sync_at: "2024-01-01T00:00:00Z",
            last_sync_at: "2024-01-10T00:00:00Z",
        });
        mockGetMessages.mockResolvedValue([]);
        mockGetCalendarEvents.mockResolvedValue([]);

        await syncAllContacts("grant-1", "user-1");

        expect(mockUpdate).toHaveBeenCalledWith(expect.not.objectContaining({ first_sync_at: expect.anything() }));
    });

    it("returns isIncremental=true when last_sync_at is set", async () => {
        setupSuccessSupabase({
            id: "int-1",
            email_address: null,
            first_sync_at: "2024-01-01T00:00:00Z",
            last_sync_at: "2024-01-10T00:00:00Z",
        });
        mockGetMessages.mockResolvedValue([]);
        mockGetCalendarEvents.mockResolvedValue([]);

        const result = await syncAllContacts("grant-1", "user-1");

        expect(result.isIncremental).toBe(true);
    });

    it("returns isIncremental=false when no last_sync_at", async () => {
        setupSuccessSupabase({
            id: "int-1",
            email_address: null,
            first_sync_at: null,
            last_sync_at: null,
        });
        mockGetMessages.mockResolvedValue([]);
        mockGetCalendarEvents.mockResolvedValue([]);

        const result = await syncAllContacts("grant-1", "user-1");

        expect(result.isIncremental).toBe(false);
    });
});
