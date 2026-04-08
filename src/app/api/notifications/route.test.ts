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

describe("GET /api/notifications", () => {
    const mockUser = { id: "user-123", email: "test@example.com" };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("should return 401 if user is not authenticated", async () => {
        mockGetUser.mockResolvedValue({ data: { user: null }, error: { message: "Not authenticated" } });

        const request = new NextRequest("http://localhost/api/notifications");

        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(401);
        expect(data.error).toBe("Unauthorized");
    });

    it("should return empty array when no notifications", async () => {
        mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null });

        const mockLimit = vi.fn().mockResolvedValue([]);
        const mockOrderBy = vi.fn().mockReturnValue({ limit: mockLimit });
        const mockWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
        const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
        mockDb.select.mockReturnValue({ from: mockFrom });

        const request = new NextRequest("http://localhost/api/notifications");

        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(Array.isArray(data)).toBe(true);
        expect(data.length).toBe(0);
    });

    it("should return notifications with sender information", async () => {
        mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null });

        const mockNotifications = [
            {
                id: "notif-1",
                type: "message",
                title: null,
                content: "Hello there!",
                related_id: "msg-1",
                created_at: new Date().toISOString(),
                read_at: null,
            },
        ];

        const mockSenderProfile = {
            id: "user-456",
            full_name: "John Doe",
            avatar_url: "https://example.com/avatar.jpg",
        };

        let callCount = 0;
        mockDb.select.mockImplementation(() => {
            callCount++;
            if (callCount === 1) {
                // First call: fetch notifications
                const mockLimit = vi.fn().mockResolvedValue(mockNotifications);
                const mockOrderBy = vi.fn().mockReturnValue({ limit: mockLimit });
                const mockWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
                const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
                return { from: mockFrom };
            } else if (callCount === 2) {
                // Second call: fetch message sender_id
                const mockWhere = vi.fn().mockResolvedValue([{ senderId: "user-456" }]);
                const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
                return { from: mockFrom };
            } else {
                // Third call: fetch sender profile
                const mockWhere = vi.fn().mockResolvedValue([mockSenderProfile]);
                const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
                return { from: mockFrom };
            }
        });

        const request = new NextRequest("http://localhost/api/notifications");

        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(Array.isArray(data)).toBe(true);
        expect(data.length).toBe(1);
        expect(data[0].type).toBe("message");
        expect(data[0].sender).toBeDefined();
        expect(data[0].sender?.full_name).toBe("John Doe");
        expect(data[0].content).toBe("Hello there!");
    });

    it("should only return unread notifications", async () => {
        mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null });

        const mockLimit = vi.fn().mockResolvedValue([]);
        const mockOrderBy = vi.fn().mockReturnValue({ limit: mockLimit });
        const mockWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
        const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
        mockDb.select.mockReturnValue({ from: mockFrom });

        const request = new NextRequest("http://localhost/api/notifications");

        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(Array.isArray(data)).toBe(true);
        expect(data.length).toBe(0);
    });

    it("should handle errors when fetching notifications", async () => {
        mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null });

        const mockLimit = vi.fn().mockRejectedValue(new Error("Database error"));
        const mockOrderBy = vi.fn().mockReturnValue({ limit: mockLimit });
        const mockWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
        const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
        mockDb.select.mockReturnValue({ from: mockFrom });

        const request = new NextRequest("http://localhost/api/notifications");

        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(500);
        expect(data.error).toBe("Database error");
    });
});
