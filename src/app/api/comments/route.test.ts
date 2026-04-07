import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DELETE, GET, POST } from "./route";

const { mockGetUser, mockDbSelect, mockDbInsert, mockDbDelete, mockParseMentions, mockSendMentionNotificationEmail } = vi.hoisted(() => ({
    mockGetUser: vi.fn(),
    mockDbSelect: vi.fn(),
    mockDbInsert: vi.fn(),
    mockDbDelete: vi.fn(),
    mockParseMentions: vi.fn(),
    mockSendMentionNotificationEmail: vi.fn().mockResolvedValue(true),
}));

vi.mock("@/utils/supabase/server", () => ({
    createClient: vi.fn().mockResolvedValue({
        auth: { getUser: mockGetUser },
    }),
}));

vi.mock("@/db", () => ({
    db: {
        select: mockDbSelect,
        insert: mockDbInsert,
        delete: mockDbDelete,
    },
}));

vi.mock("@/utils/parse-mentions", () => ({
    parseMentions: mockParseMentions,
}));

vi.mock("@/utils/send-mention-notification-email", () => ({
    sendMentionNotificationEmail: mockSendMentionNotificationEmail,
}));

const mockUser = { id: "user-123", email: "test@example.com" };

function makeRequest(body: Record<string, unknown>) {
    return new NextRequest("http://localhost/api/comments", {
        method: "POST",
        body: JSON.stringify(body),
    });
}

function authAs(user = mockUser) {
    mockGetUser.mockResolvedValue({ data: { user }, error: null });
}

function noAuth() {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: { message: "Not authenticated" } });
}

describe("POST /api/comments", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockParseMentions.mockReturnValue([]);
    });

    it("returns 401 if user is not authenticated", async () => {
        noAuth();
        const res = await POST(makeRequest({ post_id: "post-123", content: "Great post!" }));
        expect(res.status).toBe(401);
    });

    it("returns 400 if post_id is missing", async () => {
        authAs();
        const res = await POST(makeRequest({ content: "Great post!" }));
        expect(res.status).toBe(400);
        expect((await res.json()).error).toBe("post_id is required");
    });

    it("returns 400 if content is missing", async () => {
        authAs();
        const res = await POST(makeRequest({ post_id: "post-123" }));
        expect(res.status).toBe(400);
        expect((await res.json()).error).toBe("content is required and cannot be empty");
    });

    it("returns 400 if content is empty string", async () => {
        authAs();
        const res = await POST(makeRequest({ post_id: "post-123", content: "   " }));
        expect(res.status).toBe(400);
    });

    it("returns 404 if post does not exist", async () => {
        authAs();
        const mockWhere = vi.fn().mockResolvedValue([]);
        const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
        mockDbSelect.mockReturnValue({ from: mockFrom });

        const res = await POST(makeRequest({ post_id: "post-123", content: "Great post!" }));
        expect(res.status).toBe(404);
        expect((await res.json()).error).toBe("Post not found");
    });

    it("creates comment successfully without mentions", async () => {
        authAs();
        const mockComment = { id: "comment-123", postId: "post-123", userId: "user-123", content: "Great post!", createdAt: "now", updatedAt: "now" };

        let selectCallCount = 0;
        mockDbSelect.mockImplementation(() => {
            selectCallCount++;
            if (selectCallCount === 1) {
                const mockWhere = vi.fn().mockResolvedValue([{ id: "post-123" }]);
                return { from: vi.fn().mockReturnValue({ where: mockWhere }) };
            }
            return { from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }) };
        });

        const mockReturning = vi.fn().mockResolvedValue([mockComment]);
        const mockValues = vi.fn().mockReturnValue({ returning: mockReturning });
        mockDbInsert.mockReturnValue({ values: mockValues });

        const res = await POST(makeRequest({ post_id: "post-123", content: "Great post!" }));
        const data = await res.json();

        expect(res.status).toBe(201);
        expect(data.id).toBe("comment-123");
        expect(data.content).toBe("Great post!");
        expect(mockValues).toHaveBeenCalledWith(expect.objectContaining({ postId: "post-123", userId: "user-123", content: "Great post!" }));
    });

    it("creates comment with mentions and sends emails", async () => {
        authAs();
        mockParseMentions.mockReturnValue(["John Smith", "Jane Doe"]);

        const mockComment = {
            id: "comment-123",
            postId: "post-123",
            userId: "user-123",
            content: "Great post @John Smith @Jane Doe!",
            createdAt: "now",
            updatedAt: "now",
        };

        let selectCallCount = 0;
        mockDbSelect.mockImplementation(() => {
            selectCallCount++;
            if (selectCallCount === 1) {
                const mockWhere = vi.fn().mockResolvedValue([{ id: "post-123" }]);
                return { from: vi.fn().mockReturnValue({ where: mockWhere }) };
            }
            // profiles lookup
            const mockWhere = vi.fn().mockResolvedValue([
                { id: "user-456", fullName: "John Smith" },
                { id: "user-789", fullName: "Jane Doe" },
            ]);
            return { from: vi.fn().mockReturnValue({ where: mockWhere }) };
        });

        const mockReturning = vi.fn().mockResolvedValue([mockComment]);
        const mockValues = vi.fn().mockReturnValue({ returning: mockReturning });
        mockDbInsert.mockReturnValue({ values: mockValues });

        const res = await POST(makeRequest({ post_id: "post-123", content: "Great post @John Smith @Jane Doe!" }));
        const data = await res.json();

        expect(res.status).toBe(201);
        expect(mockSendMentionNotificationEmail).toHaveBeenCalledTimes(2);
        expect(mockSendMentionNotificationEmail).toHaveBeenCalledWith("comment-123", "user-456", "post-123");
        expect(mockSendMentionNotificationEmail).toHaveBeenCalledWith("comment-123", "user-789", "post-123");
    });

    it("does not send email to comment author when they mention themselves", async () => {
        authAs();
        mockParseMentions.mockReturnValue(["Test User"]);

        const mockComment = {
            id: "comment-123",
            postId: "post-123",
            userId: "user-123",
            content: "Great post @Test User!",
            createdAt: "now",
            updatedAt: "now",
        };

        let selectCallCount = 0;
        mockDbSelect.mockImplementation(() => {
            selectCallCount++;
            if (selectCallCount === 1) {
                const mockWhere = vi.fn().mockResolvedValue([{ id: "post-123" }]);
                return { from: vi.fn().mockReturnValue({ where: mockWhere }) };
            }
            const mockWhere = vi.fn().mockResolvedValue([{ id: "user-123", fullName: "Test User" }]);
            return { from: vi.fn().mockReturnValue({ where: mockWhere }) };
        });

        const mockReturning = vi.fn().mockResolvedValue([mockComment]);
        const mockValues = vi.fn().mockReturnValue({ returning: mockReturning });
        mockDbInsert.mockReturnValue({ values: mockValues });

        const res = await POST(makeRequest({ post_id: "post-123", content: "Great post @Test User!" }));

        expect(res.status).toBe(201);
        expect(mockSendMentionNotificationEmail).not.toHaveBeenCalled();
    });

    it("returns 500 if comment insertion fails", async () => {
        authAs();
        const mockWhere = vi.fn().mockResolvedValue([{ id: "post-123" }]);
        const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
        mockDbSelect.mockReturnValue({ from: mockFrom });

        const mockReturning = vi.fn().mockResolvedValue([]);
        const mockValues = vi.fn().mockReturnValue({ returning: mockReturning });
        mockDbInsert.mockReturnValue({ values: mockValues });

        const res = await POST(makeRequest({ post_id: "post-123", content: "Great post!" }));
        expect(res.status).toBe(500);
        expect((await res.json()).error).toBe("Failed to create comment");
    });
});

