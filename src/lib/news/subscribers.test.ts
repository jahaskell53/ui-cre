import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_PREFERRED_SEND_TIMES, getActiveSubscribers, getSubscriberByEmail, isValidTimezone, unsubscribe } from "./subscribers";

const { mockFrom, mockDbUpdate } = vi.hoisted(() => ({
    mockFrom: vi.fn(),
    mockDbUpdate: vi.fn(),
}));

vi.mock("@/utils/supabase/server", () => ({
    createClient: vi.fn().mockResolvedValue({ from: mockFrom }),
}));

vi.mock("@/db", () => ({
    db: {
        update: mockDbUpdate,
    },
}));

// ─── isValidTimezone ──────────────────────────────────────────────────────────

describe("isValidTimezone", () => {
    it("returns true for valid IANA timezones", () => {
        expect(isValidTimezone("America/New_York")).toBe(true);
        expect(isValidTimezone("UTC")).toBe(true);
        expect(isValidTimezone("Europe/London")).toBe(true);
    });

    it("returns false for invalid timezone strings", () => {
        expect(isValidTimezone("Not/A/Timezone")).toBe(false);
        expect(isValidTimezone("Foo/Bar")).toBe(false);
        expect(isValidTimezone("garbage")).toBe(false);
    });
});

// ─── getActiveSubscribers ─────────────────────────────────────────────────────

describe("getActiveSubscribers", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("returns empty array when DB errors", async () => {
        const mockEq = vi.fn().mockResolvedValue({ data: null, error: { message: "DB error" } });
        const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
        mockFrom.mockReturnValue({ select: mockSelect });

        const result = await getActiveSubscribers();
        expect(result).toEqual([]);
    });

    it("returns empty array when no subscribers", async () => {
        const mockEq = vi.fn().mockResolvedValue({ data: [], error: null });
        const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
        mockFrom.mockReturnValue({ select: mockSelect });

        const result = await getActiveSubscribers();
        expect(result).toEqual([]);
    });

    it("maps DB rows to Subscriber interface", async () => {
        const dbRow = {
            id: "sub-1",
            email: "alice@example.com",
            full_name: "Alice Smith",
            subscribed_at: "2024-01-01T00:00:00Z",
            is_active: true,
            interests: "multifamily",
            timezone: "America/New_York",
            preferred_send_times: [{ dayOfWeek: 1, hour: 9 }],
            subscriber_counties: [{ county_id: "c1", counties: { name: "Suffolk" } }],
            subscriber_cities: [{ city_id: "ct1", cities: { name: "Boston", state: "Massachusetts", state_abbr: "MA" } }],
        };

        const mockEq = vi.fn().mockResolvedValue({ data: [dbRow], error: null });
        const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
        mockFrom.mockReturnValue({ select: mockSelect });

        const result = await getActiveSubscribers();

        expect(result).toHaveLength(1);
        expect(result[0]).toMatchObject({
            id: "sub-1",
            email: "alice@example.com",
            firstName: "Alice Smith",
            isActive: true,
            interests: "multifamily",
            timezone: "America/New_York",
            selectedCounties: ["Suffolk"],
            preferredSendTimes: [{ dayOfWeek: 1, hour: 9 }],
        });
        expect(result[0].selectedCities[0]).toMatchObject({ name: "Boston", state: "Massachusetts", stateAbbr: "MA" });
    });

    it("uses default send times when preferred_send_times is null", async () => {
        const dbRow = {
            id: "sub-1",
            email: "alice@example.com",
            full_name: "Alice",
            subscribed_at: null,
            is_active: true,
            interests: null,
            timezone: null,
            preferred_send_times: null,
            subscriber_counties: [],
            subscriber_cities: [],
        };

        const mockEq = vi.fn().mockResolvedValue({ data: [dbRow], error: null });
        const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
        mockFrom.mockReturnValue({ select: mockSelect });

        const result = await getActiveSubscribers();
        expect(result[0].preferredSendTimes).toEqual(DEFAULT_PREFERRED_SEND_TIMES);
    });

    it("filters out counties with null name", async () => {
        const dbRow = {
            id: "sub-1",
            email: "a@example.com",
            full_name: "A",
            subscribed_at: null,
            is_active: true,
            interests: null,
            timezone: null,
            preferred_send_times: null,
            subscriber_counties: [
                { county_id: "c1", counties: null },
                { county_id: "c2", counties: { name: "Suffolk" } },
            ],
            subscriber_cities: [],
        };

        const mockEq = vi.fn().mockResolvedValue({ data: [dbRow], error: null });
        const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
        mockFrom.mockReturnValue({ select: mockSelect });

        const result = await getActiveSubscribers();
        expect(result[0].selectedCounties).toEqual(["Suffolk"]);
    });
});

