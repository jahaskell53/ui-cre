import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const { mockGetUser, mockDb } = vi.hoisted(() => ({
    mockGetUser: vi.fn(),
    mockDb: {
        update: vi.fn(),
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

describe("POST /api/notifications/[id]/read", () => {
    const mockUser = { id: "user-123", email: "test@example.com" };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("should return 401 if user is not authenticated", async () => {
        mockGetUser.mockResolvedValue({ data: { user: null }, error: { message: "Not authenticated" } });

        const request = new NextRequest("http://localhost/api/notifications/notif-123/read", {
            method: "POST",
        });

        const response = await POST(request, { params: Promise.resolve({ id: "notif-123" }) });
        const data = await response.json();

        expect(response.status).toBe(401);
        expect(data.error).toBe("Unauthorized");
    });

    it("should mark notification as read", async () => {
        mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null });

        const mockWhere = vi.fn().mockResolvedValue([]);
        const mockSet = vi.fn().mockReturnValue({ where: mockWhere });
        mockDb.update.mockReturnValue({ set: mockSet });

        const request = new NextRequest("http://localhost/api/notifications/notif-123/read", {
            method: "POST",
        });

        const response = await POST(request, { params: Promise.resolve({ id: "notif-123" }) });
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(mockDb.update).toHaveBeenCalled();
        expect(mockSet).toHaveBeenCalledWith(expect.objectContaining({ readAt: expect.any(String) }));
    });

    it("should handle errors when marking notification as read", async () => {
        mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null });

        const mockWhere = vi.fn().mockRejectedValue(new Error("Database error"));
        const mockSet = vi.fn().mockReturnValue({ where: mockWhere });
        mockDb.update.mockReturnValue({ set: mockSet });

        const request = new NextRequest("http://localhost/api/notifications/notif-123/read", {
            method: "POST",
        });

        const response = await POST(request, { params: Promise.resolve({ id: "notif-123" }) });
        const data = await response.json();

        expect(response.status).toBe(500);
        expect(data.error).toBe("Failed to mark notification as read");
    });
});
