import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const { mockDbSelect } = vi.hoisted(() => ({
    mockDbSelect: vi.fn(),
}));

vi.mock("@/db", () => ({
    db: {
        select: mockDbSelect,
    },
}));

function makeGet(params?: Record<string, string>) {
    const u = new URL("http://localhost/api/listings/loopnet");
    if (params) Object.entries(params).forEach(([k, v]) => u.searchParams.set(k, v));
    return new NextRequest(u.toString());
}

beforeEach(() => {
    vi.clearAllMocks();
});

describe("GET /api/listings/loopnet", () => {
    it("returns attachment_urls on detail by id", async () => {
        const row = {
            id: "ln-1",
            address: "1 Main St",
            addressRaw: "1 Main St, San Francisco, CA 94102",
            addressStreet: "1 Main St",
            addressCity: "San Francisco",
            addressState: "CA",
            addressZip: "94102",
            headline: null,
            location: "SF, CA",
            latitude: 37.7749,
            longitude: -122.4194,
            price: "$1M",
            capRate: "5%",
            buildingCategory: "Multifamily",
            squareFootage: "10000",
            thumbnailUrl: null,
            listingUrl: "https://loopnet.example/l/1",
            omUrl: null,
            createdAt: "2024-01-01T00:00:00Z",
            unitMix: null,
            attachmentUrls: [
                { source_url: "https://cdn/a.pdf", url: "https://s3/a.pdf", description: "OM" },
                { source_url: "https://cdn/b.pdf", url: "https://s3/b.pdf" },
            ],
        };
        const mockLimit = vi.fn().mockResolvedValue([row]);
        const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
        const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
        mockDbSelect.mockReturnValue({ from: mockFrom });

        const res = await GET(makeGet({ id: "ln-1" }));
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.address_raw).toBe("1 Main St, San Francisco, CA 94102");
        expect(body.address_street).toBe("1 Main St");
        expect(body.address_city).toBe("San Francisco");
        expect(body.address_state).toBe("CA");
        expect(body.address_zip).toBe("94102");
        expect(body.attachment_urls).toEqual([
            { source_url: "https://cdn/a.pdf", url: "https://s3/a.pdf", description: "OM" },
            { source_url: "https://cdn/b.pdf", url: "https://s3/b.pdf" },
        ]);
        expect(body.latitude).toBe(37.7749);
        expect(body.longitude).toBe(-122.4194);
    });

    it("returns empty map payload when no rows (latest_only)", async () => {
        let call = 0;
        mockDbSelect.mockImplementation(() => {
            call += 1;
            if (call === 1) {
                const mockLimit = vi.fn().mockResolvedValue([{ runId: 1 }]);
                const mockOrderBy = vi.fn().mockReturnValue({ limit: mockLimit });
                return { from: vi.fn().mockReturnValue({ orderBy: mockOrderBy }) };
            }
            const mockOrderBy2 = vi.fn().mockResolvedValue([]);
            const mockWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy2 });
            return { from: vi.fn().mockReturnValue({ where: mockWhere }) };
        });

        const res = await GET(makeGet({ latest_only: "1" }));
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body).toEqual({ data: [], count: 0 });
        expect(call).toBe(2);
    });

    it("returns latest_run_id", async () => {
        const mockLimit = vi.fn().mockResolvedValue([{ runId: 42 }]);
        const mockOrderBy = vi.fn().mockReturnValue({ limit: mockLimit });
        const mockFrom = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
        mockDbSelect.mockReturnValue({ from: mockFrom });

        const res = await GET(makeGet({ latest_run_id: "1" }));
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body).toEqual({ run_id: 42 });
    });
});
