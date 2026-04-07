import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const { mockExchangeCodeForGrant, mockEnqueueEmailSync, mockDbInsert } = vi.hoisted(() => ({
    mockExchangeCodeForGrant: vi.fn(),
    mockEnqueueEmailSync: vi.fn(),
    mockDbInsert: vi.fn(),
}));

vi.mock("@/utils/supabase/server", () => ({
    createClient: vi.fn().mockResolvedValue({}),
}));

vi.mock("@/lib/nylas/client", () => ({
    exchangeCodeForGrant: mockExchangeCodeForGrant,
}));

vi.mock("@/utils/sqs", () => ({
    enqueueEmailSync: mockEnqueueEmailSync,
}));

vi.mock("@/db", () => ({
    db: {
        insert: mockDbInsert,
    },
}));

function makeGet(params: Record<string, string>) {
    const u = new URL("http://localhost/api/auth/nylas/callback");
    Object.entries(params).forEach(([k, v]) => u.searchParams.set(k, v));
    return new NextRequest(u.toString());
}

describe("GET /api/auth/nylas/callback", () => {
    beforeEach(() => vi.clearAllMocks());

    it("redirects to error page when OAuth error param is present", async () => {
        const res = await GET(makeGet({ error: "access_denied" }));
        expect(res.status).toBe(307);
        expect(res.headers.get("location")).toContain("oauth_failed");
    });

    it("redirects to error page when code is missing", async () => {
        const res = await GET(makeGet({ state: "user-1:12345" }));
        expect(res.status).toBe(307);
        expect(res.headers.get("location")).toContain("missing_params");
    });

    it("redirects to error page when state is missing", async () => {
        const res = await GET(makeGet({ code: "auth-code" }));
        expect(res.status).toBe(307);
        expect(res.headers.get("location")).toContain("missing_params");
    });

    it("stores integration and redirects to success on happy path", async () => {
        const grantResponse = {
            grantId: "grant-abc",
            provider: "google",
            email: "user@example.com",
            scope: ["email", "calendar"],
        };
        mockExchangeCodeForGrant.mockResolvedValue(grantResponse);

        // db.insert(...).values(...) → resolves
        const mockValues = vi.fn().mockResolvedValue(undefined);
        mockDbInsert.mockReturnValue({ values: mockValues });
        mockEnqueueEmailSync.mockResolvedValue(undefined);

        const res = await GET(makeGet({ code: "auth-code", state: "user-1:12345" }));

        expect(res.status).toBe(307);
        expect(res.headers.get("location")).toContain("success=true");
        expect(mockValues).toHaveBeenCalledWith(
            expect.objectContaining({
                userId: "user-1",
                nylasGrantId: "grant-abc",
            }),
        );
    });

    it("enqueues sync job after successful integration", async () => {
        mockExchangeCodeForGrant.mockResolvedValue({
            grantId: "grant-abc",
            provider: "google",
            email: "user@example.com",
            scope: [],
        });
        const mockValues = vi.fn().mockResolvedValue(undefined);
        mockDbInsert.mockReturnValue({ values: mockValues });
        mockEnqueueEmailSync.mockResolvedValue(undefined);

        await GET(makeGet({ code: "auth-code", state: "user-1:12345" }));

        expect(mockEnqueueEmailSync).toHaveBeenCalledWith("grant-abc", "user-1");
    });

    it("redirects to custom path from state when redirect is included", async () => {
        mockExchangeCodeForGrant.mockResolvedValue({
            grantId: "grant-abc",
            provider: "google",
            email: "user@example.com",
            scope: [],
        });
        const mockValues = vi.fn().mockResolvedValue(undefined);
        mockDbInsert.mockReturnValue({ values: mockValues });
        mockEnqueueEmailSync.mockResolvedValue(undefined);

        const state = `user-1:12345:${encodeURIComponent("/settings")}`;
        const res = await GET(makeGet({ code: "auth-code", state }));

        expect(res.headers.get("location")).toContain("/settings");
    });

    it("continues and redirects to success even when enqueueEmailSync fails", async () => {
        mockExchangeCodeForGrant.mockResolvedValue({
            grantId: "grant-abc",
            provider: "google",
            email: "user@example.com",
            scope: [],
        });
        const mockValues = vi.fn().mockResolvedValue(undefined);
        mockDbInsert.mockReturnValue({ values: mockValues });
        mockEnqueueEmailSync.mockRejectedValue(new Error("SQS down"));

        const res = await GET(makeGet({ code: "auth-code", state: "user-1:12345" }));

        expect(res.status).toBe(307);
        expect(res.headers.get("location")).toContain("success=true");
    });

    it("redirects to callback_failed error when exchangeCodeForGrant throws", async () => {
        mockExchangeCodeForGrant.mockRejectedValue(new Error("network error"));

        const res = await GET(makeGet({ code: "auth-code", state: "user-1:12345" }));

        expect(res.status).toBe(307);
        expect(res.headers.get("location")).toContain("callback_failed");
    });
});
