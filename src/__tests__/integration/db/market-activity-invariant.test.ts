/**
 * DB integration test: inventory invariant for market activity RPCs.
 *
 * The "inventory" in this app means the count of active rental listings per week
 * (accumulated_listings), derived from scraped Zillow data in cleaned_listings.
 * Three metrics are returned per (week, bed_type):
 *   - new_listings:          listings entering the active set that week
 *   - accumulated_listings:  total active listings that week
 *   - closed_listings:       listings leaving the active set
 *
 * Invariants tested:
 *
 * [All functions]
 *   1. All metric values are non-negative.
 *   2. new_listings <= accumulated_listings  (new arrivals can't exceed total stock)
 *   3. closed_listings <= accumulated_listings  (departures can't exceed total stock)
 *   4. The first week for each bed type: new_listings == accumulated_listings
 *      (every active listing on the very first week is "new")
 *
 * [Scrape-based ZIP function only — get_market_activity]
 *   5. Stock-flow identity for exact 7-day intervals:
 *        accumulated[T] = accumulated[T-1] + new[T] - closed[T]
 *      (holds exactly when scrape weeks are 7 days apart; irregular gaps are skipped)
 *   6. The last week per bed type: closed_listings == 0
 *      (no closures attributed to the final scrape week, by construction)
 *
 * Requires SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and
 * SUPABASE_SERVICE_ROLE_KEY in the environment.
 */
import { createClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it } from "vitest";

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

function daysBetween(a: string, b: string): number {
    return Math.round((new Date(b).getTime() - new Date(a).getTime()) / (1000 * 60 * 60 * 24));
}

function assertCommonInvariants(rows: ActivityRow[], byBeds: Map<number, ActivityRow[]>, label: string) {
    // Invariant 1: non-negative
    for (const row of rows) {
        expect(toNum(row.new_listings)).toBeGreaterThanOrEqual(0);
        expect(toNum(row.accumulated_listings)).toBeGreaterThanOrEqual(0);
        expect(toNum(row.closed_listings)).toBeGreaterThanOrEqual(0);
    }

    // Invariant 2: new <= accumulated
    for (const row of rows) {
        expect(toNum(row.new_listings)).toBeLessThanOrEqual(toNum(row.accumulated_listings));
    }

    // Invariant 3: closed <= accumulated
    for (const row of rows) {
        expect(toNum(row.closed_listings)).toBeLessThanOrEqual(toNum(row.accumulated_listings));
    }

    // Invariant 4: first week new == accumulated
    for (const [beds, group] of byBeds) {
        const first = group[0];
        expect(toNum(first.new_listings)).toBe(toNum(first.accumulated_listings));
    }
}

function makeClient() {
    const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
        throw new Error("Missing SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
    }
    return createClient(url, key);
}

// ── get_market_activity (ZIP / scrape-based) ──────────────────────────────────
// Uses a specific zip for fast response time. This function uses fixed 7-day
// offsets so the stock-flow identity holds exactly for consecutive 7-day gaps.

describe("get_market_activity (scrape-based, ZIP=94061) – inventory invariant", () => {
    let rows: ActivityRow[] = [];
    let byBeds: Map<number, ActivityRow[]>;

    beforeAll(async () => {
        const client = makeClient();
        const { data, error } = await client.rpc("get_market_activity", {
            p_zip: "94061",
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

    it("satisfies common invariants (non-negative, new<=acc, closed<=acc, first week new==acc)", () => {
        assertCommonInvariants(rows, byBeds, "get_market_activity");
    });

    it("last week per bed type: closed_listings is zero", () => {
        for (const [beds, group] of byBeds) {
            const last = group[group.length - 1];
            expect(toNum(last.closed_listings)).toBe(0);
        }
    });

    it("stock-flow identity holds for consecutive 7-day intervals: accumulated[t] = accumulated[t-1] + new[t] - closed[t]", () => {
        let checkedPairs = 0;
        for (const [beds, group] of byBeds) {
            for (let i = 1; i < group.length; i++) {
                const prev = group[i - 1];
                const cur = group[i];
                if (daysBetween(prev.week_start, cur.week_start) !== 7) continue;

                const expected = toNum(prev.accumulated_listings) + toNum(cur.new_listings) - toNum(cur.closed_listings);
                expect(toNum(cur.accumulated_listings)).toBe(expected);
                checkedPairs++;
            }
        }
        expect(checkedPairs).toBeGreaterThan(0);
    });
});

// ── get_market_activity_by_city (lifecycle-based) ────────────────────────────
// This variant uses first_seen / last_seen lifecycle inference rather than
// raw scrape presence. It satisfies the common invariants but not the same
// stock-flow identity as the scrape-based function.

describe("get_market_activity_by_city (lifecycle-based, Redwood City CA) – inventory invariant", () => {
    const TEST_CITY = "Redwood City";
    const TEST_STATE = "CA";

    let rows: ActivityRow[] = [];
    let byBeds: Map<number, ActivityRow[]>;

    beforeAll(async () => {
        const client = makeClient();
        const { data, error } = await client.rpc("get_market_activity_by_city", {
            p_city: TEST_CITY,
            p_state: TEST_STATE,
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

    it("satisfies common invariants (non-negative, new<=acc, closed<=acc, first week new==acc)", () => {
        assertCommonInvariants(rows, byBeds, "get_market_activity_by_city");
    });

    it("accumulated_listings is always positive when any listings exist", () => {
        for (const row of rows) {
            if (toNum(row.new_listings) > 0 || toNum(row.accumulated_listings) > 0) {
                expect(toNum(row.accumulated_listings)).toBeGreaterThan(0);
            }
        }
    });
});
