import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

function makeGet(params?: Record<string, string>) {
    const u = new URL("http://localhost/api/geocode");
    if (params) Object.entries(params).forEach(([k, v]) => u.searchParams.set(k, v));
    return new NextRequest(u.toString());
}

function mockFetch(ok: boolean, data: unknown) {
    vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue({
            ok,
            json: () => Promise.resolve(data),
        }),
    );
}

afterEach(() => {
    vi.unstubAllGlobals();
});

describe("GET /api/geocode", () => {
    it("returns 400 when q param is missing", async () => {
        const res = await GET(makeGet());
        expect(res.status).toBe(400);
    });

    it("returns 400 when q param is blank", async () => {
        const res = await GET(makeGet({ q: "   " }));
        expect(res.status).toBe(400);
    });

    it("returns transformed suggestions", async () => {
        mockFetch(true, {
            features: [
                {
                    id: "place.1",
                    place_name: "123 Main St, Boston, MA",
                    center: [-71.0589, 42.3601],
                    context: [],
                },
            ],
        });

        const res = await GET(makeGet({ q: "123 Main St" }));
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.suggestions).toHaveLength(1);
        expect(body.suggestions[0].id).toBe("place.1");
        expect(body.suggestions[0].address).toBe("123 Main St, Boston, MA");
        expect(body.suggestions[0].coordinates).toEqual([-71.0589, 42.3601]);
    });

    it("returns 500 when Mapbox responds with non-ok status", async () => {
        mockFetch(false, {});

        const res = await GET(makeGet({ q: "somewhere" }));
        expect(res.status).toBe(500);
    });

    it("returns 500 when fetch throws", async () => {
        vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network error")));

        const res = await GET(makeGet({ q: "somewhere" }));
        expect(res.status).toBe(500);
    });
});
