import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { sendMessageNotificationEmail } from "@/utils/send-message-notification-email";
import { POST } from "./route";

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

vi.mock("@/utils/send-message-notification-email", () => ({
    sendMessageNotificationEmail: vi.fn(),
}));

describe("POST /api/notifications/send-email", () => {
    const mockUser = { id: "user-123", email: "test@example.com" };

    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(sendMessageNotificationEmail).mockResolvedValue(true);
    });

    it("should return 401 if user is not authenticated", async () => {
        mockGetUser.mockResolvedValue({ data: { user: null }, error: { message: "Not authenticated" } });

        const request = new NextRequest("http://localhost/api/notifications/send-email", {
            method: "POST",
            body: JSON.stringify({ message_id: "msg-123" }),
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(401);
        expect(data.error).toBe("Unauthorized");
    });

    it("should return 400 if neither notification_id nor message_id is provided", async () => {
        mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null });

        const request = new NextRequest("http://localhost/api/notifications/send-email", {
            method: "POST",
            body: JSON.stringify({}),
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toBe("notification_id or message_id is required");
    });

    it("should send email for message_id", async () => {
        mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null });

        const request = new NextRequest("http://localhost/api/notifications/send-email", {
            method: "POST",
            body: JSON.stringify({ message_id: "msg-123" }),
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(sendMessageNotificationEmail).toHaveBeenCalledWith("msg-123");
    });

    it("should send email for notification_id", async () => {
        mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null });

        const mockWhere = vi.fn().mockResolvedValue([{ relatedId: "msg-456" }]);
        const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
        mockDb.select.mockReturnValue({ from: mockFrom });

        const request = new NextRequest("http://localhost/api/notifications/send-email", {
            method: "POST",
            body: JSON.stringify({ notification_id: "notif-123" }),
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.success).toBe(true);
        expect(sendMessageNotificationEmail).toHaveBeenCalledWith("msg-456");
    });

    it("should return 404 if notification not found", async () => {
        mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null });

        const mockWhere = vi.fn().mockResolvedValue([]);
        const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
        mockDb.select.mockReturnValue({ from: mockFrom });

        const request = new NextRequest("http://localhost/api/notifications/send-email", {
            method: "POST",
            body: JSON.stringify({ notification_id: "notif-123" }),
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(404);
        expect(data.error).toBe("Notification not found");
    });

    it("should return 400 if notification has no related message", async () => {
        mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null });

        const mockWhere = vi.fn().mockResolvedValue([{ relatedId: null }]);
        const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
        mockDb.select.mockReturnValue({ from: mockFrom });

        const request = new NextRequest("http://localhost/api/notifications/send-email", {
            method: "POST",
            body: JSON.stringify({ notification_id: "notif-123" }),
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toBe("Notification has no related message");
    });

    it("should return 500 if email sending fails", async () => {
        mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null });

        vi.mocked(sendMessageNotificationEmail).mockResolvedValue(false);

        const request = new NextRequest("http://localhost/api/notifications/send-email", {
            method: "POST",
            body: JSON.stringify({ message_id: "msg-123" }),
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(500);
        expect(data.error).toBe("Failed to send email");
    });
});
