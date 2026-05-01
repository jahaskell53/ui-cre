import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const { mockGetUser, mockRpc } = vi.hoisted(() => ({
    mockGetUser: vi.fn(),
    mockRpc: vi.fn(),
}));

vi.mock("@/utils/supabase/server", () => ({
    createClient: vi.fn().mockResolvedValue({
        auth: { getUser: mockGetUser },
        rpc: mockRpc,
    }),
}));

function makeGet(search: string) {
    return new NextRequest(`http://localhost/api/analytics/crexi-sales-bucket-listings${search}`);
}

describe("GET /api/analytics/crexi-sales-bucket-listings", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
        mockRpc.mockResolvedValue({
            data: [
                {
                    id: 1,
                    crexi_id: "c1",
                    property_name: "Test",
                    address_full: "1 Main",
                    city: "Oakland",
                    state: "CA",
                    zip: "94601",
                    property_price_total: 1_000_000,
                    num_units: 10,
                    price_per_door: 100_000,
                    sale_transaction_date: "2024-06-15",
                    sale_cap_rate_percent: 5.5,
                    financials_cap_rate_percent: null,
                    total_count: 1,
                },
            ],
            error: null,
        });
    });

    it("returns 401 when not authenticated", async () => {
        mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
        const res = await GET(makeGet("?areaKind=zip&bucketStart=2024-01-01&zip=94601"));
        expect(res.status).toBe(401);
    });

    it("returns 400 when bucketStart missing", async () => {
        const res = await GET(makeGet("?areaKind=zip"));
        expect(res.status).toBe(400);
    });

    it("calls rpc with expected params and strips total_count from rows", async () => {
        const res = await GET(makeGet("?areaKind=zip&bucketStart=2024-01-01&zip=94601&monthsPerBucket=3&offset=0&limit=25&minUnits=5&maxUnits=50"));
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.total).toBe(1);
        expect(body.listings).toHaveLength(1);
        expect(body.listings[0]).not.toHaveProperty("total_count");
        expect(body.listings[0].id).toBe(1);
        expect(mockRpc).toHaveBeenCalledWith(
            "get_crexi_sales_trends_bucket_listings",
            expect.objectContaining({
                p_area_kind: "zip",
                p_bucket_start: "2024-01-01",
                p_months_per_bucket: 3,
                p_zip: "94601",
                p_min_units: 5,
                p_max_units: 50,
            }),
        );
    });
});
