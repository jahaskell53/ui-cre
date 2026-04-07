import { beforeEach, describe, expect, it, vi } from "vitest";
import { recalculateNetworkStrengthForUser } from "./network-strength";

const { mockDb } = vi.hoisted(() => ({
    mockDb: {
        select: vi.fn(),
        update: vi.fn(),
    },
}));

vi.mock("@/db", () => ({
    db: mockDb,
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makePerson(id: string, timeline: unknown[]) {
    return { id, timeline };
}

function email() {
    return { type: "email" };
}
function meeting() {
    return { type: "meeting" };
}
function other() {
    return { type: "note" };
}

/**
 * Sets up mockDb for tests.
 * selectResult: rows returned by select query (id + timeline)
 * fetchError: if truthy, select throws instead
 */
function setupDb(people: ReturnType<typeof makePerson>[] | null = [], fetchError: unknown = null) {
    const mockUpdateWhere = vi.fn().mockResolvedValue(undefined);
    const mockUpdateSet = vi.fn().mockReturnValue({ where: mockUpdateWhere });
    mockDb.update.mockReturnValue({ set: mockUpdateSet });

    if (fetchError) {
        const mockSelectWhere = vi.fn().mockRejectedValue(fetchError);
        const mockSelectFrom = vi.fn().mockReturnValue({ where: mockSelectWhere });
        mockDb.select.mockReturnValue({ from: mockSelectFrom });
    } else {
        const mockSelectWhere = vi.fn().mockResolvedValue(people);
        const mockSelectFrom = vi.fn().mockReturnValue({ where: mockSelectWhere });
        mockDb.select.mockReturnValue({ from: mockSelectFrom });
    }

    return { mockUpdateWhere, mockUpdateSet };
}

// ─── getInteractionCount (tested via recalculate) ─────────────────────────────

describe("interaction count", () => {
    beforeEach(() => vi.clearAllMocks());

    it("counts emails and meetings", async () => {
        const { mockUpdateSet } = setupDb([makePerson("p1", [email(), email(), meeting()])]);
        await recalculateNetworkStrengthForUser("user-1");
        // 3 interactions, only 1 person → percentile = 1.0 → HIGH
        expect(mockUpdateSet).toHaveBeenCalledWith({ networkStrength: "HIGH" });
    });

    it("ignores non-email, non-meeting timeline items", async () => {
        const { mockUpdateSet } = setupDb([makePerson("p1", [other(), other(), other()])]);
        await recalculateNetworkStrengthForUser("user-1");
        // 0 interactions → LOW
        expect(mockUpdateSet).toHaveBeenCalledWith({ networkStrength: "LOW" });
    });

    it("handles null timeline", async () => {
        const { mockUpdateSet } = setupDb([makePerson("p1", null as any)]);
        await recalculateNetworkStrengthForUser("user-1");
        expect(mockUpdateSet).toHaveBeenCalledWith({ networkStrength: "LOW" });
    });

    it("handles empty timeline", async () => {
        const { mockUpdateSet } = setupDb([makePerson("p1", [])]);
        await recalculateNetworkStrengthForUser("user-1");
        expect(mockUpdateSet).toHaveBeenCalledWith({ networkStrength: "LOW" });
    });
});

// ─── network strength assignment ─────────────────────────────────────────────

describe("network strength ranking", () => {
    beforeEach(() => vi.clearAllMocks());

    it("assigns LOW to person with zero interactions regardless of percentile", async () => {
        const updateCalls: Record<string, string> = {};

        const mockUpdateWhere = vi.fn().mockImplementation((_cond: unknown) => {
            return Promise.resolve(undefined);
        });

        // We need to capture per-person calls
        let updateCallIndex = 0;
        const peopleData = [
            makePerson("p1", []),
            makePerson("p2", [email()]),
            makePerson("p3", [email()]),
            makePerson("p4", [email()]),
            makePerson("p5", [email()]),
        ];

        const callTracker: Array<{ strength: string }> = [];
        mockDb.update.mockReturnValue({
            set: vi.fn().mockImplementation((val: { networkStrength: string }) => {
                callTracker.push({ strength: val.networkStrength });
                return { where: vi.fn().mockResolvedValue(undefined) };
            }),
        });

        const mockSelectWhere = vi.fn().mockResolvedValue(peopleData);
        const mockSelectFrom = vi.fn().mockReturnValue({ where: mockSelectWhere });
        mockDb.select.mockReturnValue({ from: mockSelectFrom });

        await recalculateNetworkStrengthForUser("user-1");

        // p1 has 0 interactions → LOW (sorted last, index 4 of 5)
        // After sorting by count desc: p2,p3,p4,p5 (all count=1), p1 (count=0)
        // Last one is LOW due to zero count
        const lowCall = callTracker.find((c) => c.strength === "LOW");
        expect(lowCall).toBeDefined();
    });

    it("assigns HIGH to top 20% by interaction count", async () => {
        const people = [
            makePerson("p1", [email(), email(), email(), email(), email()]), // 5 interactions
            makePerson("p2", [email(), email()]),
            makePerson("p3", [email(), email()]),
            makePerson("p4", [email()]),
            makePerson("p5", [email()]),
        ];

        const updateCalls: Record<string, string> = {};

        const mockSelectWhere = vi.fn().mockResolvedValue(people);
        const mockSelectFrom = vi.fn().mockReturnValue({ where: mockSelectWhere });
        mockDb.select.mockReturnValue({ from: mockSelectFrom });

        mockDb.update.mockReturnValue({
            set: vi.fn().mockImplementation((val: { networkStrength: string }) => ({
                where: vi.fn().mockImplementation((_cond: unknown) => {
                    // We can't easily tell which person this is for, just track calls
                    return Promise.resolve(undefined);
                }),
            })),
        });

        // We need to verify p1 gets HIGH - let's use a different approach
        // Reset and use a more targeted test
        vi.clearAllMocks();

        const strengthMap: Array<string> = [];
        mockDb.select.mockReturnValue({ from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(people) }) });
        mockDb.update.mockReturnValue({
            set: vi.fn().mockImplementation((val: { networkStrength: string }) => {
                strengthMap.push(val.networkStrength);
                return { where: vi.fn().mockResolvedValue(undefined) };
            }),
        });

        await recalculateNetworkStrengthForUser("user-1");

        // p1 (5 interactions, rank 1) → percentile (5-0)/5 = 1.0 > 0.8 → HIGH
        expect(strengthMap[0]).toBe("HIGH");
    });

    it("assigns LOW to bottom 20% by interaction count", async () => {
        const people = [
            makePerson("p1", [email(), email(), email(), email(), email()]),
            makePerson("p2", [email(), email()]),
            makePerson("p3", [email(), email()]),
            makePerson("p4", [email()]),
            makePerson("p5", [meeting()]), // 1 interaction, rank 5 → percentile 0.2 → LOW
        ];

        const strengthMap: Array<string> = [];
        mockDb.select.mockReturnValue({ from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(people) }) });
        mockDb.update.mockReturnValue({
            set: vi.fn().mockImplementation((val: { networkStrength: string }) => {
                strengthMap.push(val.networkStrength);
                return { where: vi.fn().mockResolvedValue(undefined) };
            }),
        });

        await recalculateNetworkStrengthForUser("user-1");

        // Last one (rank 5, same 1 interaction) → percentile 0.2 → LOW
        expect(strengthMap[strengthMap.length - 1]).toBe("LOW");
    });

    it("assigns MEDIUM to middle 60%", async () => {
        const people = [
            makePerson("p1", [email(), email(), email(), email(), email()]),
            makePerson("p2", [email(), email(), email()]), // rank 2 → percentile 0.8 → MEDIUM (not > 0.8)
            makePerson("p3", [email(), email()]), // rank 3 → percentile 0.6 → MEDIUM
            makePerson("p4", [email()]), // rank 4 → percentile 0.4 → MEDIUM
            makePerson("p5", [meeting()]),
        ];

        const strengthMap: Array<string> = [];
        mockDb.select.mockReturnValue({ from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(people) }) });
        mockDb.update.mockReturnValue({
            set: vi.fn().mockImplementation((val: { networkStrength: string }) => {
                strengthMap.push(val.networkStrength);
                return { where: vi.fn().mockResolvedValue(undefined) };
            }),
        });

        await recalculateNetworkStrengthForUser("user-1");

        // Sorted desc: p1(5), p2(3), p3(2), p4(1), p5(1)
        // ranks: 0→HIGH, 1,2,3→MEDIUM, 4→LOW
        expect(strengthMap[1]).toBe("MEDIUM");
        expect(strengthMap[2]).toBe("MEDIUM");
        expect(strengthMap[3]).toBe("MEDIUM");
    });
});

// ─── early returns / error handling ───────────────────────────────────────────

describe("recalculateNetworkStrengthForUser — error handling", () => {
    beforeEach(() => vi.clearAllMocks());

    it("returns early without updating when there are no people", async () => {
        setupDb([]);
        await recalculateNetworkStrengthForUser("user-1");
        expect(mockDb.update).not.toHaveBeenCalled();
    });

    it("returns early without updating when people fetch errors", async () => {
        setupDb(null, new Error("DB error"));
        await recalculateNetworkStrengthForUser("user-1");
        expect(mockDb.update).not.toHaveBeenCalled();
    });

    it("does not throw when an update fails", async () => {
        const mockSelectWhere = vi.fn().mockResolvedValue([makePerson("p1", [email()])]);
        const mockSelectFrom = vi.fn().mockReturnValue({ where: mockSelectWhere });
        mockDb.select.mockReturnValue({ from: mockSelectFrom });

        mockDb.update.mockReturnValue({
            set: vi.fn().mockReturnValue({
                where: vi.fn().mockRejectedValue(new Error("update failed")),
            }),
        });

        await expect(recalculateNetworkStrengthForUser("user-1")).resolves.toBeUndefined();
    });
});
