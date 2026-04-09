/**
 * DB integration tests for the insert_cleaned_listings_bulk UDF.
 *
 * The function accepts a JSONB array of listing objects and performs an
 * upsert into cleaned_listings on (run_id, zpid).
 *
 * Tests verify:
 *   1. Basic insert: rows are created and lat/lng generated columns are correct
 *   2. Upsert: re-inserting with the same (run_id, zpid) updates existing rows
 *   3. Null geometry: rows without lat/lng are inserted with geom=NULL
 *   4. Laundry check constraint: invalid value is rejected
 *   5. All valid laundry values ('in_unit', 'shared', 'none', NULL) are accepted
 *
 * The test uses a fixed run_id prefix to isolate its data and deletes rows
 * after each test via the service role (bypasses RLS).
 *
 * NOTE: cleaned_listings has a FK to zip_codes(zip). The test uses a zip that
 * exists in that table ('94110') so the FK constraint is satisfied.
 * raw_scrape_id is set to NULL (the FK to raw_zillow_scrapes is nullable).
 *
 * Requires SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY.
 */
import { type SupabaseClient, createClient } from "@supabase/supabase-js";
import { afterEach, describe, expect, it } from "vitest";

const TEST_RUN_ID = "integration-test-bulk-insert";
const TEST_ZIP = "94110";

function makeClient(): SupabaseClient {
    const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error("Missing SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
    return createClient(url, key);
}

async function deleteTestRows(client: SupabaseClient) {
    await client.from("cleaned_listings").delete().eq("run_id", TEST_RUN_ID);
}

afterEach(async () => {
    await deleteTestRows(makeClient());
});

function makeListing(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
        run_id: TEST_RUN_ID,
        scraped_at: "2024-01-15T00:00:00Z",
        zip_code: TEST_ZIP,
        zpid: "test-zpid-001",
        address_raw: "123 Test St, San Francisco, CA 94110",
        address_street: "123 Test St",
        address_city: "San Francisco",
        address_state: "CA",
        address_zip: TEST_ZIP,
        price: 2500,
        beds: 1,
        baths: "1",
        area: 700,
        availability_date: null,
        lat: "37.7599",
        lng: "-122.4184",
        raw_scrape_id: null,
        img_src: null,
        detail_url: "https://zillow.com/test",
        is_building: "false",
        building_zpid: "",
        home_type: "APARTMENT",
        laundry: "",
        ...overrides,
    };
}

// ── Basic insert ──────────────────────────────────────────────────────────────

describe("insert_cleaned_listings_bulk – basic insert", () => {
    it("inserts a single row and the generated lat/lng columns match the input", async () => {
        const client = makeClient();
        const listing = makeListing({ zpid: "bulk-test-001", lat: "37.7599", lng: "-122.4184" });

        const { error } = await client.rpc("insert_cleaned_listings_bulk", {
            rows: [listing],
        });
        expect(error).toBeNull();

        const { data, error: selectErr } = await client
            .from("cleaned_listings")
            .select("zpid, latitude, longitude, price, beds, home_type")
            .eq("run_id", TEST_RUN_ID)
            .eq("zpid", "bulk-test-001");

        expect(selectErr).toBeNull();
        const rows = data ?? [];
        expect(rows).toHaveLength(1);

        const row = rows[0] as {
            zpid: string;
            latitude: number;
            longitude: number;
            price: number;
            beds: number;
            home_type: string;
        };
        expect(row.zpid).toBe("bulk-test-001");
        expect(row.latitude).toBeCloseTo(37.7599, 4);
        expect(row.longitude).toBeCloseTo(-122.4184, 4);
        expect(row.price).toBe(2500);
        expect(row.beds).toBe(1);
        expect(row.home_type).toBe("APARTMENT");
    });

    it("inserts multiple rows in one call", async () => {
        const client = makeClient();
        const listings = [
            makeListing({ zpid: "bulk-multi-001", price: 2000 }),
            makeListing({ zpid: "bulk-multi-002", price: 3000 }),
            makeListing({ zpid: "bulk-multi-003", price: 2500 }),
        ];

        const { error } = await client.rpc("insert_cleaned_listings_bulk", {
            rows: listings,
        });
        expect(error).toBeNull();

        const { data, error: selectErr } = await client
            .from("cleaned_listings")
            .select("zpid, price")
            .eq("run_id", TEST_RUN_ID)
            .in("zpid", ["bulk-multi-001", "bulk-multi-002", "bulk-multi-003"]);

        expect(selectErr).toBeNull();
        expect((data ?? []).length).toBe(3);
    });
});

// ── Upsert behavior ───────────────────────────────────────────────────────────

describe("insert_cleaned_listings_bulk – upsert on (run_id, zpid)", () => {
    it("updates an existing row when (run_id, zpid) conflicts", async () => {
        const client = makeClient();
        const zpid = "bulk-upsert-001";

        await client.rpc("insert_cleaned_listings_bulk", {
            rows: [makeListing({ zpid, price: 2000 })],
        });

        await client.rpc("insert_cleaned_listings_bulk", {
            rows: [makeListing({ zpid, price: 9999 })],
        });

        const { data } = await client.from("cleaned_listings").select("price").eq("run_id", TEST_RUN_ID).eq("zpid", zpid);

        const rows = (data ?? []) as { price: number }[];
        expect(rows).toHaveLength(1);
        expect(rows[0].price).toBe(9999);
    });
});

// ── NULL geometry ─────────────────────────────────────────────────────────────

describe("insert_cleaned_listings_bulk – null geometry", () => {
    it("inserts a row with null geom when lat/lng are absent", async () => {
        const client = makeClient();
        const listing = makeListing({ zpid: "bulk-no-geom-001" });
        delete listing["lat"];
        delete listing["lng"];

        const { error } = await client.rpc("insert_cleaned_listings_bulk", {
            rows: [listing],
        });
        expect(error).toBeNull();

        const { data } = await client
            .from("cleaned_listings")
            .select("latitude, longitude")
            .eq("run_id", TEST_RUN_ID)
            .eq("zpid", "bulk-no-geom-001");

        const rows = (data ?? []) as { latitude: number | null; longitude: number | null }[];
        expect(rows).toHaveLength(1);
        expect(rows[0].latitude).toBeNull();
        expect(rows[0].longitude).toBeNull();
    });
});

// ── Laundry values ────────────────────────────────────────────────────────────

describe("insert_cleaned_listings_bulk – laundry field", () => {
    it.each([
        ["in_unit", "in_unit"],
        ["shared", "shared"],
        ["none", "none"],
        ["", null],
    ])("accepts laundry='%s' and stores %s", async (inputLaundry, expectedLaundry) => {
        const client = makeClient();
        const zpid = `bulk-laundry-${inputLaundry || "empty"}`;
        await deleteTestRows(client);

        const { error } = await client.rpc("insert_cleaned_listings_bulk", {
            rows: [makeListing({ zpid, laundry: inputLaundry })],
        });
        expect(error).toBeNull();

        const { data } = await client
            .from("cleaned_listings")
            .select("laundry")
            .eq("run_id", TEST_RUN_ID)
            .eq("zpid", zpid);

        const rows = (data ?? []) as { laundry: string | null }[];
        expect(rows).toHaveLength(1);
        expect(rows[0].laundry).toBe(expectedLaundry);
    });

    it("rejects an invalid laundry value with a constraint error", async () => {
        const client = makeClient();

        const { error } = await client.rpc("insert_cleaned_listings_bulk", {
            rows: [makeListing({ zpid: "bulk-bad-laundry", laundry: "in_garage" })],
        });
        expect(error).not.toBeNull();
    });
});
