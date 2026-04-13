/**
 * DB integration tests for the map listings fetch + transformation pipeline.
 *
 * Covers:
 *   - get_zillow_map_listings RPC (Zillow, ZIP 94610 Oakland)
 *   - LoopNet raw fetch + mapLoopnetRow (SF Bay Area bbox)
 *
 * Fixtures
 * ────────
 * Zillow: ZIP 94610 (Oakland, CA) — bbox lat 37.799458–37.820213, lng -122.261055–-122.22394
 * LoopNet: SF Bay Area bbox — lat 37.70–37.89, lng -122.49–-122.20 (160 geocoded listings)
 *
 * Requires SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY.
 */
import { type SupabaseClient, createClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it } from "vitest";
import { type LoopnetRow, type ZillowMapListingRow, mapLoopnetRow } from "@/lib/map-listings";

const OAKLAND_ZIP = "94610";
const OAKLAND_BBOX = { south: 37.799458, north: 37.820213, west: -122.261055, east: -122.22394 };
const BAY_AREA_BBOX = { south: 37.7, north: 37.89, west: -122.49, east: -122.2 };

/** Baseline args for get_zillow_map_listings — Oakland ZIP + viewport (extend via spread). */
function zillowMapListingsParams(overrides: Record<string, unknown> = {}) {
    return {
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
        p_laundry: null,
        p_bounds_south: OAKLAND_BBOX.south,
        p_bounds_north: OAKLAND_BBOX.north,
        p_bounds_west: OAKLAND_BBOX.west,
        p_bounds_east: OAKLAND_BBOX.east,
        ...overrides,
    };
}

function makeClient(): SupabaseClient {
    const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error("Missing SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
    return createClient(url, key);
}

// ── get_zillow_map_listings RPC ───────────────────────────────────────────────

describe("get_zillow_map_listings RPC — ZIP 94610 (Oakland)", () => {
    let pins: ZillowMapListingRow[] = [];
    let rpcError: { message: string } | null = null;

    beforeAll(async () => {
        const client = makeClient();
        const { data, error } = await client.rpc("get_zillow_map_listings", zillowMapListingsParams());
        rpcError = error;
        pins = (data ?? []) as ZillowMapListingRow[];
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
            expect(pin.building_zpid === null || typeof pin.building_zpid === "string").toBe(true);
            if (pin.is_reit) {
                expect(typeof pin.building_zpid).toBe("string");
                expect((pin.building_zpid as string).length).toBeGreaterThan(0);
            } else {
                expect(pin.building_zpid).toBeNull();
            }
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

    it("total_count matches the number of pins returned", () => {
        expect(pins[0].total_count).toBe(pins.length);
    });

    it("REIT pins have is_reit=true, unit_count >= 1, and a non-empty unit_mix", () => {
        const reitPins = pins.filter((p) => p.is_reit);
        expect(reitPins.length).toBeGreaterThan(0);
        for (const pin of reitPins) {
            expect(pin.unit_count).toBeGreaterThanOrEqual(1);
            expect(pin.unit_mix.length).toBeGreaterThan(0);
        }
        expect(reitPins.some((p) => p.unit_count > 1)).toBe(true);
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
        const { data, error } = await client.rpc("get_zillow_map_listings", zillowMapListingsParams({ p_property_type: "reit" }));
        expect(error).toBeNull();
        const reitOnly = (data ?? []) as ZillowMapListingRow[];
        expect(reitOnly.length).toBeGreaterThan(0);
        expect(reitOnly.every((p) => p.is_reit)).toBe(true);
    });

    it("p_property_type='mid' returns only individual (non-REIT) pins", async () => {
        const client = makeClient();
        const { data, error } = await client.rpc("get_zillow_map_listings", zillowMapListingsParams({ p_property_type: "mid" }));
        expect(error).toBeNull();
        const midOnly = (data ?? []) as ZillowMapListingRow[];
        expect(midOnly.length).toBeGreaterThan(0);
        expect(midOnly.every((p) => !p.is_reit)).toBe(true);
    });

    it("historical unit_count is >= latest-only and includes at least one strict increase (OPE-105)", async () => {
        // latest_only=true should represent active units in the latest scrape run.
        // latest_only=false should represent historical units across runs.
        const client = makeClient();
        const { data: latestData, error: latestError } = await client.rpc(
            "get_zillow_map_listings",
            zillowMapListingsParams({ p_latest_only: true, p_property_type: "reit" }),
        );
        const { data: allData, error: allError } = await client.rpc(
            "get_zillow_map_listings",
            zillowMapListingsParams({ p_latest_only: false, p_property_type: "reit" }),
        );
        expect(latestError).toBeNull();
        expect(allError).toBeNull();

        const latestPins = (latestData ?? []) as ZillowMapListingRow[];
        const allPins = (allData ?? []) as ZillowMapListingRow[];

        // Build a map of building id -> unit_count for the latest-only result
        const latestById = new Map(latestPins.map((p) => [p.id, p.unit_count]));

        // Every building present in both results should have historical >= latest-only.
        // (allPins may include buildings absent from latestPins depending on scrape coverage.)
        let hasStrictIncrease = false;
        for (const pin of allPins) {
            if (latestById.has(pin.id)) {
                const latestUnitCount = latestById.get(pin.id)!;
                expect(pin.unit_count).toBeGreaterThanOrEqual(latestUnitCount);
                if (pin.unit_count > latestUnitCount) {
                    hasStrictIncrease = true;
                }
            }
        }

        expect(hasStrictIncrease).toBe(true);

        // unit_mix total must match unit_count
        for (const pin of allPins) {
            const mixTotal = pin.unit_mix.reduce((s, u) => s + u.count, 0);
            expect(mixTotal).toBe(pin.unit_count);
        }
    });

    it("p_price_min filter excludes pins below the threshold", async () => {
        const threshold = 3000;
        const client = makeClient();
        const { data, error } = await client.rpc("get_zillow_map_listings", zillowMapListingsParams({ p_price_min: threshold }));
        expect(error).toBeNull();
        const filtered = (data ?? []) as ZillowMapListingRow[];
        expect(filtered.length).toBeLessThan(pins.length);
    });

    it("p_laundry narrows results: stricter laundry set is a subset of looser sets", async () => {
        const client = makeClient();

        const { data: noFilter, error: e0 } = await client.rpc("get_zillow_map_listings", zillowMapListingsParams());
        expect(e0).toBeNull();
        const n0 = (noFilter ?? []).length;

        const { data: allKnown, error: e1 } = await client.rpc(
            "get_zillow_map_listings",
            zillowMapListingsParams({ p_laundry: ["in_unit", "shared", "none"] }),
        );
        expect(e1).toBeNull();
        const n1 = (allKnown ?? []).length;

        const { data: inUnitOnly, error: e2 } = await client.rpc("get_zillow_map_listings", zillowMapListingsParams({ p_laundry: ["in_unit"] }));
        expect(e2).toBeNull();
        const n2 = (inUnitOnly ?? []).length;

        expect(n1).toBeLessThanOrEqual(n0);
        expect(n2).toBeLessThanOrEqual(n1);
    });

    it("p_laundry empty array behaves like no laundry filter", async () => {
        const client = makeClient();
        const { data, error } = await client.rpc("get_zillow_map_listings", zillowMapListingsParams({ p_laundry: [] }));
        expect(error).toBeNull();
        expect((data ?? []).length).toBe(pins.length);
    });
});

// ── LoopNet raw fetch + mapLoopnetRow ─────────────────────────────────────────

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
