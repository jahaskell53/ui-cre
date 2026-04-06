import { describe, expect, it } from "vitest";
import { groupReitRows, mapCleanedListingRow, mapLoopnetRow, processZillowRows } from "./map-listings";

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

// ── mapCleanedListingRow ──────────────────────────────────────────────────────

describe("mapCleanedListingRow", () => {
    const base = {
        id: "cl-abc",
        address_raw: "456 Oak Ave, Redwood City, CA 94061",
        address_street: "456 Oak Ave",
        address_city: "Redwood City",
        address_state: "CA",
        address_zip: "94061",
        price: 3200,
        area: 850,
        latitude: 37.475,
        longitude: -122.226,
        img_src: "https://example.com/photo.jpg",
        scraped_at: "2024-03-01T00:00:00Z",
        home_type: "APARTMENT",
        building_zpid: null,
        is_building: false,
    };

    it("prefixes id with 'zillow-'", () => {
        const result = mapCleanedListingRow(base);
        expect(result.id).toBe("zillow-cl-abc");
    });

    it("uses address_raw for name and address", () => {
        const result = mapCleanedListingRow(base);
        expect(result.name).toBe("456 Oak Ave, Redwood City, CA 94061");
        expect(result.address).toBe("456 Oak Ave, Redwood City, CA 94061");
    });

    it("assembles address from parts when address_raw is missing", () => {
        const result = mapCleanedListingRow({ ...base, address_raw: null });
        expect(result.address).toBe("456 Oak Ave, Redwood City, CA, 94061");
    });

    it("formats price with dollar sign", () => {
        const result = mapCleanedListingRow(base);
        expect(result.price).toBe("$3,200");
    });

    it('returns "TBD" when price is null', () => {
        const result = mapCleanedListingRow({ ...base, price: null });
        expect(result.price).toBe("TBD");
    });

    it("sets coordinates as [longitude, latitude]", () => {
        const result = mapCleanedListingRow(base);
        expect(result.coordinates).toEqual([-122.226, 37.475]);
    });

    it("sets listingSource to 'zillow'", () => {
        const result = mapCleanedListingRow(base);
        expect(result.listingSource).toBe("zillow");
    });

    it("converts area to string for squareFootage", () => {
        const result = mapCleanedListingRow(base);
        expect(result.squareFootage).toBe("850");
    });

    it("sets squareFootage to undefined when area is missing", () => {
        const result = mapCleanedListingRow({ ...base, area: null });
        expect(result.squareFootage).toBeUndefined();
    });
});

// ── groupReitRows ─────────────────────────────────────────────────────────────

describe("groupReitRows", () => {
    const makeUnit = (overrides: Record<string, unknown> = {}) => ({
        id: `unit-${Math.random()}`,
        building_zpid: "bld-1",
        address_raw: "100 Tower Blvd, Oakland, CA 94601",
        address_street: "100 Tower Blvd",
        address_city: "Oakland",
        address_state: "CA",
        address_zip: "94601",
        latitude: 37.8044,
        longitude: -122.2711,
        img_src: null,
        scraped_at: "2024-04-01T00:00:00Z",
        is_building: false,
        beds: 1,
        baths: 1,
        price: 2000,
        ...overrides,
    });

    it("groups multiple units under the same building_zpid into one pin", () => {
        const units = [makeUnit(), makeUnit({ beds: 2, baths: 2, price: 3000 })];
        const result = groupReitRows(units);
        expect(result).toHaveLength(1);
        expect(result[0].isReit).toBe(true);
        expect(result[0].units).toBe(2);
    });

    it("produces separate pins for different building_zpids", () => {
        const units = [makeUnit({ building_zpid: "bld-A" }), makeUnit({ building_zpid: "bld-B" })];
        const result = groupReitRows(units);
        expect(result).toHaveLength(2);
    });

    it("builds a unitMix sorted by beds then baths", () => {
        const units = [
            makeUnit({ beds: 2, baths: 1, price: 3000 }),
            makeUnit({ beds: 1, baths: 1, price: 2000 }),
            makeUnit({ beds: 2, baths: 2, price: 3500 }),
        ];
        const [pin] = groupReitRows(units);
        expect(pin.unitMix).toHaveLength(3);
        expect(pin.unitMix![0].beds).toBe(1);
        expect(pin.unitMix![1].beds).toBe(2);
        expect(pin.unitMix![1].baths).toBe(1);
        expect(pin.unitMix![2].beds).toBe(2);
        expect(pin.unitMix![2].baths).toBe(2);
    });

    it("calculates average price across units", () => {
        const units = [makeUnit({ price: 2000 }), makeUnit({ price: 3000 })];
        const [pin] = groupReitRows(units);
        expect(pin.price).toBe("$2,500 avg");
    });

    it('sets price to "TBD" when no units have a price', () => {
        const units = [makeUnit({ price: null }), makeUnit({ price: null })];
        const [pin] = groupReitRows(units);
        expect(pin.price).toBe("TBD");
    });

    it("counts only units with a price when computing avgPrice in unitMix", () => {
        const units = [makeUnit({ beds: 1, baths: 1, price: 2000 }), makeUnit({ beds: 1, baths: 1, price: null })];
        const [pin] = groupReitRows(units);
        expect(pin.unitMix![0].avgPrice).toBe(2000);
        expect(pin.unitMix![0].count).toBe(2);
    });

    it("uses id of first unit for the pin id", () => {
        const firstId = "unit-first";
        const units = [makeUnit({ id: firstId }), makeUnit()];
        const [pin] = groupReitRows(units);
        expect(pin.id).toBe(`zillow-${firstId}`);
    });
});

