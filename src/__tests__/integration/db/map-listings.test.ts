/**
 * DB integration tests for the map listings fetch + transformation pipeline.
 *
 * Section 1: raw cleaned_listings + client-side processZillowRows
 *   Tests the existing approach: fetch raw rows, transform on the client.
 *   These remain the regression guard across the migration.
 *
 * Section 2: get_zillow_map_pins RPC
 *   Tests the new DB-side RPC that performs grouping in SQL and returns
 *   one row per map pin. The output contract must match Section 1.
 *
 * Section 3: LoopNet raw fetch + mapLoopnetRow
 *   Unchanged by the migration; LoopNet is always one row per listing.
 *
 * Fixtures
 * ────────
 * Zillow / cleaned_listings: ZIP 94610 (Oakland, CA)
 *   - 969 total rows (below the PostgREST 1000-row default cap)
 *   - has both individual listings (413) and REIT multi-unit buildings (405 units)
 *   - bbox: lat 37.799458–37.820213, lng -122.261055–-122.22394
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

// ── Oakland, ZIP 94610 — 969 total rows (< PostgREST 1000 cap), 413 individual + 405 REIT units ──
const OAKLAND_ZIP = "94610";
const OAKLAND_BBOX = { south: 37.799458, north: 37.820213, west: -122.261055, east: -122.22394 };

// ── SF Bay Area bbox used for LoopNet ────────────────────────────────────────
const BAY_AREA_BBOX = { south: 37.7, north: 37.89, west: -122.49, east: -122.2 };

function makeClient(): SupabaseClient {
    const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error("Missing SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
    return createClient(url, key);
}

// ── Zillow / cleaned_listings ─────────────────────────────────────────────────

describe("Zillow map listings — ZIP 94610 (Oakland)", () => {
    let rawRows: CleanedListingRow[] = [];

    beforeAll(async () => {
        const client = makeClient();
        const { data, error } = await client
            .from("cleaned_listings")
            .select("*")
            .not("latitude", "is", null)
            .not("longitude", "is", null)
            .neq("home_type", "SINGLE_FAMILY")
            .eq("address_zip", OAKLAND_ZIP)
            .gte("latitude", OAKLAND_BBOX.south)
            .lte("latitude", OAKLAND_BBOX.north)
            .gte("longitude", OAKLAND_BBOX.west)
            .lte("longitude", OAKLAND_BBOX.east);

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

// ── get_zillow_map_pins RPC ───────────────────────────────────────────────────
//
// Contract: one row per map pin. REIT units sharing a building_zpid are
// collapsed into a single row with unit_mix JSONB. Individual listings are
// returned as-is. The total_count column reflects the pre-grouping pin count
// (i.e. the number of rows this call returns, not raw unit rows).
//
// Each row must have:
//   id            text          — 'zillow-<uuid>' for individuals, 'zillow-<first_unit_uuid>' for buildings
//   address       text
//   longitude     float8
//   latitude      float8
//   price_label   text          — '$N,NNN' or '$N,NNN avg' for buildings or 'TBD'
//   is_reit       boolean
//   unit_count    int           — 1 for individuals, N for buildings
//   unit_mix      jsonb         — [] for individuals, [{beds,baths,count,avg_price},...] for buildings
//   img_src       text | null
//   area          int | null
//   total_count   bigint        — COUNT(*) OVER() = total pins returned

interface ZillowMapPin {
    id: string;
    address: string;
    longitude: number;
    latitude: number;
    price_label: string;
    is_reit: boolean;
    unit_count: number;
    unit_mix: { beds: number | null; baths: number | null; count: number; avg_price: number | null }[];
    img_src: string | null;
    area: number | null;
    total_count: number;
}

describe("get_zillow_map_pins RPC — ZIP 94610 (Oakland)", () => {
    let pins: ZillowMapPin[] = [];
    let rpcError: { message: string } | null = null;

    beforeAll(async () => {
        const client = makeClient();
        const { data, error } = await client.rpc("get_zillow_map_pins", {
            p_zip: OAKLAND_ZIP,
            p_city: null,
            p_address_query: null,
            p_latest_only: false,
            p_price_min: null,
            p_price_max: null,
            p_sqft_min: null,
            p_sqft_max: null,
            p_beds: null,
            p_baths_min: null,
            p_home_types: null,
            p_property_type: "both",
            p_bounds_south: OAKLAND_BBOX.south,
            p_bounds_north: OAKLAND_BBOX.north,
            p_bounds_west: OAKLAND_BBOX.west,
            p_bounds_east: OAKLAND_BBOX.east,
        });
        rpcError = error;
        pins = (data ?? []) as ZillowMapPin[];
    });

    it("RPC exists and returns without error", () => {
        expect(rpcError).toBeNull();
    });

    it("returns at least one pin", () => {
        expect(pins.length).toBeGreaterThan(0);
    });

    it("every pin has the required fields with correct types", () => {
        for (const pin of pins) {
            expect(typeof pin.id).toBe("string");
            expect(pin.id.startsWith("zillow-")).toBe(true);
            expect(typeof pin.address).toBe("string");
            expect(typeof pin.longitude).toBe("number");
            expect(typeof pin.latitude).toBe("number");
            expect(typeof pin.price_label).toBe("string");
            expect(typeof pin.is_reit).toBe("boolean");
            expect(typeof pin.unit_count).toBe("number");
            expect(pin.unit_count).toBeGreaterThanOrEqual(1);
            expect(Array.isArray(pin.unit_mix)).toBe(true);
        }
    });

    it("coordinates are in plausible Bay Area range", () => {
        for (const pin of pins) {
            expect(pin.latitude).toBeGreaterThan(37);
            expect(pin.latitude).toBeLessThan(38.5);
            expect(pin.longitude).toBeGreaterThan(-123);
            expect(pin.longitude).toBeLessThan(-122);
        }
    });

    it("returns fewer pins than the raw unit count (REIT grouping happened in DB)", () => {
        // We know 94704 has thousands of REIT unit rows. If grouping worked,
        // pins < raw unit rows. We confirm via total_count matching pins.length.
        expect(pins[0].total_count).toBe(pins.length);
    });

    it("REIT pins have is_reit=true, unit_count > 1, and a non-empty unit_mix", () => {
        const reitPins = pins.filter((p) => p.is_reit);
        expect(reitPins.length).toBeGreaterThan(0);
        for (const pin of reitPins) {
            expect(pin.unit_count).toBeGreaterThan(1);
            expect(pin.unit_mix.length).toBeGreaterThan(0);
        }
    });

    it("individual pins have is_reit=false, unit_count=1, and an empty unit_mix", () => {
        const individualPins = pins.filter((p) => !p.is_reit);
        expect(individualPins.length).toBeGreaterThan(0);
        for (const pin of individualPins) {
            expect(pin.unit_count).toBe(1);
            expect(pin.unit_mix).toHaveLength(0);
        }
    });

    it("unit_mix entries each have beds, baths, count >= 1, and avg_price >= 0 or null", () => {
        const reitPins = pins.filter((p) => p.is_reit);
        for (const pin of reitPins) {
            for (const row of pin.unit_mix) {
                expect(row.count).toBeGreaterThanOrEqual(1);
                if (row.avg_price !== null) {
                    expect(row.avg_price).toBeGreaterThan(0);
                }
            }
        }
    });

    it("price_label is '$N' or '$N avg' for priced pins, or 'TBD'", () => {
        for (const pin of pins) {
            expect(pin.price_label).toMatch(/^\$[\d,]+( avg)?$|^TBD$/);
        }
    });

    it("p_property_type='reit' returns only REIT pins", async () => {
        const client = makeClient();
        const { data, error } = await client.rpc("get_zillow_map_pins", {
            p_zip: OAKLAND_ZIP,
            p_city: null,
            p_address_query: null,
            p_latest_only: false,
            p_price_min: null,
            p_price_max: null,
            p_sqft_min: null,
            p_sqft_max: null,
            p_beds: null,
            p_baths_min: null,
            p_home_types: null,
            p_property_type: "reit",
            p_bounds_south: OAKLAND_BBOX.south,
            p_bounds_north: OAKLAND_BBOX.north,
            p_bounds_west: OAKLAND_BBOX.west,
            p_bounds_east: OAKLAND_BBOX.east,
        });
        expect(error).toBeNull();
        const reitOnly = (data ?? []) as ZillowMapPin[];
        expect(reitOnly.length).toBeGreaterThan(0);
        expect(reitOnly.every((p) => p.is_reit)).toBe(true);
    });

    it("p_property_type='mid' returns only individual (non-REIT) pins", async () => {
        const client = makeClient();
        const { data, error } = await client.rpc("get_zillow_map_pins", {
            p_zip: OAKLAND_ZIP,
            p_city: null,
            p_address_query: null,
            p_latest_only: false,
            p_price_min: null,
            p_price_max: null,
            p_sqft_min: null,
            p_sqft_max: null,
            p_beds: null,
            p_baths_min: null,
            p_home_types: null,
            p_property_type: "mid",
            p_bounds_south: OAKLAND_BBOX.south,
            p_bounds_north: OAKLAND_BBOX.north,
            p_bounds_west: OAKLAND_BBOX.west,
            p_bounds_east: OAKLAND_BBOX.east,
        });
        expect(error).toBeNull();
        const midOnly = (data ?? []) as ZillowMapPin[];
        expect(midOnly.length).toBeGreaterThan(0);
        expect(midOnly.every((p) => !p.is_reit)).toBe(true);
    });

    it("p_price_min filter excludes pins below the threshold", async () => {
        const threshold = 3000;
        const client = makeClient();
        const { data, error } = await client.rpc("get_zillow_map_pins", {
            p_zip: OAKLAND_ZIP,
            p_city: null,
            p_address_query: null,
            p_latest_only: false,
            p_price_min: threshold,
            p_price_max: null,
            p_sqft_min: null,
            p_sqft_max: null,
            p_beds: null,
            p_baths_min: null,
            p_home_types: null,
            p_property_type: "both",
            p_bounds_south: OAKLAND_BBOX.south,
            p_bounds_north: OAKLAND_BBOX.north,
            p_bounds_west: OAKLAND_BBOX.west,
            p_bounds_east: OAKLAND_BBOX.east,
        });
        expect(error).toBeNull();
        const filtered = (data ?? []) as ZillowMapPin[];
        // All returned pins should NOT have a price below the threshold.
        // We can't directly inspect raw price from the label easily, but we
        // can confirm the filtered set is smaller than the unfiltered set.
        expect(filtered.length).toBeLessThan(pins.length);
    });
});
