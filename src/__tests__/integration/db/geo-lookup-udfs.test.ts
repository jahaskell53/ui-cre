/**
 * DB integration tests for geo-lookup UDFs:
 *   - get_neighborhood_bbox
 *   - get_msa_bbox
 *   - search_neighborhoods
 *   - search_msas
 *   - get_neighborhood_geojson
 *   - get_county_geojson
 *   - get_msa_geojson
 *   - get_city_geojson
 *
 * Fixtures
 * ────────
 * Neighborhood: Mission, San Francisco (resolved via get_neighborhood_at_point)
 * MSA:          San Francisco Bay Area (resolved via get_msa_at_point)
 * County:       San Francisco County, CA
 * City:         San Francisco, CA
 *
 * Requires SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY.
 */
import { type SupabaseClient, createClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, it } from "vitest";

const MISSION_LAT = 37.7599;
const MISSION_LNG = -122.4184;

function makeClient(): SupabaseClient {
    const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error("Missing SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
    return createClient(url, key);
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
    const nhArr = nhRows as { id: number; name: string; city: string }[];
    expect(nhArr.length).toBeGreaterThan(0);
    missionNeighborhoodId = nhArr[0].id;

    const { data: msaRows, error: msaErr } = await client.rpc("get_msa_at_point", {
        p_lat: MISSION_LAT,
        p_lng: MISSION_LNG,
    });
    if (msaErr) throw new Error(`get_msa_at_point failed: ${msaErr.message}`);
    const msaArr = msaRows as { geoid: string; name: string }[];
    expect(msaArr.length).toBeGreaterThan(0);
    sfBayAreaGeoid = msaArr[0].geoid;
});

// ── get_neighborhood_bbox ─────────────────────────────────────────────────────

describe("get_neighborhood_bbox", () => {
    it("returns a valid bounding box for the Mission neighborhood", async () => {
        const client = makeClient();
        const { data, error } = await client.rpc("get_neighborhood_bbox", {
            p_neighborhood_id: missionNeighborhoodId,
        });
        expect(error).toBeNull();
        const rows = data as { west: number; south: number; east: number; north: number }[];
        expect(rows).toHaveLength(1);

        const bbox = rows[0];
        expect(typeof bbox.west).toBe("number");
        expect(typeof bbox.south).toBe("number");
        expect(typeof bbox.east).toBe("number");
        expect(typeof bbox.north).toBe("number");

        expect(bbox.west).toBeLessThan(bbox.east);
        expect(bbox.south).toBeLessThan(bbox.north);

        // Should be somewhere in the SF Bay Area
        expect(bbox.west).toBeGreaterThan(-123);
        expect(bbox.east).toBeLessThan(-122);
        expect(bbox.south).toBeGreaterThan(37);
        expect(bbox.north).toBeLessThan(38.5);
    });

    it("returns empty result for a non-existent neighborhood id", async () => {
        const client = makeClient();
        const { data, error } = await client.rpc("get_neighborhood_bbox", {
            p_neighborhood_id: -999999,
        });
        expect(error).toBeNull();
        const rows = data as unknown[];
        expect(rows).toHaveLength(0);
    });
});

// ── get_msa_bbox ──────────────────────────────────────────────────────────────

describe("get_msa_bbox", () => {
    it("returns a valid bounding box for the SF Bay Area MSA", async () => {
        const client = makeClient();
        const { data, error } = await client.rpc("get_msa_bbox", {
            p_geoid: sfBayAreaGeoid,
        });
        expect(error).toBeNull();
        const rows = data as { west: number; south: number; east: number; north: number }[];
        expect(rows).toHaveLength(1);

        const bbox = rows[0];
        expect(bbox.west).toBeLessThan(bbox.east);
        expect(bbox.south).toBeLessThan(bbox.north);

        // SF Bay Area is in Northern California
        expect(bbox.west).toBeGreaterThan(-125);
        expect(bbox.east).toBeLessThan(-121);
        expect(bbox.south).toBeGreaterThan(36);
        expect(bbox.north).toBeLessThan(39);
    });

    it("returns empty result for a non-existent geoid", async () => {
        const client = makeClient();
        const { data, error } = await client.rpc("get_msa_bbox", {
            p_geoid: "NONEXISTENT-GEOID-99999",
        });
        expect(error).toBeNull();
        const rows = data as unknown[];
        expect(rows).toHaveLength(0);
    });
});

// ── search_neighborhoods ──────────────────────────────────────────────────────