// ─── getSubscriberByEmail ─────────────────────────────────────────────────────

describe("getSubscriberByEmail", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("returns null when subscriber not found", async () => {
        const mockSingle = vi.fn().mockResolvedValue({ data: null, error: { message: "not found" } });
        const mockEq = vi.fn().mockReturnValue({ single: mockSingle });
        const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
        mockFrom.mockReturnValue({ select: mockSelect });

        const result = await getSubscriberByEmail("unknown@example.com");
        expect(result).toBeNull();
    });

    it("queries with lowercased email", async () => {
        const mockSingle = vi.fn().mockResolvedValue({ data: null, error: { message: "not found" } });
        const mockEq = vi.fn().mockReturnValue({ single: mockSingle });
        const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
        mockFrom.mockReturnValue({ select: mockSelect });

        await getSubscriberByEmail("ALICE@Example.COM");
        expect(mockEq).toHaveBeenCalledWith("email", "alice@example.com");
    });

    it("returns mapped subscriber when found", async () => {
        const dbRow = {
            id: "sub-1",
            email: "alice@example.com",
            full_name: "Alice",
            subscribed_at: null,
            is_active: true,
            interests: null,
            timezone: null,
            preferred_send_times: [],
            subscriber_counties: [],
            subscriber_cities: [],
        };

        const mockSingle = vi.fn().mockResolvedValue({ data: dbRow, error: null });
        const mockEq = vi.fn().mockReturnValue({ single: mockSingle });
        const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
        mockFrom.mockReturnValue({ select: mockSelect });

        const result = await getSubscriberByEmail("alice@example.com");
        expect(result).not.toBeNull();
        expect(result!.id).toBe("sub-1");
        expect(result!.email).toBe("alice@example.com");
    });
});

// ─── unsubscribe ──────────────────────────────────────────────────────────────

describe("unsubscribe", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("returns true on success", async () => {
        const mockWhere = vi.fn().mockResolvedValue(undefined);
        const mockSet = vi.fn().mockReturnValue({ where: mockWhere });
        mockDbUpdate.mockReturnValue({ set: mockSet });

        const result = await unsubscribe("alice@example.com");
        expect(result).toBe(true);
        expect(mockSet).toHaveBeenCalledWith({ isActive: false });
    });

    it("lowercases the email before querying", async () => {
        const mockWhere = vi.fn().mockResolvedValue(undefined);
        const mockSet = vi.fn().mockReturnValue({ where: mockWhere });
        mockDbUpdate.mockReturnValue({ set: mockSet });

        const result = await unsubscribe("ALICE@Example.COM");
        expect(result).toBe(true);
        expect(mockSet).toHaveBeenCalled();
    });

    it("returns false when DB throws", async () => {
        mockDbUpdate.mockReturnValue({ set: vi.fn().mockReturnValue({ where: vi.fn().mockRejectedValue(new Error("DB error")) }) });

        const result = await unsubscribe("alice@example.com");
        expect(result).toBe(false);
    });
});
