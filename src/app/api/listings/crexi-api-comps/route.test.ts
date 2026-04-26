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
    const u = new URL("http://localhost/api/listings/crexi-api-comps");
    if (params) Object.entries(params).forEach(([k, v]) => u.searchParams.set(k, v));
    return new NextRequest(u.toString());
}

beforeEach(() => {
    vi.clearAllMocks();
});

describe("GET /api/listings/crexi-api-comps", () => {
    it("returns one row by id", async () => {
        const row = { id: 42, crexi_id: "x", property_name: "Test", document_type: null };
        const mockLimit = vi.fn().mockResolvedValue([row]);
        const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
        mockDbSelect.mockReturnValue({ from: vi.fn().mockReturnValue({ where: mockWhere }) });

        const res = await GET(makeGet({ id: "42" }));
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body).toEqual(row);
    });

    it("returns 404 when id not found", async () => {
        const mockLimit = vi.fn().mockResolvedValue([]);
        const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
        mockDbSelect.mockReturnValue({ from: vi.fn().mockReturnValue({ where: mockWhere }) });

        const res = await GET(makeGet({ id: "999" }));
        expect(res.status).toBe(404);
    });

    it("returns 400 for invalid id", async () => {
        const res = await GET(makeGet({ id: "abc" }));
        expect(res.status).toBe(400);
    });

    it("returns empty when no rows", async () => {
        const mockOrderBy = vi.fn().mockResolvedValue([]);
        const mockWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
        mockDbSelect.mockReturnValue({ from: vi.fn().mockReturnValue({ where: mockWhere }) });

        const res = await GET(makeGet({ bounds_west: "-122.5", bounds_east: "-122.4", bounds_south: "37.7", bounds_north: "37.8" }));
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body).toEqual({ data: [], count: 0 });
    });
});
