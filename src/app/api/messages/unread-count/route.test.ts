import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const { mockGetUser, mockDb } = vi.hoisted(() => ({
    mockGetUser: vi.fn(),
    mockDb: {
        select: vi.fn(),
    },
}));

vi.mock("@/utils/supabase/server", () => ({
    createClient: vi.fn().mockResolvedValue({
        auth: { getUser: mockGetUser },
    }),
}));

vi.mock("@/db", () => ({
    db: mockDb,
}));

describe("GET /api/messages/unread-count", () => {
    const mockUser = { id: "user-123", email: "test@example.com" };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("should return 401 if user is not authenticated", async () => {
        mockGetUser.mockResolvedValue({ data: { user: null }, error: { message: "Not authenticated" } });

        const request = new NextRequest("http://localhost/api/messages/unread-count");

        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(401);
        expect(data.error).toBe("Unauthorized");
    });

    it("should return unread count of 0 when no unread notifications", async () => {
        mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null });

        const mockWhere = vi.fn().mockResolvedValue([{ count: 0 }]);
        const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
        mockDb.select.mockReturnValue({ from: mockFrom });

        const request = new NextRequest("http://localhost/api/messages/unread-count");

        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.unread_count).toBe(0);
    });

    it("should return correct unread count", async () => {
        mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null });

        const mockWhere = vi.fn().mockResolvedValue([{ count: 5 }]);
        const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
        mockDb.select.mockReturnValue({ from: mockFrom });

        const request = new NextRequest("http://localhost/api/messages/unread-count");

        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.unread_count).toBe(5);
    });

    it("should handle database errors", async () => {
        mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null });

        const mockWhere = vi.fn().mockRejectedValue(new Error("Database error"));
        const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
        mockDb.select.mockReturnValue({ from: mockFrom });

        const request = new NextRequest("http://localhost/api/messages/unread-count");

        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(500);
        expect(data.error).toBe("Database error");
    });

    it("should return 0 when result is empty", async () => {
        mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null });

        const mockWhere = vi.fn().mockResolvedValue([]);
        const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
        mockDb.select.mockReturnValue({ from: mockFrom });

        const request = new NextRequest("http://localhost/api/messages/unread-count");

        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.unread_count).toBe(0);
    });
});
