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

describe("GET /api/analytics/crexi-comp/[id]", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("returns row when looked up by numeric id", async () => {
        const row = {
            id: 42,
            crexi_id: "SALES~1",
            crexi_url: "https://www.crexi.com/property-records/SALES~1",
            property_name: "Test MF",
            latitude: 37.7,
            longitude: -122.4,
        };
        const mockLimit = vi.fn().mockResolvedValue([row]);
        const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
        mockDbSelect.mockReturnValue({ from: vi.fn().mockReturnValue({ where: mockWhere }) });

        const req = new NextRequest("http://localhost/api/analytics/crexi-comp/42");
        const res = await GET(req, { params: Promise.resolve({ id: "42" }) });
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.id).toBe(42);
        expect(body.property_name).toBe("Test MF");
    });

    it("returns 404 when no row", async () => {
        const mockLimit = vi.fn().mockResolvedValue([]);
        const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
        mockDbSelect.mockReturnValue({ from: vi.fn().mockReturnValue({ where: mockWhere }) });

        const req = new NextRequest("http://localhost/api/analytics/crexi-comp/999");
        const res = await GET(req, { params: Promise.resolve({ id: "999" }) });

        expect(res.status).toBe(404);
    });
});
