import { describe, expect, it } from "vitest";
import {
    buildMapSearchParams,
    countActiveMapFilters,
    createDefaultMapFilters,
    parseAreaFilter,
    parseMapFilters,
    parseMapListingSource,
    parseShowLatestOnly,
} from "./map-page";

describe("analytics map-page helpers", () => {
    it("parses map filters and source settings from url params", () => {
        const params = new URLSearchParams(
            "source=loopnet&latest=false&priceMin=1000&priceMax=2000&capRateMin=5&sqftMin=900&beds=1,2&bathsMin=1.5&propertyType=reit",
        );

        expect(parseMapListingSource(params)).toBe("loopnet");
        expect(parseShowLatestOnly(params)).toBe(false);
        expect(parseMapFilters(params)).toEqual({
            priceMin: "1000",
            priceMax: "2000",
            capRateMin: "5",
            capRateMax: "",
            sqftMin: "900",
            sqftMax: "",
            beds: [1, 2],
            bathsMin: 1.5,
            propertyType: "reit",
        });
    });

    it("parses and serializes area filters", () => {
        const params = new URLSearchParams(
            "areaType=city&area=Oakland%2C%20CA&areaCity=Oakland&areaCityState=CA&areaBboxW=-122.4&areaBboxS=37.7&areaBboxE=-122.1&areaBboxN=37.9",
        );

        const areaFilter = parseAreaFilter(params);
        expect(areaFilter).toEqual({
            type: "city",
            label: "Oakland, CA",
            cityName: "Oakland",
            cityState: "CA",
            bbox: {
                west: -122.4,
                south: 37.7,
                east: -122.1,
                north: 37.9,
            },
        });

        const serialized = buildMapSearchParams({
            filters: createDefaultMapFilters(),
            mapListingSource: "zillow",
            showLatestOnly: true,
            areaType: "city",
            areaFilter,
        });
        expect(serialized.get("areaCity")).toBe("Oakland");
        expect(serialized.get("areaBboxN")).toBe("37.9");
    });

    it("counts only active filters relevant to the active listing source", () => {
        const filters = {
            ...createDefaultMapFilters(),
            priceMin: "1000",
            capRateMin: "4",
            beds: [2],
            bathsMin: 2,
            propertyType: "reit" as const,
        };

        expect(countActiveMapFilters(filters, "zillow")).toBe(4);
        expect(countActiveMapFilters(filters, "loopnet")).toBe(2);
    });
});
