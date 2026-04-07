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

describe("GET /api/conversations", () => {
    const mockUser = {
        id: "user-123",
        email: "test@example.com",
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("should return 401 if user is not authenticated", async () => {
        mockGetUser.mockResolvedValue({
            data: { user: null },
            error: { message: "Not authenticated" },
        });

        const request = new NextRequest("http://localhost/api/conversations");

        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(401);
        expect(data.error).toBe("Unauthorized");
    });

    it("should return empty array if no conversations", async () => {
        mockGetUser.mockResolvedValue({
            data: { user: mockUser },
            error: null,
        });

        // db.select().from().where().orderBy() → []
        const mockOrderBy = vi.fn().mockResolvedValue([]);
        const mockWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
        const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
        mockDb.select.mockReturnValue({ from: mockFrom });

        const request = new NextRequest("http://localhost/api/conversations");

        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(Array.isArray(data)).toBe(true);
        expect(data.length).toBe(0);
    });

    it("should return conversations with profile data", async () => {
        mockGetUser.mockResolvedValue({
            data: { user: mockUser },
            error: null,
        });

        const mockMessages = [
            {
                id: "msg-1",
                sender_id: "user-123",
                recipient_id: "user-456",
                content: "Hello",
                created_at: new Date(Date.now() - 10000).toISOString(),
                read_at: null,
            },
            {
                id: "msg-2",
                sender_id: "user-456",
                recipient_id: "user-123",
                content: "Hi there",
                created_at: new Date().toISOString(),
                read_at: null,
            },
        ];

        const mockProfiles = [
            {
                id: "user-456",
                full_name: "John Doe",
                avatar_url: "https://example.com/avatar.jpg",
            },
        ];

        let callCount = 0;
        mockDb.select.mockImplementation(() => {
            callCount++;
            if (callCount === 1) {
                // messages query
                const mockOrderBy = vi.fn().mockResolvedValue(mockMessages);
                const mockWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
                return { from: vi.fn().mockReturnValue({ where: mockWhere }) };
            } else {
                // profiles query
                const mockWhere = vi.fn().mockResolvedValue(mockProfiles);
                return { from: vi.fn().mockReturnValue({ where: mockWhere }) };
            }
        });

        const request = new NextRequest("http://localhost/api/conversations");

        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(Array.isArray(data)).toBe(true);
        expect(data.length).toBe(1);
        expect(data[0].other_user_id).toBe("user-456");
        expect(data[0].other_user).toBeDefined();
        expect(data[0].other_user?.full_name).toBe("John Doe");
        expect(data[0].last_message).toBeDefined();
        expect(data[0].unread_count).toBeGreaterThanOrEqual(0);
    });

    it("should handle errors when fetching messages", async () => {
        mockGetUser.mockResolvedValue({
            data: { user: mockUser },
            error: null,
        });

        mockDb.select.mockImplementation(() => {
            throw new Error("Database error");
        });

        const request = new NextRequest("http://localhost/api/conversations");

        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(500);
    });
});
