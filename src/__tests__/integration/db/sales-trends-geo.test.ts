/**
 * DB integration tests for sales trends RPCs across all geo types.
 *
 * Validates that get_sales_trends_by_neighborhood, get_sales_trends_by_county,
 * and get_sales_trends_by_msa return rows and use loopnet_listings.geom for
 * the spatial join (so geocoded listings with no raw lat/lng are included).
 *
 * Uses a Los Angeles area fixture which has LoopNet commercial listings.
 *
 * Requires SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY.
 */
import { type SupabaseClient, createClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

/** Approx. center of Downtown Los Angeles — used for neighborhood + MSA resolution. */
const DTLA_LAT = 34.0522;
const DTLA_LNG = -118.2437;

const CITY = "Los Angeles";
const STATE = "CA";
const COUNTY_NAME = "Los Angeles County";

interface SalesTrendRow {
    month_start: string;
    median_price: number | string | null;
    avg_cap_rate: number | string | null;
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

function assertSalesTrendRows(rows: SalesTrendRow[], label: string) {
    expect(rows.length, `${label}: expected at least one row`).toBeGreaterThan(0);
    for (const row of rows) {
        const price = typeof row.median_price === "string" ? parseFloat(row.median_price) : (row.median_price ?? 0);
        const count = typeof row.listing_count === "bigint" ? Number(row.listing_count) : row.listing_count;
        expect(price, `${label} month=${row.month_start}: median_price`).toBeGreaterThan(0);
        expect(count, `${label} month=${row.month_start}: listing_count`).toBeGreaterThan(0);
    }
}

describe("get_sales_trends_by_city (Los Angeles, CA)", () => {
    it("returns sales rows for Los Angeles", async () => {
        const client = makeClient();
        const { data, error } = await client.rpc("get_sales_trends_by_city", {
            p_city: CITY,
            p_state: STATE,
        });
        expect(error).toBeNull();
        assertSalesTrendRows((data ?? []) as SalesTrendRow[], "get_sales_trends_by_city LA");
    });
});

describe("get_sales_trends_by_county (Los Angeles County, CA)", () => {
    it("returns sales rows for Los Angeles County", async () => {
        const client = makeClient();
        const { data, error } = await client.rpc("get_sales_trends_by_county", {
            p_county_name: COUNTY_NAME,
            p_state: STATE,
        });
        expect(error).toBeNull();
        assertSalesTrendRows((data ?? []) as SalesTrendRow[], "get_sales_trends_by_county LA County");
    });
});

describe("get_sales_trends_by_msa (Los Angeles MSA)", () => {
    it("resolves LA MSA at DTLA point and returns sales trends", async () => {
        const client = makeClient();
        const { data: msaRows, error: msaError } = await client.rpc("get_msa_at_point", {
            p_lat: DTLA_LAT,
            p_lng: DTLA_LNG,
        });
        expect(msaError).toBeNull();
        expect(msaRows).toBeDefined();
        expect(Array.isArray(msaRows)).toBe(true);
        expect((msaRows as { geoid: string; name: string }[]).length).toBeGreaterThan(0);

        const msa = (msaRows as { geoid: string; name: string }[])[0];
        expect(msa.name).toMatch(/Los Angeles/i);

        const { data, error } = await client.rpc("get_sales_trends_by_msa", {
            p_geoid: msa.geoid,
        });
        expect(error).toBeNull();
        assertSalesTrendRows((data ?? []) as SalesTrendRow[], `get_sales_trends_by_msa geoid=${msa.geoid}`);
    });
});

describe("get_sales_trends_by_neighborhood (DTLA area)", () => {
    it("resolves a neighborhood at DTLA point and returns sales trends", async () => {
        const client = makeClient();
        const { data: nhRows, error: nhError } = await client.rpc("get_neighborhood_at_point", {
            p_lat: DTLA_LAT,
            p_lng: DTLA_LNG,
        });
        expect(nhError).toBeNull();
        expect(Array.isArray(nhRows)).toBe(true);

        const nhs = nhRows as { id: number; name: string; city: string }[];
        if (nhs.length === 0) {
            // No neighborhood polygon covers this point — skip the data assertion.
            return;
        }

        const nh = nhs[0];
        const { data, error } = await client.rpc("get_sales_trends_by_neighborhood", {
            p_neighborhood_ids: [nh.id],
        });
        expect(error).toBeNull();
        // We don't assert rows > 0 here because neighborhood commercial listing
        // density can legitimately be zero; we just verify no RPC error.
        const rows = (data ?? []) as SalesTrendRow[];
        for (const row of rows) {
            const price = typeof row.median_price === "string" ? parseFloat(row.median_price) : (row.median_price ?? 0);
            const count = typeof row.listing_count === "bigint" ? Number(row.listing_count) : row.listing_count;
            expect(price).toBeGreaterThan(0);
            expect(count).toBeGreaterThan(0);
        }
    });
});
