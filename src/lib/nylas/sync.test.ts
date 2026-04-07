import { beforeEach, describe, expect, it, vi } from "vitest";
import { NylasRateLimitError } from "./client";
import { syncAllContacts } from "./sync";

const { mockGetMessages, mockGetCalendarEvents, mockDbSelect, mockDbUpdate, mockDbInsert, mockRecalculateNetworkStrength } = vi.hoisted(() => ({
    mockGetMessages: vi.fn(),
    mockGetCalendarEvents: vi.fn(),
    mockDbSelect: vi.fn(),
    mockDbUpdate: vi.fn(),
    mockDbInsert: vi.fn(),
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

vi.mock("@/db", () => ({
    db: {
        select: mockDbSelect,
        update: mockDbUpdate,
        insert: mockDbInsert,
    },
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
 * Sets up db mocks for the integration select and update calls used by syncAllContacts.
 * The integration select returns the given record via the chained `.where().limit()` builder.
 */
function setupIntegrationDb(
    integration: Record<string, unknown> = {
        id: "int-1",
        emailAddress: null,
        firstSyncAt: null,
        lastSyncAt: null,
    },
) {
    const mockLimit = vi.fn().mockResolvedValue([integration]);
    const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
    const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });

    const mockUpdateWhere = vi.fn().mockResolvedValue(undefined);
    const mockSet = vi.fn().mockReturnValue({ where: mockUpdateWhere });

    mockDbSelect.mockReturnValue({ from: mockFrom });
    mockDbUpdate.mockReturnValue({ set: mockSet });

    return { mockSet, mockUpdateWhere };
}

/**
 * Sets up db mocks for the full successful sync path (empty messages/events).
 * syncEmailContacts returns 0 early because emailAddress is null.
 * syncCalendarContacts fetches existing people (returns []).
 */
function setupSuccessDb(
    integration: Record<string, unknown> = {
        id: "int-1",
        emailAddress: null,
        firstSyncAt: null,
        lastSyncAt: null,
    },
) {
    // People select: used by syncCalendarContacts when processing contacts
    const mockPeopleWhere = vi.fn().mockResolvedValue([]);
    const mockPeopleFrom = vi.fn().mockReturnValue({ where: mockPeopleWhere });

    // Integration select: used by syncAllContacts and syncEmailContacts/syncCalendarContacts
    const mockLimit = vi.fn().mockResolvedValue([integration]);
    const mockIntWhere = vi.fn().mockReturnValue({ limit: mockLimit });
    const mockIntFrom = vi.fn().mockReturnValue({ where: mockIntWhere });

    const mockUpdateWhere = vi.fn().mockResolvedValue(undefined);
    const mockSet = vi.fn().mockReturnValue({ where: mockUpdateWhere });

    // Route all selects through the same mock — integration queries use .limit(), people use .where() only
    mockDbSelect.mockImplementation(() => ({ from: mockIntFrom }));
    mockDbUpdate.mockReturnValue({ set: mockSet });

    return { mockSet };
}

// ─── Rate limit handling ──────────────────────────────────────────────────────

describe("syncAllContacts — rate limit handling", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockRecalculateNetworkStrength.mockResolvedValue(undefined);
    });

    it("marks integration as rate_limited when email sync hits rate limit", async () => {
        const { mockSet } = setupIntegrationDb();
        mockGetMessages.mockRejectedValue(makeRateLimitError(30_000));
        mockGetCalendarEvents.mockRejectedValue(makeRateLimitError(30_000));

        const result = await syncAllContacts("grant-1", "user-1");

        expect(result.rateLimited).toBe(true);
        expect(result.retryAfterMs).toBe(30_000);
        expect(mockSet).toHaveBeenCalledWith(expect.objectContaining({ status: "rate_limited" }));
    });

    it("marks integration as rate_limited when only calendar sync is rate limited", async () => {
        setupIntegrationDb();
        // Email sync succeeds (messages = [], returns 0 via early return since emailAddress is null)
        mockGetMessages.mockResolvedValue([]);
        mockGetCalendarEvents.mockRejectedValue(makeRateLimitError(45_000));

        const result = await syncAllContacts("grant-1", "user-1");

        expect(result.rateLimited).toBe(true);
        expect(result.retryAfterMs).toBe(45_000);
    });

    it("uses the longer retry delay when both email and calendar are rate limited", async () => {
        setupIntegrationDb();
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
        const { mockSet } = setupIntegrationDb();
        const crash = new Error("Nylas API down");
        mockGetMessages.mockRejectedValue(crash);

        await expect(syncAllContacts("grant-1", "user-1")).rejects.toThrow("Nylas API down");
        expect(mockSet).toHaveBeenCalledWith(expect.objectContaining({ status: "error" }));
    });

    it("marks integration as error and rethrows when calendar sync throws", async () => {
        const { mockSet } = setupIntegrationDb();
        mockGetMessages.mockResolvedValue([]);
        mockGetCalendarEvents.mockRejectedValue(new Error("Calendar fetch failed"));

        await expect(syncAllContacts("grant-1", "user-1")).rejects.toThrow("Calendar fetch failed");
        expect(mockSet).toHaveBeenCalledWith(expect.objectContaining({ status: "error" }));
    });
});

// ─── Successful sync ──────────────────────────────────────────────────────────

describe("syncAllContacts — successful sync", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockRecalculateNetworkStrength.mockResolvedValue(undefined);
    });

    it("updates integration to active with lastSyncAt on success", async () => {
        const { mockSet } = setupSuccessDb({
            id: "int-1",
            emailAddress: null,
            firstSyncAt: "2024-01-01T00:00:00Z",
            lastSyncAt: "2024-01-10T00:00:00Z",
        });
        mockGetMessages.mockResolvedValue([]);
        mockGetCalendarEvents.mockResolvedValue([]);

        const result = await syncAllContacts("grant-1", "user-1");

        expect(result.rateLimited).toBeFalsy();
        expect(mockSet).toHaveBeenCalledWith(expect.objectContaining({ status: "active", lastSyncAt: expect.any(String), syncError: null }));
    });

    it("sets firstSyncAt when this is the first sync", async () => {
        const { mockSet } = setupSuccessDb({
            id: "int-1",
            emailAddress: null,
            firstSyncAt: null,
            lastSyncAt: null,
        });
        mockGetMessages.mockResolvedValue([]);
        mockGetCalendarEvents.mockResolvedValue([]);

        await syncAllContacts("grant-1", "user-1");

        expect(mockSet).toHaveBeenCalledWith(expect.objectContaining({ firstSyncAt: expect.any(String) }));
    });

    it("does not overwrite firstSyncAt on subsequent syncs", async () => {
        const { mockSet } = setupSuccessDb({
            id: "int-1",
            emailAddress: null,
            firstSyncAt: "2024-01-01T00:00:00Z",
            lastSyncAt: "2024-01-10T00:00:00Z",
        });
        mockGetMessages.mockResolvedValue([]);
        mockGetCalendarEvents.mockResolvedValue([]);

        await syncAllContacts("grant-1", "user-1");

        expect(mockSet).toHaveBeenCalledWith(expect.not.objectContaining({ firstSyncAt: expect.anything() }));
    });

    it("returns isIncremental=true when lastSyncAt is set", async () => {
        setupSuccessDb({
            id: "int-1",
            emailAddress: null,
            firstSyncAt: "2024-01-01T00:00:00Z",
            lastSyncAt: "2024-01-10T00:00:00Z",
        });
        mockGetMessages.mockResolvedValue([]);
        mockGetCalendarEvents.mockResolvedValue([]);

        const result = await syncAllContacts("grant-1", "user-1");

        expect(result.isIncremental).toBe(true);
    });

    it("returns isIncremental=false when no lastSyncAt", async () => {
        setupSuccessDb({
            id: "int-1",
            emailAddress: null,
            firstSyncAt: null,
            lastSyncAt: null,
        });
        mockGetMessages.mockResolvedValue([]);
        mockGetCalendarEvents.mockResolvedValue([]);

        const result = await syncAllContacts("grant-1", "user-1");

        expect(result.isIncremental).toBe(false);
    });
});
