import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const mockGetUser = vi.fn();
const mockDbExecute = vi.fn();

vi.mock("@/utils/supabase/server", () => ({
    createClient: vi.fn().mockResolvedValue({
        auth: { getUser: mockGetUser },
    }),
}));

vi.mock("@/db", () => ({
    db: {
        execute: mockDbExecute,
    },
}));

function post(body: Record<string, unknown>) {
    return new NextRequest("http://localhost/api/analytics/crexi-sales-comps", {
        method: "POST",
        body: JSON.stringify(body),
    });
}

describe("POST /api/analytics/crexi-sales-comps", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("returns 401 when not authenticated", async () => {
        mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
        const res = await POST(
            post({
                bucket_month_start: "2024-01-01",
                p_zip: "94102",
            }),
        );
        expect(res.status).toBe(401);
    });

    it("returns 400 when geographic scope is ambiguous", async () => {
        mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
        const res = await POST(
            post({
                bucket_month_start: "2024-01-01",
                p_zip: "94102",
                p_city: "San Francisco",
                p_state: "CA",
            }),
        );
        expect(res.status).toBe(400);
    });

    it("returns total and rows from RPC", async () => {
        mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
        mockDbExecute.mockResolvedValue([
            {
                result: {
                    total: 2,
                    rows: [
                        {
                            id: 1,
                            crexi_url: "https://example.com/1",
                            property_name: "A",
                            address_full: null,
                            city: null,
                            state: null,
                            zip: null,
                            sale_transaction_date: "2024-01-15",
                            property_price_total: 1_000_000,
                            num_units: 10,
                            price_per_door: 100_000,
                            cap_rate_percent: 5.5,
                        },
                    ],
                },
            },
        ]);

        const res = await POST(
            post({
                bucket_month_start: "2024-01-01",
                sample_window_months: 3,
                p_zip: "94102",
            }),
        );
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.total).toBe(2);
        expect(body.rows).toHaveLength(1);
        expect(body.rows[0].property_name).toBe("A");
    });
});
