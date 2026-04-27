import { describe, expect, it } from "vitest";
import { capRateAbsoluteYAxisConfig } from "./trends-utils";

describe("capRateAbsoluteYAxisConfig", () => {
    it("returns null when there are no numeric values", () => {
        expect(capRateAbsoluteYAxisConfig([{ month: "2024-01-01", monthLabel: "Jan 24" }], ["a"])).toBeNull();
    });

    it("uses 0.1 tick steps spanning the data range", () => {
        const cfg = capRateAbsoluteYAxisConfig(
            [
                { month: "2024-01-01", monthLabel: "Jan 24", a: 5.23, b: 5.87 },
                { month: "2024-02-01", monthLabel: "Feb 24", a: 5.41 },
            ],
            ["a", "b"],
        );
        expect(cfg).not.toBeNull();
        expect(cfg!.domain).toEqual([5.2, 5.9]);
        expect(cfg!.ticks).toEqual([5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 5.9]);
    });

    it("expands by one step on each side when min equals max", () => {
        const cfg = capRateAbsoluteYAxisConfig([{ month: "2024-01-01", monthLabel: "Jan 24", x: 6.0 }], ["x"]);
        expect(cfg!.domain).toEqual([5.9, 6.1]);
        expect(cfg!.ticks).toEqual([5.9, 6.0, 6.1]);
    });

    it("tightens domain when outliers would exceed max tick count", () => {
        const pts = Array.from({ length: 50 }, (_, i) => ({
            month: `2020-${String((i % 12) + 1).padStart(2, "0")}-01`,
            monthLabel: "m",
            a: 5 + (i % 10) * 0.1,
        }));
        pts.push({ month: "2021-01-01", monthLabel: "x", a: 95 });
        const cfg = capRateAbsoluteYAxisConfig(pts, ["a"]);
        expect(cfg).not.toBeNull();
        expect(cfg!.ticks.length).toBeLessThanOrEqual(100);
        for (let i = 1; i < cfg!.ticks.length; i++) {
            expect(cfg!.ticks[i]! - cfg!.ticks[i - 1]!).toBeCloseTo(0.1, 5);
        }
        expect(cfg!.domain[1]! - cfg!.domain[0]!).toBeCloseTo((cfg!.ticks.length - 1) * 0.1, 5);
    });
});
