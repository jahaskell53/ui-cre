import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const { mockGetUser, mockFrom, mockGenerateAuthUrl } = vi.hoisted(() => ({
    mockGetUser: vi.fn(),
    mockFrom: vi.fn(),
    mockGenerateAuthUrl: vi.fn(),
}));

vi.mock("@/utils/supabase/server", () => ({
    createClient: vi.fn().mockResolvedValue({
        auth: { getUser: mockGetUser },
        from: mockFrom,
    }),
}));

vi.mock("@/lib/nylas/client", () => ({
    generateAuthUrl: mockGenerateAuthUrl,
}));

function makeGet(params?: Record<string, string>) {
    const u = new URL("http://localhost/api/auth/nylas/authorize");
    if (params) Object.entries(params).forEach(([k, v]) => u.searchParams.set(k, v));
    return new NextRequest(u.toString());
}

describe("GET /api/auth/nylas/authorize", () => {
    beforeEach(() => vi.clearAllMocks());

    it("returns 400 when provider is missing", async () => {
        mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
        const res = await GET(makeGet());
        expect(res.status).toBe(400);
    });

    it("returns 401 when not authenticated", async () => {
        mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
        const res = await GET(makeGet({ provider: "google" }));
        expect(res.status).toBe(401);
    });

    it("redirects to OAuth URL when valid", async () => {
        mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
        mockGenerateAuthUrl.mockReturnValue({ url: "https://accounts.google.com/oauth?state=abc" });

        const res = await GET(makeGet({ provider: "google" }));

        expect(res.status).toBe(307);
        expect(res.headers.get("location")).toBe("https://accounts.google.com/oauth?state=abc");
    });

    it("includes redirect in state when redirect param is provided", async () => {
        mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
        mockGenerateAuthUrl.mockReturnValue({ url: "https://oauth.example.com/?state=xyz" });

        await GET(makeGet({ provider: "google", redirect: "/dashboard" }));

        expect(mockGenerateAuthUrl).toHaveBeenCalledWith("google", expect.stringContaining(encodeURIComponent("/dashboard")));
    });
});
