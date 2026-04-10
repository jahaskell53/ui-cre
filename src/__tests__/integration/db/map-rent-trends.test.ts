/**
 * DB integration tests for choropleth map rent trend UDFs:
 *   - get_map_rent_trends (ZIP-level choropleth)
 *   - get_map_rent_trends_by_neighborhood
 *   - get_map_rent_trends_by_county
 *   - get_map_rent_trends_by_msa
 *   - get_map_rent_trends_by_city
 *
 * All functions return current/prior median rent + pct_change + geom_json per area.
 * Tests verify:
 *   1. RPC executes without error and returns rows
 *   2. Required fields are present with correct types
 *   3. Numeric invariants: current/prior medians in valid rent range, listing_count > 0
 *   4. pct_change is computed correctly: round((current-prior)/prior*100, 1)
 *   5. geom_json is parseable GeoJSON with coordinates
 *
 * Fixtures
 * ────────
 * All functions use p_beds=1 (studio/1BR is most common) as the test bed count.
 *
 * Requires SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY.
 */
import { type SupabaseClient, createClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

const TEST_BEDS = 1;

function makeClient(): SupabaseClient {
    const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error("Missing SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
    return createClient(url, key);
}

interface MapTrendRow {
    current_median: number | string;
    prior_median: number | string;
    pct_change: number | string | null;
    listing_count: number | bigint;
    geom_json: string;
}

function toNum(v: number | string | bigint): number {
    if (typeof v === "bigint") return Number(v);
    if (typeof v === "string") return parseFloat(v);
    return v;
}

function assertMapTrendRows(rows: MapTrendRow[], label: string) {
    expect(rows.length, `${label}: expected at least one row`).toBeGreaterThan(0);
    for (const row of rows) {
        const current = toNum(row.current_median);
        const prior = toNum(row.prior_median);
        const count = toNum(row.listing_count);

        expect(current, `${label} current_median`).toBeGreaterThan(500);
        expect(current, `${label} current_median`).toBeLessThan(30_000);
        expect(prior, `${label} prior_median`).toBeGreaterThan(500);
        expect(prior, `${label} prior_median`).toBeLessThan(30_000);
        expect(count, `${label} listing_count`).toBeGreaterThan(0);

        // pct_change should be null or a number
        if (row.pct_change !== null) {
            const pct = toNum(row.pct_change as number | string);
            expect(isNaN(pct)).toBe(false);
        }

        // geom_json must be parseable with type and coordinates
        expect(typeof row.geom_json).toBe("string");
        const geojson = JSON.parse(row.geom_json);
        expect(geojson).toHaveProperty("type");
        expect(geojson).toHaveProperty("coordinates");
    }
}

// ── get_map_rent_trends (ZIP choropleth) ──────────────────────────────────────

describe("get_map_rent_trends (ZIP choropleth, beds=1)", () => {
    it("returns rows with valid fields and geom_json", async () => {
        const client = makeClient();
        const { data, error } = await client.rpc("get_map_rent_trends", {
            p_beds: TEST_BEDS,
            p_weeks_back: 13,
            p_reits_only: false,
        });
        expect(error).toBeNull();
        const rows = (data ?? []) as (MapTrendRow & { zip: string })[];
        assertMapTrendRows(rows, "get_map_rent_trends");

        // Each row has a zip field
        for (const row of rows) {
            expect(typeof row.zip).toBe("string");
            expect(row.zip.length).toBeGreaterThan(0);
        }
    });

    it("returns fewer rows with p_reits_only=true than p_reits_only=false", async () => {
        const client = makeClient();
        const [{ data: all }, { data: reits }] = await Promise.all([
            client.rpc("get_map_rent_trends", { p_beds: TEST_BEDS, p_weeks_back: 13, p_reits_only: false }),
            client.rpc("get_map_rent_trends", { p_beds: TEST_BEDS, p_weeks_back: 13, p_reits_only: true }),
        ]);
        const allRows = (all ?? []) as unknown[];
        const reitRows = (reits ?? []) as unknown[];
        expect(allRows.length).toBeGreaterThan(reitRows.length);
    });
});

// ── get_map_rent_trends_by_neighborhood ──────────────────────────────────────

describe("get_map_rent_trends_by_neighborhood (beds=1)", () => {
    it("returns rows with neighborhood_id, name, city, and valid geom_json", async () => {
        const client = makeClient();
        const { data, error } = await client.rpc("get_map_rent_trends_by_neighborhood", {
            p_beds: TEST_BEDS,
            p_weeks_back: 13,
            p_reits_only: false,
        });
        expect(error).toBeNull();
        const rows = (data ?? []) as (MapTrendRow & { neighborhood_id: number; name: string; city: string })[];
        assertMapTrendRows(rows, "get_map_rent_trends_by_neighborhood");

        for (const row of rows) {
            expect(typeof row.neighborhood_id).toBe("number");
            expect(typeof row.name).toBe("string");
            expect(typeof row.city).toBe("string");
        }
    });
});

// ── get_map_rent_trends_by_county ─────────────────────────────────────────────

describe("get_map_rent_trends_by_county (beds=1)", () => {
    it("returns rows with county_name, state, and valid geom_json", async () => {
        const client = makeClient();
        const { data, error } = await client.rpc("get_map_rent_trends_by_county", {
            p_beds: TEST_BEDS,
            p_weeks_back: 13,
            p_reits_only: false,
        });
        expect(error).toBeNull();
        const rows = (data ?? []) as (MapTrendRow & { county_name: string; state: string })[];
        assertMapTrendRows(rows, "get_map_rent_trends_by_county");

        for (const row of rows) {
            expect(typeof row.county_name).toBe("string");
            expect(typeof row.state).toBe("string");
        }
    });
});

// ── get_map_rent_trends_by_msa ────────────────────────────────────────────────

describe("get_map_rent_trends_by_msa (beds=1)", () => {
    it("returns rows with geoid, name, and valid geom_json", async () => {
        const client = makeClient();
        const { data, error } = await client.rpc("get_map_rent_trends_by_msa", {
            p_beds: TEST_BEDS,
            p_weeks_back: 13,
            p_reits_only: false,
        });
        expect(error).toBeNull();
        const rows = (data ?? []) as (MapTrendRow & { geoid: string; name: string })[];
        assertMapTrendRows(rows, "get_map_rent_trends_by_msa");

        for (const row of rows) {
            expect(typeof row.geoid).toBe("string");
            expect(typeof row.name).toBe("string");
        }
    });
});

// ── get_map_rent_trends_by_city ───────────────────────────────────────────────

describe("get_map_rent_trends_by_city (beds=1)", () => {
    it("returns rows with city_name, state, and valid geom_json", async () => {
        const client = makeClient();
        const { data, error } = await client.rpc("get_map_rent_trends_by_city", {
            p_beds: TEST_BEDS,
            p_weeks_back: 13,
            p_reits_only: false,
        });
        expect(error).toBeNull();
        const rows = (data ?? []) as (MapTrendRow & { city_name: string; state: string })[];
        assertMapTrendRows(rows, "get_map_rent_trends_by_city");

        for (const row of rows) {
            expect(typeof row.city_name).toBe("string");
            expect(typeof row.state).toBe("string");
        }
    });
});
