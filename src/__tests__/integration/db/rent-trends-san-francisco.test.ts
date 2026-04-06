/**
 * DB integration tests for rent trends RPCs (San Francisco / Bay Area fixtures).
 *
 * Covers the same area stack the trends UI uses:
 *   ZIP 94110, Mission neighborhood, San Francisco city, San Francisco County,
 *   and the MSA containing a point in Mission (San Francisco Bay Area).
 *
 * Requires SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and
 * SUPABASE_SERVICE_ROLE_KEY.
 */
import { type SupabaseClient, createClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

/** Approx. center of Mission, San Francisco (94110) — used for neighborhood + MSA resolution. */
const MISSION_LAT = 37.7599;
const MISSION_LNG = -122.4184;

const ZIP_94110 = "94110";
const CITY = "San Francisco";
const STATE = "CA";
/** County label as stored in `county_boundaries.name_lsad` / Mapbox district context */
const COUNTY_NAME = "San Francisco County";

interface TrendRow {
    week_start: string;
    beds: number;
    median_rent: number | string;
    listing_count: bigint | number;
}

function makeClient(): SupabaseClient {
    const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
        throw new Error("Missing SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY");
    }
    return createClient(url, key);
}

const rpcArgs = {
    p_beds: null as number | null,
    p_reits_only: false,
    p_home_type: null as string | null,
};

function assertRentTrendRows(rows: TrendRow[], label: string) {
    expect(rows.length, `${label}: expected at least one row`).toBeGreaterThan(0);
    for (const row of rows) {
        const rent = typeof row.median_rent === "string" ? parseFloat(row.median_rent) : row.median_rent;
        const count = typeof row.listing_count === "bigint" ? Number(row.listing_count) : row.listing_count;
        expect(rent, `${label} week=${row.week_start} beds=${row.beds}`).toBeGreaterThan(500);
        expect(rent, `${label} week=${row.week_start} beds=${row.beds}`).toBeLessThan(30_000);
        expect(count, `${label} week=${row.week_start} beds=${row.beds}`).toBeGreaterThan(0);
    }
}

describe("get_rent_trends (ZIP 94110)", () => {
    it("returns median rent rows for zip 94110", async () => {
        const client = makeClient();
        const { data, error } = await client.rpc("get_rent_trends", {
            p_zip: ZIP_94110,
            ...rpcArgs,
        });
        expect(error).toBeNull();
        assertRentTrendRows((data ?? []) as TrendRow[], "get_rent_trends 94110");
    });
});

describe("get_rent_trends_by_neighborhood (Mission, San Francisco)", () => {
    it("resolves Mission at a 94110 point and returns rent trends", async () => {
        const client = makeClient();
        const { data: nhRows, error: nhError } = await client.rpc("get_neighborhood_at_point", {
            p_lat: MISSION_LAT,
            p_lng: MISSION_LNG,
        });
        expect(nhError).toBeNull();
        expect(nhRows).toBeDefined();
        expect(Array.isArray(nhRows)).toBe(true);
        expect((nhRows as { id: number; name: string; city: string }[]).length).toBeGreaterThan(0);

        const nh = (nhRows as { id: number; name: string; city: string }[])[0];
        expect(nh.name).toMatch(/Mission/i);
        expect(nh.city).toMatch(/San Francisco/i);

        const { data, error } = await client.rpc("get_rent_trends_by_neighborhood", {
            p_neighborhood_ids: [nh.id],
            ...rpcArgs,
        });
        expect(error).toBeNull();
        assertRentTrendRows((data ?? []) as TrendRow[], "get_rent_trends_by_neighborhood Mission");
    });
});

describe("get_rent_trends_by_city (San Francisco, CA)", () => {
    it("returns rows for San Francisco", async () => {
        const client = makeClient();
        const { data, error } = await client.rpc("get_rent_trends_by_city", {
            p_city: CITY,
            p_state: STATE,
            ...rpcArgs,
        });
        expect(error).toBeNull();
        assertRentTrendRows((data ?? []) as TrendRow[], "get_rent_trends_by_city SF");
    });
});

describe("get_rent_trends_by_county (San Francisco County, CA)", () => {
    it("returns rows for San Francisco County", async () => {
        const client = makeClient();
        const { data, error } = await client.rpc("get_rent_trends_by_county", {
            p_county_name: COUNTY_NAME,
            p_state: STATE,
            ...rpcArgs,
        });
        expect(error).toBeNull();
        assertRentTrendRows((data ?? []) as TrendRow[], "get_rent_trends_by_county SF County");
    });
});

describe("get_rent_trends_by_msa (San Francisco Bay Area)", () => {
    it("resolves Bay Area MSA at Mission point and returns rent trends", async () => {
        const client = makeClient();
        const { data: msaRows, error: msaError } = await client.rpc("get_msa_at_point", {
            p_lat: MISSION_LAT,
            p_lng: MISSION_LNG,
        });
        expect(msaError).toBeNull();
        expect(msaRows).toBeDefined();
        expect(Array.isArray(msaRows)).toBe(true);
        expect((msaRows as { geoid: string; name: string }[]).length).toBeGreaterThan(0);

        const msa = (msaRows as { geoid: string; name: string }[])[0];
        expect(msa.name).toMatch(/San Francisco/i);

        const { data, error } = await client.rpc("get_rent_trends_by_msa", {
            p_geoid: msa.geoid,
            ...rpcArgs,
        });
        expect(error).toBeNull();
        assertRentTrendRows((data ?? []) as TrendRow[], `get_rent_trends_by_msa geoid=${msa.geoid}`);
    });
});
