import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const { mockFetchArticlesForNewsletter, mockGenerateEmailContentFromArticles, mockGenerateNewsletterHTML, mockSendEmail } = vi.hoisted(() => ({
    mockFetchArticlesForNewsletter: vi.fn(),
    mockGenerateEmailContentFromArticles: vi.fn(),
    mockGenerateNewsletterHTML: vi.fn(),
    mockSendEmail: vi.fn(),
}));

vi.mock("@/lib/news/newsletter-utils", () => ({
    fetchArticlesForNewsletter: mockFetchArticlesForNewsletter,
    generateEmailContentFromArticles: mockGenerateEmailContentFromArticles,
}));

vi.mock("@/lib/news/email-template", () => ({
    generateNewsletterHTML: mockGenerateNewsletterHTML,
}));

vi.mock("@/lib/news/newsletter-service", () => ({
    EmailService: vi.fn().mockImplementation(function () {
        return { sendEmail: mockSendEmail };
    }),
}));

function makePost(body: Record<string, unknown>) {
    return new NextRequest("http://localhost/api/news/send-preview", {
        method: "POST",
        body: JSON.stringify(body),
    });
}

describe("POST /api/news/send-preview — validation", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("returns 400 when interests is missing", async () => {
        const res = await POST(makePost({ email: "user@example.com" }));
        expect(res.status).toBe(400);
    });

    it("returns 400 when interests is blank", async () => {
        const res = await POST(makePost({ interests: "   ", email: "user@example.com" }));
        expect(res.status).toBe(400);
    });

    it("returns 400 when email is missing", async () => {
        const res = await POST(makePost({ interests: "multifamily" }));
        expect(res.status).toBe(400);
    });
});

describe("POST /api/news/send-preview — happy path", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockFetchArticlesForNewsletter.mockResolvedValue({
            nationalArticles: [{ id: "a1", title: "Deal" }],
            localArticles: [],
        });
        mockGenerateEmailContentFromArticles.mockReturnValue("<p>Content</p>");
        mockGenerateNewsletterHTML.mockReturnValue("<html>Newsletter</html>");
    });

    it("returns 200 success after sending email", async () => {
        mockSendEmail.mockResolvedValue(true);

        const res = await POST(makePost({ interests: "multifamily", email: "alice@example.com" }));
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.success).toBe(true);
        expect(mockSendEmail).toHaveBeenCalledWith(
            "alice@example.com",
            expect.objectContaining({ html: "<html>Newsletter</html>" }),
            undefined,
            expect.any(String),
        );
    });

    it("returns 500 when no articles found", async () => {
        mockFetchArticlesForNewsletter.mockResolvedValue({ nationalArticles: [], localArticles: [] });

        const res = await POST(makePost({ interests: "obscure topic", email: "alice@example.com" }));
        expect(res.status).toBe(500);
    });

    it("returns 500 when email send fails", async () => {
        mockSendEmail.mockResolvedValue(false);

        const res = await POST(makePost({ interests: "multifamily", email: "alice@example.com" }));
        expect(res.status).toBe(500);
    });
});