describe("search_neighborhoods", () => {
    it("returns neighborhoods matching 'Mission San Francisco'", async () => {
        const client = makeClient();
        const { data, error } = await client.rpc("search_neighborhoods", {
            p_query: "Mission San Francisco",
        });
        expect(error).toBeNull();
        const rows = data as { id: number; name: string; city: string; state: string }[];
        expect(rows.length).toBeGreaterThan(0);
        expect(rows.length).toBeLessThanOrEqual(8);

        const mission = rows.find((r) => /Mission/i.test(r.name) && /San Francisco/i.test(r.city));
        expect(mission).toBeDefined();
    });

    it("returns up to 8 results", async () => {
        const client = makeClient();
        const { data, error } = await client.rpc("search_neighborhoods", {
            p_query: "Park",
        });
        expect(error).toBeNull();
        const rows = data as unknown[];
        expect(rows.length).toBeLessThanOrEqual(8);
    });

    it("returns rows with id, name, city, state fields", async () => {
        const client = makeClient();
        const { data, error } = await client.rpc("search_neighborhoods", {
            p_query: "Mission",
        });
        expect(error).toBeNull();
        const rows = data as { id: number; name: string; city: string; state: string }[];
        expect(rows.length).toBeGreaterThan(0);
        for (const row of rows) {
            expect(typeof row.id).toBe("number");
            expect(typeof row.name).toBe("string");
            expect(typeof row.city).toBe("string");
            expect(typeof row.state).toBe("string");
        }
    });

    it("returns empty array for an unrecognizable query", async () => {
        const client = makeClient();
        const { data, error } = await client.rpc("search_neighborhoods", {
            p_query: "xyzzy-impossible-neighborhood-name-1234567890",
        });
        expect(error).toBeNull();
        const rows = data as unknown[];
        expect(rows).toHaveLength(0);
    });

    it("accepts optional p_lat and p_lng parameters without error", async () => {
        const client = makeClient();
        const { data, error } = await client.rpc("search_neighborhoods", {
            p_query: "Mission",
            p_lat: MISSION_LAT,
            p_lng: MISSION_LNG,
        });
        expect(error).toBeNull();
        const rows = data as { id: number; name: string; city: string; state: string }[];
        expect(rows.length).toBeGreaterThan(0);
        expect(rows.length).toBeLessThanOrEqual(8);
    });

    it("ranks the Mission neighborhood first when proximity matches SF coords", async () => {
        const client = makeClient();
        const { data, error } = await client.rpc("search_neighborhoods", {
            p_query: "Mission",
            p_lat: MISSION_LAT,
            p_lng: MISSION_LNG,
        });
        expect(error).toBeNull();
        const rows = data as { id: number; name: string; city: string; state: string }[];
        expect(rows.length).toBeGreaterThan(0);
        const first = rows[0];
        expect(/Mission/i.test(first.name)).toBe(true);
        expect(/San Francisco/i.test(first.city)).toBe(true);
    });
});

// ── search_msas ───────────────────────────────────────────────────────────────

describe("search_msas", () => {
    it("returns MSAs matching 'San Francisco'", async () => {
        const client = makeClient();
        const { data, error } = await client.rpc("search_msas", {
            p_query: "San Francisco",
        });
        expect(error).toBeNull();
        const rows = data as { id: number; name: string; name_lsad: string; geoid: string }[];
        expect(rows.length).toBeGreaterThan(0);
        expect(rows.length).toBeLessThanOrEqual(8);

        const sfMsa = rows.find((r) => /San Francisco/i.test(r.name));
        expect(sfMsa).toBeDefined();
        expect(sfMsa!.geoid).toBe(sfBayAreaGeoid);
    });

    it("returns up to 8 results", async () => {
        const client = makeClient();
        const { data, error } = await client.rpc("search_msas", {
            p_query: "New York",
        });
        expect(error).toBeNull();
        const rows = data as unknown[];
        expect(rows.length).toBeLessThanOrEqual(8);
    });

    it("returns rows with id, name, name_lsad, geoid fields", async () => {
        const client = makeClient();
        const { data, error } = await client.rpc("search_msas", {
            p_query: "Chicago",
        });
        expect(error).toBeNull();
        const rows = data as { id: number; name: string; name_lsad: string; geoid: string }[];
        expect(rows.length).toBeGreaterThan(0);
        for (const row of rows) {
            expect(typeof row.name).toBe("string");
            expect(typeof row.name_lsad).toBe("string");
            expect(typeof row.geoid).toBe("string");
        }
    });

    it("returns empty array for an unrecognizable query", async () => {
        const client = makeClient();
        const { data, error } = await client.rpc("search_msas", {
            p_query: "xyzzy-impossible-msa-name-1234567890",
        });
        expect(error).toBeNull();
        const rows = data as unknown[];
        expect(rows).toHaveLength(0);
    });

    it("accepts optional p_lat and p_lng parameters without error", async () => {
        const client = makeClient();
        const { data, error } = await client.rpc("search_msas", {
            p_query: "San Francisco",
            p_lat: MISSION_LAT,
            p_lng: MISSION_LNG,
        });
        expect(error).toBeNull();
        const rows = data as { id: number; name: string; name_lsad: string; geoid: string }[];
        expect(rows.length).toBeGreaterThan(0);
        expect(rows.length).toBeLessThanOrEqual(8);
    });

    it("ranks the SF Bay Area MSA first when proximity matches SF coords", async () => {
        const client = makeClient();
        const { data, error } = await client.rpc("search_msas", {
            p_query: "San Francisco",
            p_lat: MISSION_LAT,
            p_lng: MISSION_LNG,
        });
        expect(error).toBeNull();
        const rows = data as { id: number; name: string; name_lsad: string; geoid: string }[];
        expect(rows.length).toBeGreaterThan(0);
        expect(rows[0].geoid).toBe(sfBayAreaGeoid);
    });
});