// ── processZillowRows ─────────────────────────────────────────────────────────

describe("processZillowRows", () => {
    const individualListing = {
        id: "ind-1",
        building_zpid: null,
        is_building: false,
        address_raw: "99 Solo St, San Jose, CA 95101",
        address_city: "San Jose",
        address_state: "CA",
        address_zip: "95101",
        address_street: "99 Solo St",
        price: 1800,
        area: 600,
        latitude: 37.3382,
        longitude: -121.8863,
        img_src: null,
        scraped_at: "2024-05-01T00:00:00Z",
        home_type: "APARTMENT",
    };

    const reitUnit = (id: string, building_zpid = "bld-X") => ({
        id,
        building_zpid,
        is_building: false,
        address_raw: "200 Reit Rd, San Jose, CA 95110",
        address_city: "San Jose",
        address_state: "CA",
        address_zip: "95110",
        address_street: "200 Reit Rd",
        price: 2500,
        area: 800,
        latitude: 37.34,
        longitude: -121.89,
        img_src: null,
        scraped_at: "2024-05-01T00:00:00Z",
        home_type: "APARTMENT",
        beds: 1,
        baths: 1,
    });

    it("passes individual listings through as separate pins", () => {
        const result = processZillowRows([individualListing, { ...individualListing, id: "ind-2" }]);
        expect(result).toHaveLength(2);
        expect(result.every((p) => !p.isReit)).toBe(true);
    });

    it("groups REIT units into one pin per building", () => {
        const result = processZillowRows([reitUnit("u1"), reitUnit("u2"), reitUnit("u3")]);
        expect(result).toHaveLength(1);
        expect(result[0].isReit).toBe(true);
        expect(result[0].units).toBe(3);
    });

    it("handles a mix of individual listings and REIT units", () => {
        const result = processZillowRows([individualListing, reitUnit("u1"), reitUnit("u2")]);
        expect(result).toHaveLength(2);
        const individual = result.find((p) => !p.isReit);
        const building = result.find((p) => p.isReit);
        expect(individual).toBeDefined();
        expect(building?.units).toBe(2);
    });

    it("returns empty array for empty input", () => {
        expect(processZillowRows([])).toEqual([]);
    });

    it("excludes is_building=true rows from individual listings", () => {
        const buildingRow = { ...individualListing, is_building: true, id: "bld-row" };
        const result = processZillowRows([buildingRow]);
        // is_building=true with no building_zpid: filtered out of nonReit, not added to reitUnits either
        expect(result).toHaveLength(0);
    });

    it("two separate buildings produce two REIT pins", () => {
        const result = processZillowRows([reitUnit("u1", "bld-A"), reitUnit("u2", "bld-B")]);
        expect(result).toHaveLength(2);
        expect(result.every((p) => p.isReit)).toBe(true);
    });
});
