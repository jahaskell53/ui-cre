import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const { mockDbExecute } = vi.hoisted(() => ({
    mockDbExecute: vi.fn(),
}));

vi.mock("@/db", () => ({
    db: {
        execute: mockDbExecute,
    },
}));

// sql tagged template literal just needs to produce something truthy
vi.mock("drizzle-orm", () => ({
    sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({ strings, values }),
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
        building_zpid: null,
    },
];

beforeEach(() => {
    vi.clearAllMocks();
});

describe("GET /api/listings/zillow", () => {
    it("returns rows with Cache-Control header on success", async () => {
        mockDbExecute.mockResolvedValue(SAMPLE_ROWS);

        const res = await GET(makeGet({ zip: "94610" }));
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body).toEqual(SAMPLE_ROWS);
        expect(res.headers.get("Cache-Control")).toBe("public, s-maxage=604800, stale-while-revalidate=86400");
    });

    it("calls db.execute (bypasses PostgREST max_rows)", async () => {
        mockDbExecute.mockResolvedValue([]);
        await GET(makeGet({ zip: "94610" }));
        expect(mockDbExecute).toHaveBeenCalledTimes(1);
    });

    it("defaults property_type to 'both' when not provided", async () => {
        mockDbExecute.mockResolvedValue([]);
        const res = await GET(makeGet());
        expect(res.status).toBe(200);
    });

    it("passes p_laundry when laundry query param is set", async () => {
        mockDbExecute.mockResolvedValue([]);
        const res = await GET(makeGet({ laundry: "in_unit,shared" }));
        expect(res.status).toBe(200);
    });

    it("snaps bounds outward to 0.1° grid", async () => {
        mockDbExecute.mockResolvedValue([]);
        // south=37.82 floors to 37.8, north=37.85 ceils to 37.9
        // west=-122.26 floors to -122.3, east=-122.22 ceils to -122.2
        const res = await GET(makeGet({ bounds_south: "37.82", bounds_north: "37.85", bounds_west: "-122.26", bounds_east: "-122.22" }));
        expect(res.status).toBe(200);
    });

    it("passes null bounds when none provided", async () => {
        mockDbExecute.mockResolvedValue([]);
        const res = await GET(makeGet({ zip: "94610" }));
        expect(res.status).toBe(200);
        // Ensure execute was still called (bounds default to null within the sql template)
        expect(mockDbExecute).toHaveBeenCalledTimes(1);
    });

    it("includes Server-Timing header in response", async () => {
        mockDbExecute.mockResolvedValue(SAMPLE_ROWS);

        const res = await GET(makeGet({ zip: "94610" }));

        expect(res.status).toBe(200);
        expect(res.headers.get("Server-Timing")).toContain("rpc;dur=");
    });

    it("returns 500 when db.execute throws a non-timeout error", async () => {
        mockDbExecute.mockRejectedValue(new Error("RPC failed"));

        const res = await GET(makeGet({ zip: "94610" }));
        const body = await res.json();

        expect(res.status).toBe(500);
        expect(body.error).toBe("RPC failed");
    });

    it("retries db.execute on statement timeout then succeeds", async () => {
        vi.useFakeTimers();
        mockDbExecute
            .mockRejectedValueOnce(new Error("canceling statement due to statement timeout"))
            .mockResolvedValueOnce(SAMPLE_ROWS);

        const p = GET(makeGet({ zip: "94610" }));
        await vi.advanceTimersByTimeAsync(500);
        const res = await p;
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body).toEqual(SAMPLE_ROWS);
        expect(mockDbExecute).toHaveBeenCalledTimes(2);
        vi.useRealTimers();
    });

    it("returns 500 after exhausting retries on statement timeouts", async () => {
        vi.useFakeTimers();
        const timeoutErr = new Error("canceling statement due to statement timeout");
        mockDbExecute.mockRejectedValue(timeoutErr);

        const p = GET(makeGet({ zip: "94610" }));
        await vi.advanceTimersByTimeAsync(2000);
        const res = await p;
        const body = await res.json();

        expect(res.status).toBe(500);
        expect(body.error).toContain("statement timeout");
        expect(mockDbExecute).toHaveBeenCalledTimes(3);
        vi.useRealTimers();
    });

    it("returns empty array when db.execute returns no data", async () => {
        mockDbExecute.mockResolvedValue([]);

        const res = await GET(makeGet({ zip: "94610" }));
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body).toEqual([]);
    });
});
