import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const { mockUnsubscribe } = vi.hoisted(() => ({
    mockUnsubscribe: vi.fn(),
}));

vi.mock("@/lib/news/subscribers", () => ({
    unsubscribe: mockUnsubscribe,
}));

function makeRequest(params?: Record<string, string>) {
    const u = new URL("http://localhost/api/news/unsubscribe");
    if (params) Object.entries(params).forEach(([k, v]) => u.searchParams.set(k, v));
    return new NextRequest(u.toString());
}

describe("GET /api/news/unsubscribe", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("returns 400 HTML when email param is missing", async () => {
        const res = await GET(makeRequest());
        const text = await res.text();
        expect(res.status).toBe(400);
        expect(res.headers.get("content-type")).toContain("text/html");
        expect(text).toContain("Email address is required");
    });

    it("returns 200 HTML with success message when unsubscribe succeeds", async () => {
        mockUnsubscribe.mockResolvedValue(true);
        const res = await GET(makeRequest({ email: "alice@example.com" }));
        const text = await res.text();
        expect(res.status).toBe(200);
        expect(text).toContain("Successfully Unsubscribed");
    });

    it("returns 404 HTML when email not found", async () => {
        mockUnsubscribe.mockResolvedValue(false);
        const res = await GET(makeRequest({ email: "unknown@example.com" }));
        const text = await res.text();
        expect(res.status).toBe(404);
        expect(text).toContain("Error");
    });

    it("returns 500 HTML when unsubscribe throws", async () => {
        mockUnsubscribe.mockRejectedValue(new Error("DB crash"));
        const res = await GET(makeRequest({ email: "alice@example.com" }));
        const text = await res.text();
        expect(res.status).toBe(500);
        expect(text).toContain("unexpected error");
    });
});
