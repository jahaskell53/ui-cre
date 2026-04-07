import { describe, expect, it } from "vitest";
import { buildDisplayAreaResults, buildDisplayAreas, getTrendsSearchPlaceholder, parseSerializedAreas, serializeAreasParam } from "./trends-page";

describe("analytics trends-page helpers", () => {
    it("serializes and parses selected areas", () => {
        const areas = [{ id: "94107", label: "94107", color: "#3b82f6" }];
        expect(parseSerializedAreas(serializeAreasParam(areas))).toEqual(areas);
        expect(parseSerializedAreas("not-base64")).toEqual([]);
    });

    it("builds placeholder text and display areas by segment", () => {
        expect(getTrendsSearchPlaceholder("Neighborhood", false)).toBe("Search neighborhood name...");
        expect(getTrendsSearchPlaceholder("ZIP Code", true)).toBe("Enter address...");

        expect(
            buildDisplayAreas([{ id: "94107", label: "94107", color: "#3b82f6" }], "both").map((area) => ({
                id: area.id,
                label: area.label,
            })),
        ).toEqual([
            { id: "94107:mid", label: "94107 (Mid-market)" },
            { id: "94107:reit", label: "94107 (REIT)" },
        ]);
    });

    it("projects area results onto the rendered display areas", () => {
        const displayAreas = [{ id: "94107:mid", label: "94107 (Mid-market)", color: "#3b82f6" }];
        expect(
            buildDisplayAreaResults(displayAreas, {
                "94107:mid": {
                    trends: [{ week_start: "2025-01-01", beds: 1, median_rent: 3200, listing_count: 4 }],
                    activity: [{ week_start: "2025-01-01", beds: 1, new_listings: 2, accumulated_listings: 8, closed_listings: 1 }],
                },
            }),
        ).toEqual({
            displayRentResults: {
                "94107:mid": [{ week_start: "2025-01-01", beds: 1, median_rent: 3200, listing_count: 4 }],
            },
            displayActivityResults: {
                "94107:mid": [{ week_start: "2025-01-01", beds: 1, new_listings: 2, accumulated_listings: 8, closed_listings: 1 }],
            },
        });
    });
});
