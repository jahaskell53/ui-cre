/**
 * DB integration test for get_comps RPC.
 *
 * Runs against the real Supabase project using the service role key.
 * Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the environment.
 *
 * Subject property: 301 Oak Ave, Redwood City, CA 94061
 *   coords: lng=-122.2261, lat=37.47504
 *   2 bedrooms, 2 bathrooms, 1200 sq ft
 */
import { createClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

const SUBJECT_LNG = -122.2261;
const SUBJECT_LAT = 37.47504;
const SUBJECT_BEDS = 2;
const SUBJECT_BATHS = 2;
const SUBJECT_AREA = 1200;
const RADIUS_M = 2 * 1609.34; // 2 miles in meters
/** Wall-clock upper bound for neighborhood-mode get_comps (RPC + network); catches regressions toward statement timeout. */
const NEIGHBORHOOD_COMPS_MAX_MS = 20_000;

describe("get_comps DB integration", () => {
    it("returns more than 20 comps for 301 Oak Ave, Redwood City (2bd/2ba/1200sqft)", async () => {
        const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
        const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

        if (!supabaseUrl || !serviceRoleKey) {
            throw new Error("Missing required environment variables: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
        }

        const client = createClient(supabaseUrl, serviceRoleKey);

        const { data, error } = await client.rpc("get_comps", {
            subject_lng: SUBJECT_LNG,
            subject_lat: SUBJECT_LAT,
            radius_m: RADIUS_M,
            subject_beds: SUBJECT_BEDS,
            subject_baths: SUBJECT_BATHS,
            subject_area: SUBJECT_AREA,
            p_segment: "both",
            p_limit: 500,
            p_neighborhood_ids: null,
            p_neighborhood_id: null,
            p_subject_zip: null,
            p_home_type: null,
        });

        expect(error).toBeNull();
        expect(Array.isArray(data)).toBe(true);
        expect(data.length).toBeGreaterThan(20);
    });

    it("neighborhood mode: Central, Redwood City for 301 Oak Ave completes without timeout (2bd/2ba)", async () => {
        const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
        const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

        if (!supabaseUrl || !serviceRoleKey) {
            throw new Error("Missing required environment variables: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
        }

        const client = createClient(supabaseUrl, serviceRoleKey);

        const { data: nhRows, error: nhError } = await client.rpc("get_neighborhood_at_point", {
            p_lat: SUBJECT_LAT,
            p_lng: SUBJECT_LNG,
        });

        expect(nhError).toBeNull();
        expect(nhRows).toBeDefined();
        expect(Array.isArray(nhRows)).toBe(true);
        expect(nhRows!.length).toBeGreaterThan(0);

        const nh = nhRows![0] as { id: number; name: string; city: string };
        expect(nh.city).toMatch(/Redwood City/i);
        expect(nh.name).toMatch(/Central/i);

        const compsStarted = performance.now();
        const { data, error } = await client.rpc("get_comps", {
            subject_lng: SUBJECT_LNG,
            subject_lat: SUBJECT_LAT,
            radius_m: RADIUS_M,
            subject_beds: SUBJECT_BEDS,
            subject_baths: SUBJECT_BATHS,
            subject_area: SUBJECT_AREA,
            p_segment: "both",
            p_limit: 500,
            p_neighborhood_ids: [nh.id],
            p_neighborhood_id: null,
            p_subject_zip: null,
            p_home_type: null,
        });
        const compsElapsedMs = performance.now() - compsStarted;

        expect(compsElapsedMs).toBeLessThan(NEIGHBORHOOD_COMPS_MAX_MS);
        expect(error).toBeNull();
        expect(Array.isArray(data)).toBe(true);
        expect(data!.length).toBeGreaterThan(0);
    });
});
