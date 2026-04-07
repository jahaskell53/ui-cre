import { beforeEach, describe, expect, it, vi } from "vitest";
import { recalculateNetworkStrengthForUser } from "./network-strength";

const { mockDbSelect, mockDbUpdate } = vi.hoisted(() => ({
    mockDbSelect: vi.fn(),
    mockDbUpdate: vi.fn(),
}));

vi.mock("@/db", () => ({
    db: {
        select: mockDbSelect,
        update: mockDbUpdate,
    },
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeDbWithPeople(peopleRows: unknown[]) {
    const mockUpdateEq = vi.fn().mockResolvedValue(undefined);
    const mockSet = vi.fn().mockReturnValue({ where: mockUpdateEq });
    mockDbUpdate.mockReturnValue({ set: mockSet });

    const mockWhere = vi.fn().mockResolvedValue(peopleRows);
    const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
    mockDbSelect.mockReturnValue({ from: mockFrom });

    return { mockSet, mockUpdateEq };
}

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

// ─── getInteractionCount (tested via recalculate) ─────────────────────────────

describe("interaction count", () => {
    beforeEach(() => vi.clearAllMocks());

    it("counts emails and meetings", async () => {
        const { mockSet } = makeDbWithPeople([makePerson("p1", [email(), email(), meeting()])]);
        await recalculateNetworkStrengthForUser("user-1");
        // 3 interactions, only 1 person → percentile = 1.0 → HIGH
        expect(mockSet).toHaveBeenCalledWith({ networkStrength: "HIGH" });
    });

    it("ignores non-email, non-meeting timeline items", async () => {
        const { mockSet } = makeDbWithPeople([makePerson("p1", [other(), other(), other()])]);
        await recalculateNetworkStrengthForUser("user-1");
        // 0 interactions → LOW
        expect(mockSet).toHaveBeenCalledWith({ networkStrength: "LOW" });
    });

    it("handles null timeline", async () => {
        const { mockSet } = makeDbWithPeople([makePerson("p1", null as any)]);
        await recalculateNetworkStrengthForUser("user-1");
        expect(mockSet).toHaveBeenCalledWith({ networkStrength: "LOW" });
    });

    it("handles empty timeline", async () => {
        const { mockSet } = makeDbWithPeople([makePerson("p1", [])]);
        await recalculateNetworkStrengthForUser("user-1");
        expect(mockSet).toHaveBeenCalledWith({ networkStrength: "LOW" });
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
        const mockSet = vi.fn().mockImplementation((val: { networkStrength: string }) => {
            return {
                where: (cond: any) => {
                    // We can't easily extract id from drizzle eq() call, so track via call order
                    updateCalls[`call_${Object.keys(updateCalls).length}`] = val.networkStrength;
                    return Promise.resolve(undefined);
                },
            };
        });
        mockDbUpdate.mockReturnValue({ set: mockSet });

        const peopleRows = [
            makePerson("p1", []),
            makePerson("p2", [email()]),
            makePerson("p3", [email()]),
            makePerson("p4", [email()]),
            makePerson("p5", [email()]),
        ];
        const mockWhere = vi.fn().mockResolvedValue(peopleRows);
        const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
        mockDbSelect.mockReturnValue({ from: mockFrom });

        await recalculateNetworkStrengthForUser("user-1");

        // p1 has 0 interactions → always LOW (it's sorted last after those with interactions)
        expect(mockSet).toHaveBeenCalledWith({ networkStrength: "LOW" });
    });

    it("assigns HIGH to the person with the most interactions (top 20%)", async () => {
        const setArgs: string[] = [];

        const mockSet = vi.fn().mockImplementation((val: { networkStrength: string }) => {
            setArgs.push(val.networkStrength);
            return { where: vi.fn().mockResolvedValue(undefined) };
        });
        mockDbUpdate.mockReturnValue({ set: mockSet });

        // 5 people — p1 has most interactions
        const peopleRows = [
            makePerson("p1", [email(), email(), email(), email(), email()]),
            makePerson("p2", [email(), email()]),
            makePerson("p3", [email(), email()]),
            makePerson("p4", [email()]),
            makePerson("p5", [meeting()]),
        ];
        const mockWhere = vi.fn().mockResolvedValue(peopleRows);
        const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
        mockDbSelect.mockReturnValue({ from: mockFrom });

        await recalculateNetworkStrengthForUser("user-1");

        // First call (highest rank) should be HIGH
        expect(setArgs[0]).toBe("HIGH");
    });

    it("assigns LOW to the person with the fewest interactions (bottom 20%)", async () => {
        const setArgs: string[] = [];

        const mockSet = vi.fn().mockImplementation((val: { networkStrength: string }) => {
            setArgs.push(val.networkStrength);
            return { where: vi.fn().mockResolvedValue(undefined) };
        });
        mockDbUpdate.mockReturnValue({ set: mockSet });

        const peopleRows = [
            makePerson("p1", [email(), email(), email(), email(), email()]),
            makePerson("p2", [email(), email()]),
            makePerson("p3", [email(), email()]),
            makePerson("p4", [email()]),
            makePerson("p5", [meeting()]), // 1 interaction, rank 5 → percentile 0.2 → LOW
        ];
        const mockWhere = vi.fn().mockResolvedValue(peopleRows);
        const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
        mockDbSelect.mockReturnValue({ from: mockFrom });

        await recalculateNetworkStrengthForUser("user-1");

        // Last call (lowest rank) should be LOW
        expect(setArgs[setArgs.length - 1]).toBe("LOW");
    });

    it("assigns MEDIUM to middle 60%", async () => {
        const setArgs: string[] = [];

        const mockSet = vi.fn().mockImplementation((val: { networkStrength: string }) => {
            setArgs.push(val.networkStrength);
            return { where: vi.fn().mockResolvedValue(undefined) };
        });
        mockDbUpdate.mockReturnValue({ set: mockSet });

        const peopleRows = [
            makePerson("p1", [email(), email(), email(), email(), email()]),
            makePerson("p2", [email(), email(), email()]), // rank 2 → percentile 0.8 → boundary (not > 0.8) → MEDIUM
            makePerson("p3", [email(), email()]), // rank 3 → percentile 0.6 → MEDIUM
            makePerson("p4", [email()]), // rank 4 → percentile 0.4 → MEDIUM
            makePerson("p5", [meeting()]),
        ];
        const mockWhere = vi.fn().mockResolvedValue(peopleRows);
        const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
        mockDbSelect.mockReturnValue({ from: mockFrom });

        await recalculateNetworkStrengthForUser("user-1");

        // Ranks 2, 3, 4 (indices 1, 2, 3) should be MEDIUM
        expect(setArgs[1]).toBe("MEDIUM");
        expect(setArgs[2]).toBe("MEDIUM");
        expect(setArgs[3]).toBe("MEDIUM");
    });
});

// ─── early returns / error handling ───────────────────────────────────────────

describe("recalculateNetworkStrengthForUser — error handling", () => {
    beforeEach(() => vi.clearAllMocks());

    it("returns early without updating when there are no people", async () => {
        const mockUpdateSet = vi.fn();
        mockDbUpdate.mockReturnValue({ set: mockUpdateSet });

        const mockWhere = vi.fn().mockResolvedValue([]);
        const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
        mockDbSelect.mockReturnValue({ from: mockFrom });

        await recalculateNetworkStrengthForUser("user-1");
        expect(mockUpdateSet).not.toHaveBeenCalled();
    });

    it("returns early without updating when DB select throws", async () => {
        const mockUpdateSet = vi.fn();
        mockDbUpdate.mockReturnValue({ set: mockUpdateSet });

        const mockWhere = vi.fn().mockRejectedValue(new Error("DB error"));
        const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
        mockDbSelect.mockReturnValue({ from: mockFrom });

        await expect(recalculateNetworkStrengthForUser("user-1")).resolves.toBeUndefined();
        expect(mockUpdateSet).not.toHaveBeenCalled();
    });

    it("does not throw when an update fails", async () => {
        const mockSet = vi.fn().mockReturnValue({ where: vi.fn().mockRejectedValue(new Error("update failed")) });
        mockDbUpdate.mockReturnValue({ set: mockSet });

        const mockWhere = vi.fn().mockResolvedValue([makePerson("p1", [email()])]);
        const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
        mockDbSelect.mockReturnValue({ from: mockFrom });

        await expect(recalculateNetworkStrengthForUser("user-1")).resolves.toBeUndefined();
    });
});
