import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const { mockRpc } = vi.hoisted(() => ({
    mockRpc: vi.fn(),
}));

vi.mock("@/utils/supabase/admin", () => ({
    createAdminClient: vi.fn(() => ({
        rpc: mockRpc,
    })),
}));

function makeGet(params?: Record<string, string>) {
    const u = new URL("http://localhost/api/listings/zillow");
    if (params) Object.entries(params).forEach(([k, v]) => u.searchParams.set(k, v));
    return new NextRequest(u.toString());
}

const SAMPLE_ROWS = [
    {
        id: "zillow-1",
        address: "123 Main St",
        longitude: -122.25,
        latitude: 37.81,
        price_label: "$2,500",
        is_reit: false,
        unit_count: 1,
        unit_mix: [],
        img_src: null,
        area: 800,
        scraped_at: "2024-01-01T00:00:00Z",
        total_count: 1,
    },
];

beforeEach(() => {
    vi.clearAllMocks();
});

describe("GET /api/listings/zillow", () => {
    it("returns rows with Cache-Control header on success", async () => {
        mockRpc.mockResolvedValue({ data: SAMPLE_ROWS, error: null });

        const res = await GET(makeGet({ zip: "94610" }));
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body).toEqual(SAMPLE_ROWS);
        expect(res.headers.get("Cache-Control")).toBe("public, s-maxage=259200, stale-while-revalidate=43200");
    });

    it("passes params correctly to rpc", async () => {
        mockRpc.mockResolvedValue({ data: [], error: null });

        await GET(
            makeGet({
                zip: "94610",
                latest_only: "true",
                price_min: "1000",
                price_max: "5000",
                sqft_min: "500",
                sqft_max: "1200",
                beds: "1,2",
                baths_min: "1",
                property_type: "reit",
                limit: "50",
                offset: "100",
            }),
        );

        expect(mockRpc).toHaveBeenCalledWith("get_zillow_map_listings", {
            p_zip: "94610",
            p_city: null,
            p_address_query: null,
            p_latest_only: true,
            p_price_min: 1000,
            p_price_max: 5000,
            p_sqft_min: 500,
            p_sqft_max: 1200,
            p_beds: [1, 2],
            p_baths_min: 1,
            p_home_types: null,
            p_property_type: "reit",
            p_bounds_south: null,
            p_bounds_north: null,
            p_bounds_west: null,
            p_bounds_east: null,
            p_limit: 50,
            p_offset: 100,
        });
    });

    it("defaults property_type to 'both' when not provided", async () => {
        mockRpc.mockResolvedValue({ data: [], error: null });

        await GET(makeGet());

        expect(mockRpc).toHaveBeenCalledWith("get_zillow_map_listings", expect.objectContaining({ p_property_type: "both" }));
    });

    it("snaps bounds outward to 0.1° grid before passing to rpc", async () => {
        mockRpc.mockResolvedValue({ data: [], error: null });

        // south=37.82 floors to 37.8, north=37.85 ceils to 37.9
        // west=-122.26 floors to -122.3, east=-122.22 ceils to -122.2
        await GET(makeGet({ bounds_south: "37.82", bounds_north: "37.85", bounds_west: "-122.26", bounds_east: "-122.22" }));

        expect(mockRpc).toHaveBeenCalledWith(
            "get_zillow_map_listings",
            expect.objectContaining({
                p_bounds_south: 37.8,
                p_bounds_north: 37.9,
                p_bounds_west: -122.3,
                p_bounds_east: -122.2,
            }),
        );
    });

    it("passes null bounds when none provided", async () => {
        mockRpc.mockResolvedValue({ data: [], error: null });

        await GET(makeGet({ zip: "94610" }));

        expect(mockRpc).toHaveBeenCalledWith(
            "get_zillow_map_listings",
            expect.objectContaining({
                p_bounds_south: null,
                p_bounds_north: null,
                p_bounds_west: null,
                p_bounds_east: null,
            }),
        );
    });

    it("returns 500 with Server-Timing when rpc returns an error", async () => {
        mockRpc.mockResolvedValue({ data: null, error: { message: "RPC failed" } });

        const res = await GET(makeGet({ zip: "94610" }));
        const body = await res.json();

        expect(res.status).toBe(500);
        expect(body.error).toBe("RPC failed");
        expect(res.headers.get("Server-Timing")).toContain("rpc;dur=");
    });

    it("retries rpc on statement timeout then succeeds", async () => {
        vi.useFakeTimers();
        mockRpc
            .mockResolvedValueOnce({
                data: null,
                error: { message: "canceling statement due to statement timeout" },
            })
            .mockResolvedValueOnce({ data: SAMPLE_ROWS, error: null });

        const p = GET(makeGet({ zip: "94610" }));
        await vi.advanceTimersByTimeAsync(500);
        const res = await p;
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body).toEqual(SAMPLE_ROWS);
        expect(mockRpc).toHaveBeenCalledTimes(2);
        vi.useRealTimers();
    });

    it("returns 500 after exhausting retries on statement timeouts", async () => {
        vi.useFakeTimers();
        const timeoutErr = { message: "canceling statement due to statement timeout" };
        mockRpc.mockResolvedValue({ data: null, error: timeoutErr });

        const p = GET(makeGet({ zip: "94610" }));
        await vi.advanceTimersByTimeAsync(2000);
        const res = await p;
        const body = await res.json();

        expect(res.status).toBe(500);
        expect(body.error).toBe(timeoutErr.message);
        expect(mockRpc).toHaveBeenCalledTimes(3);
        vi.useRealTimers();
    });

    it("returns 500 when admin client throws", async () => {
        mockRpc.mockRejectedValue(new Error("connection error"));

        const res = await GET(makeGet({ zip: "94610" }));
        const body = await res.json();

        expect(res.status).toBe(500);
        expect(body.error).toBe("connection error");
    });

    it("returns empty array when rpc returns no data", async () => {
        mockRpc.mockResolvedValue({ data: null, error: null });

        const res = await GET(makeGet({ zip: "94610" }));
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body).toEqual([]);
    });
});
