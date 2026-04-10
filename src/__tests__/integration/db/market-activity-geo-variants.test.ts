/**
 * DB integration tests for geography-based market activity UDFs not covered elsewhere:
 *   - get_market_activity_by_neighborhood
 *   - get_market_activity_by_county
 *   - get_market_activity_by_msa
 *
 * Applies the same inventory invariants as market-activity-invariant.test.ts:
 *   1. All metric values are non-negative.
 *   2. new_listings <= accumulated_listings
 *   3. closed_listings <= accumulated_listings
 *   4. First week per bed type: new_listings == accumulated_listings
 *
 * Fixtures
 * ────────
 * Neighborhood: Mission, San Francisco (resolved via get_neighborhood_at_point)
 * County:       San Francisco County, CA
 * MSA:          San Francisco Bay Area (resolved via get_msa_at_point)
 *
 * Requires SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY.
 */
import { type SupabaseClient, createClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it } from "vitest";

const MISSION_LAT = 37.7599;
const MISSION_LNG = -122.4184;
const SF_COUNTY = "San Francisco County";
const SF_STATE = "CA";

function makeClient(): SupabaseClient {
    const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error("Missing SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
    return createClient(url, key);
}

interface ActivityRow {
    week_start: string;
    beds: number;
    new_listings: bigint | number;
    accumulated_listings: bigint | number;
    closed_listings: bigint | number;
}

function toNum(v: bigint | number): number {
    return typeof v === "bigint" ? Number(v) : v;
}

function groupByBeds(rows: ActivityRow[]): Map<number, ActivityRow[]> {
    const map = new Map<number, ActivityRow[]>();
    for (const row of rows) {
        if (!map.has(row.beds)) map.set(row.beds, []);
        map.get(row.beds)!.push(row);
    }
    for (const group of map.values()) {
        group.sort((a, b) => a.week_start.localeCompare(b.week_start));
    }
    return map;
}

function assertCommonInvariants(rows: ActivityRow[], byBeds: Map<number, ActivityRow[]>, label: string) {
    for (const row of rows) {
        expect(toNum(row.new_listings), `${label} new_listings >= 0`).toBeGreaterThanOrEqual(0);
        expect(toNum(row.accumulated_listings), `${label} accumulated_listings >= 0`).toBeGreaterThanOrEqual(0);
        expect(toNum(row.closed_listings), `${label} closed_listings >= 0`).toBeGreaterThanOrEqual(0);
    }

    for (const row of rows) {
        expect(toNum(row.new_listings), `${label} new <= accumulated`).toBeLessThanOrEqual(toNum(row.accumulated_listings));
    }

    for (const row of rows) {
        expect(toNum(row.closed_listings), `${label} closed <= accumulated`).toBeLessThanOrEqual(toNum(row.accumulated_listings));
    }

    for (const [, group] of byBeds) {
        const first = group[0];
        expect(toNum(first.new_listings), `${label} first week new == accumulated`).toBe(toNum(first.accumulated_listings));
    }
}

// ── Resolve fixture IDs once ──────────────────────────────────────────────────

let missionNeighborhoodId: number;
let sfBayAreaGeoid: string;

beforeAll(async () => {
    const client = makeClient();

    const { data: nhRows, error: nhErr } = await client.rpc("get_neighborhood_at_point", {
        p_lat: MISSION_LAT,
        p_lng: MISSION_LNG,
    });
    if (nhErr) throw new Error(`get_neighborhood_at_point failed: ${nhErr.message}`);
    const nhArr = nhRows as { id: number; name: string }[];
    expect(nhArr.length).toBeGreaterThan(0);
    missionNeighborhoodId = nhArr[0].id;

    const { data: msaRows, error: msaErr } = await client.rpc("get_msa_at_point", {
        p_lat: MISSION_LAT,
        p_lng: MISSION_LNG,
    });
    if (msaErr) throw new Error(`get_msa_at_point failed: ${msaErr.message}`);
    const msaArr = msaRows as { geoid: string }[];
    expect(msaArr.length).toBeGreaterThan(0);
    sfBayAreaGeoid = msaArr[0].geoid;
});

// ── get_market_activity_by_neighborhood ──────────────────────────────────────

describe("get_market_activity_by_neighborhood (Mission, San Francisco) – inventory invariant", () => {
    let rows: ActivityRow[] = [];
    let byBeds: Map<number, ActivityRow[]>;

    beforeAll(async () => {
        const client = makeClient();
        const { data, error } = await client.rpc("get_market_activity_by_neighborhood", {
            p_neighborhood_ids: [missionNeighborhoodId],
            p_reits_only: false,
            p_home_type: null,
        });
        if (error) throw new Error(`RPC error: ${error.message}`);
        rows = data as ActivityRow[];
        byBeds = groupByBeds(rows);
    });

    it("returns at least one row", () => {
        expect(rows.length).toBeGreaterThan(0);
    });

    it("satisfies inventory invariants (non-negative, new<=acc, closed<=acc, first week new==acc)", () => {
        assertCommonInvariants(rows, byBeds, "get_market_activity_by_neighborhood");
    });

    it("each row has week_start, beds, new_listings, accumulated_listings, closed_listings", () => {
        for (const row of rows) {
            expect(row.week_start).toBeTruthy();
            expect(typeof row.beds).toBe("number");
            expect(row.new_listings).toBeDefined();
            expect(row.accumulated_listings).toBeDefined();
            expect(row.closed_listings).toBeDefined();
        }
    });
});

// ── get_market_activity_by_county ─────────────────────────────────────────────

describe("get_market_activity_by_county (San Francisco County, CA) – inventory invariant", () => {
    let rows: ActivityRow[] = [];
    let byBeds: Map<number, ActivityRow[]>;

    beforeAll(async () => {
        const client = makeClient();
        const { data, error } = await client.rpc("get_market_activity_by_county", {
            p_county_name: SF_COUNTY,
            p_state: SF_STATE,
            p_reits_only: false,
            p_home_type: null,
        });
        if (error) throw new Error(`RPC error: ${error.message}`);
        rows = data as ActivityRow[];
        byBeds = groupByBeds(rows);
    });

    it("returns at least one row", () => {
        expect(rows.length).toBeGreaterThan(0);
    });

    it("satisfies inventory invariants (non-negative, new<=acc, closed<=acc, first week new==acc)", () => {
        assertCommonInvariants(rows, byBeds, "get_market_activity_by_county");
    });

    it("accumulated_listings is always positive when any listings exist", () => {
        for (const row of rows) {
            if (toNum(row.new_listings) > 0 || toNum(row.accumulated_listings) > 0) {
                expect(toNum(row.accumulated_listings)).toBeGreaterThan(0);
            }
        }
    });
});

// ── get_market_activity_by_msa ────────────────────────────────────────────────

describe("get_market_activity_by_msa (San Francisco Bay Area) – inventory invariant", () => {
    let rows: ActivityRow[] = [];
    let byBeds: Map<number, ActivityRow[]>;

    beforeAll(async () => {
        const client = makeClient();
        const { data, error } = await client.rpc("get_market_activity_by_msa", {
            p_geoid: sfBayAreaGeoid,
            p_reits_only: false,
            p_home_type: null,
        });
        if (error) throw new Error(`RPC error: ${error.message}`);
        rows = data as ActivityRow[];
        byBeds = groupByBeds(rows);
    });

    it("returns at least one row", () => {
        expect(rows.length).toBeGreaterThan(0);
    });

    it("satisfies inventory invariants (non-negative, new<=acc, closed<=acc, first week new==acc)", () => {
        assertCommonInvariants(rows, byBeds, "get_market_activity_by_msa");
    });

    it("accumulated_listings is always positive when any listings exist", () => {
        for (const row of rows) {
            if (toNum(row.new_listings) > 0 || toNum(row.accumulated_listings) > 0) {
                expect(toNum(row.accumulated_listings)).toBeGreaterThan(0);
            }
        }
    });
});