// ── get_neighborhood_geojson ──────────────────────────────────────────────────

describe("get_neighborhood_geojson", () => {
    it("returns valid GeoJSON text for the Mission neighborhood", async () => {
        const client = makeClient();
        const { data, error } = await client.rpc("get_neighborhood_geojson", {
            p_id: missionNeighborhoodId,
        });
        expect(error).toBeNull();
        expect(typeof data).toBe("string");
        expect(data).not.toBeNull();

        const geojson = JSON.parse(data as string);
        expect(geojson).toHaveProperty("type");
        expect(geojson).toHaveProperty("coordinates");
        expect(["Polygon", "MultiPolygon"]).toContain(geojson.type);
    });

    it("returns null for a non-existent neighborhood id", async () => {
        const client = makeClient();
        const { data, error } = await client.rpc("get_neighborhood_geojson", {
            p_id: -999999,
        });
        expect(error).toBeNull();
        expect(data).toBeNull();
    });
});

// ── get_county_geojson ────────────────────────────────────────────────────────

describe("get_county_geojson", () => {
    it("returns valid GeoJSON text for San Francisco County, CA", async () => {
        const client = makeClient();
        const { data, error } = await client.rpc("get_county_geojson", {
            p_name: "San Francisco County",
            p_state: "CA",
        });
        expect(error).toBeNull();
        expect(typeof data).toBe("string");
        expect(data).not.toBeNull();

        const geojson = JSON.parse(data as string);
        expect(geojson).toHaveProperty("type");
        expect(geojson).toHaveProperty("coordinates");
        expect(["Polygon", "MultiPolygon"]).toContain(geojson.type);
    });

    it("returns null for a non-existent county", async () => {
        const client = makeClient();
        const { data, error } = await client.rpc("get_county_geojson", {
            p_name: "Nonexistent County XYZ",
            p_state: "CA",
        });
        expect(error).toBeNull();
        expect(data).toBeNull();
    });
});

// ── get_msa_geojson ───────────────────────────────────────────────────────────

describe("get_msa_geojson", () => {
    it("returns valid GeoJSON text for the SF Bay Area MSA", async () => {
        const client = makeClient();
        const { data, error } = await client.rpc("get_msa_geojson", {
            p_geoid: sfBayAreaGeoid,
        });
        expect(error).toBeNull();
        expect(typeof data).toBe("string");
        expect(data).not.toBeNull();

        const geojson = JSON.parse(data as string);
        expect(geojson).toHaveProperty("type");
        expect(geojson).toHaveProperty("coordinates");
        expect(["Polygon", "MultiPolygon"]).toContain(geojson.type);
    });

    it("returns null for a non-existent MSA geoid", async () => {
        const client = makeClient();
        const { data, error } = await client.rpc("get_msa_geojson", {
            p_geoid: "NONEXISTENT-GEOID-99999",
        });
        expect(error).toBeNull();
        expect(data).toBeNull();
    });
});

// ── get_city_geojson ──────────────────────────────────────────────────────────

describe("get_city_geojson", () => {
    it("returns valid GeoJSON text for San Francisco, CA", async () => {
        const client = makeClient();
        const { data, error } = await client.rpc("get_city_geojson", {
            p_name: "San Francisco",
            p_state: "CA",
        });
        expect(error).toBeNull();
        expect(typeof data).toBe("string");
        expect(data).not.toBeNull();

        const geojson = JSON.parse(data as string);
        expect(geojson).toHaveProperty("type");
        expect(geojson).toHaveProperty("coordinates");
        expect(["Polygon", "MultiPolygon"]).toContain(geojson.type);
    });

    it("returns null for a non-existent city", async () => {
        const client = makeClient();
        const { data, error } = await client.rpc("get_city_geojson", {
            p_name: "Nonexistent City XYZ ABC",
            p_state: "CA",
        });
        expect(error).toBeNull();
        expect(data).toBeNull();
    });
});
