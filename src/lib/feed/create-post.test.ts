import { describe, expect, it, vi } from "vitest";
import {
    canSubmitFeedPost,
    getAttachmentDisplayName,
    getFeedInitials,
    getFeedPostContent,
    isImageAttachment,
    resolvePostAuthorId,
    uploadPostAttachment,
} from "./create-post";

describe("feed create-post helpers", () => {
    it("derives initials from the author name", () => {
        expect(getFeedInitials("Open Midmarket")).toBe("OM");
        expect(getFeedInitials("")).toBe("U");
        expect(getFeedInitials(null, "AU")).toBe("AU");
    });

    it("validates and trims post content by post type", () => {
        expect(canSubmitFeedPost("post", "  hello  ", "")).toBe(true);
        expect(canSubmitFeedPost("post", "   ", "")).toBe(false);
        expect(canSubmitFeedPost("link", "", " https://example.com ")).toBe(true);
        expect(getFeedPostContent("post", "  hello  ", "")).toBe("hello");
        expect(getFeedPostContent("link", "", " https://example.com ")).toBe("https://example.com");
    });

    it("detects image attachments and extracts file names", () => {
        expect(isImageAttachment("https://cdn.test/file-photo.webp?size=large")).toBe(true);
        expect(isImageAttachment("https://cdn.test/file-brochure.pdf")).toBe(false);
        expect(getAttachmentDisplayName("https://cdn.test/123-brochure%20v2.pdf")).toBe("brochure v2.pdf");
    });

    it("resolves the posting user and falls back when the system account is missing", async () => {
        await expect(
            resolvePostAuthorId({
                isAdmin: true,
                postAsSystem: true,
                userId: "user-1",
                lookupSystemProfileId: async () => "system-1",
            }),
        ).resolves.toEqual({ userIdToUse: "system-1", fellBackToUser: false });

        await expect(
            resolvePostAuthorId({
                isAdmin: true,
                postAsSystem: true,
                userId: "user-1",
                lookupSystemProfileId: async () => null,
            }),
        ).resolves.toEqual({ userIdToUse: "user-1", fellBackToUser: true });
    });

    it("normalizes attachment upload success and failure responses", async () => {
        const file = new File(["hello"], "hello.txt", { type: "text/plain" });
        const okUpload = vi.fn().mockResolvedValue(
            new Response(JSON.stringify({ url: "https://cdn.test/hello.txt" }), {
                status: 200,
                headers: { "Content-Type": "application/json" },
            }),
        );
        const failedUpload = vi.fn().mockResolvedValue(
            new Response(JSON.stringify({ error: "bad file" }), {
                status: 400,
                headers: { "Content-Type": "application/json" },
            }),
        );

        await expect(uploadPostAttachment(file, okUpload)).resolves.toEqual({
            url: "https://cdn.test/hello.txt",
            error: null,
        });
        await expect(uploadPostAttachment(file, failedUpload)).resolves.toEqual({
            url: null,
            error: "bad file",
        });
    });
});
