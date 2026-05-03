/**
 * DB integration tests for sales trends RPCs across all geo types.
 *
 * Covers both the LoopNet-based get_sales_trends_by_* family and the
 * Crexi-based get_crexi_sales_trends_by_* family.
 *
 * Uses a San Francisco / Bay Area fixture — city + county RPCs are exercised
 * against production-shaped data (LoopNet + Crexi).
 *
 * Requires SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY.
 */
import { type SupabaseClient, createClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

/** Approx. center of downtown San Francisco — used for neighborhood + MSA resolution. */
const SF_LAT = 37.7749;
const SF_LNG = -122.4194;

const CITY = "San Francisco";
const STATE = "CA";
/** Stored in county_boundaries.name_lsad (with "County" suffix, matching Mapbox output) */
const COUNTY_NAME = "San Francisco County";

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

describe("get_sales_trends_by_city (San Francisco, CA)", () => {
    it("returns sales rows for San Francisco", async () => {
        const client = makeClient();
        const { data, error } = await client.rpc("get_sales_trends_by_city", {
            p_city: CITY,
            p_state: STATE,
        });
        expect(error).toBeNull();
        assertSalesTrendRows((data ?? []) as SalesTrendRow[], "get_sales_trends_by_city San Francisco");
    });
});

describe("get_sales_trends_by_county (San Francisco County, CA)", () => {
    it("returns sales rows for San Francisco County", async () => {
        const client = makeClient();
        const { data, error } = await client.rpc("get_sales_trends_by_county", {
            p_county_name: COUNTY_NAME,
            p_state: STATE,
        });
        expect(error).toBeNull();
        assertSalesTrendRows((data ?? []) as SalesTrendRow[], "get_sales_trends_by_county San Francisco County");
    });
});

describe("get_sales_trends_by_msa (SF Bay Area MSA)", () => {
    it("resolves SF Bay Area MSA at San Francisco point and returns sales trends", async () => {
        const client = makeClient();
        const { data: msaRows, error: msaError } = await client.rpc("get_msa_at_point", {
            p_lat: SF_LAT,
            p_lng: SF_LNG,
        });
        expect(msaError).toBeNull();
        expect(msaRows).toBeDefined();
        expect(Array.isArray(msaRows)).toBe(true);
        expect((msaRows as { geoid: string; name: string }[]).length).toBeGreaterThan(0);

        const msa = (msaRows as { geoid: string; name: string }[])[0];
        expect(msa.name).toMatch(/San Francisco|Oakland/i);

        const { data, error } = await client.rpc("get_sales_trends_by_msa", {
            p_geoid: msa.geoid,
        });
        expect(error).toBeNull();
        assertSalesTrendRows((data ?? []) as SalesTrendRow[], `get_sales_trends_by_msa geoid=${msa.geoid}`);
    });
});

describe("get_sales_trends_by_neighborhood (San Francisco area)", () => {
    it("resolves a neighborhood at San Francisco point and returns sales trends", async () => {
        const client = makeClient();
        const { data: nhRows, error: nhError } = await client.rpc("get_neighborhood_at_point", {
            p_lat: SF_LAT,
            p_lng: SF_LNG,
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

// ── Crexi sales trends RPCs ──────────────────────────────────────────────────

describe("get_crexi_sales_trends_by_city (San Francisco, CA)", () => {
    it("returns no RPC error for San Francisco", async () => {
        const client = makeClient();
        const { data, error } = await client.rpc("get_crexi_sales_trends_by_city", {
            p_city: CITY,
            p_state: STATE,
        });
        expect(error).toBeNull();
        // Crexi data may be sparse for any given city; just verify shape.
        const rows = (data ?? []) as SalesTrendRow[];
        for (const row of rows) {
            const price = typeof row.median_price === "string" ? parseFloat(row.median_price) : (row.median_price ?? 0);
            const count = typeof row.listing_count === "bigint" ? Number(row.listing_count) : row.listing_count;
            expect(price).toBeGreaterThan(0);
            expect(count).toBeGreaterThan(0);
        }
    });
});

describe("get_crexi_sales_trends_by_county (San Francisco County, CA)", () => {
    it("returns no RPC error for San Francisco County", async () => {
        const client = makeClient();
        const { data, error } = await client.rpc("get_crexi_sales_trends_by_county", {
            p_county_name: COUNTY_NAME,
            p_state: STATE,
        });
        expect(error).toBeNull();
        const rows = (data ?? []) as SalesTrendRow[];
        for (const row of rows) {
            const price = typeof row.median_price === "string" ? parseFloat(row.median_price) : (row.median_price ?? 0);
            const count = typeof row.listing_count === "bigint" ? Number(row.listing_count) : row.listing_count;
            expect(price).toBeGreaterThan(0);
            expect(count).toBeGreaterThan(0);
        }
    });
});

describe("get_crexi_sales_trends_by_msa (SF Bay Area MSA)", () => {
    it("resolves SF Bay Area MSA and returns no RPC error", async () => {
        const client = makeClient();
        const { data: msaRows, error: msaError } = await client.rpc("get_msa_at_point", {
            p_lat: SF_LAT,
            p_lng: SF_LNG,
        });
        expect(msaError).toBeNull();
        expect(Array.isArray(msaRows)).toBe(true);
        expect((msaRows as { geoid: string; name: string }[]).length).toBeGreaterThan(0);

        const msa = (msaRows as { geoid: string; name: string }[])[0];
        const { data, error } = await client.rpc("get_crexi_sales_trends_by_msa", {
            p_geoid: msa.geoid,
        });
        expect(error).toBeNull();
        const rows = (data ?? []) as SalesTrendRow[];
        for (const row of rows) {
            const price = typeof row.median_price === "string" ? parseFloat(row.median_price) : (row.median_price ?? 0);
            const count = typeof row.listing_count === "bigint" ? Number(row.listing_count) : row.listing_count;
            expect(price).toBeGreaterThan(0);
            expect(count).toBeGreaterThan(0);
        }
    });
});

describe("get_crexi_sales_trends_by_neighborhood (San Francisco area)", () => {
    it("resolves a neighborhood at San Francisco point and returns no RPC error", async () => {
        const client = makeClient();
        const { data: nhRows, error: nhError } = await client.rpc("get_neighborhood_at_point", {
            p_lat: SF_LAT,
            p_lng: SF_LNG,
        });
        expect(nhError).toBeNull();
        expect(Array.isArray(nhRows)).toBe(true);

        const nhs = nhRows as { id: number; name: string; city: string }[];
        if (nhs.length === 0) {
            return;
        }

        const nh = nhs[0];
        const { data, error } = await client.rpc("get_crexi_sales_trends_by_neighborhood", {
            p_neighborhood_ids: [nh.id],
        });
        expect(error).toBeNull();
        const rows = (data ?? []) as SalesTrendRow[];
        for (const row of rows) {
            const price = typeof row.median_price === "string" ? parseFloat(row.median_price) : (row.median_price ?? 0);
            const count = typeof row.listing_count === "bigint" ? Number(row.listing_count) : row.listing_count;
            expect(price).toBeGreaterThan(0);
            expect(count).toBeGreaterThan(0);
        }
    });
});
