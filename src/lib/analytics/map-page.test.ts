import { describe, expect, it } from "vitest";
import {
    buildMapSearchParams,
    countActiveMapFilters,
    createDefaultMapFilters,
    parseAreaFilter,
    parseMapFilters,
    parseMapListingSource,
    parseMobileListingsPanel,
    parseShowLatestOnly,
} from "./map-page";

describe("analytics map-page helpers", () => {
    it("parses map filters and source settings from url params", () => {
        const params = new URLSearchParams(
            "source=loopnet&latest=false&priceMin=1000&priceMax=2000&capRateMin=5&sqftMin=900&beds=1,2&bathsMin=1.5&propertyType=reit",
        );

        expect(parseMapListingSource(params)).toBe("loopnet");
        expect(parseShowLatestOnly(params)).toBe(false);
        expect(parseMobileListingsPanel(params)).toBe("list");
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

    it("parses mobile list vs map panel from url", () => {
        expect(parseMobileListingsPanel(new URLSearchParams())).toBe("list");
        expect(parseMobileListingsPanel(new URLSearchParams("panel=map"))).toBe("map");
    });

    it("serializes mobile panel when provided to buildMapSearchParams", () => {
        const withMap = buildMapSearchParams({
            filters: createDefaultMapFilters(),
            mapListingSource: "zillow",
            showLatestOnly: true,
            areaType: "zip",
            areaFilter: null,
            mobileListingsPanel: "map",
        });
        expect(withMap.get("panel")).toBe("map");

        const withList = buildMapSearchParams({
            baseParams: withMap,
            filters: createDefaultMapFilters(),
            mapListingSource: "zillow",
            showLatestOnly: true,
            areaType: "zip",
            areaFilter: null,
            mobileListingsPanel: "list",
        });
        expect(withList.get("panel")).toBeNull();
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
