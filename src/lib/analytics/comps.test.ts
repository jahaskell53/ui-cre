import { describe, expect, it } from "vitest";
import { buildMarketStats, getGeomBounds, getScoreColor, makeCircle, metersToMiles, sortCompResults, titleCaseAddress } from "./comps";

describe("analytics comps helpers", () => {
    it("builds a closed search radius polygon", () => {
        const circle = makeCircle([-122.4, 37.8], 1609.34);
        expect(circle.geometry.coordinates[0]).toHaveLength(65);
        expect(circle.geometry.coordinates[0][0]).toEqual(circle.geometry.coordinates[0][64]);
    });

    it("computes geometry bounds and title-cases addresses", () => {
        expect(
            getGeomBounds({
                type: "FeatureCollection",
                features: [
                    {
                        type: "Feature",
                        geometry: { type: "Polygon", coordinates: [[[-122.5, 37.7], [-122.3, 37.7], [-122.3, 37.9], [-122.5, 37.9], [-122.5, 37.7]]] },
                        properties: {},
                    },
                ],
            }),
        ).toEqual([
            [-122.5, 37.7],
            [-122.3, 37.9],
        ]);
        expect(titleCaseAddress("  123 MAIN st  ")).toBe("123 Main St");
    });

    it("sorts comps by proximity to the subject values", () => {
        const comps = [
            { price: 3000, beds: 2, baths: 2, area: 1000, distance_m: 500, composite_score: 0.8 },
            { price: 3500, beds: 2, baths: 1, area: 900, distance_m: 200, composite_score: 0.6 },
            { price: 5000, beds: 3, baths: 2, area: 1500, distance_m: 100, composite_score: 0.9 },
        ];

        expect(
            sortCompResults(comps, "price", "asc", {
                price: "3400",
                beds: "2",
                baths: "2",
                area: "950",
            }).map((comp) => comp.price),
        ).toEqual([3500, 3000, 5000]);
    });

    it("builds market stats and shared display helpers", () => {
        const comps = [
            { price: 2500, beds: 1, baths: 1, area: 700, distance_m: 200, composite_score: 0.5 },
            { price: 3000, beds: 1, baths: 1, area: 750, distance_m: 300, composite_score: 0.6 },
            { price: 3500, beds: 1, baths: 1, area: 800, distance_m: 400, composite_score: 0.7 },
            { price: 4500, beds: 1, baths: 1, area: 850, distance_m: 500, composite_score: 0.8 },
        ];

        expect(buildMarketStats(comps, "3200")).toEqual({
            min: 2500,
            max: 4500,
            p25: 2875,
            median: 3250,
            p75: 3750,
            n: 4,
            subjectPercentile: 50,
        });
        expect(metersToMiles(1609.34)).toBe("1.00");
        expect(getScoreColor(0.8)).toContain("green");
        expect(getScoreColor(0.6)).toContain("yellow");
        expect(getScoreColor(0.4)).toContain("red");
    });
});
