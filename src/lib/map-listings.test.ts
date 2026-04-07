import { describe, expect, it } from "vitest";
import { mapLoopnetRow, mapZillowRpcRow, type ZillowMapListingRow } from "./map-listings";

// ── mapLoopnetRow ─────────────────────────────────────────────────────────────

describe("mapLoopnetRow", () => {
    const base = {
        id: "ln-1",
        headline: "Prime Apartment Complex",
        address: "123 Main St, San Francisco, CA",
        location: "San Francisco, CA",
        price: "$2,500,000",
        cap_rate: "5.2%",
        square_footage: "10000",
        latitude: 37.77,
        longitude: -122.41,
        thumbnail_url: "https://example.com/img.jpg",
        created_at: "2024-01-15T00:00:00Z",
    };

    it("maps id, name, address and source", () => {
        const result = mapLoopnetRow(base);
        expect(result.id).toBe("ln-1");
        expect(result.name).toBe("Prime Apartment Complex");
        expect(result.address).toBe("123 Main St, San Francisco, CA");
        expect(result.listingSource).toBe("loopnet");
    });

    it("sets coordinates as [longitude, latitude]", () => {
        const result = mapLoopnetRow(base);
        expect(result.coordinates).toEqual([-122.41, 37.77]);
    });

    it("maps price, capRate, thumbnailUrl, _createdAt", () => {
        const result = mapLoopnetRow(base);
        expect(result.price).toBe("$2,500,000");
        expect(result.capRate).toBe("5.2%");
        expect(result.thumbnailUrl).toBe("https://example.com/img.jpg");
        expect(result._createdAt).toBe("2024-01-15T00:00:00Z");
    });

    it("falls back to address when headline is missing", () => {
        const result = mapLoopnetRow({ ...base, headline: null });
        expect(result.name).toBe("123 Main St, San Francisco, CA");
    });

    it('falls back to "Building" when both headline and address are missing', () => {
        const result = mapLoopnetRow({ ...base, headline: null, address: null });
        expect(result.name).toBe("Building");
    });

    it('uses "TBD" when price is missing', () => {
        const result = mapLoopnetRow({ ...base, price: null });
        expect(result.price).toBe("TBD");
    });

    it("estimates units from square_footage / 500", () => {
        const result = mapLoopnetRow({ ...base, square_footage: "5000" });
        expect(result.units).toBe(10);
    });

    it("returns null units when square_footage is missing", () => {
        const result = mapLoopnetRow({ ...base, square_footage: null });
        expect(result.units).toBeNull();
    });
});

// ── mapZillowRpcRow ───────────────────────────────────────────────────────────

describe("mapZillowRpcRow", () => {
    const baseIndividual: ZillowMapListingRow = {
        id: "zillow-abc-123",
        address: "456 Oak Ave, Redwood City, CA 94061",
        longitude: -122.226,
        latitude: 37.475,
        price_label: "$3,200",
        is_reit: false,
        unit_count: 1,
        unit_mix: [],
        img_src: "https://example.com/photo.jpg",
        area: 850,
        scraped_at: "2024-03-01T00:00:00Z",
        total_count: 42,
    };

    const baseReit: ZillowMapListingRow = {
        id: "zillow-bld-999",
        address: "100 Tower Blvd, Oakland, CA 94601",
        longitude: -122.271,
        latitude: 37.804,
        price_label: "$2,500 avg",
        is_reit: true,
        unit_count: 3,
        unit_mix: [
            { beds: 1, baths: 1, count: 2, avg_price: 2200 },
            { beds: 2, baths: 2, count: 1, avg_price: 3100 },
        ],
        img_src: null,
        area: null,
        scraped_at: "2024-04-01T00:00:00Z",
        total_count: 42,
    };

    it("preserves the id directly", () => {
        expect(mapZillowRpcRow(baseIndividual).id).toBe("zillow-abc-123");
    });

    it("uses address as both name and address", () => {
        const result = mapZillowRpcRow(baseIndividual);
        expect(result.name).toBe("456 Oak Ave, Redwood City, CA 94061");
        expect(result.address).toBe("456 Oak Ave, Redwood City, CA 94061");
    });

    it("sets coordinates as [longitude, latitude]", () => {
        const result = mapZillowRpcRow(baseIndividual);
        expect(result.coordinates).toEqual([-122.226, 37.475]);
    });

    it("sets listingSource to 'zillow'", () => {
        expect(mapZillowRpcRow(baseIndividual).listingSource).toBe("zillow");
    });

    it("maps price_label to price", () => {
        expect(mapZillowRpcRow(baseIndividual).price).toBe("$3,200");
    });

    it("maps img_src to thumbnailUrl", () => {
        expect(mapZillowRpcRow(baseIndividual).thumbnailUrl).toBe("https://example.com/photo.jpg");
    });

    it("sets thumbnailUrl to undefined when img_src is null", () => {
        expect(mapZillowRpcRow(baseReit).thumbnailUrl).toBeUndefined();
    });

    it("converts area to string for squareFootage", () => {
        expect(mapZillowRpcRow(baseIndividual).squareFootage).toBe("850");
    });

    it("sets squareFootage to undefined when area is null", () => {
        expect(mapZillowRpcRow(baseReit).squareFootage).toBeUndefined();
    });

    it("individual pin: isReit=false, units=null, unitMix=[]", () => {
        const result = mapZillowRpcRow(baseIndividual);
        expect(result.isReit).toBe(false);
        expect(result.units).toBeNull();
        expect(result.unitMix).toEqual([]);
    });

    it("REIT pin: isReit=true, units=unit_count, unitMix mapped from unit_mix", () => {
        const result = mapZillowRpcRow(baseReit);
        expect(result.isReit).toBe(true);
        expect(result.units).toBe(3);
        expect(result.unitMix).toEqual([
            { beds: 1, baths: 1, count: 2, avgPrice: 2200 },
            { beds: 2, baths: 2, count: 1, avgPrice: 3100 },
        ]);
    });

    it("maps avg_price to avgPrice (camelCase)", () => {
        const result = mapZillowRpcRow(baseReit);
        expect(result.unitMix![0].avgPrice).toBe(2200);
    });

    it("sets _createdAt from scraped_at", () => {
        expect(mapZillowRpcRow(baseIndividual)._createdAt).toBe("2024-03-01T00:00:00Z");
    });

    it("sets _createdAt to empty string when scraped_at is null", () => {
        expect(mapZillowRpcRow({ ...baseIndividual, scraped_at: null })._createdAt).toBe("");
    });
});
