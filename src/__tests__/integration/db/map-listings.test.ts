/**
 * DB integration tests for the map listings fetch + transformation pipeline.
 *
 * These tests exercise the same query logic used by the analytics map page and
 * the same transformation functions in src/lib/map-listings.ts.  They are
 * designed to pass both before and after the planned migration that pushes the
 * REIT grouping to the database side — the observable contract (shapes,
 * invariants) must remain identical regardless of where the grouping happens.
 *
 * Fixtures
 * ────────
 * Zillow / cleaned_listings: ZIP 94704 (Berkeley, CA)
 *   - has both individual listings and REIT multi-unit buildings
 *   - bbox derived from real data: lat 37.860985–37.877010, lng -122.2735–-122.24522
 *
 * LoopNet / loopnet_listings: San Francisco Bay Area bbox
 *   - lat 37.70–37.89, lng -122.49–-122.20 (160 geocoded listings)
 *
 * Requires SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and
 * SUPABASE_SERVICE_ROLE_KEY in the environment.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it } from "vitest";
import { mapLoopnetRow, processZillowRows, type CleanedListingRow, type LoopnetRow } from "@/lib/map-listings";

// ── Berkeley, ZIP 94704 — has both individual and REIT listings ──────────────
const BERKELEY_ZIP = "94704";
const BERKELEY_BBOX = { south: 37.860985, north: 37.87701, west: -122.2735, east: -122.24522 };

// ── SF Bay Area bbox used for LoopNet ────────────────────────────────────────
const BAY_AREA_BBOX = { south: 37.7, north: 37.89, west: -122.49, east: -122.2 };

function makeClient(): SupabaseClient {
    const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error("Missing SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
    return createClient(url, key);
}

// ── Zillow / cleaned_listings ─────────────────────────────────────────────────

describe("Zillow map listings — ZIP 94704 (Berkeley)", () => {
    let rawRows: CleanedListingRow[] = [];

    beforeAll(async () => {
        const client = makeClient();
        const { data, error } = await client
            .from("cleaned_listings")
            .select("*")
            .not("latitude", "is", null)
            .not("longitude", "is", null)
            .neq("home_type", "SINGLE_FAMILY")
            .eq("address_zip", BERKELEY_ZIP)
            .gte("latitude", BERKELEY_BBOX.south)
            .lte("latitude", BERKELEY_BBOX.north)
            .gte("longitude", BERKELEY_BBOX.west)
            .lte("longitude", BERKELEY_BBOX.east);

        if (error) throw new Error(`Supabase query error: ${error.message}`);
        rawRows = (data ?? []) as CleanedListingRow[];
    });

    it("returns raw rows from the database", () => {
        expect(rawRows.length).toBeGreaterThan(0);
    });

    it("raw rows include both individual and REIT unit rows", () => {
        const individuals = rawRows.filter((r) => !r.building_zpid && !r.is_building);
        const reitUnits = rawRows.filter((r) => r.building_zpid != null);
        expect(individuals.length).toBeGreaterThan(0);
        expect(reitUnits.length).toBeGreaterThan(0);
    });

    describe("after processZillowRows transformation", () => {
        let pins: ReturnType<typeof processZillowRows>;

        beforeAll(() => {
            pins = processZillowRows(rawRows);
        });

        it("produces fewer pins than raw rows (REIT units are grouped)", () => {
            expect(pins.length).toBeLessThan(rawRows.length);
        });

        it("every pin has required fields: id, name, address, coordinates, price, listingSource", () => {
            for (const pin of pins) {
                expect(pin.id).toBeTruthy();
                expect(typeof pin.name).toBe("string");
                expect(typeof pin.address).toBe("string");
                expect(Array.isArray(pin.coordinates)).toBe(true);
                expect(pin.coordinates).toHaveLength(2);
                expect(typeof pin.price).toBe("string");
                expect(pin.listingSource).toBe("zillow");
            }
        });

        it("coordinates are [longitude, latitude] (lng first, as Mapbox expects)", () => {
            for (const pin of pins) {
                const [lng, lat] = pin.coordinates;
                // Within generous bounds for the Bay Area
                expect(lat).toBeGreaterThan(30);
                expect(lat).toBeLessThan(50);
                expect(lng).toBeLessThan(0); // Western hemisphere
            }
        });

        it("REIT pins have isReit=true, a units count, and a non-empty unitMix", () => {
            const reitPins = pins.filter((p) => p.isReit);
            expect(reitPins.length).toBeGreaterThan(0);
            for (const pin of reitPins) {
                expect(pin.units).toBeGreaterThan(0);
                expect(Array.isArray(pin.unitMix)).toBe(true);
                expect(pin.unitMix!.length).toBeGreaterThan(0);
            }
        });

        it("individual listing pins do not have isReit set", () => {
            const individualPins = pins.filter((p) => !p.isReit);
            expect(individualPins.length).toBeGreaterThan(0);
            for (const pin of individualPins) {
                expect(pin.isReit).toBeFalsy();
            }
        });

        it("unitMix entries each have beds, baths, count, and a non-negative avgPrice or null", () => {
            const reitPins = pins.filter((p) => p.isReit);
            for (const pin of reitPins) {
                for (const row of pin.unitMix!) {
                    expect(row.count).toBeGreaterThan(0);
                    if (row.avgPrice !== null) {
                        expect(row.avgPrice).toBeGreaterThan(0);
                    }
                }
            }
        });

        it("total raw REIT unit rows equals sum of units across REIT pins", () => {
            const rawReitUnits = rawRows.filter((r) => r.building_zpid != null);
            const reitPins = pins.filter((p) => p.isReit);
            const pinUnitSum = reitPins.reduce((acc, p) => acc + (p.units ?? 0), 0);
            expect(pinUnitSum).toBe(rawReitUnits.length);
        });
    });
});

// ── LoopNet / loopnet_listings ────────────────────────────────────────────────

describe("LoopNet map listings — SF Bay Area bbox", () => {
    let rawRows: LoopnetRow[] = [];

    beforeAll(async () => {
        const client = makeClient();
        const { data, error } = await client
            .from("loopnet_listings")
            .select("*")
            .not("latitude", "is", null)
            .not("longitude", "is", null)
            .gte("latitude", BAY_AREA_BBOX.south)
            .lte("latitude", BAY_AREA_BBOX.north)
            .gte("longitude", BAY_AREA_BBOX.west)
            .lte("longitude", BAY_AREA_BBOX.east)
            .order("created_at", { ascending: false });

        if (error) throw new Error(`Supabase query error: ${error.message}`);
        rawRows = (data ?? []) as LoopnetRow[];
    });

    it("returns rows from the database", () => {
        expect(rawRows.length).toBeGreaterThan(0);
    });

    describe("after mapLoopnetRow transformation", () => {
        let pins: ReturnType<typeof mapLoopnetRow>[];

        beforeAll(() => {
            pins = rawRows.map(mapLoopnetRow);
        });

        it("produces one pin per raw row (no grouping for LoopNet)", () => {
            expect(pins.length).toBe(rawRows.length);
        });

        it("every pin has required fields: id, name, address, coordinates, price, listingSource", () => {
            for (const pin of pins) {
                expect(pin.id).toBeTruthy();
                expect(typeof pin.name).toBe("string");
                expect(typeof pin.address).toBe("string");
                expect(Array.isArray(pin.coordinates)).toBe(true);
                expect(pin.coordinates).toHaveLength(2);
                expect(typeof pin.price).toBe("string");
                expect(pin.listingSource).toBe("loopnet");
            }
        });

        it("coordinates are [longitude, latitude] (lng first, as Mapbox expects)", () => {
            for (const pin of pins) {
                const [lng, lat] = pin.coordinates;
                expect(lat).toBeGreaterThan(30);
                expect(lat).toBeLessThan(50);
                expect(lng).toBeLessThan(0);
            }
        });

        it("no LoopNet pins have isReit set", () => {
            expect(pins.every((p) => !p.isReit)).toBe(true);
        });
    });
});
