import { describe, expect, it } from "vitest";
import {
    type SalesTrendRow,
    aggregateSalesTrendRows,
    aggregateSalesTrendRowsToHalfYear,
    aggregateSalesTrendRowsToQuarter,
    aggregateSalesTrendRowsToYear,
    buildMultiAreaSalesData,
    formatSalesPeriodLabel,
    getSalesCapRateAbsYAxisTicks,
    isSalesGranularity,
    salesMonthStartToHalfYearBucket,
    salesMonthStartToQuarterBucket,
} from "./trends-utils";

const monthly2024H1: SalesTrendRow[] = [
    { month_start: "2024-01-01", median_price: 1_000_000, avg_cap_rate: 5, listing_count: 10 },
    { month_start: "2024-02-01", median_price: 1_200_000, avg_cap_rate: 6, listing_count: 8 },
    { month_start: "2024-03-01", median_price: 1_100_000, avg_cap_rate: null, listing_count: 12 },
];

describe("sales trends granularity", () => {
    it("isSalesGranularity accepts only known values", () => {
        expect(isSalesGranularity("month")).toBe(true);
        expect(isSalesGranularity("quarter")).toBe(true);
        expect(isSalesGranularity("half_year")).toBe(true);
        expect(isSalesGranularity("year")).toBe(true);
        expect(isSalesGranularity("invalid")).toBe(false);
    });

    it("maps months to quarter and half-year bucket starts", () => {
        expect(salesMonthStartToQuarterBucket("2024-01-01")).toBe("2024-01-01");
        expect(salesMonthStartToQuarterBucket("2024-02-01")).toBe("2024-01-01");
        expect(salesMonthStartToQuarterBucket("2024-04-01")).toBe("2024-04-01");
        expect(salesMonthStartToQuarterBucket("2024-12-01")).toBe("2024-10-01");
        expect(salesMonthStartToHalfYearBucket("2024-01-01")).toBe("2024-01-01");
        expect(salesMonthStartToHalfYearBucket("2024-06-01")).toBe("2024-01-01");
        expect(salesMonthStartToHalfYearBucket("2024-07-01")).toBe("2024-07-01");
    });

    it("aggregateSalesTrendRowsToQuarter rolls up listing_count and median of medians", () => {
        const q1 = aggregateSalesTrendRowsToQuarter(monthly2024H1);
        expect(q1).toHaveLength(1);
        expect(q1[0].month_start).toBe("2024-01-01");
        expect(q1[0].listing_count).toBe(30);
        expect(q1[0].median_price).toBe(1_100_000);
        expect(q1[0].avg_cap_rate).toBeCloseTo((5 + 6) / 2, 5);
    });

    it("aggregateSalesTrendRowsToHalfYear merges two quarters", () => {
        const h1 = aggregateSalesTrendRowsToHalfYear([
            ...monthly2024H1,
            { month_start: "2024-04-01", median_price: 2_000_000, avg_cap_rate: 7, listing_count: 5 },
            { month_start: "2024-05-01", median_price: 2_200_000, avg_cap_rate: 8, listing_count: 5 },
            { month_start: "2024-06-01", median_price: 2_100_000, avg_cap_rate: null, listing_count: 5 },
        ]);
        expect(h1).toHaveLength(1);
        expect(h1[0].month_start).toBe("2024-01-01");
        expect(h1[0].listing_count).toBe(45);
        const sortedMedians = [1_000_000, 1_100_000, 1_200_000, 2_000_000, 2_100_000, 2_200_000].sort((a, b) => a - b);
        expect(h1[0].median_price).toBe((sortedMedians[2] + sortedMedians[3]) / 2);
    });

    it("aggregateSalesTrendRowsToYear uses calendar year", () => {
        const y = aggregateSalesTrendRowsToYear([...monthly2024H1, { month_start: "2024-10-01", median_price: 900_000, avg_cap_rate: 4, listing_count: 20 }]);
        expect(y).toHaveLength(1);
        expect(y[0].month_start).toBe("2024-01-01");
        expect(y[0].listing_count).toBe(50);
    });

    it("aggregateSalesTrendRows passes through month", () => {
        expect(aggregateSalesTrendRows(monthly2024H1, "month")).toEqual([...monthly2024H1].sort((a, b) => a.month_start.localeCompare(b.month_start)));
    });

    it("formatSalesPeriodLabel for quarter and half year", () => {
        expect(formatSalesPeriodLabel("2024-04-01", "quarter")).toBe("Q2 '24");
        expect(formatSalesPeriodLabel("2024-07-01", "half_year")).toBe("H2 '24");
        expect(formatSalesPeriodLabel("2024-01-01", "half_year")).toBe("H1 '24");
    });

    it("buildMultiAreaSalesData aligns buckets across areas", () => {
        const areas = [
            { id: "a", label: "A", color: "#000" },
            { id: "b", label: "B", color: "#fff" },
        ];
        const data = buildMultiAreaSalesData(
            {
                a: monthly2024H1,
                b: [{ month_start: "2024-01-01", median_price: 500_000, avg_cap_rate: null, listing_count: 2 }],
            },
            areas,
            "median_price",
            "quarter",
        );
        expect(data).toHaveLength(1);
        expect(data[0].month).toBe("2024-01-01");
        expect(data[0].a).toBe(1_100_000);
        expect(data[0].b).toBe(500_000);
    });
});

describe("getSalesCapRateAbsYAxisTicks", () => {
    it("returns undefined when there are no numeric cap values", () => {
        expect(getSalesCapRateAbsYAxisTicks([{ month: "2024-01-01", monthLabel: "Jan '24", a: "x" }], ["a"])).toBeUndefined();
    });

    it("uses sub-integer tick spacing when values span a narrow band", () => {
        const ticks = getSalesCapRateAbsYAxisTicks(
            [
                { month: "2024-01-01", monthLabel: "Jan '24", a: 5.1, b: 5.8 },
                { month: "2024-02-01", monthLabel: "Feb '24", a: 5.2, b: 5.9 },
            ],
            ["a", "b"],
        );
        expect(ticks).toBeDefined();
        expect(ticks!.length).toBeGreaterThan(2);
        const step = ticks![1] - ticks![0];
        expect(step).toBeLessThanOrEqual(0.25);
        expect(Math.min(...ticks!)).toBeLessThanOrEqual(5.1);
        expect(Math.max(...ticks!)).toBeGreaterThanOrEqual(5.9);
    });
});
