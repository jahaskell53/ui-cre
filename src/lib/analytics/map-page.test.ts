import { describe, expect, it } from "vitest";
import {
    type LaundryFilterValue,
    buildMapSearchParams,
    countActiveMapFilters,
    createDefaultMapFilters,
    parseAreaFilter,
    parseListingsViewMode,
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
        expect(parseListingsViewMode(params)).toBe("map");
        expect(parseMapFilters(params)).toEqual({
            priceMin: "1000",
            priceMax: "2000",
            capRateMin: "5",
            capRateMax: "",
            sqftMin: "900",
            sqftMax: "",
            beds: [1, 2],
            bathsMin: 1.5,
            laundry: [],
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

    it("parses address filter with bbox and no addressQuery (geocoded proximity)", () => {
        const params = new URLSearchParams(
            "areaType=address&area=123+Main+St%2C+San+Francisco%2C+CA&areaBboxW=-122.42&areaBboxS=37.76&areaBboxE=-122.40&areaBboxN=37.78",
        );

        const areaFilter = parseAreaFilter(params);
        expect(areaFilter).toEqual({
            type: "address",
            label: "123 Main St, San Francisco, CA",
            addressQuery: undefined,
            bbox: {
                west: -122.42,
                south: 37.76,
                east: -122.4,
                north: 37.78,
            },
        });
    });

    it("parses address filter with addressQuery and no bbox (text search)", () => {
        const params = new URLSearchParams("areaType=address&area=Market+St&areaAddress=Market+St");

        const areaFilter = parseAreaFilter(params);
        expect(areaFilter).toEqual({
            type: "address",
            label: "Market St",
            addressQuery: "Market St",
            bbox: undefined,
        });
    });

    it("serializes and restores geocoded address filter (bbox, no addressQuery)", () => {
        const areaFilter = {
            type: "address" as const,
            label: "123 Main St, San Francisco, CA",
            addressQuery: undefined,
            bbox: { west: -122.42, south: 37.76, east: -122.4, north: 37.78 },
        };

        const serialized = buildMapSearchParams({
            filters: createDefaultMapFilters(),
            mapListingSource: "zillow",
            showLatestOnly: true,
            areaType: "address",
            areaFilter,
        });

        expect(serialized.get("areaAddress")).toBeNull();
        expect(serialized.get("areaBboxW")).toBe("-122.42");
        expect(serialized.get("areaBboxN")).toBe("37.78");

        const restored = parseAreaFilter(serialized);
        expect(restored?.addressQuery).toBeUndefined();
        expect(restored?.bbox?.west).toBe(-122.42);
    });

    it("parses listings view mode from url", () => {
        expect(parseListingsViewMode(new URLSearchParams())).toBe("map");
        expect(parseListingsViewMode(new URLSearchParams("view=list"))).toBe("list");
    });

    it("serializes listings view mode when provided to buildMapSearchParams", () => {
        const withList = buildMapSearchParams({
            filters: createDefaultMapFilters(),
            mapListingSource: "zillow",
            showLatestOnly: true,
            areaType: "zip",
            areaFilter: null,
            listingsViewMode: "list",
        });
        expect(withList.get("view")).toBe("list");

        const withMap = buildMapSearchParams({
            baseParams: withList,
            filters: createDefaultMapFilters(),
            mapListingSource: "zillow",
            showLatestOnly: true,
            areaType: "zip",
            areaFilter: null,
            listingsViewMode: "map",
        });
        expect(withMap.get("view")).toBeNull();
    });

    it("counts only active filters relevant to the active listing source", () => {
        const filters = {
            ...createDefaultMapFilters(),
            priceMin: "1000",
            capRateMin: "4",
            beds: [2],
            bathsMin: 2,
            laundry: ["in_unit"] as LaundryFilterValue[],
            propertyType: "reit" as const,
        };

        expect(countActiveMapFilters(filters, "zillow")).toBe(5);
        expect(countActiveMapFilters(filters, "loopnet")).toBe(3);
    });

    it("parses laundry from url and round-trips in buildMapSearchParams", () => {
        const params = new URLSearchParams("laundry=in_unit,none");
        const filters = parseMapFilters(params);
        expect(filters.laundry).toEqual(["in_unit", "none"]);

        const out = buildMapSearchParams({
            filters,
            mapListingSource: "zillow",
            showLatestOnly: true,
            areaType: "zip",
            areaFilter: null,
        });
        expect(out.get("laundry")).toBe("in_unit,none");
    });
});