// ─── GET ──────────────────────────────────────────────────────────────────────

describe("GET /api/comments", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("returns 400 if post_id is missing", async () => {
        const req = new NextRequest("http://localhost/api/comments");
        const res = await GET(req);
        expect(res.status).toBe(400);
    });

    it("returns comments for a post", async () => {
        const mockOrderBy = vi
            .fn()
            .mockResolvedValue([{ id: "comment-1", content: "Great!", createdAt: "now", userId: "user-1", profile: { fullName: "Alice", avatarUrl: null } }]);
        const mockWhere = vi.fn().mockReturnValue({ orderBy: mockOrderBy });
        const mockLeftJoin = vi.fn().mockReturnValue({ where: mockWhere });
        const mockFrom = vi.fn().mockReturnValue({ leftJoin: mockLeftJoin });
        mockDbSelect.mockReturnValue({ from: mockFrom });

        const req = new NextRequest("http://localhost/api/comments?post_id=post-123");
        const res = await GET(req);
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(Array.isArray(body)).toBe(true);
        expect(body[0].id).toBe("comment-1");
    });
});

// ─── DELETE ───────────────────────────────────────────────────────────────────

describe("DELETE /api/comments", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("returns 401 if not authenticated", async () => {
        mockGetUser.mockResolvedValue({ data: { user: null }, error: { message: "Not authenticated" } });
        const req = new NextRequest("http://localhost/api/comments?id=comment-1", { method: "DELETE" });
        const res = await DELETE(req);
        expect(res.status).toBe(401);
    });

    it("returns 400 if id is missing", async () => {
        mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
        const req = new NextRequest("http://localhost/api/comments", { method: "DELETE" });
        const res = await DELETE(req);
        expect(res.status).toBe(400);
    });

    it("deletes comment and returns success", async () => {
        mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });

        const mockReturning = vi.fn().mockResolvedValue([{ id: "comment-1" }]);
        const mockWhere = vi.fn().mockReturnValue({ returning: mockReturning });
        mockDbDelete.mockReturnValue({ where: mockWhere });

        const req = new NextRequest("http://localhost/api/comments?id=comment-1", { method: "DELETE" });
        const res = await DELETE(req);
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.success).toBe(true);
    });

    it("returns 404 when comment not found or unauthorized", async () => {
        mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });

        const mockReturning = vi.fn().mockResolvedValue([]);
        const mockWhere = vi.fn().mockReturnValue({ returning: mockReturning });
        mockDbDelete.mockReturnValue({ where: mockWhere });

        const req = new NextRequest("http://localhost/api/comments?id=nonexistent", { method: "DELETE" });
        const res = await DELETE(req);
        expect(res.status).toBe(404);
    });
});
