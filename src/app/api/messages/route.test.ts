import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "./route";

const { mockGetUser, mockDb } = vi.hoisted(() => ({
    mockGetUser: vi.fn(),
    mockDb: {
        select: vi.fn(),
        insert: vi.fn(),
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

vi.mock("@/utils/send-message-notification-email", () => ({
    sendMessageNotificationEmail: vi.fn().mockResolvedValue(true),
}));

describe("POST /api/messages", () => {
    const mockUser = { id: "user-123", email: "test@example.com" };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("should return 401 if user is not authenticated", async () => {
        mockGetUser.mockResolvedValue({ data: { user: null }, error: { message: "Not authenticated" } });

        const request = new NextRequest("http://localhost/api/messages", {
            method: "POST",
            body: JSON.stringify({ recipient_id: "user-456", content: "Hello" }),
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(401);
        expect(data.error).toBe("Unauthorized");
    });

    it("should return 400 if recipient_id is missing", async () => {
        mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null });

        const request = new NextRequest("http://localhost/api/messages", {
            method: "POST",
            body: JSON.stringify({ content: "Hello" }),
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toBe("recipient_id is required");
    });

    it("should return 400 if content is missing or empty", async () => {
        mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null });

        const request = new NextRequest("http://localhost/api/messages", {
            method: "POST",
            body: JSON.stringify({ recipient_id: "user-456", content: "" }),
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toBe("content is required and cannot be empty");
    });

    it("should return 400 if trying to send message to self", async () => {
        mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null });

        const request = new NextRequest("http://localhost/api/messages", {
            method: "POST",
            body: JSON.stringify({ recipient_id: "user-123", content: "Hello" }),
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toBe("Cannot send message to yourself");
    });

    it("should return 404 if recipient does not exist", async () => {
        mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null });

        // select for recipient check returns empty array
        const mockWhere = vi.fn().mockResolvedValue([]);
        const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
        mockDb.select.mockReturnValue({ from: mockFrom });

        const request = new NextRequest("http://localhost/api/messages", {
            method: "POST",
            body: JSON.stringify({ recipient_id: "user-456", content: "Hello" }),
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(404);
        expect(data.error).toBe("Recipient not found");
    });

    it("should send message successfully", async () => {
        mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null });

        const mockMessage = {
            id: "msg-123",
            senderId: "user-123",
            recipientId: "user-456",
            content: "Hello",
            createdAt: new Date().toISOString(),
            readAt: null,
        };

        // select for recipient check
        const mockSelectWhere = vi.fn().mockResolvedValue([{ id: "user-456" }]);
        const mockSelectFrom = vi.fn().mockReturnValue({ where: mockSelectWhere });
        mockDb.select.mockReturnValue({ from: mockSelectFrom });

        // insert returning message
        const mockReturning = vi.fn().mockResolvedValue([mockMessage]);
        const mockValues = vi.fn().mockReturnValue({ returning: mockReturning });
        mockDb.insert.mockReturnValue({ values: mockValues });

        const request = new NextRequest("http://localhost/api/messages", {
            method: "POST",
            body: JSON.stringify({ recipient_id: "user-456", content: "Hello" }),
        });

        const response = await POST(request);
        const data = await response.json();

        expect(response.status).toBe(201);
        expect(data.id).toBe("msg-123");
        expect(data.content).toBe("Hello");
        expect(mockValues).toHaveBeenCalledWith(
            expect.objectContaining({
                senderId: "user-123",
                recipientId: "user-456",
                content: "Hello",
            }),
        );
    });
});

describe("GET /api/messages", () => {
    const mockUser = { id: "user-123", email: "test@example.com" };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("should return 401 if user is not authenticated", async () => {
        mockGetUser.mockResolvedValue({ data: { user: null }, error: { message: "Not authenticated" } });

        const request = new NextRequest("http://localhost/api/messages?user_id=user-456");

        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(401);
        expect(data.error).toBe("Unauthorized");
    });

    it("should return 400 if user_id is missing", async () => {
        mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null });

        const request = new NextRequest("http://localhost/api/messages");

        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(400);
        expect(data.error).toBe("user_id query parameter is required");
    });

    it("should fetch messages successfully", async () => {
        mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null });

        const mockMessages = [
            {
                id: "msg-1",
                sender_id: "user-123",
                recipient_id: "user-456",
                content: "Hello",
                created_at: new Date().toISOString(),
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

        // select messages
        const mockOrderBy = vi.fn().mockResolvedValue(mockMessages);
        const mockWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
        const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
        mockDb.select.mockReturnValue({ from: mockFrom });

        // update to mark as read (msg-2 is unread and sent to user-123)
        const mockUpdateWhere = vi.fn().mockResolvedValue([]);
        const mockSet = vi.fn().mockReturnValue({ where: mockUpdateWhere });
        mockDb.update.mockReturnValue({ set: mockSet });

        const request = new NextRequest("http://localhost/api/messages?user_id=user-456");

        const response = await GET(request);
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(Array.isArray(data)).toBe(true);
        expect(data.length).toBe(2);
    });
});
